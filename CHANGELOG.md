# Versionsverlauf

## Unveröffentlicht

- **Google Antigravity als Coding-Agent:** Die Einrichtung erkennt Antigravity (App oder CLI) und kopiert die Superint-Skills mit einem Klick nach `%USERPROFILE%\.gemini\config\skills`, wo App und CLI sie finden. Der Auftrag für Earshot heißt jetzt „Auftrag für deinen Coding-Agenten kopieren“.

- **Google Cloud mit Google-Anmeldung:** „Mit Google anmelden (ADC)“ ist jetzt der empfohlene Weg zu Google Cloud, Googles Application Default Credentials statt eines API-Schlüssels. Ein Fenster holt bei Bedarf die Google Cloud CLI über winget und öffnet `gcloud auth application-default login` im Browser; die App holt sich danach kurzlebige Zugangsschlüssel für dein Konto und speichert selbst nichts davon. Gebraucht wird eine Projekt-ID (Einrichtung, `GOOGLE_CLOUD_PROJECT` oder das Abrechnungsprojekt der Anmeldung). Der API-Schlüssel bleibt als „Stattdessen einen API-Schlüssel eintragen“ und geht vor, wenn einer gespeichert ist.

- **Mikrofon im Feld:** Statt „Sprechen“ steht ein Mikrofon-Knopf unten rechts im Eingabefeld. Während der Aufnahme sind er und der Rand des Felds blau, die einzige Farbe der App, und derselbe Knopf schreibt die Aufnahme auf; „✕“ oder Escape verwirft sie.
- **Werkzeuge ohne Neustart finden:** Hat winget ein Werkzeug nur in den PATH eingetragen statt einen Link anzulegen (ohne Entwicklermodus der Normalfall), findet die App es trotzdem: Sie liest den PATH, den Windows gespeichert hat. Das Earshot-Fenster findet uv auch in winget's Paketordner.

- **Text in der Vorschau ändern:** Im angehaltenen Studio-Bild zeigt ein Rahmen, welche Texte sich ändern lassen, sobald die Maus über dem Bild ist. Ein Klick öffnet direkt am Text ein Feld mit dem bisherigen Wortlaut; Enter übernimmt (in die `props` des Clips, wie rechts im Inspektor), Esc bricht ab. Szenen finden ihre Texte über `data-prop="key"` oder, ohne Markierung, als Element mit genau dem Text des Props; der Player meldet sie als `texts` in Bühnenpixeln. Die Skills sagen Claude, Texte so zu markieren.

- **Earshot richtig installieren:** Die Einrichtung empfahl `pip install earshot`, doch auf PyPI gehört der Name einem anderen Projekt (Spracherkennung von pykeio). Jetzt installiert „Installieren“ Earshot von GitHub mit uv (`uv tool install "earshot[mcp,llm] @ git+https://github.com/Leonxlnx/earshot"`) und holt uv vorher über winget, wenn es fehlt; „Auftrag für Claude Code oder Codex kopieren“ gibt dieselbe Aufgabe dem Coding-Agent. Die App findet Werkzeuge, die uv oder pipx nach `%USERPROFILE%\.local\bin` legen, auch ohne Neustart.
- **Einrichtung führt:** Drei nummerierte Schritte mit Fortschrittsbalken, erledigte mit Haken, der nächste hervorgehoben, Freiwilliges ohne Nummer. Nach dem letzten Schritt bleibt die Einrichtung stehen, bis „Weiter zum ersten Film“ gewählt wird, statt sofort zu verschwinden.

