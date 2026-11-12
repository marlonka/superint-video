# Sicherheit / Security

## Eine Lücke melden / Reporting a vulnerability

Bitte melde Sicherheitslücken **nicht** in einem öffentlichen Issue. Nutze stattdessen GitHubs privates Meldeformular: [Report a vulnerability](https://github.com/marlonka/superint-video/security/advisories/new). Du bekommst in der Regel innerhalb einer Woche eine Antwort.

Please do **not** report security issues in a public issue. Use GitHub's private form instead: [Report a vulnerability](https://github.com/marlonka/superint-video/security/advisories/new). You will usually hear back within a week.

Hilfreich sind / Helpful:

- die Version (`superint-video --version`) und dein System,
- die Schritte, die das Problem zeigen, und was dabei passiert,
- was ein Angreifer damit erreichen könnte.

## Unterstützte Versionen / Supported versions

Sicherheitskorrekturen gibt es für die jeweils neueste Version. / Fixes go into the latest release.

## Was zur Angriffsfläche gehört / Scope

Superint Video läuft lokal. Besonders interessant sind:

- die lokalen Server von Studio und App (gedacht nur für `127.0.0.1`),
- Pfade in Projekten und Stil-Dateien (`.superint-style.zip`), die aus ihrem Ordner herausführen,
- der Umgang mit API-Schlüsseln (verschlüsselt in der App, `.env`),
- Befehle, die die App startet (etwa `winget`).

Szenen sind HTML und JavaScript, die in Chrome laufen. Öffne nur Projekte und Stile, deren Herkunft du vertraust, so wie du auch keine fremde Website-Datei ungeprüft öffnen würdest.

Scenes are HTML and JavaScript that run in Chrome. Only open projects and styles from sources you trust.
