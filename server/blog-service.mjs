import { escapeHtml as esc, renderMarkdown, formatDate } from '../frontend/blog-format.mjs';

export const SESSION_COOKIE = '__Host-lennox_blog_session';
export const PASSWORD_ITERATIONS = 100000;
const SESSION_SECONDS = 8 * 60 * 60, MAX_IMAGE = 900 * 1024;
const ORIGINS = new Set(['https://lennox-publishing.netlify.app', 'https://lennox-publishing-neugestaltung.cleanrowan2.chatgpt.site']);
const encoder = new TextEncoder();
const security = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN','Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'};
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), {status,headers:{...security,'Content-Type':'application/json; charset=utf-8','Vary':'Cookie',...headers}}); }
export const hex = bytes => [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2,'0')).join('');
const fromHex = text => Uint8Array.from(text.match(/.{2}/g) ?? [], v => parseInt(v,16));
export async function sha256(value) { return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value))); }
export async function passwordHash(password,salt,iterations=PASSWORD_ITERATIONS) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(salt),iterations},key,256));
}
function equal(a,b) {
  if(typeof a!=='string'||typeof b!=='string') return false;
  let diff=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}
const randomHex=size=>hex(crypto.getRandomValues(new Uint8Array(size)));
const cookie=(token,seconds=SESSION_SECONDS)=>`${SESSION_COOKIE}=${token}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
const first=(db,sql,...params)=>db.prepare(sql).bind(...params).first();
const run=(db,sql,...params)=>db.prepare(sql).bind(...params).run();
const all=async(db,sql,...params)=>(await db.prepare(sql).bind(...params).all()).results;
async function readBytes(request,limit) {
  if(Number(request.headers.get('content-length'))>limit) fail(413,'Die Datei oder Anfrage ist zu groß.');
  const reader=request.body?.getReader(); if(!reader) return new Uint8Array();
  let size=0; const chunks=[];
  while(true) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; if(size>limit){await reader.cancel();fail(413,'Die Datei oder Anfrage ist zu groß.');} chunks.push(value); }
  const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;} return bytes;
}
async function bodyJson(request,max=160000) {
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Bitte JSON senden.');
  try{const value=JSON.parse(new TextDecoder().decode(await readBytes(request,max)));if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Die Anfrage ist ungültig.');return value;}catch(error){if(error instanceof HttpError)throw error;fail(400,'Die Anfrage ist ungültig.');}
}
function checkOrigin(request) {
  if(!ORIGINS.has(request.headers.get('origin'))||request.headers.get('sec-fetch-site')==='cross-site') fail(403,'Diese Anfrage ist nicht erlaubt. Bitte lade die Website neu.');
}
async function sessionUser(request,db) {
  const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return first(db,'SELECT u.id,u.username,u.display_name FROM blog_sessions s JOIN blog_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',await sha256(token),Date.now());
}
async function requireUser(request,db){const user=await sessionUser(request,db);if(!user)fail(401,'Bitte melde dich im Blog Creator an.');return user;}
async function login(request,env) {
  const {username:rawUsername,password}=await bodyJson(request,4096);
  const username=typeof rawUsername==='string'?rawUsername.trim().toLowerCase():'';
  if(!username||username.length>80||typeof password!=='string'||password.length>256)fail(401,'Benutzername oder Passwort ist falsch.');
  if(!env.BLOG_AUTH_SECRET||!env.BLOG_BOOTSTRAP_HASH)fail(503,'Die Anmeldung wird gerade eingerichtet.');
  const db=env.DB,now=Date.now(),windowMs=15*60*1000;
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-nf-client-connection-ip')||'unknown';
  const keys=[await sha256(`${env.BLOG_AUTH_SECRET}:user:${username}`),await sha256(`${env.BLOG_AUTH_SECRET}:ip:${ip}`)],limits=[5,25];
  for(let i=0;i<keys.length;i++){const row=await first(db,'SELECT count,window_start FROM blog_login_attempts WHERE key=?',keys[i]);if(row&&row.window_start>now-windowMs&&row.count>=limits[i])fail(429,'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.');}
  await db.batch(keys.map(key=>db.prepare('INSERT INTO blog_login_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<=? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<=? THEN ? ELSE window_start END').bind(key,now,now-windowMs,now-windowMs,now)));
  let user=await first(db,'SELECT * FROM blog_users WHERE username=?',username);
  const noUsers=!user&&!(await first(db,'SELECT id FROM blog_users LIMIT 1'));
  const bootstrap=noUsers&&equal(username,env.BLOG_BOOTSTRAP_USERNAME);
  const salt=user?.password_salt||env.BLOG_BOOTSTRAP_SALT;
  const hash=await passwordHash(password,salt,user?.iterations||PASSWORD_ITERATIONS);
  if(!(user?equal(hash,user.password_hash):bootstrap&&equal(hash,env.BLOG_BOOTSTRAP_HASH)))fail(401,'Benutzername oder Passwort ist falsch.');
  if(!user){await run(db,'INSERT OR IGNORE INTO blog_users (id,username,password_hash,password_salt,iterations,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',crypto.randomUUID(),username,env.BLOG_BOOTSTRAP_HASH,salt,PASSWORD_ITERATIONS,'Lennox Publishing',now,now);user=await first(db,'SELECT * FROM blog_users WHERE username=?',username);}
  const token=randomHex(32);
  await db.batch([
    db.prepare('DELETE FROM blog_sessions WHERE expires_at<=?').bind(now),
    db.prepare('DELETE FROM blog_login_attempts WHERE window_start<=? OR key=?').bind(now-windowMs,keys[0]),
    db.prepare('DELETE FROM blog_images WHERE created_at<? AND id NOT IN (SELECT cover_image_id FROM blog_posts WHERE cover_image_id IS NOT NULL)').bind(now-86400000),
    db.prepare('INSERT INTO blog_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(await sha256(token),user.id,now,now+SESSION_SECONDS*1000),
  ]);
  return json({user:{username:user.username,displayName:user.display_name}},200,{'Set-Cookie':cookie(token)});
}
function validatePost(input) {
  if(!input||typeof input!=='object')fail(400,'Der Beitrag ist ungültig.');
  const clean={};
  for(const[key,max,required]of[['title',140,true],['excerpt',320,false],['body',50000,true]]){
    if(typeof input[key]!=='string'||input[key].length>max||(required&&!input[key].trim()))fail(400,`Bitte ${key==='title'?'einen Titel (maximal 140 Zeichen)':key==='body'?'einen Beitragstext (maximal 50.000 Zeichen)':'einen Kurztext mit maximal 320 Zeichen'} eingeben.`);
    clean[key]=input[key].trim();
  }
  if(!['draft','published'].includes(input.status))fail(400,'Der Beitragsstatus ist ungültig.');
  clean.status=input.status;clean.coverImageId=input.coverImageId||null;
  if(clean.coverImageId&&!/^[a-f0-9-]{36}$/.test(clean.coverImageId))fail(400,'Das Titelbild ist ungültig.');return clean;
}
const postData=row=>({id:row.id,slug:row.slug,title:row.title,excerpt:row.excerpt,body:row.body,status:row.status,authorName:row.author_name,coverImageId:row.cover_image_id,publishedAt:row.published_at,createdAt:row.created_at,updatedAt:row.updated_at});
function slugify(title){return title.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75)||'beitrag';}
async function savePost(request,db,user,id) {
  const input=await bodyJson(request),data=validatePost(input),now=Date.now();
  const existing=id?await first(db,'SELECT * FROM blog_posts WHERE id=? AND user_id=?',id,user.id):null;
  if(id&&!existing)fail(404,'Dieser Beitrag wurde nicht gefunden.');
  if(data.coverImageId&&!await first(db,'SELECT id FROM blog_images WHERE id=? AND user_id=?',data.coverImageId,user.id))fail(400,'Das Titelbild wurde nicht gefunden. Bitte lade es erneut hoch.');
  const publishedAt=data.status==='published'?existing?.published_at||now:existing?.published_at||null;
  if(existing){
    if(input.updatedAt!==existing.updated_at)fail(409,'Dieser Beitrag wurde inzwischen geändert. Bitte lade ihn erneut, bevor du speicherst.');
    const result=await run(db,'UPDATE blog_posts SET title=?,excerpt=?,body=?,status=?,cover_image_id=?,published_at=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=?',data.title,data.excerpt,data.body,data.status,data.coverImageId,publishedAt,Math.max(now,existing.updated_at+1),id,user.id,existing.updated_at);
    if(!result.meta.changes)fail(409,'Der Beitrag wurde inzwischen geändert. Bitte lade ihn erneut.');
  }else{id=crypto.randomUUID();await run(db,'INSERT INTO blog_posts (id,slug,title,excerpt,body,status,author_name,user_id,cover_image_id,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,`${slugify(data.title)}-${id.slice(0,8)}`,data.title,data.excerpt,data.body,data.status,user.display_name,user.id,data.coverImageId,publishedAt,now,now);}
  return json({post:postData(await first(db,'SELECT * FROM blog_posts WHERE id=?',id))},existing?200:201);
}
function imageMime(bytes) {
  if(bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return'image/png';
  if(bytes.length>=20&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'image/webp';return null;
}
async function uploadImage(request,db,user) {
  const bytes=await readBytes(request,MAX_IMAGE),mime=imageMime(bytes);if(!mime)fail(415,'Bitte ein JPG-, PNG- oder WebP-Bild hochladen (maximal 900 KB).');
  const usage=await first(db,'SELECT COALESCE(SUM(size),0) AS size FROM blog_images');if(usage.size+bytes.byteLength>200*1024*1024)fail(507,'Der Bildspeicher ist voll. Bitte entferne nicht mehr benötigte Beiträge und Bilder.');
  const id=crypto.randomUUID();await run(db,'INSERT INTO blog_images (id,mime,data,size,created_at,user_id) VALUES (?,?,?,?,?,?)',id,mime,bytes.buffer,bytes.byteLength,Date.now(),user.id);return json({id},201);
}
async function serveImage(db,id,user) {
  const row=user?await first(db,'SELECT mime,data FROM blog_images WHERE id=? AND user_id=?',id,user.id):await first(db,"SELECT i.mime,i.data FROM blog_images i WHERE i.id=? AND EXISTS (SELECT 1 FROM blog_posts p WHERE p.cover_image_id=i.id AND p.status='published')",id);
  if(!row)fail(404,'Bild nicht gefunden.');return new Response(row.data instanceof ArrayBuffer?row.data:new Uint8Array(row.data),{headers:{...security,'Content-Type':row.mime,'Content-Security-Policy':"default-src 'none'; sandbox"}});
}
async function publicPosts(db,url) {
  const page=Math.min(10000,Math.max(1,parseInt(url.searchParams.get('page')||'1',10)||1));
  const rows=await all(db,"SELECT id,slug,title,excerpt,cover_image_id,published_at,author_name FROM blog_posts WHERE status='published' ORDER BY published_at DESC,id DESC LIMIT 12 OFFSET ?",(page-1)*12);
  const {total}=await first(db,"SELECT COUNT(*) AS total FROM blog_posts WHERE status='published'");return{posts:rows.map(postData),page,total,pages:Math.ceil(total/12)};
}
function shell(title,description,content,canonicalPath='/blog') {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101e2b"><title>${esc(title)} – Lennox Publishing</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="article"><link rel="canonical" href="https://lennox-publishing.netlify.app${esc(canonicalPath)}"><link rel="icon" href="/assets/favicon.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/blog.css"><link rel="stylesheet" href="/privacy.css"><script type="module" src="/privacy.js"></script></head><body><a class="skip-link" href="#inhalt">Zum Inhalt springen</a><header class="site-header"><div class="container header-inner"><a class="brand" href="/" aria-label="Lennox Publishing – Startseite"><span class="brand-mark" aria-hidden="true">LP<span>✦</span></span><span class="brand-name">Lennox Publishing<span>Galaxie Verlag</span></span></a><a class="text-link" href="/blog">Alle Beiträge</a></div></header><main id="inhalt" class="container blog-page">${content}</main><footer class="site-footer"><div class="container footer-bottom"><span>Lennox Publishing · Galaxie Verlag</span><div class="legal-paused"><a href="/">Startseite</a><a href="/datenschutz.html">Datenschutz (Entwurf)</a><button type="button" data-cookie-settings hidden>Cookie-Einstellungen</button><a href="/blog-creator/">Blog Creator</a></div></div></footer></body></html>`;
}
function htmlResponse(html,status=200){return new Response(html,{status,headers:{...security,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; font-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"}});}
export function postCard(post) {
  return `<article class="blog-card">${post.coverImageId?`<a href="/blog/${esc(post.slug)}" tabindex="-1" aria-hidden="true"><img src="/api/blog/images/${esc(post.coverImageId)}" alt="" loading="lazy" width="720" height="450"></a>`:'<div class="blog-card-placeholder" aria-hidden="true">Lennox<br><em>Journal.</em></div>'}<div class="blog-card-copy"><time datetime="${new Date(post.publishedAt).toISOString()}">${formatDate(post.publishedAt)}</time><h3><a href="/blog/${esc(post.slug)}">${esc(post.title)}</a></h3><p>${esc(post.excerpt||'Ein neuer Einblick in die Welt von Lennox Publishing.')}</p><a class="text-link" href="/blog/${esc(post.slug)}">Beitrag lesen</a></div></article>`;
}
async function blogPage(db,url) {
  const path=url.pathname.replace(/\/$/,'');
  if(path==='/blog'){
    const data=await publicPosts(db,url);
    return htmlResponse(shell('Blog','Neuigkeiten, Geschichten und Einblicke von Lennox Publishing.',`<div class="blog-page-heading"><p class="eyebrow">Aus der Schreibwerkstatt</p><h1>Geschichten hinter<br>den Geschichten.</h1><p>Neuigkeiten, Gedanken und Einblicke in die Welt von Lennox Publishing.</p></div>${data.posts.length?`<div class="blog-grid">${data.posts.map(postCard).join('')}</div>`:'<div class="blog-empty"><h2>Das erste Kapitel folgt.</h2><p>Hier erscheinen bald neue Beiträge. Schau gerne wieder vorbei.</p></div>'}<nav class="blog-pagination" aria-label="Blog-Seiten">${data.page>1?`<a class="button button-outline" href="/blog?page=${data.page-1}">Vorherige Seite</a>`:''}${data.page<data.pages?`<a class="button button-outline" href="/blog?page=${data.page+1}">Nächste Seite</a>`:''}</nav>`,data.page>1?`/blog?page=${data.page}`:'/blog'));
  }
  const slug=path.slice('/blog/'.length),row=await first(db,"SELECT * FROM blog_posts WHERE slug=? AND status='published'",slug);
  if(!row)return htmlResponse(shell('Beitrag nicht gefunden','Dieser Beitrag ist nicht verfügbar.','<div class="blog-empty"><h1>Dieser Beitrag ist nicht verfügbar.</h1><p>Er wurde möglicherweise noch nicht veröffentlicht.</p><a class="button button-gold" href="/blog">Zum Blog</a></div>'),404);
  const p=postData(row);
  return htmlResponse(shell(p.title,p.excerpt||p.title,`<article class="blog-article"><a class="text-link" href="/blog">Alle Beiträge</a><header><p class="eyebrow">Lennox Journal</p><h1>${esc(p.title)}</h1><p class="blog-byline"><time datetime="${new Date(p.publishedAt).toISOString()}">${formatDate(p.publishedAt)}</time><span>Von ${esc(p.authorName)}</span></p>${p.excerpt?`<p class="blog-lead">${esc(p.excerpt)}</p>`:''}</header>${p.coverImageId?`<img class="blog-article-cover" src="/api/blog/images/${esc(p.coverImageId)}" alt="Titelbild zum Beitrag ${esc(p.title)}" width="1200" height="750">`:''}<div class="blog-prose">${renderMarkdown(p.body)}</div></article>`,`/blog/${p.slug}`));
}
export async function handleBlogRequest(request,env) {
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/')&&path!=='/blog'&&!path.startsWith('/blog/'))return null;
  try{
    if(!env.DB)fail(503,'Der Blog wird gerade eingerichtet. Bitte versuche es später erneut.');
    if(path==='/blog'||path.startsWith('/blog/')){if(!['GET','HEAD'].includes(request.method))fail(405,'Diese Methode ist nicht erlaubt.');const response=await blogPage(env.DB,url);return request.method==='HEAD'?new Response(null,response):response;}
    if(!['GET','HEAD'].includes(request.method))checkOrigin(request);
    if(path==='/api/auth/login'&&request.method==='POST')return await login(request,env);
    if(path==='/api/auth/session'&&request.method==='GET'){const user=await sessionUser(request,env.DB);return json({user:user?{username:user.username,displayName:user.display_name}:null});}
    if(path==='/api/auth/logout'&&request.method==='POST'){
      const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
      if(token)await run(env.DB,'DELETE FROM blog_sessions WHERE token_hash=?',await sha256(token));return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    if(path==='/api/blog/posts'&&request.method==='GET')return json(await publicPosts(env.DB,url));
    let match=/^\/api\/blog\/images\/([a-f0-9-]{36})$/.exec(path);
    if(match&&request.method==='GET')return await serveImage(env.DB,match[1],null);
    if(path.startsWith('/api/admin/')){
      const user=await requireUser(request,env.DB);
      if(path==='/api/admin/posts'&&request.method==='GET')return json({posts:(await all(env.DB,'SELECT * FROM blog_posts WHERE user_id=? ORDER BY updated_at DESC LIMIT 500',user.id)).map(postData)});
      if(path==='/api/admin/posts'&&request.method==='POST')return await savePost(request,env.DB,user,null);
      match=/^\/api\/admin\/posts\/([a-f0-9-]{36})$/.exec(path);
      if(match&&request.method==='PUT')return await savePost(request,env.DB,user,match[1]);
      if(match&&request.method==='DELETE'){
        const post=await first(env.DB,'SELECT cover_image_id FROM blog_posts WHERE id=? AND user_id=?',match[1],user.id);if(!post)fail(404,'Dieser Beitrag wurde nicht gefunden.');
        await run(env.DB,'DELETE FROM blog_posts WHERE id=? AND user_id=?',match[1],user.id);
        if(post.cover_image_id)await run(env.DB,'DELETE FROM blog_images WHERE id=? AND user_id=? AND NOT EXISTS (SELECT 1 FROM blog_posts WHERE cover_image_id=?)',post.cover_image_id,user.id,post.cover_image_id);return json({ok:true});
      }
      if(path==='/api/admin/images'&&request.method==='POST')return await uploadImage(request,env.DB,user);
      match=/^\/api\/admin\/images\/([a-f0-9-]{36})$/.exec(path);if(match&&request.method==='GET')return await serveImage(env.DB,match[1],user);
      if(path==='/api/admin/password'&&request.method==='PUT'){
        const data=await bodyJson(request,4096);
        if(typeof data.password!=='string'||data.password.length<16||data.password.length>256||typeof data.currentPassword!=='string'||data.currentPassword.length>256)fail(400,'Das neue Passwort muss mindestens 16 und höchstens 256 Zeichen haben.');
        const stored=await first(env.DB,'SELECT * FROM blog_users WHERE id=?',user.id);
        if(!equal(await passwordHash(data.currentPassword,stored.password_salt,stored.iterations),stored.password_hash))fail(400,'Das bisherige Passwort ist falsch.');
        const salt=randomHex(16),hash=await passwordHash(data.password,salt);
        await env.DB.batch([env.DB.prepare('UPDATE blog_users SET password_hash=?,password_salt=?,iterations=?,updated_at=? WHERE id=?').bind(hash,salt,PASSWORD_ITERATIONS,Date.now(),user.id),env.DB.prepare('DELETE FROM blog_sessions WHERE user_id=?').bind(user.id)]);
        return json({ok:true},200,{'Set-Cookie':cookie('',0)});
      }
    }
    fail(404,'Dieser Bereich wurde nicht gefunden.');
  }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Blog request failed',{path,name:error?.name,message:error?.message});return json({error:'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es erneut.'},500);}
}
