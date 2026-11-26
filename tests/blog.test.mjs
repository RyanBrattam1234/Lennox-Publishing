import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleBlogRequest,passwordHash,SESSION_COOKIE} from '../server/blog-service.mjs';
import {renderMarkdown} from '../frontend/blog-format.mjs';

function sqliteBinding(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  function prepare(sql){let args=[];const statement=sqlite.prepare(sql);return{bind(...values){args=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;},async first(){return statement.get(...args)||null;},async all(){return{results:statement.all(...args)};},async run(){return{meta:{changes:Number(statement.run(...args).changes)}};}};}
  return{sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
async function setup(){
  const DB=sqliteBinding(),salt='0123456789abcdef0123456789abcdef';
  const env={DB,BLOG_AUTH_SECRET:'test-secret-only-not-a-production-key',BLOG_BOOTSTRAP_USERNAME:'editor',BLOG_BOOTSTRAP_SALT:salt,BLOG_BOOTSTRAP_HASH:await passwordHash('Test-only-password-12345',salt)};
  let cookie='';
  const request=async(path,method='GET',body,opts={})=>{
    const headers={cookie,...(method!=='GET'?{origin:'https://lennox-publishing.netlify.app'}:{}),...opts.headers};
    let payload=body;if(body!==undefined&&!(body instanceof Uint8Array)){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
    const response=await handleBlogRequest(new Request('https://lennox-publishing.netlify.app'+path,{method,headers,body:payload}),env);
    if(opts.rememberCookie&&response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const login=()=>request('/api/auth/login','POST',{username:'editor',password:'Test-only-password-12345'},{rememberCookie:true});
  return{DB,env,request,login,get cookie(){return cookie;}};
}
test('Authentication, real SQLite persistence, drafts, publication, images and revocation',async t=>{
  const c=await setup();t.after(()=>c.DB.sqlite.close());
  assert.equal((await c.request('/api/admin/posts')).status,401);
  assert.equal((await c.request('/api/admin/posts','POST',{}, {headers:{origin:'https://attacker.example'}})).status,403);
  const signedIn=await c.login();assert.equal(signedIn.status,200);assert.match(signedIn.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.match(c.cookie,new RegExp('^'+SESSION_COOKIE+'='));
  assert.equal(c.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM blog_users').get().n,1);
  assert.notEqual(c.DB.sqlite.prepare('SELECT token_hash FROM blog_sessions').get().token_hash,c.cookie.split('=')[1]);
  const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1eEAAAAASUVORK5CYII=','base64'));
  const upload=await c.request('/api/admin/images','POST',image,{headers:{'Content-Type':'image/png'}});assert.equal(upload.status,201);const imageId=(await upload.json()).id;
  assert.equal((await c.request('/api/blog/images/'+imageId)).status,404);
  assert.equal((await c.request('/api/admin/images/'+imageId)).status,200);
  assert.equal((await c.request('/api/admin/images','POST',new TextEncoder().encode('<svg onload="alert(1)"></svg>'),{headers:{'Content-Type':'image/svg+xml'}})).status,415);
  const input={title:'Ein neuer Anfang <script>',excerpt:'Ein kurzer Einblick.',body:'## Hallo\n\n**Welt** <script>alert(1)</script>\n\n[Link](javascript:alert(1))',status:'draft',coverImageId:imageId};
  let response=await c.request('/api/admin/posts','POST',input);assert.equal(response.status,201);let post=(await response.json()).post;
  assert.equal((await (await c.request('/api/blog/posts')).json()).total,0);assert.equal((await c.request('/blog/'+post.slug)).status,404);
  response=await c.request('/api/admin/posts/'+post.id,'PUT',{...input,status:'published',updatedAt:post.updatedAt});assert.equal(response.status,200);const previous=post;post=(await response.json()).post;
  const feed=await(await c.request('/api/blog/posts')).json();assert.equal(feed.total,1);assert.equal(feed.posts[0].body,undefined);
  const page=await c.request('/blog/'+post.slug);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('<strong>Welt</strong>'));
  assert.deepEqual(new Uint8Array(await(await c.request('/api/blog/images/'+imageId)).arrayBuffer()),image);
  assert.equal((await c.request('/api/admin/posts/'+post.id,'PUT',{...input,updatedAt:previous.updatedAt})).status,409);
  response=await c.request('/api/admin/posts/'+post.id,'PUT',{...input,updatedAt:post.updatedAt});assert.equal(response.status,200);
  assert.equal((await c.request('/blog/'+post.slug)).status,404);assert.equal((await c.request('/api/blog/images/'+imageId)).status,404);
  assert.equal((await c.request('/api/admin/posts/'+post.id,'DELETE',{})).status,200);
  assert.equal(c.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM blog_images').get().n,0);
  assert.equal((await c.request('/api/admin/posts')).status,200);
  assert.equal((await c.request('/api/auth/logout','POST',{})).status,200);assert.equal((await c.request('/api/admin/posts')).status,401);
});
test('Rate limits, changed password, expired sessions and no registration',async t=>{
  const c=await setup();t.after(()=>c.DB.sqlite.close());
  for(let i=0;i<5;i++)assert.equal((await c.request('/api/auth/login','POST',{username:'editor',password:'wrong'})).status,401);
  assert.equal((await c.login()).status,429);c.DB.sqlite.exec('DELETE FROM blog_login_attempts');assert.equal((await c.login()).status,200);
  assert.equal((await c.request('/api/admin/password','PUT',{currentPassword:'wrong',password:'A-new-test-password-12345'})).status,400);
  assert.equal((await c.request('/api/admin/password','PUT',{currentPassword:'Test-only-password-12345',password:'A-new-test-password-12345'})).status,200);
  assert.equal((await c.request('/api/admin/posts')).status,401);assert.equal((await c.login()).status,401);
  assert.equal((await c.request('/api/auth/login','POST',{username:'editor',password:'A-new-test-password-12345'},{rememberCookie:true})).status,200);
  c.DB.sqlite.exec('UPDATE blog_sessions SET expires_at=0');assert.equal((await c.request('/api/admin/posts')).status,401);
  assert.equal((await c.request('/api/auth/register','POST',{})).status,404);
});
test('Formatting never accepts executable HTML or unsafe links',()=>{
  const html=renderMarkdown('# <img src=x onerror=alert(1)>\n\n[Bad](javascript:evil) [Good](https://example.com/?x=1&y=2)\n\n- **Fett**\n- `Code`');
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript'));assert.ok(html.includes('href="https://example.com/?x=1&amp;y=2"'));assert.ok(html.includes('<li><strong>Fett</strong></li>'));
});

test('Owner can change books and revoke editor sessions, editor cannot administer', async t => {
  const c=await setup();t.after(()=>c.DB.sqlite.close());
  assert.equal((await c.request('/api/owner/account')).status,401);
  await c.login();
  const editorCookie=c.cookie;
  assert.equal((await c.request('/api/owner/editor-password','PUT',{password:'new-editor-password'})).status,403);
  c.env.OWNER_BOOTSTRAP_SALT=c.env.BLOG_BOOTSTRAP_SALT;
  c.env.OWNER_BOOTSTRAP_HASH=await passwordHash('owner-test-password',c.env.OWNER_BOOTSTRAP_SALT);
  await c.request('/api/auth/login','POST',{username:'ryan',password:'owner-test-password'},{rememberCookie:true});
  assert.equal((await c.request('/api/owner/account')).status,200);
  const path='/api/owner/books/maggie';
  assert.equal((await c.request(path,'PUT',{status:'Vorschau',subtitle:'Untertitel',description:'Beschreibung'})).status,200);
  const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1eEAAAAASUVORK5CYII=','base64'));
  assert.equal((await c.request(path+'/cover','PUT',image)).status,200);
  const b=(await (await c.request('/api/books')).json()).books.find(b=>b.id==='maggie');
  assert.equal(b.status,'Vorschau');assert.deepEqual(new Uint8Array(await (await c.request(b.cover)).arrayBuffer()),image);
  assert.equal((await c.request(path+'/cover','DELETE')).status,200);
  assert.equal((await c.request('/api/owner/editor-password','PUT',{password:'new-editor-password'})).status,200);
  assert.equal((await c.request('/api/admin/posts','GET',undefined,{headers:{cookie:editorCookie}})).status,401);
  assert.equal((await c.login()).status,401);
});