- **Sprechen statt tippen:** Unter „Neuer Film“ nimmt „Sprechen“ das Thema über das Mikrofon auf. Während du sprichst, zeigt eine Wellenform, dass das Mikrofon dich hört, daneben laufen die Zeit, „✕“ (verwerfen, auch mit Escape) und „✓“ (aufschreiben). Das Modell deines API-Schlüssels schreibt es auf und setzt den Text dort ein, wo der Cursor stand: mit Google `gemini-3.5-transcribe` im Modus `smart` (ohne „äh“, Versprecher und Neuanfänge, mit deinen eigenen Korrekturen), sonst mit OpenAI `gpt-transcribe` oder OpenRouter `microsoft/mai-transcribe-2`. Die Aufnahme bleibt bis zum Senden im Fenster und wird nirgends gespeichert (`POST /api/app/dictate`).
- **Google Cloud als Anbieter:** Ein API-Schlüssel der Gemini Enterprise Agent Platform (früher Vertex AI) bringt dieselben Google-Modelle über dein Google-Cloud-Projekt, abgerechnet dort und zu dessen Bedingungen. Solange er da ist, gehen Googles Modelle über Google Cloud, sonst über AI Studio, beim Tageslimit weiter zum nächsten Weg bis OpenRouter. Mit Projekt-ID laufen Stimme, Wort-Zeitpunkte und Diktat in der Region `eu` (Standard) oder `us`; ohne Projekt ist es der globale Express-Modus. Musik nimmt dort `lyria-3-pro-preview`, global. Googles eigene Variablen gelten auch: `GOOGLE_API_KEY` mit `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`.
- **OpenAI fürs Diktat:** Ein OpenAI-Schlüssel schreibt Diktate mit `gpt-transcribe`, auf Wunsch über `eu.api.openai.com` für ein Projekt mit Datenresidenz in Europa. Für Filme nutzt das Werkzeug OpenAI bewusst nicht: Die Sprachmodelle der Speech-API enden am 6. Januar 2027, ihr Nachfolger liest nicht zugesagt wortgetreu, und Wort-Zeitpunkte gibt nur noch `whisper-1` (bis 26. Februar 2027).
- **Modelle wählen (für Profis):** Die Einrichtung hat einen Bereich „Modelle“: Stimme (Modell und Name), Wort-Zeitpunkte, Musik und Diktat nehmen jede Modell-ID, wie der Anbieter sie schreibt; die ID sagt den Anbieter. Sie gelten für neue Filme vor dem Stil, `voice.md` und `music-prompt.md` eines Films haben weiter das letzte Wort, und `doctor --json` nennt sie dem Agenten (`chosen`). Weitere Anbieter (Google Cloud, OpenAI) sind in der Einrichtung eingeklappt, bis sie einen Schlüssel haben. Einstellungen `narrationModel`, `narrationVoice`, `transcriptionModel`, `musicModel`, `dictationModel`, `googleCloudProject`, `googleCloudLocation`, `openAiRegion`.

