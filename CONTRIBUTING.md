# Mitmachen

Danke, dass du Superint Video besser machen willst. Fehlerberichte, Ideen, Stile und Code sind willkommen.

*English: Issues and pull requests in English are just as welcome as in German. The steps below are the same for everyone.*

## Fehler melden und Ideen vorschlagen

- **Fehler:** Öffne ein [Issue](https://github.com/marlonka/superint-video/issues/new/choose) mit der Vorlage „Fehler“. Am meisten hilft die Ausgabe von `superint-video doctor --json`, die genaue Fehlermeldung und, wenn möglich, ein kleines Projekt, das den Fehler zeigt. Entferne vorher API-Schlüssel und alles, was du nicht teilen willst.
- **Sicherheitslücken** meldest du nicht öffentlich, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.
- **Ideen:** Ein Issue mit der Vorlage „Idee“. Beschreib, welchen Film du machen willst und woran es scheitert, nicht nur die Lösung.
- **Größere Änderungen** (neue Befehle, Änderungen am Projektformat, ein neues Preset) bitte erst in einem Issue besprechen, bevor du viel Zeit hineinsteckst.

## Was gerade besonders hilft

- Erfahrungen auf anderen Rechnern: Geprüft ist bisher nur Windows x64. Berichte von macOS oder Linux, auch gescheiterte, sind wertvoll.
- Eigene Stile (`preset export`) und Fehler in den Skills, die ein Agent falsch versteht.
- Übersetzungen der Oberfläche über Deutsch und Englisch hinaus (`studio/src/i18n/`).

## Umgebung

Geprüft auf Windows x64 mit Rust 1.100.0, Node.js 26.13.1 LTS und npm 12.2.2. Rust benötigt die MSVC-Buildtools. Für den Installer kommt [Inno Setup 6](https://jrsoftware.org/isinfo.php) dazu (`winget install --id JRSoftware.InnoSetup --exact --scope user`); ohne baut der Build nur das ZIP und sagt das. Aufbau und Befehle im Überblick: [docs/ENTWICKLER.md](docs/ENTWICKLER.md). Chrome, Chromium oder Edge sowie FFmpeg und ffprobe werden für echte Frame- und Exportprüfungen separat installiert.

```powershell
.\scripts\build.ps1
```

Der Build installiert die gesperrten npm-Abhängigkeiten und verwendet `Cargo.lock`. Studio muss vor Rust gebaut werden, weil seine Dateien in die EXE eingebettet werden: also kein `cargo build` aus einem frischen Checkout ohne vorherigen Studio-Build.

Die Demo unter `examples/demo` braucht einmal `.\scripts\generate-demo-assets.ps1`.

## Prüfungen

`build.ps1` führt Schema- und Svelte-Prüfung, Szenen-Tests, Rustfmt, Rust-Tests, Release-Build und HTTP-API-Prüfung aus. Die CI führt dasselbe bei jedem Pull Request aus, unter Windows und mit `scripts/build-mac.sh` auf einem Mac; dort startet sie zusätzlich die App aus dem Bundle und rendert das Starterprojekt. Vor Änderungen an Studio zusätzlich die Formatierung prüfen:

```powershell
Push-Location studio
npm run format:check
Pop-Location
```

Für Änderungen an Medien, Player, Szenen-Runtime oder Rendering:

```powershell
cargo test --test render_contract --test media_contract --test failure_contract -- --ignored --test-threads=1
```

Diese Tests verwenden echte Browser- und FFmpeg-Prozesse. Prüfe mit einem lokalen Testprojekt außerdem einzelne Frames, Wiedergabe, Rückwärtssprünge und einen fertigen Export. Testausgaben, Renders und eigene Filme gehören nicht ins Repository.

## Änderungen am Projektformat

1. Rust-Modell und Validierung ändern.
2. Das Schema über die gebaute CLI mit `schema` neu exportieren und `docs/video.schema.json` als UTF-8 aktualisieren.
3. `node scripts/generate-types.mjs` ausführen.
4. `docs/FORMAT.md`, `docs/INTERFACES.md` und betroffene Skill-Referenzen aktualisieren.
5. Den kompletten Build ausführen. Er prüft, ob Rust-Schema und eingecheckte Datei übereinstimmen.

Generierte Manifest-Typen nicht von Hand bearbeiten. Bestehende Projektdateien, Clip-IDs und Source-Offsets bleiben gültig.

## Studio und App

Lies die [Designregeln](docs/design.md); produktbezogene Entscheidungen stehen in [REDESIGN.md](docs/REDESIGN.md). Prüfe beide Themes, schmale Fenster, Tastaturbedienung, Fokus und ungespeicherte Eingaben. Jeder sichtbare Text steht in beiden Sprachkatalogen (`studio/src/i18n/de.ts` und `en.ts`). Keine Remote-Fonts, keine Telemetrie, keine Aufrufe an Dienste, die der Nutzer nicht selbst eingerichtet hat.

## Pull Requests

- Ein Branch je Änderung, ein Pull Request gegen `main`.
- Commit-Nachrichten folgen [Conventional Commits](https://www.conventionalcommits.org/), etwa `fix: preserve source offset after trim`.
- Der Pull Request beschreibt das Problem, das neue Verhalten und die ausgeführten Prüfungen. Änderungen, die Nutzer bemerken, bekommen einen kurzen Eintrag unter „Unveröffentlicht“ in [CHANGELOG.md](CHANGELOG.md), eingeordnet nach „Neu“, „Geändert“, „Behoben“ und „Entfernt“: ein Satz, was sich für Nutzer ändert, nicht wie.
- Keine API-Schlüssel, `.env`-Dateien, persönlichen Pfade oder fremden Bilder und Filme committen. Referenzbilder, an deren Rechten du zweifelst, bleiben lokal (`preset reference`).
- Neue Abhängigkeiten nur mit Grund. Jede neue Abhängigkeit kommt mit Lizenz in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) und `docs/THIRD_PARTY_LICENSES.txt`.

## Releases

`dist/`, `target/`, npm-Abhängigkeiten, Renderausgaben und lokale Caches sind ausgeschlossen. `build.ps1` erzeugt `Superint-Video-Setup.exe` (mit [`packaging/setup.iss`](packaging/setup.iss)), das Windows-ZIP und `SHA256SUMS.txt`. Ein Release enthält das Setup, das ZIP, die CLI-EXE und die Prüfsummen, dazu `Superint-Video-macOS.zip` aus dem Workflow „macOS build“ des Release-Tags (`gh run download`), dessen Prüfsumme in `SHA256SUMS.txt` mit hinein kommt. Das Setup heißt in jeder Version gleich, damit der Download-Link der README immer zur neuesten führt. Die Versionsnummer stammt aus `Cargo.toml` und muss zur Studio-Version, zum CHANGELOG und zum Versions-Badge der beiden READMEs passen.

## Lizenz

Der Quellcode steht unter der [MIT-Lizenz](LICENSE). Mit einem Beitrag stimmst du zu, dass er unter derselben Lizenz veröffentlicht wird.
