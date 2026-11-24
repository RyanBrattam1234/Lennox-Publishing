import { NOTICE_COOKIE, createNoticePreferences } from './privacy-storage.mjs';

if (!document.querySelector('#privacy-ui')) {
  const preferences = createNoticePreferences({
    read: () => document.cookie,
    write: value => { document.cookie = value; },
    secure: window.location.protocol === 'https:'
  });
  const privacyUrl = new URL('./datenschutz.html', import.meta.url).href;
  const root = document.createElement('div');
  root.id = 'privacy-ui';
  root.innerHTML = `
    <aside class="privacy-notice" aria-label="Datenschutz und Cookies" hidden>
      <div class="privacy-notice-copy"><h2>Datenschutz &amp; Cookies</h2><p>Im Website-Code sind keine Analyse- oder Marketingdienste eingebunden. Du entscheidest, ob dieser Hinweis für spätere Besuche ausgeblendet wird.</p><a data-privacy-link>Datenschutzhinweise lesen</a></div>
      <div class="privacy-notice-actions"><button type="button" class="privacy-choice" data-cookie-settings>Einstellungen öffnen</button><button type="button" class="privacy-choice" data-dismiss-notice>Für diesen Besuch schließen</button></div>
    </aside>
    <dialog class="privacy-dialog" id="cookie-settings-dialog" aria-labelledby="cookie-settings-title" aria-describedby="cookie-settings-description">
      <div class="privacy-dialog-heading"><div><p class="eyebrow">Deine Entscheidung</p><h2 id="cookie-settings-title">Cookie-Einstellungen</h2></div><button type="button" class="privacy-close" aria-label="Cookie-Einstellungen schließen">×</button></div>
      <div class="privacy-dialog-content"><p id="cookie-settings-description">Die Website kommt ohne Analyse- und Marketing-Cookies aus. Die Speicherung der Hinweis-Einstellung ist freiwillig; die Seite funktioniert auch ohne sie.</p>
        <div class="privacy-service-summary"><span>Analyse &amp; Marketing<strong>Im Website-Code nicht eingebunden</strong></span><span>Schriftarten<strong>Lokal bereitgestellt</strong></span><span>Kontaktformular<strong>Deaktiviert</strong></span><span>Blog Creator<strong>Sitzungscookie nur nach Anmeldung</strong></span></div>
        <label class="privacy-remember"><input type="checkbox" id="remember-cookie-notice" aria-describedby="remember-cookie-description"><span><strong>Hinweis für 180 Tage ausblenden</strong><span id="remember-cookie-description">Mit „Auswahl speichern“ erlaubst du dafür das Cookie <code>lennox_privacy_notice</code>. Es enthält nur die Hinweis-Auswahl und keine Kennung zur Wiedererkennung für Werbung oder Analyse.</span></span></label>
        <div class="privacy-cookie-heading"><h3>Cookies auf dieser Domain</h3><button type="button" class="privacy-text-button" data-refresh-cookies>Liste aktualisieren</button></div>
        <p class="privacy-small" data-cookie-domain></p>
        <div class="privacy-table-wrap"><table class="privacy-cookie-table"><caption class="visually-hidden">Im Browser auslesbare Cookies dieser Domain</caption><thead><tr><th scope="col">Name</th><th scope="col">Zweck &amp; Dauer</th><th scope="col">Verwalten</th></tr></thead><tbody data-cookie-list></tbody></table></div>
        <p class="privacy-small">Bekanntes notwendiges Cookie: <code>__Host-lennox_blog_session</code> hält eine Anmeldung im Blog Creator bis zu 8 Stunden aktiv. Es ist HttpOnly-geschützt und deshalb hier nicht als vorhanden oder abwesend erkennbar. Über „Abmelden“ im Blog Creator beendest du diese Sitzung.</p><p class="privacy-small">Der Hostinganbieter kann beim direkten Aufruf unter <code>chatgpt.site</code> zusätzlich das geschützte Cookie <code>__cf_bm</code> zur Bot-Erkennung setzen (laut Anbieter 30 Minuten Inaktivität). Es ist nicht das Anmelde-Cookie; auf der Netlify-Domain ist sein Vorhandensein daraus nicht ableitbar. Details stehen in den Datenschutzhinweisen.</p><p class="privacy-small">Die Liste zeigt Cookies, die diese Seite im Browser auslesen kann. Geschützte HttpOnly-Cookies und Cookies anderer Domains sind hier nicht sichtbar. Sämtliche Website-Daten lassen sich zusätzlich in den Browsereinstellungen verwalten.</p>
        <p class="privacy-small">Technische Serverzugriffe für die Bereitstellung der Website werden durch diese Cookie-Auswahl nicht abgeschaltet. Die Übersicht übermittelt keine Cookie-Inhalte an einen zusätzlichen Dienst.</p>
        <p class="privacy-action-status" role="status" aria-live="polite" hidden></p>
      </div>
      <div class="privacy-dialog-actions"><div class="privacy-main-actions"><button type="button" class="privacy-choice" data-without-storage>Ohne Speicherung fortfahren</button><button type="button" class="privacy-choice" data-save-cookie-choice>Auswahl speichern</button></div><div class="privacy-secondary-actions"><button type="button" class="privacy-text-button" data-reset-cookie-choice>Einstellung zurücksetzen</button><a data-privacy-link>Datenschutzhinweise</a></div></div>
    </dialog>
    <p class="privacy-global-status visually-hidden" role="status" aria-live="polite"></p>`;
  document.body.append(root);
  root.querySelectorAll('[data-privacy-link]').forEach(link => { link.href = privacyUrl; });

  const notice = root.querySelector('.privacy-notice');
  const dialog = root.querySelector('.privacy-dialog');
  const remember = root.querySelector('#remember-cookie-notice');
  const cookieList = root.querySelector('[data-cookie-list]');
  const actionStatus = root.querySelector('.privacy-action-status');
  const globalStatus = root.querySelector('.privacy-global-status');
  let returnFocus = null;

  const announce = message => { globalStatus.textContent = message; };
  const showActionStatus = message => {
    actionStatus.hidden = false;
    actionStatus.textContent = message;
  };
  const syncNotice = () => { notice.hidden = !preferences.shouldShowNotice; };
  const renderCookies = () => {
    root.querySelector('[data-cookie-domain]').textContent = `Aktuelle Domain: ${window.location.hostname}`;
    cookieList.replaceChildren();
    const cookies = preferences.cookies().sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!cookies.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 3;
      cell.className = 'privacy-empty';
      cell.textContent = 'Aktuell sind keine durch diese Ansicht auslesbaren Cookies vorhanden.';
      row.append(cell);
      cookieList.append(row);
      return;
    }
    for (const cookie of cookies) {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      const purpose = document.createElement('td');
      const manage = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = cookie.name;
      name.append(code);
      if (cookie.name === NOTICE_COOKIE.name) {
        purpose.textContent = 'Blendet den Hinweis für spätere Besuche aus. Freiwillig, maximal 180 Tage.';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'privacy-text-button';
        remove.textContent = 'Löschen';
        remove.setAttribute('aria-label', 'Cookie lennox_privacy_notice löschen');
        remove.addEventListener('click', resetChoice);
        manage.append(remove);
      } else {
        purpose.textContent = 'Nicht durch diesen Website-Code verwaltet. Zweck und Laufzeit lassen sich aus dem Cookie-Namen allein nicht zuverlässig bestimmen.';
        manage.textContent = 'Im Browser verwalten';
      }
      row.append(name, purpose, manage);
      cookieList.append(row);
    }
  };

  function resetChoice() {
    const result = preferences.reset();
    remember.checked = preferences.remembered;
    renderCookies();
    syncNotice();
    showActionStatus(result.removed
      ? 'Die gespeicherte Hinweis-Einstellung wurde gelöscht. Du kannst jetzt neu wählen.'
      : 'Der Browser konnte die gespeicherte Einstellung nicht löschen. Bitte entferne sie in den Website-Daten deines Browsers.');
  }

  const openSettings = trigger => {
    if (typeof dialog.showModal !== 'function') {
      window.location.assign(privacyUrl + '#cookies');
      return;
    }
    returnFocus = trigger;
    remember.checked = preferences.remembered;
    actionStatus.hidden = true;
    renderCookies();
    dialog.showModal();
    document.body.classList.add('dialog-open');
  };

  const applyChoice = shouldRemember => {
    const result = preferences.apply(shouldRemember);
    remember.checked = preferences.remembered;
    syncNotice();
    renderCookies();
    if (shouldRemember && !result.persisted) {
      showActionStatus('Der Browser erlaubt die Speicherung gerade nicht. Der Hinweis bleibt für diesen Besuch geschlossen; es wurde keine dauerhafte Auswahl bestätigt.');
      return;
    }
    if (!shouldRemember && !result.removed) {
      showActionStatus('Die Auswahl gilt für diesen Besuch. Eine zuvor gespeicherte Einstellung konnte nicht gelöscht werden; bitte entferne sie zusätzlich in den Website-Daten deines Browsers.');
      return;
    }
    dialog.close();
    announce(shouldRemember ? 'Hinweis-Einstellung für maximal 180 Tage gespeichert.' : 'Ohne dauerhafte Speicherung fortgesetzt.');
  };

  document.querySelectorAll('[data-cookie-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => openSettings(button));
  });
  root.querySelector('[data-dismiss-notice]').addEventListener('click', () => {
    preferences.apply(false);
    syncNotice();
    announce('Hinweis für diesen Besuch geschlossen. Es wurde kein Cookie zur Speicherung der Auswahl gesetzt.');
  });
  root.querySelector('[data-save-cookie-choice]').addEventListener('click', () => applyChoice(remember.checked));
  root.querySelector('[data-without-storage]').addEventListener('click', () => applyChoice(false));
  root.querySelector('[data-reset-cookie-choice]').addEventListener('click', resetChoice);
  root.querySelector('[data-refresh-cookies]').addEventListener('click', renderCookies);
  root.querySelector('.privacy-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
    const target = returnFocus && !returnFocus.closest('[hidden]') ? returnFocus : document.querySelector('footer [data-cookie-settings]');
    target?.focus({ preventScroll: true });
  });
  const hostNote = document.querySelector('[data-host-preview-note]');
  if (hostNote && window.location.hostname.endsWith('.chatgpt.site')) hostNote.hidden = false;
  syncNotice();
}