- Bereit für Open Source: SECURITY.md, Vorlagen für Issues und Pull Requests, eine englische README (`README.en.md`) und ein überarbeitetes CONTRIBUTING.
- Handbuch und README sagen, was deinen Rechner verlässt (Stimme, Transkription und Musik beim gewählten Anbieter, sonst nichts) und wie du KI-Inhalte kennzeichnest.
- Jedes exportierte MP4 trägt in seinen Metadaten (`comment`, `description`), dass es mit Superint Video und KI-Hilfe entstanden ist.
- Das Windows-ZIP hat Pfade mit `/`, wie es das ZIP-Format verlangt; vorher entstanden beim Entpacken auf macOS und Linux Dateinamen mit `\` statt Ordnern. Die Gestaltungsnotizen für Studio liegen nur noch im Repository.
- Die Demo-Medien in `examples/demo/assets` liegen nicht mehr im Repository; `scripts/generate-demo-assets.ps1` erzeugt sie.
- Die Windows-CI läuft bei jedem Pull Request und jedem Push auf `main`.
- Die Filmliste behandelt einen Ordner gleich, ob sein Pfad lang oder in der Windows-Kurzform (`RUNNER~1`) geschrieben ist; vorher konnte ein wieder geöffneter Film versteckt bleiben, und der Test dazu scheiterte auf GitHubs Windows-Runnern.
- Die Skills nennen keine fremden Kanäle mehr als Stilvorbild.

## 0.3.0 — 2026-11-12

- Neuer Stil `launch` (Launch-Film): die echte Oberfläche des Produkts, in Code nachgebaut, auf dunklem Grund, große Zeilen über einem weich gezeichneten Bild, ein Schlussbild aus der letzten Form. Das Kit bringt das Taktraster der Musik, Kamera mit logarithmischem Zoom, Übergaben einer Form von Bildschirm zu Bildschirm, Tiefenschärfe und vier Arten, eine Zeile hereinzuholen. Standard-Ablauf `superint-launch`.
- Der Launch-Film von Superint Video liegt als Beispiel im Skill `superint-launch`; der Skill sagt jetzt, wie man einen Lyria-Track auf Taktgrenzen auf die Filmlänge schneidet und einen echten Lauf des Produkts als Fall nimmt.
- `sfx place` geht auch ohne Stimme: In einem Film, den die Musik trägt, richten sich die Pegel der Soundeffekte nach der Musik. `mix` meldet eine fehlende Stimme nur noch, wenn es eine aufgenommene gibt, die nicht auf der Timeline liegt.
- „Film fertig“ auf der Startseite stimmt auch bei Filmen, deren Schritte nicht englisch heißen: Der Server entscheidet es (`ready` in `/api/app`) aus dem fertigen Render und dem letzten Schritt.
- Die Menüs „⋯“ an Filmen und Stilen sind ein Bauteil: Pfeiltasten, Pos1, Ende und Escape gehen überall, und der Fokus kehrt zum Knopf zurück.
- Aufgeräumt: Studio und App teilen sich das Starten, Finden und Beenden ihres Servers, Zeit-, Datei- und Vorschaubild-Helfer gibt es nur noch einmal, und Code, den nur Tests riefen, ist weg. Der ganze Rust-Code ist wieder mit `cargo fmt` formatiert.
- Die Versionsgeschichte des Repositorys beginnt mit 0.3.0 neu: Ein Klon von vorher lässt sich nicht weiterziehen, sondern wird neu geklont.

## 0.2.0 — 2026-11-12

### Die App

- Ein Doppelklick auf `Superint Video.exe` (oder `superint-video app`) öffnet eine Startseite in einem eigenen Fenster, auf Deutsch und Englisch. Beim ersten Start gilt die Sprache des Systems, der Globus oben rechts stellt um (`settings set uiLanguage de`). Zahlen, Zeiten und Aufzählungen folgen der Sprache; die mitgelieferten Stile haben deutsche Titel und Beschreibungen (`translations` in `preset.json`).
- **Einrichtung:** Solange ein Coding-Agent mit Skills, Chrome, FFmpeg oder ein API-Schlüssel fehlt, zeigt die App nur sie, in vier Gruppen (Coding-Agent, Werkzeuge, Stimme und Musik, Freiwillig). Jede Zeile hat einen Knopf, der sie erledigt; unter jedem Anbieter stehen die Modelle, die ein Film damit nutzt. Ein abgewiesener Schlüssel bekommt kein Häkchen. „Installieren“ für Chrome und FFmpeg öffnet ein sichtbares Terminal mit einem festen winget-Befehl und stimmt nichts für dich zu.
- **API-Schlüssel** trägt man in der App ein. Sie bleiben auf dem eigenen Rechner, unter Windows für das Benutzerkonto verschlüsselt, und werden nie wieder angezeigt, auch dem Agenten nicht. Mit nur einem OpenRouter-Schlüssel laufen Stimme, Transkription und Musik über OpenRouter. Fehlt ein Schlüssel, sagt der Befehl das, bevor er etwas kostet.
- **Neuer Film** baut den Prompt für Claude Code oder ChatGPT Codex, **Filme** zeigt alle Filme mit ihrem Stand, **Vorgaben** legt Stil, Länge, Format, Sprache und den Filme-Ordner fest. `new` übernimmt diese Vorgaben; `settings` zeigt und ändert sie.
- **Filme-Ordner:** Jeder Film entsteht als eigener Ordner in `Videos\Superint Video`, nie im Programmordner oder in einem Code-Repository (`filmsFolder`; `SUPERINT_FILMS` für Tests).
- **Skills aktualisieren:** Die App vergleicht die Skills im Ordner des Coding-Agenten mit ihren eigenen und ersetzt sie auf Klick. Die bisherigen bleiben unter `replaced-skills` im Einstellungsordner erhalten, verknüpfte Skill-Ordner bleiben unberührt.
- **Stile als Datei:** „Als Datei exportieren“ schreibt `<name>.superint-style.zip`, „Stil importieren“ nimmt eine solche Datei an (auch `preset export` und `preset import`). Ein vergebener Name bekommt eine Nummer, und die Datei kann nichts außerhalb ihres Stil-Ordners schreiben.
- Startseite ohne Kästen und Etiketten, Stil-Karten mit „Als Standard“, „Referenzen“ und „Kopieren“, kurze Bewegungen bei Knöpfen, Menüs und Dialogen. Wer im System weniger Bewegung eingestellt hat, sieht keine.

### Werkzeug, Ablauf und Look getrennt

- Skill `superint-video` beschreibt nur noch das Werkzeug und lässt den Agenten vor `new` fragen: welche Art Film, welches Preset, welche Referenzbilder.
- Ablauf-Skills: `superint-explainer` für Erklärvideos (Recherche mit Claim-Register, Botschaft, drei Konzepte, Skript, Beats, Style-Frames, Review, Abgabe) und `superint-launch` für Launch-, Update- und Produktfilme, aufgebaut auf [cinetic](https://github.com/Leonxlnx/cinetic) von Leonxlnx (MIT).
- Ton-Skill `superint-audio`: Stimme, Musik, SFX und Mix; der Anbieter ist Konfiguration, je Anbieter eine Datei.
- Preset-System mit eingebetteten und eigenen Presets (`%APPDATA%\superint-video\presets`, `SUPERINT_PRESETS`) und den Befehlen `preset list | show | new | reference`. Presets: `flat-explainer` (flache Vektorgrafik mit Figuren, Farbwelten und Bausteinen für 16:9, 9:16 und 1:1), `miniature-3d` mit Skill `superint-miniature` (fotografische Miniaturwelt aus einem eigenen WebGL2-Renderer) und `blank` (kein Hauslook).
- `new` legt ein Projekt mit `brief.md` an (Thema, Länge, Format, Sprache, Zielgruppe, Botschaft mit `--message`, Muss/Vermeiden, Stopps, Wortbudget) und nimmt `--preset`, `--workflow` und `--reference`.
- Die Regeln in Skills und Presets sind eine Untergrenze: Ein stärkeres Modell darf einen besseren Weg gehen und begründet ihn im Bericht. Jede Abgabe endet mit einem Making-of in `report.md`.
- Starter-Prompts in `prompts/`.

### Studio

- Studio zeigt die Arbeit: `new` öffnet es, der Produktionsbereich zeigt Briefing, Stil, Skills, Referenzen, den aktuellen Schritt aus `process/status.json` und die Arbeitsdokumente (`GET /api/doc`). Jeder Render erscheint dort mit aktuellem Bild, Bildern pro Sekunde, Restzeit und Filmstreifen. `--no-studio` und `SUPERINT_NO_STUDIO` schalten das ab, in CI ist es aus.
- Der Polish-Durchgang ist sichtbar: angesehene Bilder, Befunde und Korrekturen.
- Werkzeuge der Timeline tragen Wörter; „Zoom: Ganzes Bild“ und „Ganzer Film“ ersetzen die zwei „Fit“.

### Neue Befehle

- `polish`: der letzte Blick vor dem Render, mit Standbildern alle 5 s, Nahaufnahmen, beiden Seiten jedes Schnitts und den schnellsten Bewegungen. `polish --accept` hält einen sauberen Durchgang fest; `render` verlangt ihn bei Filmen mit Briefing (`--quality draft` für Testrender, `--unpolished` zum Überspringen).
- `listen <datei>`: Earshots Audio-Kritiker hört einen Take, den Mix oder den fertigen Film über Gemini und speichert Bewertung und Probleme mit Zeitstempeln in `process/listen/`.
- `sfx place` schreibt zusätzlich `audio/sfx/cues.json` im Cue-Format von Earshot und braucht für 655 Einsätze rund zwei Sekunden statt über zehn Minuten.

### Ton

- Google AI Studio und OpenRouter mit denselben Google-Modellen: Ist AI Studio am Tageslimit, nimmt das Werkzeug dasselbe Modell über OpenRouter, meldet das und hält den Weg je Take fest. `voice assemble` warnt, wenn ein Film beide Wege mischt.
- `superint-audio/references/google-ai-studio.md`: Preise, TTS-Prompting, Voices API (eigene Stimme nur mit Einwilligung) und Lyria-Prompting.
- `voice check` kennt Googles vollständige Tag-Liste und `voicekey_`-IDs.
- Musik und Geräusche liegen deutlich weiter unter der Stimme: Musik 22 statt 16 dB, Geräusche 14–37 statt 5–13 dB.

### Rendern

- Schnellerer Export: verlustfreie PNG-Screenshots mit `optimizeForSpeed` und mehrere Browser parallel (`render --workers N`), bei gleichen Pixeln.
- `render --codec x265|x264`; Standard ist x265 (HEVC, CRF 20, `hvc1`), etwa halb so groß wie x264 bei gleicher Qualität.
- Miniatur-Look: 64 statt 256 Teilbilder je Bild (3,3-mal so schnell), keine flackernden Wände und Böden mehr.
- Szenen, die auf `requestAnimationFrame` oder ein Bitmap-`<img>` warten, laufen nicht mehr in den 15-Sekunden-Timeout. Damit geht HTML-in-Canvas in einer Szene (`content="drawable"`), noch ohne Bilder aus dem Projekt.
- Der Player blendet inaktive Szenen mit `visibility` aus, damit Szenen Text vor ihrem ersten sichtbaren Frame messen können.

### Sonstiges

- MIT-Lizenz.
- Die EXE-Dateien enthalten keine Pfade des Bau-Rechners mehr (`--remap-path-prefix`), und `scripts/build.ps1` bricht ab, wenn doch einer darin steht.
- Drittanbieterhinweise auf dem Stand der gesperrten Abhängigkeiten.
- `build.rs` baut neu, wenn sich `runtime/`, `studio/dist` oder eingebettete Presets ändern.
- Pfade in JSON-Ausgaben ohne Windows-Präfix `\\?\`.
- README neu, mit Bildern der App; alles Weitere steht im [Handbuch](docs/HANDBUCH.md).

## 0.1.0 — 2026-10-09

- Rust-CLI für Projektanlage, Studio, Inspektion, Prüfung, Snapshots, MP4-Export und Tool-Erkennung.
- Lokales Studio mit Vorschau, Medienbibliothek, Timeline, Kontextkopie und typisierten Szenen-Eigenschaften.
- Monochrome Dark-/Light-Themes, bedarfsabhängige Seitenbereiche, Tastaturbedienung und Layouts für schmale Fenster.
- Verschieben, Kürzen, Teilen, Duplizieren, Undo/Redo und revisionsgeschütztes Speichern.
- Erhalt ungespeicherter Felder bei Wiedergabe; Konflikterkennung bei externen Änderungen und Recovery-Download.
- Frameabhängige HTML-/CSS-/SVG-/JavaScript-Szenen; lokale Video- und Audioclips mit Source-Offsets, Lautstärke und Fades.
- MP4-Export über Chromium und FFmpeg mit Fortschritt, Abbrechen und Prüfung des fertigen Ergebnisses.
- Agent-Skill, Starterprojekt, synthetische Demo, JSON Schema und dokumentierte Prüfungen.
- Deutscher Einstieg, Windows-Paket mit Prüfsummen und Build-Workflow.

Geprüfte Plattform: Windows x64. Browser und FFmpeg bleiben separate Laufzeit-Abhängigkeiten. Die Studio-Oberfläche ist derzeit englisch.
