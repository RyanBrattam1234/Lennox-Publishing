# Lennox Publishing · Galaxie Verlag

Statische Autoren- und Verlagswebsite von Lennox Berg. Das vollständige Projekt ist direkt für Netlify vorbereitet: kein Build-Schritt, keine npm-Installation und keine Umgebungsvariablen erforderlich.

## Auf Netlify veröffentlichen

1. In Netlify **Add new project → Import an existing project** öffnen.
2. **GitHub** auswählen und **RyanBrattam1234/Lennox-Publishing** verbinden.
3. Den Branch **main** verwenden.
4. **Build command leer lassen**, **Publish directory: `dist`**. Die beiliegende `netlify.toml` legt das Veröffentlichungsverzeichnis bereits fest.
5. Das Projekt veröffentlichen. Spätere Commits in `main` können von Netlify automatisch veröffentlicht werden, wenn Continuous Deployment aktiviert ist.

Alternativ den Inhalt des Ordners `dist/` direkt über Netlify Drop hochladen. Alle Asset- und Seitenverweise sind relativ.

Offizielle Dokumentation:
- https://docs.netlify.com/build/configure-builds/overview/
- https://docs.netlify.com/build/configure-builds/file-based-configuration/

## Funktionsumfang

- Neues responsives Design in Nachtblau, Weiß und Gold.
- Buchpräsentation mit vergrößerbarem Cover und aufklappbaren Informationen.
- Autorenbereich, Projektstand und mobiles Menü.
- Tastaturbedienbare Navigation, sichtbare Fokusmarkierungen und reduzierte Bewegung.
- Lokal geladene Schriftarten; keine eigenen Analyse- oder Marketing-Skripte.

## Vorübergehend deaktiviert

### Kontaktformular

Auf der Seite steht: **„Das Kontaktformular ist aktuell nicht verfügbar.“** Es gibt keine Formularfelder, keinen Absende-Button, keinen Versand-Endpunkt und keinen Versandcode. Die bisherige Formularintegration wurde aus den veröffentlichten Dateien entfernt. Der direkte E-Mail-Link bleibt als Kontaktmöglichkeit erhalten.

### Impressum

Das Impressum bleibt vorübergehend deaktiviert. Die alte Adresse zeigt einen Nichtverfügbarkeits-Hinweis.

## Datenschutz und Cookie-Einstellungen

`dist/datenschutz.html` enthält einen ausdrücklich vorläufigen Entwurf für die Netlify-Veröffentlichung unter https://lennox-publishing.netlify.app/.

Als Betreiberkontakt ist nur `berg.lennox@web.de` eingetragen. Vollständiger Name und Anschrift des Verantwortlichen bleiben auf Wunsch offen und müssen ergänzt werden. Kontokonfiguration, Zusatzdienste und Vertragsgrundlagen sind vor einer endgültigen Freigabe zu bestätigen. Die Entwurfskennzeichnung bleibt bis dahin sichtbar.

Die Hinweise behandeln Hosting/Protokolle, Netlifys dokumentierte Aufbewahrungszeiträume, mögliche USA-Übermittlungen, lokale Schriftarten, die deaktivierte Formularfunktion, E-Mail-Kontakt und Betroffenenrechte. Die separate Sites-Vorschau wird auf dieser Seite als andere Hostingumgebung gekennzeichnet.

### Tatsächliches Speicherverhalten

