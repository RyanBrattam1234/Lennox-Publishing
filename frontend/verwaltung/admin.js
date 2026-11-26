const el = id => document.getElementById(id);
const data = id => Object.fromEntries(new FormData(el(id)));
let books = [];
function signedOut() {
  el('panel').hidden = el('logout').hidden = true;
  el('login').hidden = false;
  for (const form of document.forms) form.reset();
}
async function api(path,method='GET',payload) {
  const binary = payload instanceof Blob;
  const res = await fetch('/api/'+path,{method,cache:'no-store',headers:payload && !binary ? {'Content-Type':'application/json'} : {},body:binary ? payload : JSON.stringify(payload)});
  const body = await res.json();
  if (!res.ok) {
    if (res.status === 401) signedOut();
    const err = Error(body.error || 'Anfrage fehlgeschlagen.');err.status = res.status;throw err;
  }
  return body;
}
function showBook() {
  const book = books.find(b => b.id === el('book').value);
  for (const key of ['status','subtitle','description']) el('details').elements[key].value = book[key];
  el('edit-title').hidden = !book.added;
  el('details').elements.title.value = book.title;
  el('preview').hidden = !book.cover;
  if (book.cover) el('preview').src = book.cover+'?v='+Date.now();
  el('restore').hidden = book.added && !book.cover;
  el('restore').textContent = book.added ? 'Cover entfernen' : 'Originalcover verwenden';
  el('cover').reset();
}
async function refresh(preferred) {
  const account = await api('owner/account');
  books = (await api('books?catalog=1')).books;
  const selected = preferred || el('book').value;
  el('book').replaceChildren(...books.map(book => new Option(book.title,book.id)));
  if (books.some(b => b.id === selected)) el('book').value = selected;
  el('editor').textContent = account.editor;showBook();
  el('login').hidden = true;el('panel').hidden = el('logout').hidden = false;
}
function bind(id,event,action) {
  el(id).addEventListener(event,async e => {
    e.preventDefault();const control = e.submitter || e.currentTarget;control.disabled = true;
    try { el('notice').textContent = await action() || ''; }
    catch (err) { el('notice').textContent = err.message; }
    finally { control.disabled = false; }
  });
}
const route = () => 'owner/books/'+el('book').value;
bind('login','submit',async () => {await api('auth/login','POST',data('login'));el('login').reset();await refresh();});
bind('logout','click',async () => {await api('auth/logout','POST');signedOut();});
el('book').onchange = showBook;
bind('details','submit',async () => {await api(route(),'PUT',data('details'));await refresh();return 'Buchtext veröffentlicht.';});
async function prepareCover(file) {
  if (file.size>900*1024) {
    const image=await createImageBitmap(file),ratio=Math.min(1,1400/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
    file=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78));
    if (!file || file.size>900*1024) throw Error('Bitte ein kleineres Cover auswählen (bis 900 KB).');
  }
  return file;
}
bind('cover','submit',async () => {
  const target=route();
  const file=await prepareCover(el('cover').elements.file.files[0]);
  await api(target+'/cover','PUT',file);await refresh();return 'Cover veröffentlicht.';
});
bind('restore','click',async () => {if (!confirm('Das hochgeladene Cover entfernen?')) return;await api(route()+'/cover','DELETE');await refresh();return 'Buchcover aktualisiert.';});
for (const id of ['reset','self']) bind(id,'submit',async () => {
  const fields=data(id);
  if (fields.password!==fields.repeat) throw Error('Die neuen Passwörter stimmen nicht überein.');
  if (id==='reset' && !confirm('Passwort ändern und offene Redaktionssitzungen beenden?')) return;
  delete fields.repeat;await api(id==='reset'?'owner/editor-password':'admin/password','PUT',fields);
  el(id).reset();if (id==='self') signedOut();
  return id==='reset'?'Redaktionspasswort geändert.':'Bitte mit deinem neuen Passwort anmelden.';
});
refresh().catch(err=>{signedOut();if(err.status!==401)el('notice').textContent=err.message;});

let pendingId = crypto.randomUUID();
bind('newbook','submit',async () => {
  const form = el('newbook');
  const fields = data('newbook');
  const file = form.elements.file.files[0];
  delete fields.file;
  if (file) {
    const cover = await prepareCover(file);
    fields.image = await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(Error('Das Cover konnte nicht gelesen werden.'));
      reader.readAsDataURL(cover);
    });
  }
  const result = await api('owner/books','POST',{...fields,id:pendingId});
  pendingId = crypto.randomUUID();
  form.reset();
  el('new-book').open = false;
  await refresh(result.id);
  return 'Buch veröffentlicht. Es erscheint unter „Weitere Bücher“.';
});
