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

### Impressum und Datenschutz

Die bisherigen Texte werden nicht veröffentlicht und sind nicht mehr über den Footer verlinkt. Auch die direkten URLs `impressum.html` und `datenschutz.html` zeigen ausschließlich einen Hinweis zur vorübergehenden Nichtverfügbarkeit.

Frühere Entwürfe sind zur späteren Bearbeitung unter `docs/legal-drafts/` archiviert. Netlify veröffentlicht ausschließlich `dist/`; die archivierten Texte gehören nicht zum Website-Build. Die Archivdateien sind Entwürfe mit Platzhaltern und keine freigegebenen Rechtstexte.

## Projektstruktur

```text
dist/
  index.html             Startseite
  styles.css             Design und responsive Ansichten
  script.js              Menü, Coverdialog und Navigationsmarkierung
  impressum.html         Nicht-verfügbar-Seite
  datenschutz.html       Nicht-verfügbar-Seite
  404.html               Eigene Fehlerseite
  assets/                Buchcover, Logo, Favicon und lokale Fonts
docs/legal-drafts/       Archivierte Entwürfe, nicht im Website-Build
netlify.toml             Netlify-Veröffentlichung aus dist/
```

## Inhalte ändern

Texte stehen direkt in `dist/index.html`. Farben und Layout sind in `dist/styles.css` über benannte Variablen und Abschnitte organisiert. Das Cover liegt unter `dist/assets/book-cover.webp`, das Logo unter `dist/assets/publisher-logo.webp`.

Die Bilddateien stammen aus der bisherigen Website. Die Schriftarten **DM Sans** und **Libre Caslon Display** stehen unter der SIL Open Font License; die Lizenzen befinden sich im Schriftordner. Das Buch wird weiterhin als **in Entwicklung** dargestellt; es wird kein Veröffentlichungstermin behauptet.