- Im Website-Code sind keine Analyse- oder Marketingdienste eingebunden.
- Die am 24. November 2026 geprüften HTTP-Antworten der Netlify-Startseite, des Skripts, des Buchcovers und der bisherigen Datenschutzseite enthielten keinen `Set-Cookie`-Header. Dies ersetzt keinen vollständigen Browser- oder Konten-Audit.
- Der neue Hinweis setzt beim ersten Aufruf kein eigenes Cookie.
- **Für diesen Besuch schließen** verwendet nur Arbeitsspeicher und setzt kein neues dauerhaftes Cookie.
- Erst nach aktivem Ankreuzen von **Hinweis für 180 Tage ausblenden** und anschließendem Speichern wird `lennox_privacy_notice=hidden-v1` gesetzt: `Max-Age=15552000`, `Path=/`, `SameSite=Lax`, bei HTTPS `Secure`. Die Domain wird nicht erweitert.
- Ohne Speicherung fortfahren beziehungsweise Zurücksetzen löscht nur dieses eigene Cookie, nicht fremde Cookies.
- Es werden keine individuellen Kennungen, Cookie-Werte oder Cookie-Listen an einen zusätzlichen Dienst geschickt. Local Storage und Session Storage kommen nicht zum Einsatz.
- Die Übersicht zeigt die aktuell durch JavaScript auslesbaren Cookie-Namen. HttpOnly-Cookies und Cookies anderer Domains können hier nicht ausgelesen oder verwaltet werden. Unbekannte Cookies werden ausdrücklich nicht automatisch als erforderlich klassifiziert.
- Die Cookie-Einstellungen sind auf jeder Seite erneut über den Footer erreichbar. Beide Fortfahren-/Speichern-Schaltflächen haben dieselbe visuelle Gewichtung. Es gibt keine fiktiven Analyse- oder Marketing-Schalter.

### Quellen für die Netlify-Angaben

- Netlify DPA, aktualisiert am 13. November 2026: https://www.netlify.com/pdf/netlify-dpa.pdf/
- Netlify Privacy Statement: https://www.netlify.com/privacy/
- Die DPA nennt für CDN-/Zugriffslogs 30 Tage online und bis zu 13 Monate Archiv; Plattformlogs 90 Tage online und 1 Jahr offline; Sicherheits-/Missbrauchslogs 365 Tage online und bis zu 6 Jahre Archiv. Diese Kategorien dürfen nicht zu einer pauschalen 30-Tage-Löschung verkürzt werden.

## Prüfungen

```sh
node --test tests/privacy-storage.test.mjs
node --check dist/privacy-storage.mjs
node --input-type=module --check < dist/privacy.js
```

Die Tests prüfen insbesondere keine Speicherung beim ersten Besuch, freiwillige Speicherung, Ablaufparameter, Widerruf, Erhalt fremder Cookies, Zurücksetzen und blockierten Browser-Speicher. Ein echter Browser-Cookie-Audit bleibt eine eigene Prüfung.

## Projektstruktur

```text
dist/
  index.html             Startseite
  styles.css             Design und responsive Ansichten
  script.js              Menü, Coverdialog und Navigationsmarkierung
  impressum.html         Nicht-verfügbar-Seite
  datenschutz.html       Vorläufige Netlify-Datenschutzhinweise
  privacy.css            Datenschutzseite und Cookie-Oberfläche
  privacy.js             Cookie-Hinweis, Übersicht und Einstellungen
  privacy-storage.mjs    Speicherregeln für den freiwilligen Hinweis-Cookie
  404.html               Eigene Fehlerseite
  assets/                Buchcover, Logo, Favicon und lokale Fonts
docs/legal-drafts/       Frühere Entwürfe, nicht im Website-Build
tests/                  Tests für freiwillige Speicherung und Widerruf
netlify.toml             Netlify-Veröffentlichung aus dist/
```

## Inhalte ändern

Texte stehen direkt in `dist/index.html`. Farben und Layout sind in `dist/styles.css` über benannte Variablen und Abschnitte organisiert. Das Cover liegt unter `dist/assets/book-cover.webp`, das Logo unter `dist/assets/publisher-logo.webp`.

Die Bilddateien stammen aus der bisherigen Website. Die Schriftarten **DM Sans** und **Libre Caslon Display** stehen unter der SIL Open Font License; die Lizenzen befinden sich im Schriftordner. Das Buch wird weiterhin als **in Entwicklung** dargestellt; es wird kein Veröffentlichungstermin behauptet.
