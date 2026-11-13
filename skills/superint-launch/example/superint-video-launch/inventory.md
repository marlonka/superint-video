# Inventar

**Was es ist, in einer Zeile:** Superint Video lässt deinen Coding-Agenten (Claude Code oder ChatGPT Codex) Filme machen: HTML-Szenen auf einer Timeline in `video.json`, gerendert mit Chrome und FFmpeg auf deinem Rechner.

## Echte Bildschirme und Texte (aus App und Studio, Stand 0.2.0, Deutsch)

**Startseite** (`references/app-start.jpg`)
- Abschnitt „Neuer Film“, darunter „Beschreib den Film, kopiere den Prompt und füge ihn in Claude Code ein.“
- Feld mit Platzhalter „Worum soll es im Film gehen? Ein, zwei Sätze genügen.“ (1040 × 99 px, Rand #777, Radius 8)
- Auswahlen Stil / Länge / Format / Sprache; Werte u. a. „Flat-Vektor-Erklärfilm“, „2 min“, „16:9, quer (YouTube)“, „Deutsch“
- Prompt-Zeile „Mach ein Video mit Superint Video über: …“, Knopf „Prompt kopieren“ (weiß, 173 × 40 px)
- Hinweis nach dem Klick: „Kopiert. Füge ihn in Claude Code ein.“
- Der Prompt: „Mach ein Video mit Superint Video über: {Thema}“ und „Stil {Name}, etwa {Länge}, auf {Sprache}“

**Studio** (`references/studio.jpg`)
- Kopf: Zeichen und „Superint Video“, Filmname, „Medien“, „Fortschritt“, „Film“, „⋯“, „Exportieren“ (weiß)
- Vorschau in der Mitte, rechts „Fortschritt“ mit „Jetzt“, Notiz und Schritten, unten Transport („00:00:00 / 02:29:03“, „Bild“, „Zoom: Ganzes Bild“) und Timeline (Werkzeuge „Teilen“, „Duplizieren“, „Löschen“, „Einrasten“, „Ganzer Film“; Spuren „Scenes“, „Voice“, „Music“, „Sound effects“)
- Render-Ansicht: „Rendert {n} %“, „Bild {n} von {gesamt}“, „Filmzeit {a} von {b}“, „{n} Bilder/s“, „noch etwa …“, Fortschrittsbalken, Streifen „Bisher gerenderte Bilder“; am Ende „Film fertig“
- Farben: Grund #0e0e0e, Flächen #171717 / #222, Text #eee, zweitrangig #b4b4b4, Linien #303030, Rand #777; Aktion weiß mit Text #111. Keine Akzentfarbe.
- Zeichen: das S aus Balken, `M3 4h19v5H8v3h14v9H3v-5h14v-3H3Z` auf einem Raster von 25

**Kommandozeile** (was der Coding-Agent ausführt): `superint-video new`, `voice takes`, `music`, `sfx place`, `check`, `review`, `polish`, `render`

## Der Fall

Der Film „Modellfamilien: Die richtige Größe wählen“, den Superint Video wirklich gemacht hat:
- 2:29 lang, 4473 Bilder bei 30 Bildern/s, 16:9, Deutsch, Stil Flat-Vektor-Erklärfilm, Ziel im Briefing 125 s („2 min“ in der Auswahl)
- Szenen auf der Timeline: `hook`, `space`, `claude`, `rule`; eine Stimme, Musik, 56 Soundeffekte
- Schritte im Fortschritt: Brief, Research, Konzept, Skript, Beats, Stimme, Style Frames, Bau, Review, Render
- Bilder in `assets/case/`: Schreibtisch bei Nacht, Mond, Luna, Sol, Astra, der Schlusssatz; `strip.jpg` hat alle 5 s ein Bild
- Das Thema, das im Film getippt wird, ist ein eigener Satz zu diesem Film, nicht der Prompt, mit dem er entstand.

## Fakten für den Schluss

- Version 0.3 (die nächste Veröffentlichung nach diesem Film), Windows x64, MIT-Lizenz
- Keine Adresse im Film.

## Nicht im Film

- Andere Marken als Bild: kein Claude-Code- oder ChatGPT-Codex-Logo, keine nachgebaute Oberfläche dieser Programme; das Terminal ist neutral.
- Bilder des Falls mit lesbaren Modell- oder Firmennamen (die Tabellen mit GPT und Claude) nur so klein, dass sie nicht lesbar sind.
- Keine erfundenen Zahlen: Bilder pro Sekunde, Restzeit und Dauer kommen aus echten Läufen oder bleiben weg.
