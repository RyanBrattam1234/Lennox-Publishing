(() => {
  'use strict';
  const mode = window.matchMedia('(display-mode: standalone)');
  const isInstalled = () => mode.matches || navigator.standalone === true;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null, registrationPromise = null, dialog = null, returnFocus = null;

  function enableAppShell() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return Promise.resolve(null);
    if (!registrationPromise) registrationPromise = navigator.serviceWorker.register('/sw.js', {scope:'/',updateViaCache:'none'}).catch(() => {registrationPromise=null;return null;});
    return registrationPromise;
  }
  // Ordinary browsing does not register an offline cache. The visitor requests
  // it by opening installation help, or by launching the installed web app.
  function syncInstalledMode() {
    const installed = isInstalled();
    document.documentElement.classList.toggle('is-web-app',installed);
    document.querySelectorAll('[data-app-install-card]').forEach(el => {el.hidden=installed;});
    document.querySelectorAll('[data-install-app]').forEach(el => {el.hidden=installed;});
    document.querySelectorAll('[data-app-refresh]').forEach(el => {el.hidden=!installed;});
    if (installed) enableAppShell();
  }
  mode.addEventListener?.('change',syncInstalledMode);
  window.addEventListener('appinstalled',() => {installPrompt=null;document.querySelectorAll('[data-install-app],[data-app-install-card]').forEach(el=>{el.hidden=true;});dialog?.close();});
  window.addEventListener('beforeinstallprompt',event => {
    event.preventDefault();installPrompt=event;
    const direct=dialog?.querySelector('[data-native-install]');if(direct)direct.hidden=false;
  });

  function makeDialog() {
    const element=document.createElement('dialog');element.className='app-install-dialog';element.setAttribute('aria-labelledby','app-install-title');
    element.innerHTML=`<div class="app-install-heading"><img src="/apple-touch-icon.png" alt="" width="72" height="72"><div><p class="eyebrow">Deine Geschichten. Immer griffbereit.</p><h2 id="app-install-title">Lennox auf dem Homescreen.</h2></div><button class="app-dialog-close" type="button" aria-label="Anleitung schließen">×</button></div><div class="app-install-content"><p>Öffne Lennox Publishing direkt über das neue App-Icon auf deinem Home-Bildschirm.</p><div data-ios-guide><h3>Auf dem iPhone oder iPad</h3><ol><li>Öffne diese Website in <strong>Safari</strong>.</li><li>Tippe auf <strong>Teilen</strong>. Je nach Safari-Layout findest du die Funktion zuerst im Menü <strong>„Mehr“</strong>.</li><li>Wähle <strong>„Zu Home-Bildschirm hinzufügen“</strong>.</li><li>Lass <strong>„Als Web-App öffnen“</strong> eingeschaltet, falls die Option angezeigt wird, und tippe auf <strong>„Hinzufügen“</strong>.</li></ol></div><div data-other-guide><h3>In anderen Browsern</h3><p>Wähle im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Wenn dein Browser die direkte Installation unterstützt, kannst du auch den Button unten verwenden.</p></div><p class="app-install-note">Aktuelle Blogbeiträge und der Blog Creator benötigen Internet. Die Web-App speichert nur öffentliche Gestaltungsdateien und eine Offline-Hinweisseite auf deinem Gerät.</p><a class="text-link" href="https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">Anleitung von Apple</a></div><div class="app-install-actions"><button class="button button-gold" type="button" data-native-install hidden>Jetzt installieren</button><button class="button" type="button" data-close-install>Verstanden</button></div>`;
    document.body.append(element);
    const iosGuide=element.querySelector('[data-ios-guide]'),otherGuide=element.querySelector('[data-other-guide]');
    if(isIOS)otherGuide.hidden=true;else{iosGuide.hidden=false;otherGuide.hidden=false;}
    element.querySelector('.app-dialog-close').addEventListener('click',()=>element.close());
    element.querySelector('[data-close-install]').addEventListener('click',()=>element.close());
    element.querySelector('[data-native-install]').addEventListener('click',nativeInstall);
    element.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');returnFocus?.focus({preventScroll:true});});
    element.addEventListener('click',event=>{if(event.target!==element)return;const b=element.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)element.close();});
    return element;
  }
  async function nativeInstall() {
    if(!installPrompt)return;
    const pending=installPrompt;installPrompt=null;
    try {await pending.prompt();const choice=await pending.userChoice;if(choice.outcome==='accepted')dialog?.close();}
    catch {}
    finally {const button=dialog?.querySelector('[data-native-install]');if(button)button.hidden=true;}
  }
  function openInstall(trigger) {
    if(isInstalled())return;
    enableAppShell();
    if(installPrompt&&!isIOS){nativeInstall();return;}
    if(typeof HTMLDialogElement==='undefined'||!HTMLDialogElement.prototype.showModal){location.assign('/app-installieren.html');return;}
    if(!dialog)dialog=makeDialog();returnFocus=trigger;
    dialog.querySelector('[data-native-install]').hidden=!installPrompt||isIOS;
    dialog.showModal();document.body.classList.add('dialog-open');
  }
  const footer=document.querySelector('footer');
  if(footer){
    const controls=footer.querySelector('.legal-paused,.privacy-footer-controls,.availability-links,.creator-footer>div')||footer.querySelector('div')||footer;
    const install=document.createElement('button');install.type='button';install.className='app-footer-button';install.dataset.installApp='';install.textContent='Als App hinzufügen';controls.append(install);
    const refresh=document.createElement('button');refresh.type='button';refresh.className='app-footer-button';refresh.dataset.appRefresh='';refresh.textContent='Seite aktualisieren';refresh.hidden=true;controls.append(refresh);
  }
  document.querySelectorAll('[data-install-app]').forEach(button=>{button.hidden=false;button.addEventListener('click',()=>openInstall(button));});
  document.querySelectorAll('[data-app-retry],[data-app-refresh]').forEach(button=>button.addEventListener('click',()=>{
    if(window.dispatchEvent(new CustomEvent('lennox:request-refresh',{cancelable:true})))location.reload();
  }));
  let connectionNote=null;
  function syncConnection() {
    const offline=navigator.onLine===false;
    if(offline&&!connectionNote){connectionNote=document.createElement('p');connectionNote.className='app-connection-note';connectionNote.setAttribute('role','status');const main=document.querySelector('main');main?.prepend(connectionNote);}
    if(connectionNote){connectionNote.hidden=!offline;connectionNote.textContent=document.body.classList.contains('creator-body')?'Du bist offline. Dein Text bleibt im geöffneten Tab erhalten. Speichern und Veröffentlichen brauchen eine Internetverbindung.':'Du bist offline. Verbinde dich mit dem Internet, um aktuelle Inhalte zu laden.';}
  }
  window.addEventListener('offline',syncConnection);window.addEventListener('online',syncConnection);
  syncInstalledMode();syncConnection();
})();
