# Versionsverlauf

Was sich in jeder Version von Superint Video geändert hat, die neueste zuerst. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Nummern folgen [Semantic Versioning](https://semver.org/lang/de/). Jede Version zum Herunterladen steht unter [Releases](https://github.com/marlonka/superint-video/releases).

## [Unveröffentlicht]

### Sicherheit

- „Film öffnen“ in Studio öffnet nur noch eine MP4-Datei. Ein Projekt aus fremder Hand konnte dort bisher eine beliebige Datei eintragen, auch ein Programm, das der Klick dann gestartet hätte.
- Eine fremde Website kann Studio und die App nicht mehr im Hintergrund ansprechen, etwa um eine Prüfung des Films anzustoßen.
- Gespeicherte API-Schlüssel sind unter Windows jetzt zusätzlich an Superint Video gebunden: Ein Programm, das Windows einfach bittet, alles zu entschlüsseln, was dein Konto verschlüsselt hat, bekommt sie nicht mehr. Deine Schlüssel werden beim ersten Start von selbst umgestellt. Eine ältere Version liest sie danach nicht mehr.
- Die App überschreibt die Kopien der Schlüssel, die sie selbst im Arbeitsspeicher hält, sobald sie sie nicht mehr braucht. Auf dem Mac macht sie eine Schlüsseldatei, die andere Benutzer lesen könnten, wieder nur für dich lesbar.

## [0.11.0] – 2026-11-14

### Neu

- **Superint Video für den Mac:** `Superint-Video-macOS.zip` enthält die App für Apple-Chip und Intel (macOS 11 oder neuer). Die README erklärt in vier Schritten, wie du sie öffnest.
- Auf dem Mac holt „Installieren“ in der Einrichtung Chrome, FFmpeg, Earshot und die Google Cloud CLI über Homebrew in einem Terminal-Fenster.

### Geändert

- Eine neue Version löst beim Start eine noch laufende ältere ab, auch wenn sie am selben Ort liegt.

### Behoben

- Mit einem FFmpeg ohne `zscale`, etwa dem von Homebrew, schlug jeder Render fehl. Jetzt rechnet Superint Video die Farben dann selbst um, auf eine Stufe genau wie mit `zscale`.

## [0.10.0] – 2026-11-14

### Neu

- **Der Feinschliff arbeitet Details aus:** Vor dem Render behebt dein Coding-Agent nicht mehr nur Fehler. Er ergänzt in jedem Bild, was ihm fehlt: Material, kleine Teile, Licht, Tiefe.
- `superint-video studio <Ordner> --background` holt Studio im Hintergrund zurück und nennt sofort seine Adresse. Es läuft weiter, auch wenn dein Coding-Agent sich beendet.

### Geändert

- **Der Feinschliff ist viel schneller:** Dein Coding-Agent sieht alle 10 Sekunden ein Standbild an (bei Filmen bis zu einer Minute alle 5), bessert es sofort nach, sieht einmal das Ergebnis an und geht zum nächsten. Vorher sah er Hunderte Bilder an und brauchte dafür über eine Stunde.
- Studio zeigt beim Feinschliff, welches Bild gerade angesehen wird und was daran gebessert wurde.
- **Musik ist leiser Hintergrund, auch in der Vorschau:** `mix` schreibt die Lautstärke der Musik in den Clip. Vorher spielte die Vorschau in Studio die Musik viel lauter als der fertige Film.
- Stellst du die Lautstärke der Musik in Studio selbst ein, gilt dein Wert auch im fertigen Film.

### Behoben

- Befehle brachen mit „project changed while …“ ab, wenn Studio im selben Moment etwas speicherte. Sie warten jetzt kurz und lesen neu.
- `listen` für einen Ausschnitt überschrieb die Antwort für den ganzen Film.

## [0.9.5] – 2026-11-13

### Geändert

- Unter „Neuer Film“ steht direkt über dem Prompt, wohin er gehört: in Claude Code, ChatGPT Codex oder Google Antigravity.
- Alle Auswahllisten haben denselben Pfeil wie das Feld „Länge“.

### Behoben

- Die Auswahllisten schnitten ihren Text weit vor dem Pfeil ab, etwa bei „16:9, quer (YouTube)“. Passt ein Text wirklich nicht, endet er jetzt mit „…“.

## [0.9.4] – 2026-11-13

### Neu

- **Google Cloud findet ein passendes Projekt:** Lehnt Google deine Anmeldung für ein Projekt ab, sucht „Prüfen“ unter deinen anderen Projekten die, in denen es funktioniert, und bietet sie mit einem Klick an.

### Geändert

- README, Startseite und Handbuch sagen klarer, wie es gedacht ist: Superint Video schreibt den Prompt, du kopierst ihn in deinen Coding-Agenten, und der baut den Film, während du zuschaust oder im Hintergrund.
- Nach „Prompt kopieren“ steht unter dem Prompt, was als Nächstes kommt.
- Name und Version stehen oben in der Mitte.
- „Erneut prüfen“ erscheint in der Einrichtung nur, solange etwas offen ist, und sagt, was es tut.
- Der Feinschliff heißt jetzt „Visueller Qualitäts-Feinschliff vor dem Render“.

### Behoben

- Die Prüfung von Google Cloud sprach von einem API-Schlüssel, obwohl die App mit deiner Google-Anmeldung fragte. Jetzt nennt sie die Anmeldung, das Projekt und den Grund der Ablehnung.

## [0.9.3] – 2026-11-13

### Behoben

- Benutzen mehrere Clips dieselbe Szene und scheitern alle, nennt die Meldung jetzt immer den ersten Clip, nicht den, der zufällig zuerst fertig war.
- Ein Fehler, den eine Szene schon beim Laden meldet, beginnt nicht mehr mit einem doppelten „Error:“.

## [0.9.2] – 2026-11-13

### Neu

- **Installer:** `Superint-Video-Setup.exe` installiert die App mit zwei Klicks und ohne Adminrechte. Dazu kommen ein Symbol auf dem Desktop, ein Eintrag im Startmenü und „Deinstallieren“ in den Windows-Einstellungen. Für ein Update installierst du einfach drüber. Das ZIP gibt es weiterhin.
- **Desktop und Startmenü in der Einrichtung:** Wer das ZIP nutzt, legt die App mit „Auf den Desktop legen“ dorthin. Zeigt eine Verknüpfung auf eine ältere Kopie, erneuert die Einrichtung sie.
- **API-Schlüssel aus einer `.env` übernehmen:** Liegen Schlüssel unverschlüsselt in einer `.env`-Datei, holt „In die App übernehmen“ sie verschlüsselt in die App und legt die Datei in den Papierkorb.

### Geändert

- Die README ist kurz und für alle gedacht: was du brauchst, Installieren, erster Film, häufige Fragen. Technisches steht in [docs/ENTWICKLER.md](docs/ENTWICKLER.md).
- Dieser Versionsverlauf ist gekürzt und folgt Keep a Changelog.
- Der Build räumt ältere Pakete aus `dist\` weg.

### Behoben

- Der Starter `Superint Video.exe` lief unsichtbar weiter, solange Chrome offen war, und sperrte dabei seine eigene Datei.
- Wer die App aus einer anderen Kopie startete, etwa nach einem Update in einem neuen Ordner, sah die alte, noch laufende App. Jetzt löst die gestartete App die laufende ab.

## [0.9.1] – 2026-11-13

### Behoben

- Studio und App endeten, wenn die Desktop-App des Coding-Agenten sich schloss oder aktualisierte. Jetzt laufen sie weiter, und ein Studio kommt an seiner alten Adresse zurück.
- Die App beendete sich, obwohl ihre Seite hinter anderen Fenstern noch offen war.

### Geändert

- `app --stop` beendet auch die Studios, damit ein Update das Programm ersetzen kann. Beim nächsten Start holt die App sie zurück.

## [0.9.0] – 2026-11-13

### Neu

- **Echtes HTML im Canvas:** Szenen schicken echte Oberflächen durch Shader, etwa einen Bildschirm im Raum mit Schärfentiefe. Auch die Miniaturwelt zeigt so Bildschirme, Briefe und Zeitungen.
- Fehlermeldungen der App sind verständlich und auf Deutsch und Englisch. Ein Fehler in einer Szene nennt Szene, Meldung und Stelle im Code.

### Geändert

- Lehnt ein Anbieter eine Anfrage ab, nimmt Superint Video den nächsten eingerichteten Weg, statt stehen zu bleiben.

### Behoben

- Die App beendete sich nach langem Ruhezustand des Computers.

## [0.8.0] – 2026-11-13

### Neu

- **Filme ohne API-Schlüssel:** Nötig sind nur ein Coding-Agent, Chrome und FFmpeg.
- **Eigene Stimme:** Im Studio Absatz für Absatz einsprechen oder eine Audiodatei geben, auch über den fertigen Film.
- Unter „Neuer Film“ wählst du „KI-Stimme“, „Eigene Stimme“ oder „Ohne Stimme“.

### Geändert

- Jedes MP4 hat eine Tonspur, notfalls eine stille.
- Chrome DevTools MCP wird ohne Nutzungsdaten und ohne Trace-Adressen eingerichtet.

## [0.7.1] – 2026-11-12

### Behoben

- Einstellungen und Schlüssel liegen jetzt in `%USERPROFILE%\.superint-video`. Vorher bekam jede Desktop-App, die Superint Video startete, ihre eigene Kopie davon.

## [0.7.0] – 2026-11-12

### Neu

- Feinschliff in ein bis drei Runden vor jedem Render, jede mit frischen Augen.
- Stil-Karten zeigen ein 16:9-Bild, das langsam zwischen Standbildern wechselt. Die mitgelieferten Stile haben eigene Vorschaubilder.

## [0.6.1] – 2026-11-12

### Geändert

- Gebaut mit Node.js 26.13.1 LTS, npm 12.2.2, Rust 1.100.0, Vite 8 und TypeScript 7.

## [0.6.0] – 2026-11-12

### Neu

- Die Einrichtung zeigt, bei welchem Coding-Agenten Chrome DevTools MCP fehlt, und gibt ihm die Anleitung.
- Stimmen für Gemini und ElevenLabs wählst du aus einer Liste.

## [0.5.0] – 2026-11-12

### Neu

- Einen eigenen Stil aus bis zu 12 Bildern und einer Beschreibung erstellen, oder aus einem fertigen Film.
- Einen Film als Vorlage für einen neuen nutzen oder duplizieren.
- Ein eigenes Modell für neue Stile wählen.

## [0.4.0] – 2026-11-12

### Neu

- „Neuer Film“ wählt Stil, Länge und Sprache passend zum Thema, aus 46 Sprachen.
- Diktieren statt tippen, mit Google, OpenAI oder OpenRouter.
- Google Cloud (auch mit Google-Anmeldung) und OpenAI als weitere Anbieter, und eigene Modelle wählen.
- Google Antigravity als Coding-Agent.
- Die Schrift eines ganzen Films ändern. Der Coding-Agent bedient alles, was Studio kann (`edit`, `models`, `fonts`).
- Texte direkt im Vorschaubild ändern.

### Geändert

- Die Startseite ist neu geordnet: Neuer Film, Stile, Filme. Die Einrichtung ist eine eigene Seite.
- Bereit für Open Source: englische README, Sicherheitsrichtlinie, Vorlagen für Issues und Pull Requests.

### Behoben

- Earshot wird von GitHub installiert. Auf PyPI gehört der Name einem anderen Projekt.

## [0.3.0] – 2026-11-12

### Neu

- Stil `launch` für Launch-Filme: die echte Oberfläche des Produkts in Code, Musik im Takt, ein Schlussbild.

### Geändert

- Die Versionsgeschichte des Repositorys beginnt neu. Ältere Klone werden neu geklont.

## 0.2.0 – 2026-11-12

### Neu

- **Die App:** Startseite auf Deutsch und Englisch, Einrichtung mit einem Knopf je Zeile, verschlüsselte API-Schlüssel, Filme an einem festen Ort, Stile als Datei.
- Werkzeug, Ablauf und Look getrennt: die Ablauf-Skills `superint-explainer` und `superint-launch`, der Ton-Skill `superint-audio` und die Stile `flat-explainer`, `miniature-3d` und `blank`.
- Studio zeigt die Arbeit des Coding-Agenten und jeden Render live.
- Die Befehle `polish` und `listen`.
- Schnellerer Export mit mehreren Browsern gleichzeitig, HEVC als Standard.

## 0.1.0 – 2026-10-09

### Neu

- Erste Version: eine Rust-CLI und Studio im Browser für HTML-Szenen, Timeline, Prüfen, Snapshots und MP4-Export über Chromium und FFmpeg.

[0.11.0]: https://github.com/marlonka/superint-video/releases/tag/v0.11.0
[0.10.0]: https://github.com/marlonka/superint-video/releases/tag/v0.10.0
[0.9.5]: https://github.com/marlonka/superint-video/releases/tag/v0.9.5
[0.9.4]: https://github.com/marlonka/superint-video/releases/tag/v0.9.4
[0.9.3]: https://github.com/marlonka/superint-video/releases/tag/v0.9.3
[0.9.2]: https://github.com/marlonka/superint-video/releases/tag/v0.9.2
[0.9.1]: https://github.com/marlonka/superint-video/releases/tag/v0.9.1
[0.9.0]: https://github.com/marlonka/superint-video/releases/tag/v0.9.0
[0.8.0]: https://github.com/marlonka/superint-video/releases/tag/v0.8.0
[0.7.1]: https://github.com/marlonka/superint-video/releases/tag/v0.7.1
[0.7.0]: https://github.com/marlonka/superint-video/releases/tag/v0.7.0
[0.6.1]: https://github.com/marlonka/superint-video/releases/tag/v0.6.1
[0.6.0]: https://github.com/marlonka/superint-video/releases/tag/v0.6.0
[0.5.0]: https://github.com/marlonka/superint-video/releases/tag/v0.5.0
[0.4.0]: https://github.com/marlonka/superint-video/releases/tag/v0.4.0
[0.3.0]: https://github.com/marlonka/superint-video/releases/tag/v0.3.0
