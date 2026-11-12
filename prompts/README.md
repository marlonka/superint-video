# Starter-Prompts

Kopierfertige Aufträge für Claude Code oder Codex. Ersetze die Teile in `<spitzen Klammern>` und schicke den Text im Ordner deiner Wahl ab. Der Agent braucht Zugriff auf Dateien, Shell und (für die Recherche) Websuche, und er muss die Skills `superint-video`, `superint-audio` und den passenden Ablauf-Skill (`superint-explainer`, `superint-launch`) kennen (siehe [README](../README.md#agenten-einrichten)).

| Datei | Wofür |
| --- | --- |
| [explainer.md](explainer.md) | Der Hauptauftrag: Erklärvideo zu einem Thema, Agent recherchiert, schreibt, gestaltet und rendert selbst |
| [miniatur.md](miniatur.md) | Erklärfilm im Look von „Videos aus Code“: eine fotografische Miniaturwelt, ganz aus Code gerechnet |
| [launch.md](launch.md) | Launch-Film, Update-Video oder Produktvideo zu einem Produkt, im eigenen Branding oder mit erfundenem |
| [short.md](short.md) | Zusätze für Hochkant-Shorts (9:16, 30–45 s) |
| [eigenes-skript.md](eigenes-skript.md) | Video zu einem Sprechertext, den du schon hast |
| [bearbeiten.md](bearbeiten.md) | Bestehendes Projekt ändern, ohne den Rest anzufassen |

## Aufteilung

Die Prompts sind absichtlich kurz. Was bei jedem Video gleich ist, steht an einer Stelle und wird nicht in jeden Prompt kopiert:

| Wo | Was |
| --- | --- |
| Prompt bzw. `brief.md` | Thema, Botschaft, Länge, Format, Zielgruppe, Muss/Vermeiden, Stopps, Anspruch |
| Skill `superint-video` | Das Werkzeug: Projekt, Szenen-API, CLI, Prüfen, Review-Durchgänge, Polish-Durchgang vor dem Render, Rendern |
| Ablauf-Skill (`superint-explainer`, `superint-launch`) | Wie diese Art Film geplant, geschrieben, komponiert und geprüft wird |
| Skill `superint-audio` | Stimme, Musik, SFX und Mix; je Anbieter (Google AI Studio, OpenRouter) eine eigene Datei |
| Preset (`STYLE.md`, `kit/`, `blocks/`, `references/`) | Look: Farbe, Licht, Typografie, Formen, Bewegung, Fallstricke, Bausteine, Referenzbilder |

So bleibt ein Prompt lesbar, und eine Verbesserung am Skill oder Preset wirkt sofort in allen künftigen Videos. Jeder Ablauf funktioniert mit jedem Preset.

## Tipps

- **Stopps:** Ohne Stopps arbeitet der Agent bis zum fertigen MP4 durch. `concept` hält nach den Konzepten an, `script` nach dem Skript, `frames` nach den Style-Frames, `contact` vor dem finalen Render.
- **Botschaft vorgeben:** Der eine Satz, den der Film vertreten soll (`BOTSCHAFT`, `--message`), verbessert das Ergebnis mehr als lange Stilbeschreibungen. Ohne ihn sucht sich der Agent selbst einen Winkel, und der kann an deiner Absicht vorbeigehen.
- **Ton:** Stimme, Wort-Timestamps und Musik laufen über `voice`, `transcribe` und `music` (Standard: `GEMINI_API_KEY`, Alternative: `OPENROUTER_API_KEY`). Die Soundeffekte kommen aus Earshot, wenn es installiert ist. Ohne Ton entsteht ein stummes Video.
