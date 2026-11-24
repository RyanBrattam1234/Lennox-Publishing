# Lennox Publishing · Galaxie Verlag

Website mit zwei Buchprojekten und einem geschützten **Blog Creator**. Die öffentliche Website bleibt unter https://lennox-publishing.netlify.app erreichbar.

## Aufbau

- `frontend/`: direkt auf Netlify ausgelieferte HTML-, CSS-, JavaScript- und Bilddateien; enthält Startseite, Buchvorstellungen, Datenschutzentwurf, Cookie-Einstellungen und das Login/Dashboard unter `/blog-creator/`.
- `server/blog-service.mjs`: authentifizierte Blog-API und serverseitig gerenderte öffentliche Blogseiten.
- `db/schema.ts`, `drizzle/`: SQLite-Schema und erzeugte, versionierte Migrationen.
- `worker/index.ts`, `vite.config.ts`: Backend auf der bestehenden Sites-Veröffentlichung mit Cloudflare Workers und D1.
- `netlify.toml`: Netlify veröffentlicht ausschließlich `frontend/`. `/api/*`, `/blog` und `/blog/*` werden über einen Same-Origin-Proxy an das Backend weitergeleitet.

**D1 ist die dauerhaft gespeicherte SQLite-Datenbank.** Konten, gesalzene Passwort-Hashes, gehashte Sitzungskennungen, Login-Zähler, Beiträge, Entwürfe und hochgeladene Blogbilder (BLOBs) werden dort gespeichert. Es gibt keine flüchtige SQLite-Datei in einer Netlify Function und keine Speicherung der Beiträge im Browser. Die festen Buchcover bleiben Website-Assets.

Backend: https://lennox-publishing-neugestaltung.cleanrowan2.chatgpt.site

## Blog Creator verwenden

1. `/blog-creator/` öffnen und mit dem separat übermittelten Redaktionszugang anmelden. Es gibt keine öffentliche Registrierung.
2. „Neuer Beitrag“ wählen, Titel und Text schreiben; Kurzbeschreibung und Titelbild sind optional.
3. Über die Textleiste Überschriften, fettgedruckte Texte, Listen und Links einfügen. „Vorschau“ öffnet eine unveröffentlichte Ansicht.
4. „Entwurf speichern“ hält den Beitrag privat. „Veröffentlichen“ stellt ihn direkt auf der Website und im Blog bereit, ohne erneutes Website-Deployment.
5. Bestehende Beiträge lassen sich ändern, wieder offline nehmen oder nach einer Bestätigung endgültig löschen.
6. Über „Passwort ändern“ lässt sich das Zugangspasswort ersetzen; danach ist eine neue Anmeldung nötig.

Es wird erst nach einem Klick auf einen Speicherbutton gespeichert. Bei ungespeicherten Änderungen erscheint beim Wechseln/Verlassen ein Hinweis. Blogbilder werden im Browser auf maximal 1.600 Pixel Kantenlänge verkleinert; der Server akzeptiert JPG/PNG/WebP bis 900 KB. Das Projekt begrenzt den Bildspeicher auf 200 MB. Der Editor listet die letzten 500 Beiträge; der öffentliche Blog ist mit 12 Beiträgen je Seite paginiert.

## Zugang und Sicherheit

Produktive Zugangsdaten gehören **nicht** ins öffentliche Repository. Das initiale Redaktionskonto wird beim ersten erfolgreichen Login aus geschützten Laufzeitwerten angelegt. Danach gelten die Kontodaten in SQLite; ein geändertes Passwort wird nicht durch die Bootstrap-Werte überschrieben.

Erforderliche geheime Runtime-Werte im Sites-Backend:

- `BLOG_BOOTSTRAP_USERNAME`
- `BLOG_BOOTSTRAP_SALT` (Hex)
- `BLOG_BOOTSTRAP_HASH` (PBKDF2-SHA-256, 100.000 Iterationen, 32 Bytes)
- `BLOG_AUTH_SECRET`

