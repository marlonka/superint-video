# Entwicklung

Repository: [marlonka/superint-video](https://github.com/marlonka/superint-video). Zugang ist auf berechtigte GitHub-Konten beschränkt.

## Umgebung

Geprüft auf Windows x64 mit Rust 1.99.0 und Node.js 26.11.0. Rust benötigt die MSVC-Buildtools. Chrome/Chromium/Edge sowie FFmpeg und ffprobe werden für echte Frame- und Exportprüfungen separat installiert. Hinweise stehen in der [README](README.md).

```powershell
.\scripts\build.ps1
```

Der Build installiert die gesperrten npm-Abhängigkeiten und verwendet `Cargo.lock`. Studio muss vor Rust gebaut werden, weil die statischen Dateien in die EXE eingebettet werden. Kein `cargo build` aus einem frischen Checkout ohne vorherigen Studio-Build.

## Prüfungen

`build.ps1` führt Schema-/Svelte-Prüfung, Szenen-Tests, Rustfmt, Rust-Tests, Release-Build und HTTP-API-Prüfung aus. Vor Änderungen an Studio zusätzlich die Formatierung prüfen:

```powershell
Push-Location studio
npm run format:check
Pop-Location
```

Für Änderungen an Medien, Player, Szenen-Runtime oder Rendering:

```powershell
cargo test --test render_contract --test media_contract --test failure_contract -- --ignored --test-threads=1
```

Diese Tests verwenden echte Browser- und Media-Prozesse. Mit einem lokalen Testprojekt außerdem representative Frames, Wiedergabe, Rückwärtssprünge und einen fertigen Export prüfen. Testausgaben nicht committen.

## Änderungen am Projektformat

1. Rust-Modell und Validierung ändern.
2. Das Schema über die gebaute CLI mit `schema` neu exportieren; `docs/video.schema.json` als UTF-8 aktualisieren.
3. `node scripts/generate-types.mjs` ausführen.
4. `docs/FORMAT.md`, Schnittstellen und betroffene Skill-Referenzen aktualisieren.
5. Kompletten Build ausführen. Der Build prüft die Übereinstimmung zwischen Rust-Schema und eingecheckter Datei.

Generierte Manifest-Typen nicht von Hand bearbeiten. Bestehende Projektdateien, Clip-IDs und Source-Offsets erhalten.

## Studio-Änderungen

[Designregeln](docs/design.md) lesen; produktbezogene Entscheidungen in [REDESIGN.md](docs/REDESIGN.md) festhalten. Beide Themes, schmale Fenster, Tastaturbedienung, Fokus und ungespeicherte Eingaben prüfen. Keine Remote-Fonts oder Telemetrie einführen.

## Git und Releases

Branches mit `codex/` beginnen. Commits folgen Conventional Commits, beispielsweise `fix: preserve source offset after trim`. Pull Requests beschreiben Problem, resultierendes Verhalten und ausgeführte Prüfungen.

`dist/`, `target/`, npm-Abhängigkeiten, Renderausgaben und lokale Caches sind ausgeschlossen. `build.ps1` erzeugt das Windows-ZIP und `SHA256SUMS.txt`; für ein Release das geprüfte ZIP, die EXE und die Prüfsummen gemeinsam hochladen. Die Versionsnummer stammt aus `Cargo.toml` und muss zur Studio-Version und den Release-Notizen passen.

Drittanbieterhinweise und ursprüngliche Lizenztexte mitführen. Der Quellcode steht unter der MIT-Lizenz; Beiträge werden unter derselben Lizenz aufgenommen.
