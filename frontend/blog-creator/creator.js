import { renderMarkdown } from '/blog-format.mjs';
const $=id=>document.getElementById(id);
let posts=[],current=null,filter='all',dirty=false,busy=false,pendingImage=null,imageUrl=null,coverImageId=null;
const fields={title:$('post-title'),excerpt:$('post-excerpt'),body:$('post-body')};
const editorViewport=window.matchMedia('(max-width: 720px), (pointer: coarse) and (max-height: 550px) and (max-width: 1024px)');
function setPostPanelOpen(open){
  document.querySelector('.creator-sidebar').dataset.postsOpen=String(open);
  $('toggle-posts').setAttribute('aria-expanded',String(open));
  $('toggle-posts').textContent=open?'Beiträge ausblenden':'Beiträge anzeigen';
}
function focusEditor(){
  if(!editorViewport.matches)return;
  setPostPanelOpen(false);
  document.querySelector('.creator-editor').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  $('editor-title').tabIndex=-1;$('editor-title').focus({preventScroll:true});
}
$('toggle-posts').addEventListener('click',()=>setPostPanelOpen($('toggle-posts').getAttribute('aria-expanded')!=='true'));
editorViewport.addEventListener('change',()=>setPostPanelOpen(!editorViewport.matches));
setPostPanelOpen(!editorViewport.matches);
window.addEventListener('lennox:request-refresh',event=>{
  if(busy||(dirty&&!confirm('Du hast ungespeicherte Änderungen. Trotzdem neu laden?'))){event.preventDefault();return;}
  dirty=false;
});
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if(!link||link.target==='_blank'||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;
  if(busy||(dirty&&!confirm('Du hast ungespeicherte Änderungen. Möchtest du die Seite trotzdem verlassen?'))){event.preventDefault();return;}
  dirty=false;
});

