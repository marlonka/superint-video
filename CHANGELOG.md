# Versionsverlauf

## 0.3.0 — 2026-11-12

- Neuer Stil `launch` (Launch-Film): die echte Oberfläche des Produkts, in Code nachgebaut, auf dunklem Grund, große Zeilen über einem weich gezeichneten Bild, ein Schlussbild aus der letzten Form. Das Kit bringt das Taktraster der Musik, Kamera mit logarithmischem Zoom, Übergaben einer Form von Bildschirm zu Bildschirm, Tiefenschärfe und vier Arten, eine Zeile hereinzuholen. Standard-Ablauf `superint-launch`.
- Der Launch-Film von Superint Video liegt als Beispiel im Skill `superint-launch`; der Skill sagt jetzt, wie man einen Lyria-Track auf Taktgrenzen auf die Filmlänge schneidet und einen echten Lauf des Produkts als Fall nimmt.
- `sfx place` geht auch ohne Stimme: In einem Film, den die Musik trägt, richten sich die Pegel der Soundeffekte nach der Musik. `mix` meldet eine fehlende Stimme nur noch, wenn es eine aufgenommene gibt, die nicht auf der Timeline liegt.
- „Film fertig“ auf der Startseite stimmt auch bei Filmen, deren Schritte nicht englisch heißen: Der Server entscheidet es (`ready` in `/api/app`) aus dem fertigen Render und dem letzten Schritt.
- Die Menüs „⋯“ an Filmen und Stilen sind ein Bauteil: Pfeiltasten, Pos1, Ende und Escape gehen überall, und der Fokus kehrt zum Knopf zurück.
- Aufgeräumt: Studio und App teilen sich das Starten, Finden und Beenden ihres Servers, Zeit-, Datei- und Vorschaubild-Helfer gibt es nur noch einmal, und Code, den nur Tests riefen, ist weg. Der ganze Rust-Code ist wieder mit `cargo fmt` formatiert.
- Die Versionsgeschichte des Repositorys beginnt mit 0.3.0 neu: Ein Klon von vorher lässt sich nicht weiterziehen, sondern wird neu geklont.

## 0.2.0 — 2026-11-12

