import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';

const frontend=new URL('../frontend/',import.meta.url),origin='https://lennox-publishing.netlify.app';
const workerSource=readFileSync(new URL('sw.js',frontend),'utf8');
function workerHarness(){
  const handlers=new Map(),stores=new Map(),calls=[];
  const key=value=>typeof value==='string'?new URL(value,origin).href:value.url;
  const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return{async put(request,response){store.set(key(request),response.clone());},async match(request){return store.get(key(request))?.clone();}};},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
  let offline=false,body='fresh asset',status=200,noStore=false,claimed=false;
  const fetch=async request=>{const url=key(request);calls.push({url,credentials:request.credentials});if(offline)throw new TypeError('Offline');return new Response(body,{status,headers:{'Content-Type':'text/plain',...(noStore?{'Cache-Control':'no-store'}:{})}});};
  class BrowserRequest extends Request{constructor(input,options){super(typeof input==='string'?new URL(input,origin):input,options);}}
  const self={location:{origin},clients:{async claim(){claimed=true;}},addEventListener(name,handler){handlers.set(name,handler);}};
  vm.runInNewContext(workerSource,{self,caches,fetch,Request:BrowserRequest,Response,URL,Set});
  async function lifecycle(name){const pending=[];handlers.get(name)({waitUntil:p=>pending.push(p)});await Promise.all(pending);}
  async function request(path,{method='GET',navigate=false,range=false}={}){
    const actual=new BrowserRequest(path,{method,headers:range?{Range:'bytes=0-10'}:{}});
    const request={url:actual.url,method:actual.method,headers:actual.headers,mode:navigate?'navigate':'cors',credentials:'same-origin'};
    const pending=[];let response;
    handlers.get('fetch')({request,respondWith:p=>{response=p;},waitUntil:p=>pending.push(p)});
    const result=await response;await Promise.all(pending);return result;
  }
  return{stores,calls,caches,lifecycle,request,setOffline:v=>{offline=v;},setBody:v=>{body=v;},setStatus:v=>{status=v;},setNoStore:v=>{noStore=v;},get claimed(){return claimed;}};
}

test('Manifest, touch icon, app scope and page metadata are usable from every entry point',()=>{
  const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',frontend),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.id,'/');
  for(const icon of manifest.icons){const bytes=readFileSync(new URL(icon.src.slice(1),frontend));const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);assert.equal(bytes[25],2,'Icons must be opaque RGB PNGs');}
  const apple=readFileSync(new URL('apple-touch-icon.png',frontend));assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
  const pages=readdirSync(frontend,{recursive:true}).filter(p=>p.endsWith('.html'));
  for(const page of pages){const html=readFileSync(new URL(page,frontend),'utf8');assert.match(html,/rel="manifest"[^>]*href="\/manifest.webmanifest"/,page);assert.match(html,/rel="apple-touch-icon"/,page);assert.match(html,/viewport-fit=cover/,page);assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html),page+' must preserve zoom');}
});

test('Offline shell includes only existing public assets and activation preserves unrelated caches',async()=>{
  const w=workerHarness();await w.lifecycle('install');
  assert.ok(w.calls.length>0);
  for(const call of w.calls){const url=new URL(call.url);assert.ok(!url.pathname.startsWith('/api/'));assert.equal(call.credentials,'omit');readFileSync(new URL(url.pathname.slice(1),frontend));}
  const store=w.stores.get('lennox-public-shell-v1');assert.ok(store.has(origin+'/offline.html'));assert.ok(store.has(origin+'/pwa.js'));
  await w.caches.open('lennox-public-shell-old');await w.caches.open('other-app-cache');await w.lifecycle('activate');
  assert.ok(!w.stores.has('lennox-public-shell-old'));assert.ok(w.stores.has('other-app-cache'));assert.ok(w.claimed);
});

test('API, authentication, private images and write requests never enter the worker cache',async()=>{
  const w=workerHarness();await w.lifecycle('install');const before=w.calls.length;
  for(const path of ['/api/auth/session','/api/admin/posts','/api/admin/images/private','/api/blog/posts','/api/blog/images/public','/signin-with-chatgpt','https://maggieforeverywhere.com/neue-galaxie-verlag.html'])assert.equal(await w.request(path),undefined,path);
  assert.equal(await w.request('/api/auth/login',{method:'POST'}),undefined);assert.equal(await w.request('/styles.css',{range:true}),undefined);assert.equal(w.calls.length,before);
});

test('Fresh styles win online, cached public assets work offline, and no-store responses are not cached',async()=>{
  const w=workerHarness();await w.lifecycle('install');w.setBody('updated styles');assert.equal(await(await w.request('/styles.css')).text(),'updated styles');
  w.setOffline(true);assert.equal(await(await w.request('/styles.css')).text(),'updated styles');
  w.setOffline(false);w.setNoStore(true);w.setBody('do not cache');assert.equal(await(await w.request('/blog.css')).text(),'do not cache');assert.ok(!w.stores.get('lennox-public-shell-v1').has(origin+'/blog.css'));
});

test('Articles and authenticated HTML are never saved; offline navigation gets only the generic fallback',async()=>{
  const w=workerHarness();await w.lifecycle('install');const store=w.stores.get('lennox-public-shell-v1');
  w.setBody('private editor or current article');assert.equal(await(await w.request('/blog-creator/',{navigate:true})).text(),'private editor or current article');assert.equal(await(await w.request('/blog/example',{navigate:true})).text(),'private editor or current article');
  assert.ok(!store.has(origin+'/blog-creator/'));assert.ok(!store.has(origin+'/blog/example'));
  store.set(origin+'/blog/example',new Response('old article must never be returned'));
  const fallback=await(await(await w.caches.open('lennox-public-shell-v1')).match('/offline.html')).text();w.setOffline(true);
  assert.equal(await(await w.request('/blog/example',{navigate:true})).text(),fallback);assert.equal(await(await w.request('/blog-creator/',{navigate:true})).text(),fallback);
});

test('An unavailable required file aborts offline installation without a partial cache',async()=>{
  const w=workerHarness();w.setStatus(404);await assert.rejects(w.lifecycle('install'));assert.equal(w.stores.size,0);
});