Die produktiven Werte wurden außerhalb des Quellcodes eingerichtet. Ein anderes Backend braucht eine eigene sichere Einrichtung dieser Werte und die D1-Bindung `DB`. `.openai/hosting.json` enthält nur Site-Identität und logische Bindungen.

Das Redaktionskonto nutzt ein starkes, zufällig erzeugtes Passwort. Sitzungen sind auf 8 Stunden beschränkt. Das Cookie `__Host-lennox_blog_session` ist HttpOnly, Secure, SameSite=Lax und hostgebunden; in SQLite liegt nur sein Hash. Abmelden und Passwortänderungen widerrufen die betreffenden Sitzungen. Die API prüft Authentifizierung bei jedem geschützten Aufruf und erlaubt schreibende Browser-Anfragen nur von den beiden eingerichteten Website-Ursprüngen. Bei einer eigenen Domain muss die Origin-Liste in `server/blog-service.mjs` ergänzt und neu veröffentlicht werden.

Anmeldeversuche werden über gehashte Benutzer- und Netzwerkkennungen in SQLite begrenzt. Öffentliche Endpunkte liefern ausschließlich veröffentlichte Beiträge und deren Titelbilder. Rohes HTML wird als Text dargestellt; Links erlauben nur HTTP, HTTPS und mailto. Der Editor meldet parallele Änderungen, statt diese still zu überschreiben. Antworten des Blogdienstes werden nicht zwischengespeichert.

## Entwicklung und Veröffentlichung

Node.js 22.13 oder neuer (Tests mit `node:sqlite` unter Node.js 24).

```sh
npm run install:ci
node --test tests/*.test.mjs
npm run db:generate  # nur nach Schemaänderungen
npm run build
```

Migrationen enthalten ausschließlich Schemaänderungen. Bereits veröffentlichte SQL-Dateien und Drizzle-Metadaten unverändert lassen; weitere Migrationen anhängen. Die Sites-Veröffentlichung spielt neue Migrationen vor dem Backend-Upload ein. Die lokalen Daten unter `.wrangler/` sind von der produktiven Datenbank getrennt und werden nicht eingecheckt.

Ein Push ins verbundene GitHub-Repository aktualisiert das statische Netlify-Frontend. Backendänderungen müssen zusätzlich über die bestehende Sites-Veröffentlichung gebaut und veröffentlicht werden. Eine reine Netlify-Veröffentlichung provisioniert die SQLite-Datenbank nicht. Die beiden Veröffentlichungen müssen verfügbar bleiben, damit Blog und Anmeldung funktionieren.

## Buchprojekte und Datenschutz

- Das Licht von Bethlehem: bestehendes Buchprojekt mit Cover, Beschreibung und Entwicklungsstand.
- Abenteuer mit Maggie: zweites Buchprojekt mit dem bereitgestellten Cover. Es ist kein Veröffentlichungstermin und kein Verkauf angekündigt.
- Das Kontaktformular bleibt deaktiviert; die E-Mail-Verknüpfung bleibt erreichbar.
- Das Impressum bleibt auf Wunsch pausiert.
- Die Datenschutzerklärung bleibt ein ausdrücklich gekennzeichneter **Entwurf** mit der E-Mail-Adresse. Die früher zurückgestellten vollständigen Betreiberangaben sind weiterhin offen. Die neuen Blog-, SQLite-, Hosting- und Sitzungsdaten sind beschrieben; die Vertragskette und tatsächlichen Hosting-/Sicherungsbedingungen müssen vor der endgültigen Fassung bestätigt werden.
- Es gibt keine eingebauten Analyse- oder Marketingdienste. Das optionale Hinweis-Cookie `lennox_privacy_notice` wird nur nach ausdrücklicher Auswahl für bis zu 180 Tage gesetzt. Das notwendige Login-Cookie wird separat erklärt und über Abmelden beendet.

Der Blog beginnt ohne erfundene Beiträge. Die erste echte Veröffentlichung erfolgt durch die Redaktion. Eine Erreichbarkeitsprüfung oder ein erfolgreiches Deployment bestätigt keine rechtliche Vollständigkeit des Impressums oder Datenschutzentwurfs.
