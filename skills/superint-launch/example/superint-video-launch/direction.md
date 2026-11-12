# Richtung: der Balken

Richtung `one-shape` (siehe `concepts.md`), im Look des Produkts selbst. Kein Brand-Kit außer dem, was Superint Video schon hat: das S aus Balken und die einfarbige Oberfläche. Farbe bringt nur der Fall, der Film „Modellfamilien“, in Vorschau und Render.

## Der Satz und die Akte

„Superint Video nimmt dein Thema, gibt es deinem Coding-Agenten, zeigt jede Szene im Studio und rendert den Film auf deinem Rechner.“

| Akt | Zeit (120 BPM) | Zeile | Form des Balkens | Übergabe danach |
| --- | --- | --- | --- | --- |
| Was es ist | 0–3,4 s (Takt 0–1) | 1 | — (die Zeile allein) | grow: aus der Zeile wird das Feld |
| Thema | 3,4–8 s (Takt 1–4) | 2 | Feld, dann Knopf „Prompt kopieren“ | press-open: der Knopf öffnet sich als Terminal |
| Agent | 8–14 s (Takt 4–7) | 3 | Fenster, jede Szene eine Zeile | fly: die Szenenzeilen fliegen als Clips auf die Timeline |
| Studio | 14–22 s (Takt 7–11) | 4 | Clips, Schritte | grow: die Vorschau wird das Render-Bild |
| Render | 22–28 s (Takt 11–14) | 5 | Bild, Fortschrittsbalken, Streifen | converge: Bild, Balken und Streifen werden das S |
| Schluss | 28–33 s (Takt 14–16) | — | das Zeichen | Musik klingt aus |

Jede Zeile ab der zweiten steht auf dem weichgezeichneten Produkt, das sie benennt (eine Sekunde lesen), dann wird das Produkt scharf und handelt. Gelesen wird auf weichem Bild, gehandelt auf scharfem.

## Der Fall (Strings)

- Thema im Feld: „Wie wählt man unter KI-Modellen die richtige Größe?“
- Auswahl: Stil „Flat-Vektor-Erklärfilm“, Länge „2 min“, Format „16:9, quer (YouTube)“, Sprache „Deutsch“
- Prompt: „Mach ein Video mit Superint Video über: Wie wählt man unter KI-Modellen die richtige Größe? Stil Flat-Vektor-Erklärfilm, etwa 2 Minuten, auf Deutsch“
- Hinweis: „Kopiert. Füge ihn in Claude Code ein.“
- Filmname im Studio: „Modellfamilien: Die richtige Größe wählen“; Szenen `hook`, `space`, `claude`, `rule`; Länge 02:29:03; 4.473 Bilder
- Schritte: Brief, Research, Konzept, Skript, Beats, Stimme, Style Frames, Bau, Review, Render
- Render (echte Werte aus `modellfamilien/process/render.log`): 87–108 Bilder/s, „gerendert in 45 s“

## Bild

- Format 1920 × 1080, 30 Bilder/s.
- Grund #0b0b0b, von oben ein weiches Licht (#161616 in der Mitte oben, 1400 px Radius). Produktfarben genau wie in der App: #0e0e0e, #171717, #222, #303030, #777, #b4b4b4, #eee; Aktion #eee mit Text #111. Keine Akzentfarbe; Farbe kommt nur aus den Bildern des Falls.
- Schrift: Geist für alles. Zeilen 104 px, Gewicht 640, Zeilenabstand 1,04, Laufweite −0,02 em, mittig, Mitte der Zeile bei 50 % der Höhe. Oberfläche in den Größen der App (15/14/13 px) mal Kamerazoom. Terminal in JetBrains Mono 26 px. Schluss: Wortmarke 112 px Gewicht 650, darunter „Version 0.3 für Windows“ 38 px #b4b4b4.
- Fenster werfen Schatten (0 40 px 120 px rgb 0 0 0 / 55 %); weich heißt Unschärfe 14 px und Helligkeit 55 %.
- Kamera: ein Zug pro Einstellung, vorn schnell, landend; Größen auf log-Skala. Keine Drift ohne Grund; was steht, kriecht höchstens 1 % je Sekunde.
- Zeilen kommen jedes Mal anders: 1 in drei Stücken aus der Unschärfe, 2 aus einer Maske nach oben, 3 als Wischer von links mit weicher Kante, 4 aus 106 % Größe und Unschärfe, 5 in zwei Stücken versetzt aus der Maske.
- Übergaben: grow (2×), press-open, fly, converge. Kein Schnitt ohne getragenes Element.
- Signatur: Das Zeichen entsteht aus dem fertigen Render. Das Render-Bild wird der obere Balken des S, der Fortschrittsbalken der mittlere, der Filmstreifen der untere, die zwei Stege wachsen dazwischen.
- Schluss: Zeichen 232 px hoch links, Wortmarke rechts daneben, die Einheit mittig; darunter die Version. Kriecht bis zum letzten Bild um 1 % je Sekunde.

## Ton

Musik trägt, keine Stimme. Lyria, 120 BPM, F-Dur, minimal elektronisch: weicher Puls, Arpeggio, Anhebung bei 14 s (Studio), voll ab 22 s (Render), Schlussakkord auf dem Taktanfang bei 28 s, der frei ausklingt. Soundeffekte nur, wo das Bild handelt: Tasten beim Tippen, der Klick auf „Prompt kopieren“ und „Exportieren“, das Aufgehen des Hinweises, die Clips beim Landen, ein Schlag auf dem Zeichen.

## Verboten in diesem Film

Fremde Logos und nachgebaute fremde Oberflächen, lesbare Modell- und Firmennamen aus dem Fall, Funkeln für „KI“, Überschwingen bei Text, Überblendungen zweier Szenen, Zahlen ohne Quelle.
