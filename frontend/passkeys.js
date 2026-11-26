import './assets/passkeys/browser.js';

const canonical = 'https://lennox-publishing-neugestaltung.cleanrowan2.chatgpt.site';
const area = document.body.dataset.passkeyArea;
const groups = document.querySelectorAll('[data-passkeys]');
async function post(action, credential) {
  const response = await fetch('/api/passkeys/'+action,{
    method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({area,credential})
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Bitte versuche es erneut.');
  return result;
}
for (const group of groups) {
  if (location.origin !== canonical) {
    const link=document.createElement('a');
    link.href=canonical+(area==='admin'?'/verwaltung/':'/blog-creator/');
    link.textContent='Passkeys auf der Anmeldeseite verwenden';
    group.replaceChildren(link);
  } else if (!window.PublicKeyCredential || !navigator.credentials) {
    continue;
  } else {
    const feedback=group.querySelector('[role=status]');
    const buttons=group.querySelectorAll('button');
    for (const button of buttons) button.addEventListener('click',async () => {
      const action=button.dataset.action;
      if (action==='remove' && !confirm('Alle Passkeys dieses Kontos entfernen? Die Anmeldung mit Passwort bleibt verfügbar.')) return;
      buttons.forEach(b=>b.disabled=true);
      feedback.textContent='';
      try {
        if (action==='remove') {
          await post('remove');
          feedback.textContent='Passkeys dieses Kontos entfernt.';
          return;
        }
        const optionsJSON=await post(action+'/options');
        const browser=globalThis.SimpleWebAuthnBrowser;
        const credential=action==='register' ? await browser.startRegistration({optionsJSON}) : await browser.startAuthentication({optionsJSON});
        await post(action+'/verify',credential);
        if (action==='login') document.dispatchEvent(new Event('lennox:passkey-login'));
        else feedback.textContent='Dein Passkey ist eingerichtet.';
      } catch(error) {
        feedback.textContent=error.name==='NotAllowedError' ? 'Vorgang abgebrochen oder kein passender Passkey verfügbar.' : error.message;
      } finally {buttons.forEach(b=>b.disabled=false);}
    });
  }
  group.hidden=false;
}