- Filme haben einen festen Ort: Ohne dein Zutun entsteht jeder Film als eigener Ordner in `Superint Video` in deinem Videos-Ordner, nie im Programmordner oder in einem Code-Repository. `new` braucht dafür keinen Ordner mehr, die Skills lassen ihn weg, und unter „Vorgaben“ steht der Ordner mit „Anzeigen“ und lässt sich ändern (`filmsFolder` in `settings` und `/api/app`; `SUPERINT_FILMS` für Tests).
- „Skills aktualisieren“: Die App vergleicht die Skills im Ordner deines Coding-Agenten mit ihren eigenen. Weichen sie ab, etwa nach einem Update, ersetzt ein Klick sie; die bisherigen bleiben unter `replaced-skills` im Einstellungsordner erhalten, verknüpfte Skill-Ordner bleiben unberührt.
- Stile als Datei weitergeben: „Als Datei exportieren“ im Menü einer Stil-Karte schreibt `<name>.superint-style.zip` in den Downloads-Ordner, „Stil importieren“ nimmt eine solche Datei an (auch `preset export` und `preset import`). Ein vergebener Name bekommt eine Nummer, ersetzt wird nichts; die Datei kann nichts außerhalb ihres Stil-Ordners schreiben.
- Stil-Karten haben „Als Standard“ und ein Menü „⋯“ mit ausgeschriebenen Aktionen. Eine Fehlermeldung der Startseite bleibt im Blick, egal wie weit man gescrollt hat.
- README mit aktuellen Bildern der App statt alter Film-Standbilder.
- Die EXE-Dateien enthalten keine Pfade des Bau-Rechners mehr: `scripts/build.ps1` kürzt die Quellpfade der Rust-Abhängigkeiten, in denen der Windows-Benutzername stand (`--remap-path-prefix`), und bricht ab, wenn doch noch einer in `superint-video.exe` oder `Superint Video.exe` steht.
- Drittanbieterhinweise auf dem Stand der gesperrten Abhängigkeiten: 62 Rust-Pakete und ihre Lizenztexte nachgetragen, darunter die Zip-Bibliothek für Stil-Dateien.
- App und Studio sprechen Deutsch und Englisch. Beim ersten Start gilt die Sprache des Systems, der Globus oben rechts stellt um, und die Wahl gilt für jedes Fenster (`settings set uiLanguage de`). Zahlen, Zeiten und Aufzählungen folgen der Sprache; die mitgelieferten Stile haben deutsche Titel und Beschreibungen (`translations` in `preset.json`).
- Die Einrichtung ist nicht mehr zu übersehen: Solange ein Coding-Agent mit Skills, Chrome, FFmpeg oder ein API-Schlüssel fehlt, zeigt die App nur sie. Wer sie überspringt, sieht auf der Startseite und im Studio einen Balken über die ganze Breite statt eines kleinen Hinweises.
- Die Einrichtung ist ein Raster aus vier Gruppen (Coding-Agent, Werkzeuge, Stimme und Musik, Freiwillig): Häkchen, Namen und Knöpfe stehen untereinander, alle Knöpfe sind gleich groß, und nur der nächste Schritt ist hervorgehoben. Unter jedem Anbieter stehen die Modelle, die ein Film damit nutzt (`models` in den Schlüssel-Zeilen von `/api/app`). Ein API-Schlüssel, den der Anbieter ablehnt, bekommt kein Häkchen.
- „Installieren“ für Chrome und FFmpeg: öffnet ein sichtbares Terminal-Fenster mit einem festen winget-Befehl und stimmt nichts für dich zu. Ein so installiertes FFmpeg findet das Werkzeug sofort, ohne Neustart. Für Claude Code, ChatGPT Codex und Earshot gibt es Links zur Installation.
- Wortwahl: „Coding-Agent“ statt Assistent, „Prompt“ statt Auftrag, „API-Schlüssel“ statt Schlüssel; die Startseite nennt Claude Code und ChatGPT Codex beim Namen („Prompt kopieren“).
- Startseite ohne Kästen, Trennlinien, Nummern und Etiketten: Abstand und Ausrichtung gliedern sie. Stil-Karten haben keinen Rahmen; Bild, Titel, Beschreibung und Angaben stehen über alle Karten einer Reihe auf gleicher Höhe, darunter immer eine Zeile mit „Als Standard“, „Referenzen“ und „Kopieren“.
- Bewegung: Knöpfe geben beim Drücken sofort nach, Menüs wachsen aus ihrem Knopf, Dialoge und Hinweise blenden kurz ein und schneller aus, die Einrichtung klappt auf, ein erledigter Punkt setzt sein Häkchen einmal. Wer im System weniger Bewegung eingestellt hat, sieht keine.
- Studio: Die Werkzeuge der Timeline tragen Wörter (Teilen, Duplizieren, Löschen, Einrasten). Aus den zwei „Fit“ wurden „Zoom: Ganzes Bild“ an der Vorschau und „Ganzer Film“ an der Timeline. Einheiten stehen neben dem Feldnamen, der doppelte Pfeil an „Erweitert“ ist weg.

- Die App: Ein Doppelklick auf `Superint Video.exe` (oder `superint-video app`) öffnet eine Startseite in einem eigenen Fenster. **Setup** führt durch das, was fehlt: Assistent mit Skills (ein Klick kopiert sie), Chrome, FFmpeg, API-Schlüssel, Earshot. Schlüssel trägt man dort ein; sie liegen nur auf dem eigenen Rechner, unter Windows für das Benutzerkonto verschlüsselt, und werden nie wieder angezeigt, auch dem Assistenten nicht. **New film** baut den Auftrag für den Assistenten, **Films** zeigt alle Filme mit ihrem Stand, auch die, die schon im Filme-Ordner liegen, **Defaults** legt Stil, Länge, Format, Sprache und den Ordner für neue Filme fest. `new` übernimmt diese Vorgaben und braucht dann weder `--preset` noch einen Ordner; `settings` zeigt und ändert sie. Ist die Startseite offen, wechselt sie von selbst zu einem Film, den der Assistent gerade anlegt. Studio öffnet sich in einem eigenen Fenster statt als Browser-Tab (abschaltbar).
- Studio zeigt den Polish-Durchgang: wie viele Bilder angesehen sind, was zu beheben ist, und jedes Bild mit Befund und Korrektur. Die Knöpfe im Kopf tragen Wörter (Media, Progress, Film), die Lautheit ist erklärt, und das Logo führt zur Startseite.
- Ein Schlüssel genügt: Mit nur einem OpenRouter-Schlüssel laufen die Google-Modelle für Stimme, Transkription und Musik von selbst über OpenRouter. Fehlt ein Schlüssel, sagt der Befehl das, bevor er etwas kostet, und verweist auf die App.