async function api(path,options={}){
  let response;try{response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});}catch{throw new Error('Die Verbindung ist unterbrochen. Bitte prüfe dein Internet und versuche es erneut.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401&&!path.endsWith('/login')){showLogin();$('login-error').textContent='Deine Sitzung ist abgelaufen. Melde dich erneut an; dein ungespeicherter Text bleibt in diesem Tab erhalten.';$('login-error').hidden=false;}throw new Error(data.error||'Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.');}return data;
}
const jsonOptions=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function feedback(text,error=false){$('feedback').hidden=false;$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
function showLogin(){$('workspace').hidden=true;$('login-panel').hidden=false;$('loading').hidden=true;$('logout').hidden=true;$('account-settings').hidden=true;}
function markDirty(){dirty=true;$('save-note').textContent='Du hast ungespeicherte Änderungen.';}
function clearImageUrl(){if(imageUrl?.startsWith('blob:'))URL.revokeObjectURL(imageUrl);imageUrl=null;}
function displayImage(url){$('cover-preview').hidden=!url;if(url)$('cover-preview').src=url;else $('cover-preview').removeAttribute('src');$('remove-image').hidden=!url;}
function editorState(){
  const online=current?.status==='published';$('editor-title').textContent=current?'Dein Beitrag.':'Ein neuer Beitrag.';$('editor-status').textContent=current?(online?'Veröffentlicht':'Entwurf'):'Noch nicht gespeichert';$('editor-status').classList.toggle('online',online);
  $('publish-post').textContent=online?'Änderungen veröffentlichen':'Veröffentlichen';$('save-draft').textContent=online?'Offline nehmen & speichern':'Entwurf speichern';$('delete-post').hidden=!current;$('public-link').hidden=!online;if(online)$('public-link').href='/blog/'+current.slug;
}
function openPost(post){
  if(busy)return false;if(dirty&&!confirm('Du hast ungespeicherte Änderungen. Möchtest du sie verwerfen?'))return false;
  current=post?{...post}:null;dirty=false;pendingImage=null;coverImageId=post?.coverImageId||null;clearImageUrl();imageUrl=coverImageId?'/api/admin/images/'+coverImageId:null;displayImage(imageUrl);$('cover-file').value='';
  Object.entries(fields).forEach(([key,input])=>{input.value=post?.[key]||'';});$('feedback').hidden=true;
  $('save-note').textContent=post?'Zuletzt gespeichert: '+new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(post.updatedAt):'Dein Text wird erst gespeichert, wenn du einen der Speicherbuttons anklickst.';editorState();renderList();return true;
}
function renderList(){
  const query=$('post-search').value.toLowerCase(),visible=posts.filter(p=>(filter==='all'||p.status===filter)&&(p.title+' '+p.excerpt).toLowerCase().includes(query));$('post-count').textContent=posts.length===1?'1 Beitrag':`${posts.length} Beiträge`;
  const list=$('post-list');list.replaceChildren();
  if(!visible.length){const p=document.createElement('p');p.className='sidebar-empty';p.textContent=posts.length?'Keine passenden Beiträge gefunden.':'Dein erster Beitrag beginnt hier. Klicke auf „Neuer Beitrag“ und leg los.';list.append(p);}
  for(const p of visible){const button=document.createElement('button');button.type='button';button.className='post-list-item';button.classList.toggle('active',p.id===current?.id);button.setAttribute('aria-pressed',String(p.id===current?.id));const title=document.createElement('strong');title.textContent=p.title;const meta=document.createElement('span');meta.className='post-list-meta';const status=document.createElement('span');status.textContent=p.status==='published'?'Online':'Entwurf';status.className=p.status;const date=document.createElement('span');date.textContent=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(p.updatedAt);meta.append(status,date);button.append(title,meta);button.addEventListener('click',()=>{if(openPost(p))focusEditor();});list.append(button);}
}
async function enterWorkspace(){const data=await api('/api/admin/posts');posts=data.posts;$('login-panel').hidden=true;$('loading').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('account-settings').hidden=false;if(!dirty)openPost(current?posts.find(p=>p.id===current.id)||null:null);else renderList();}
function setBusy(value){busy=value;document.querySelectorAll('#post-form button,#post-form input,#post-form textarea,#new-post,#delete-post,#logout,#account-settings').forEach(b=>{b.disabled=value;});$('post-form').setAttribute('aria-busy',String(value));}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;button.textContent='Wird angemeldet …';$('login-error').hidden=true;try{await api('/api/auth/login',jsonOptions('POST',{username:$('username').value,password:$('password').value}));$('password').value='';await enterWorkspace();}catch(error){$('login-error').textContent=error.message;$('login-error').hidden=false;}finally{button.disabled=false;button.textContent='Anmelden';}});
$('logout').addEventListener('click',async()=>{if(dirty&&!confirm('Du hast ungespeicherte Änderungen. Trotzdem abmelden?'))return;try{await api('/api/auth/logout',jsonOptions('POST',{}));dirty=false;openPost(null);posts=[];$('post-list').replaceChildren();showLogin();}catch(error){feedback(error.message,true);}});
$('new-post').addEventListener('click',()=>{if(openPost(null)){if(editorViewport.matches)setPostPanelOpen(false);fields.title.focus();}});$('post-search').addEventListener('input',renderList);
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderList();}));
Object.values(fields).forEach(input=>input.addEventListener('input',markDirty));window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
async function optimizeImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.');if(file.size>20*1024*1024)throw new Error('Bitte ein Bild mit weniger als 20 MB auswählen.');
  const url=URL.createObjectURL(file),image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Dieses Bild konnte nicht geöffnet werden.'));image.src=url;});const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);for(const quality of [.86,.7,.5]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=900*1024)return blob;}throw new Error('Das Bild ist nach der Verkleinerung noch zu groß. Bitte ein kleineres Bild auswählen.');}finally{URL.revokeObjectURL(url);}
}
$('cover-file').addEventListener('change',async()=>{const file=$('cover-file').files[0];if(!file)return;setBusy(true);try{const blob=await optimizeImage(file);clearImageUrl();pendingImage=blob;imageUrl=URL.createObjectURL(blob);displayImage(imageUrl);markDirty();feedback('Das Titelbild ist vorbereitet. Es wird zusammen mit deinem Beitrag gespeichert.');}catch(error){feedback(error.message,true);$('cover-file').value='';}finally{setBusy(false);}});
$('remove-image').addEventListener('click',()=>{clearImageUrl();pendingImage=null;coverImageId=null;$('cover-file').value='';displayImage(null);markDirty();});
$('post-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;const status=event.submitter?.dataset.intent||'draft';setBusy(true);feedback(status==='published'?'Dein Beitrag wird veröffentlicht …':'Dein Entwurf wird gespeichert …');
  try{if(pendingImage){const uploaded=await api('/api/admin/images',{method:'POST',headers:{'Content-Type':pendingImage.type},body:pendingImage});coverImageId=uploaded.id;pendingImage=null;}
    const input={title:fields.title.value,excerpt:fields.excerpt.value,body:fields.body.value,status,coverImageId,updatedAt:current?.updatedAt},data=await api('/api/admin/posts'+(current?'/'+current.id:''),jsonOptions(current?'PUT':'POST',input));
    posts=[data.post,...posts.filter(p=>p.id!==data.post.id)];current=data.post;dirty=false;clearImageUrl();imageUrl=coverImageId?'/api/admin/images/'+coverImageId:null;displayImage(imageUrl);$('cover-file').value='';editorState();renderList();$('save-note').textContent='Gespeichert am '+new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(data.post.updatedAt)+'.';feedback(status==='published'?'Dein Beitrag ist jetzt online. Du kannst ihn über den Link unten aufrufen.':'Dein Beitrag ist als Entwurf gespeichert und öffentlich nicht sichtbar.');
  }catch(error){feedback(error.message,true);}finally{setBusy(false);}
});
$('delete-post').addEventListener('click',async()=>{if(!current||!confirm(`„${current.title}“ endgültig löschen? Der Beitrag wird auch von der Website entfernt.`))return;setBusy(true);try{await api('/api/admin/posts/'+current.id,jsonOptions('DELETE',{}));posts=posts.filter(p=>p.id!==current.id);dirty=false;setBusy(false);openPost(null);feedback('Der Beitrag wurde gelöscht.');}catch(error){feedback(error.message,true);}finally{setBusy(false);}});
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{
  const input=fields.body,start=input.selectionStart,end=input.selectionEnd,selected=input.value.slice(start,end);let text;
  if(button.dataset.format==='bold')text='**'+(selected||'Fetter Text')+'**';
  if(button.dataset.format==='heading')text=(start?'\n\n':'')+'## '+(selected||'Deine Überschrift')+'\n';
  if(button.dataset.format==='list')text=(start?'\n':'')+(selected||'Erster Punkt\nZweiter Punkt').split('\n').map(line=>'- '+line).join('\n')+'\n';
  if(button.dataset.format==='link'){const url=prompt('Welche Adresse soll verlinkt werden? (https://…)','https://');if(!url)return;try{const parsed=new URL(url);if(!['http:','https:','mailto:'].includes(parsed.protocol))throw new Error();text='['+(selected||'Linktext')+']('+parsed.href+')';}catch{feedback('Bitte eine gültige https-, http- oder E-Mail-Adresse eingeben.',true);return;}}
  input.setRangeText(text,start,end,'select');input.focus();markDirty();
}));
function showDialog(dialog){dialog.showModal();document.body.classList.add('dialog-open');}
document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');}));
$('preview-post').addEventListener('click',()=>{$('preview-title').textContent=fields.title.value||'Dein Beitragstitel';$('preview-excerpt').textContent=fields.excerpt.value;$('preview-excerpt').hidden=!fields.excerpt.value;$('preview-body').innerHTML=renderMarkdown(fields.body.value||'Hier erscheint dein Beitragstext.');$('preview-image').hidden=!imageUrl;if(imageUrl)$('preview-image').src=imageUrl;showDialog($('preview-dialog'));});
$('account-settings').addEventListener('click',()=>{if(dirty&&!confirm('Bitte speichere deinen Beitrag vor einer Passwortänderung. Trotzdem fortfahren?'))return;$('password-form').reset();$('password-error').hidden=true;showDialog($('password-dialog'));});
$('password-form').addEventListener('submit',async event=>{event.preventDefault();if($('new-password').value!==$('repeat-password').value){$('password-error').textContent='Die neuen Passwörter stimmen nicht überein.';$('password-error').hidden=false;return;}const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;try{await api('/api/admin/password',jsonOptions('PUT',{currentPassword:$('current-password').value,password:$('new-password').value}));$('password-dialog').close();$('password-form').reset();showLogin();$('login-error').textContent='Dein Passwort wurde geändert. Bitte melde dich mit dem neuen Passwort an.';$('login-error').hidden=false;}catch(error){$('password-error').textContent=error.message;$('password-error').hidden=false;}finally{button.disabled=false;}});
try{const data=await api('/api/auth/session');if(data.user)await enterWorkspace();else showLogin();}catch(error){showLogin();$('login-error').textContent=error.message;$('login-error').hidden=false;}