- Neuer Befehl `polish`: der letzte Blick vor dem Render, von selbst und ohne Nachfrage. Er legt alle 5 s ein Standbild ab, dazu Nahaufnahmen der Bildviertel in voller Auflösung, beide Seiten jedes Schnitts und Streifen über die schnellsten Bewegungen, mit einem Arbeitsblatt und den Fragen, die ein Zuschauer sofort beantwortet: richtig gebaut, ein Blickwinkel und ein Licht, sieht es aus wie sein Name, fertig, sauber. Ein späterer Durchgang zeigt nur, was sich geändert hat oder offen blieb; `polish --accept` hält einen sauberen Durchgang fest. `render` verlangt ihn bei Filmen mit Briefing (`--quality draft` für Testrender, `--unpolished` zum Überspringen). Die Skills schicken dafür frische Augen los, wenn möglich einen Sub-Agenten mit dem stärksten verfügbaren Modell, der findet und nachbessert. Danach wird gerendert und sofort übergeben; Thumbnail, Bericht und Aufräumen folgen erst nach der Abnahme. Anlass: Im Film „Modellfamilien“ blieben trotz dreier Review-Runden falsch gebaute Requisiten, zu schlichte Symbole und ein springender Schein am Schnitt stehen.
- Miniatur-Look: Beispielfilm korrigiert: Boden und Dachschrägen des Dachbodens flackern nicht mehr, und der Text auf dem `script.md`-Blatt ist nicht mehr gestaucht.
- Miniatur-Look: Filme rendern jetzt mit 64 statt 256 Teilbildern je Bild, 3,3-mal so schnell. Der Unterschied zeigt sich vor allem an Glanzpunkten auf poliertem Metall und bei sehr schnellen Bewegungen.
- Miniatur-Look: Wände flackern nicht mehr. Die schwarzen Schnittwände lagen genau in der Ebene der Raumwände und kämpften mit ihnen um dieselben Pixel; sie stehen jetzt 5 mm dahinter. Dazu begrenzt der Reflexionswürfel seine Spitzlichter, damit poliertes Metall nicht pulsiert.
- Szenen, die auf `requestAnimationFrame` oder ein Bitmap-`<img>` warten, laufen nicht mehr in den 15-Sekunden-Timeout: Der Player versteckte sie beim ersten Bild, und Chrome pausiert versteckte Frames aus anderer Origin. Damit geht auch HTML-in-Canvas in einer Szene (`content="drawable"`), noch ohne Bilder aus dem Projekt.
- Studio zeigt die Arbeit, statt dass man sie glauben muss: `new` öffnet es im Browser. Jeder Render erscheint dort, auch einer von der Kommandozeile, mit dem gerade berechneten Bild, Prozent im Tab, Bildern pro Sekunde, Restzeit, Uhrzeit und einem Filmstreifen; am Ende läuft der fertige Film an derselben Stelle. Lange Befehle stehen unter „Running now“, das neueste Kontaktblatt unter „Looked at last“, und `process/status.json` kommt jetzt auch wirklich live an. `--no-studio` und `SUPERINT_NO_STUDIO` schalten das ab, in CI ist es aus. Die Vorschau gibt während des Renders die Grafikkarte frei, und Szenen bekommen `context.preview`.
- Neues Preset `miniature-3d` und neuer Skill `superint-miniature`: der Look von „Videos aus Code“ für weitere Filme. Eine fotografische Miniaturwelt, ganz aus Code gerechnet, mit eigenem WebGL2-Renderer. Das Projekt startet mit einem fertigen Raum und der fotorealen Tasse als Maßstab. Der Skill enthält die Referenz des Renderers, die Rezepte für Nahaufnahmen, Licht und Material, alle bekannten Fehlerbilder, den Produktionsablauf und den ganzen Film als Beispiel. `tools/render_awake.py` hält Windows während eines langen Renders wach.
- Ist Google AI Studio am Tageslimit, nimmt das Werkzeug dasselbe Modell über OpenRouter, für Stimme, Transkription und Musik. Es meldet das, der Takes-Bericht hält den Weg je Take fest, und `voice assemble` warnt, wenn ein Film beide Wege mischt.
- Gemini TTS und Gemini Transcribe gehen jetzt auch über OpenRouter (`google/gemini-3.8-flash-tts`, `google/gemini-3.5-transcribe`), wenn das Tageskontingent von AI Studio aufgebraucht ist. Eine Änderung von `transcription:` in `voice.md` wirft keine Aufnahmen mehr weg.
- `sfx place` schreibt das Projekt nur noch einmal: 655 Einsätze in rund zwei Sekunden statt über zehn Minuten. Dabei behoben: Eine geänderte Cue-Liste ließ den Befehl mit `stale revision` abbrechen.
- Klang viel weiter unter der Stimme: Musik 22 statt 16 dB, Geräusche 14–37 statt 5–13 dB. Die alten Werte waren genau die, die im Film als viel zu laut abgelehnt wurden.
- README neu, kurz und mit Bildern aus dem Skills-Film (nach dem Vorbild von PhotoCraft). Alles Weitere steht jetzt im [Handbuch](docs/HANDBUCH.md), das auch im ZIP liegt.
- Windows-CI läuft nur noch auf Abruf und bei Release-Tags, um Actions-Minuten zu sparen; `scripts/build.ps1` prüft lokal.
- Werkzeug, Ablauf und Look getrennt: Superint Video ist nicht mehr auf Erklärvideos festgelegt.
  - Skill `superint-video` beschreibt nur noch das Werkzeug (Projekt, Szenen-API, CLI, Review-Durchgänge, Rendern) und lässt den Agenten vor `new` fragen: welche Art Film, welches Preset, welche Referenzbilder.
  - Neuer Ablauf-Skill `superint-explainer`: der bisherige Erklärvideo-Ablauf (Recherche, Botschaft, Konzepte, Skript, Beats, Style-Frames, Review, Abgabe) mit eigener `composition.md` für Welten, Übergänge und Tempo, die vorher in `flat-explainer/STYLE.md` standen.
  - Neuer Ablauf-Skill `superint-launch` für Launch-, Update- und Produktfilme, aufgebaut auf [cinetic](https://github.com/Leonxlnx/cinetic) von Leonxlnx (MIT): Copy-Regeln, Spine mit einem durchgetragenen Element, Filmformen, Übergaben, 26 Directions als Kompositionsideen, Director-Review.
  - Neuer Skill `superint-audio`: Stimme, Musik, SFX und Mix; Anbieter als Konfiguration, je Anbieter eine Datei (`google-ai-studio.md`, `openrouter.md`).
  - Neues Preset `blank` ohne Hauslook (Geist, dunkler Grund, ein Akzent, neutrale Helfer).
  - `new` verlangt `--preset`, nimmt `--workflow <skill>` und `--reference <dateien>` und schreibt Ablauf, Look und Referenzen in `brief.md`. Stopps sind freie Namen, die der Ablauf-Skill festlegt.
  - Referenzbilder: `preset reference <name> <dateien>` und `preset new … --reference`; `preset list` zeigt Ablauf und Zahl der Referenzen. Referenzen eingebauter Presets liegen in `<Preset-Ordner>/_references/<name>`.
  - `preset.json`: `narration` optional, `defaults.workflow` neu, `defaults.concepts` optional.
  - Die Regeln in Skills und Presets sind ausdrücklich Untergrenze, keine Obergrenze: Ein stärkeres Modell darf einen besseren Weg gehen und begründet ihn im Bericht. Hart bleiben nur Briefing und Brand, die Wahrheit des Inhalts und die technischen Render-Regeln.
  - Start mit so wenig wie möglich: Stil und ungefähre Länge genügen; das Preset bringt den passenden Ablauf mit, gefragt wird nur, was der Agent nicht selbst gut entscheiden kann.
  - Jede Abgabe endet mit einem Making-of in `report.md`, fertig zum Einfügen unter das Video, mit den echten Zahlen und den Modellen samt Anbieter.
- Neuer Befehl `listen <datei>`: Earshots Audio-Kritiker (`earshot llm`) hört einen Take, den Mix oder den fertigen Film über Gemini, mit dem Schlüssel aus `.env`, und speichert Bewertung, Stärken und Probleme mit Zeitstempeln in `process/listen/`. Das ist jetzt das Gehör des Agenten: Wörter und Timing prüft weiter `gemini-3.5-transcribe`, Lautheit `earshot measure`, `mix` und `render`. Earshots lokale Hörmodelle (1,1 GB) sind nicht mehr Teil des Ablaufs.
- Prompting-Regeln für Googles Medienmodelle aus der aktuellen Doku (4.11.2026) in `superint-audio/references/google-ai-studio.md`:
  - Preise und Tarife je Modell (TTS, Transcribe, Lyria) und was ein 60-s-Film kostet.
  - TTS: nur `gemini-3.8-flash-tts` (kein Flash-Lite), fünf Wege zur Stimme (vorgefertigt, Extended Voice Library, Voice Design, Remix, Replikation), erst ohne `style` testen, bei Stimmungswechseln Absätze teilen, keine Meta-Anweisungen, Großbuchstaben für Betonung, vollständige Tag-Liste.
  - Neuer Abschnitt Voices API: eigene Stimmen entwerfen, umbauen oder mit Einwilligung die eigene Stimme replizieren.
  - Lyria: Reihenfolge im Prompt, Vokabular, Struktur mit Zeitmarken und Intensitäten, Lyrics-Kopf, bis zu 10 Bilder als Stimmung, erst auf `lyria-3-clip-preview` testen.
- `sfx place` schreibt die gesetzten Cues zusätzlich als `audio/sfx/cues.json` im Cue-Format von Earshot für `timeline --cues` und `sheet --cues`.
- `voice check`: V7 kennt Googles vollständige Tag-Liste (40 Tags statt 6), V10 nimmt `voicekey_`-IDs an und weist bei unbekannten Namen auf die Extended Voice Library hin.
- Studio: Produktionsbereich (Symbol neben den Projekteinstellungen) mit Briefing, Stil-Preset, verwendeten Skills, Referenzbildern, dem aktuellen Schritt des Agenten aus `process/status.json`, Arbeitsdokumenten (lesbar per Klick) und den letzten Änderungen; aktualisiert sich live, während der Agent baut. Öffnet sich bei Projekten aus `new` von selbst. Neuer Endpunkt `GET /api/doc` für Markdown-, JSON- und Textdateien im Projekt (keine versteckten Dateien).
- `build.rs` baut auch neu, wenn sich `runtime/` oder `studio/dist` ändern; vorher konnte das Programm ein altes Studio ausliefern.
- Bildregeln nach dem Film „KI-Steuer 2031“ neu gefasst:
  - `flat-explainer/STYLE.md`: die echten Dinge statt Symbolwelten, 6–12 Orte je Minute, alle 2–4 s ein neues Bild, ein Farbskript mit eigener Farbwelt je Station und meist hellen Hintergründen, Figuren in den meisten Bildern, nichts schwebt, Quellen in den Bericht statt ins Bild, Endkarte nach dem letzten Wort. Vorher waren Nachtblau als einziger Hintergrund, eine Welt mit Zoom als Leitmotiv und „alles andere ruhig halten“ Pflicht.
  - `theme.css`: Farbwelten für `.sky` (`day`, `sunshine`, `sunset`, `warm`, `meadow`, `sea`, `mint`, `alarm`), `.vignette.soft` für helle Bilder, `.tag` für Namensschilder.
  - Skill: Modellprüfung (Produktion mit Opus), Botschaft als Pflicht, Konzepte als Abfolge von Orten mit Farbskript, Beat-Gate „neues Bild alle 2–4 s“, Review neben den Referenzbögen in `examples/`, statische Strecken nur noch auf der Endkarte, Musik endet auf der Endkarte.
  - `new --message` schreibt die Botschaft in `brief.md` (`## Message`); `prompts/explainer.md` hat das Feld `BOTSCHAFT`.
  - `build.rs`: Änderungen an eingebetteten Presets lösen einen Neubau aus; vorher kopierte `new` nach einer Preset-Änderung weiter die alte Fassung, bis sich Rust-Code änderte.
- Schnittrhythmus in `flat-explainer` beruhigt (Rückmeldung zum KI-Steuer-Film: zu hektisch geschnitten).
  - Statt 6–12 Orten je Minute und einem neuen Bild alle 2–4 s gilt jetzt: 2–4 zusammenhängende Welten je Minute, eine pro Kapitel, mit einer durchgehenden Art Direction.
  - Die Kamera fährt durch die Welt, alle 2–4 s passiert etwas Neues.
  - Schnitte oder gestaltete Übergänge kommen nur an Kapitelwechseln, typisch alle 10–30 s.
  - Neuer Stolperstein „Channel-Surfing“.
  - Geändert in STYLE.md, Skill, `production.md`, `storytelling.md`, `visual-principles.md` und `prompts/explainer.md`.
- Figuren in `flat-explainer`:
  - `scenes/lib/` kommt mit in jedes neue Projekt: `people.js` (stilisierte Figuren mit Gesicht, Haaren, Kleidungsdetails, Formschatten, Kopfdrehung, Posen, Gehen, Rückansicht, Kindern), dazu `props.js`, `places.js`, `draw.js`, `maps.js`, `shot.js`.
  - `blocks/cast.html` ist das Figurenblatt für die Besetzung.
  - STYLE.md und Skill fassen die Regeln aus dem Neuentwurf zusammen: Requisiten an den Händen, Hände auf dem Tisch, Schilder über Kopfhöhe, ferner Arm in der 3/4-Ansicht, keine Gesten kurz vor dem Schnitt.
- MIT-Lizenz.
- Preset-System: eingebettete und eigene Presets (`%APPDATA%\superint-video\presets`, `SUPERINT_PRESETS`), Befehle `preset list | show | new`.
- `new`: Projekt aus einem Preset mit `brief.md` (Thema, Länge, Format, Sprache, Zielgruppe, Muss/Vermeiden, Stopps, Wortbudget) und optional vorhandenem Skript. Stopps (`--stop concept,script,frames,contact`) legen fest, wo der Agent auf dich wartet; Sprechtempo je Sprache im Preset.
- Preset `flat-explainer`: Art Direction (`STYLE.md` mit Licht-, Text- und Bewegungsregeln und Fallstricken), lokale Schrift Nunito, `kit.js` mit Bewegungs-, Text- und SVG-Helfern einschließlich `cel()` für Schatten und Kantenlicht beliebiger Formen, Multiply-Vignette, Titelszene und acht Bausteine (Aussage, Zahl, Vergleich, Ablauf, Zoom, Schwarm, Verlauf, Outro) für 16:9, 9:16 und 1:1.
- Skill neu gegliedert: Produktionsablauf in neun Schritten mit Gates und Kritikrunden (Recherche mit Claim-Register, Konzepte mit `direction.md`, drei Skriptentwürfe, Beat-Board, Style-Frames, Bau, Review per Kontaktbogen, Abgabe mit Thumbnail und Bericht). Referenzen zu Dramaturgie und Belegen, Produktion, Ton und Mastering, Presets und Bearbeitung.
- Starter-Prompts in `prompts/`, mit dem Erklärvideo-Auftrag als Hauptvorlage.
- Schnellerer Export:
  - Screenshots als verlustfreies PNG mit `optimizeForSpeed`.
  - Mehrere Browser nehmen die Bilder parallel auf (`render --workers N`, Standard: halbe CPU-Threads, höchstens 8).
  - Die Pixel sind gleich wie vorher.
- `render --codec x265|x264`. Standard ist x265 (HEVC, CRF 20, `hvc1`), am 38-s-Film 15 MB statt 30 MB bei gleichem Abstand zum Rohbild. x264 bleibt für maximale Kompatibilität. Studio exportiert ebenfalls x265; die API nimmt `codec`.
- Player blendet inaktive Szenen mit `visibility` statt `display` aus, damit Szenen Text vor ihrem ersten sichtbaren Frame messen können.
- Pfade in JSON-Ausgaben ohne Windows-Präfix `\\?\`.

## 0.1.0 — 2026-10-09

- Rust-CLI für Projektanlage, Studio, Inspektion, Prüfung, Snapshots, MP4-Export und Tool-Erkennung.
- Lokales Studio mit Vorschau, Medienbibliothek, Timeline, Kontextkopie und typisierten Szenen-Eigenschaften.
- Monochrome Dark-/Light-Themes, bedarfsabhängige Seitenbereiche, Tastaturbedienung und Layouts für schmale Fenster.
- Verschieben, Kürzen, Teilen, Duplizieren, Undo/Redo und revisionsgeschütztes Speichern.
- Erhalt ungespeicherter Felder bei Wiedergabe; Konflikterkennung bei externen Änderungen und Recovery-Download.
- Frameabhängige HTML-/CSS-/SVG-/JavaScript-Szenen; lokale Video- und Audioclips mit Source-Offsets, Lautstärke und Fades.
- MP4-Export über Chromium und FFmpeg mit Fortschritt, Abbrechen und Prüfung des fertigen Ergebnisses.
- Agent-Skill, Starterprojekt, synthetische Demo, JSON Schema und dokumentierte Prüfungen.
- Deutscher Einstieg, Windows-Paket mit Prüfsummen und Build-Workflow im privaten GitHub-Repository.

Geprüfte Plattform: Windows x64. Browser und FFmpeg bleiben separate Laufzeit-Abhängigkeiten. Die Studio-Oberfläche ist derzeit englisch.
