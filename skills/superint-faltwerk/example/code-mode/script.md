# Script: Code Mode

<!--
Erzähltext nach dem Buchplan vom 24.11., 15:30, dem Nachtrag des Baus zu 4 und 5, den Entscheidungen der Regie zur kalten Kritik (Runde 2), der Rückmeldung zum fertigen Film (Runde 3) und der kalten Kritik dazu mit den Regieentscheidungen (Runde 3b: Anfang als Frage und Antwort, Schluss auf „Zukunft“); das Protokoll steht in process/script.md.
Ein Absatz je Doppelseite, Zahlen so geschrieben, wie sie gesprochen werden.
Zeilen ohne # und > sind gesprochener Text; {…} sind Belege aus research.md (ausführlich in research/01-cloudflare.md, 02-anthropic.md, 03-problem-ausblick.md) und werden nicht gesprochen. {Beispiel} markiert Sätze über die Beispielaufgabe des Films (Beispieldaten, keine Messung), {–} Sätze ohne Tatsachenbehauptung.
Runde 3b: Das Buch wird unter laufender Stimme aufgeschlagen. Der Deckel hebt sich auf „sparsamer“ in Absatz 0, damit das Pop-up des Titelblatts auf „MCP“ schon steht; das Titelblatt wendet sich 0,4 s nach „Zukunft?“, am Ende von Absatz 1. Stille zwischen den Absätzen: 0,5 s nach Absatz 0, sonst 2,6 s für das Wenden (nach Absatz 1: 0,4 s Ruhe, 1,9 s Wendung, 0,3 s bis zum ersten Wort von 2). Nach dem letzten Wort steht die Botschaftskarte mindestens 5 s allein.
Pausen im Absatz, die das Bild braucht (gesetzt in der Nachbearbeitung, Stellen und Längen in beats.md): Doppelseite 5 nach „… die es braucht.“ 0,5 s und nach „… dieselben MCP-Werkzeuge auf.“ 1,5 s.
Sprechzeiten geschätzt mit 3,7 Silben je Sekunde und 0,6 s je Satzpause (wie sentencePause in voice.md), Kommas ohne eigene Pause. Gemessen wird mit der Stimme; die Aufnahme von Runde 2 lief rund 12 % schneller als diese Schätzung.
Bild zu jedem Satz und Auslösewörter: beats.md. Entwürfe, Prüfung und Abweichungen vom Buchplan: process/script.md. Sprechfassung: voice.md.
Gesprochen werden von den Beispieldaten nur „fünfhundert“ und „zweitausendsechsundzwanzig“; die 41 offenen und die Summe 23.874,60 € stehen nur gedruckt im Bild. Die Bitte wird nur bis „Tabelle“ gesprochen; ganz steht sie auf dem Bildschirm und auf dem Papierstreifen.
Zusammen: 436 Wörter, geschätzt 229 s Stimme mit den Pausen; mit Wendepausen, Halt auf der Botschaft und Rückdeckel rund 4:15 geschätzt, nach dem Tempo der Aufnahme rund 3:50 (bisher 3:51).
Runde 3b, Zeiten (Filmzeit, Stimme ab 0,5 s; in Klammern nach dem Tempo der Aufnahme): MCP-Stecker auf dem Pop-up des Titelblatts ≈ 5,4 s (≈ 5); „Nein.“ ≈ 10,2 s (≈ 9,1); „dieselben MCP-Werkzeuge aufruft“ ≈ 18,7 s (≈ 16,5); „Ist das die Zukunft?“ endet ≈ 24,3 s (≈ 21,5); Doppelseite 2 beginnt ≈ 26,9 s (≈ 24); Doppelseite 3 liegt ≈ 54 s offen (≈ 48; bisher 45,8). Beide Wege und die MCP-Stecker stehen damit schon nach ≈ 5 s im Bild, auf dem Titelblatt.
-->

## Doppelseite 0: Einband

[[scene:einband]]
Code Mode soll KI-Agenten sparsamer machen. {Zweck des Ansatzes: weniger Tokens, AN2, CF5; „soll“, weil es nicht immer spart, AN19} Ersetzt er MCP, den gemeinsamen Anschluss für ihre Werkzeuge? {–; Erklärung von MCP: PR9a, PR9}
> Wörter: 15 · geschätzt 9,2 s; Stimme ab 0,5 s
> on screen: Einband in Gold: „KI-AGENTEN“, „CODE MODE“, „Die Zukunft von MCP?“, „EIN POP-UP-BUCH“
> visual: Bild 0 ist das Plakat, das geschlossene tannengrüne Buch unter der Lampe, die Kamera schon in Bewegung; auf „sparsamer“ hebt sich der Deckel, und auf dem Titelblatt richtet sich das kleine Pop-up auf; auf „MCP“ rasten seine drei Stecker ein, auf „Werkzeuge“ zeigt es den direkten Weg

## Doppelseite 1: Titel

[[scene:titel]]
Nein. {PR80} Im Code Mode schreibt die KI des Agenten ein kleines Programm, das dieselben MCP-Werkzeuge aufruft. {CF2, AN30, PR80, CF10} Die KI selbst liest nur das Endergebnis. {CF5, AN9} Ist das die Zukunft? {–; die Antwort gibt der letzte Satz von Doppelseite 7}
> Wörter: 27 · geschätzt 14,1 s
> on screen: Titelblatt: „KI-AGENTEN“, „CODE MODE“ in Kobalt, darunter das Pop-up; auf „Zukunft“ erscheint gedruckt „Die Zukunft von MCP?“; unten „EIN POP-UP-BUCH“
> visual: links das Marmorvorsatz mit Exlibris, rechts das Titelblatt mit dem Pop-up: KI-Rack, Agent, drei Dienste-Käfige mit MCP-Steckern; die Kobaltkarte steht auf „Programm“ auf, die Aufrufkarten gehen auf „aufruft“ von ihr zu den Käfigen, die Ergebnisstreifen bleiben an ihr hängen, nur ein Zettel geht auf „Endergebnis“ in die KI; 0,4 s nach „Zukunft?“ wendet sich das Blatt, das Pop-up faltet sich flach

## Doppelseite 2: Die Frage

[[scene:frage]]
Ein Beispiel zeigt den Unterschied. {–} Jemand bittet seinen KI-Agenten: Trag alle offenen Rechnungen in eine Tabelle. {Beispiel; ganz gedruckt mit „… und schreib die Summe darunter.“} Der Agent gibt die Bitte an seine KI, ein Sprachmodell. {PR11, CF10} Das Modell zerlegt sie in Tokens, kleine Stücke Text. {PR1} Alles, was es liest, liegt in seinem Kontextfenster, und jedes Token kostet. {PR3, PR4, PR7, PR31}
> Wörter: 46 · geschätzt 24,5 s
> on screen: „Die Frage“; Chatfenster mit der ganzen Bitte; Schilder „AGENT“, „MODELL“, „KONTEXTFENSTER“ (stehen auf ihr Wort auf), Reiter „Anweisungen“
> visual: goldener Nachmittag, Bürohaus und Rechenzentrum im Schnitt; der Papierstreifen mit der Bitte läuft im Glasfaserrohr zum Agenten, durch die Durchreiche am Bund zum Modell, das Messer am Einlass schneidet vierzehn Tokens, sie steigen hinter dem Glas auf; dasselbe Bild wie bisher, neu getaktet

## Doppelseite 3: Die Werkzeuge

[[scene:werkzeuge]]
Für die Aufgabe hat der Agent über MCP Dienste angeschlossen, für Rechnungen und Tabellen, aber auch für Mail, Kalender und Dateien. {PR9, PR9a, CF10; Beispiel: die Dienste der Halle} Jeder Dienst bietet Werkzeuge, jedes mit einer Beschreibung, was es tut und welche Angaben es braucht. {PR9} Viele Agenten legen alle Beschreibungen vorab ins Kontextfenster. {AN3, PR8, PR10, PR4, PR7} Laut Anthropic, dem Hersteller von Claude, sind das bei fünf verbreiteten Diensten rund fünfundfünfzigtausend Tokens. {PR20, AN12; Anthropic als Hersteller: AN0}
> Wörter: 60 · geschätzt 33,4 s (nur der erste Satz ist neu, ab „Jeder Dienst“ unverändert)
> on screen: „Die Werkzeuge“; Stecker „MCP“ an sieben Käfigen; Karte `rechnungen_liste` mit `name`, `description`, `inputSchema`; Tafel „5 verbreitete Dienste · 58 Werkzeuge“ / „rund 55.000 Tokens“
> visual: Sonnenuntergang über dem Dienste-Saal; auf „MCP“ rasten die Stecker von RECHNUNGEN und TABELLE ein, auf „Mail“ die übrigen, während die Stimme die Käfige nennt; eine Welle von Kartenbündeln läuft zum Agenten; ein Bündel geht durch die Durchreiche, und die Manilalage schiebt sich unter die Frage

## Doppelseite 4: Der direkte Weg

[[scene:direkter-weg]]
Zuerst schreibt das Modell einen Aufruf für alle Rechnungen von zweitausendsechsundzwanzig. {PR11, Beispiel} Nach „offen“ sucht das Werkzeug nicht, nur nach ganzen Jahren. {Beispiel: `rechnungen_liste` nimmt nur `jahr`, research.md und Buchplan} Der Agent führt ihn aus, und fünfhundert Rechnungen landen im Kontextfenster. {PR11, CF10, PR4, Beispiel} Jede Antwort des Modells ist eine Runde, und dazwischen behält es nichts. {PR11, PR12; research/03: „Die API ist zustandslos“ (Q7)} Für die zweite schickt der Agent deshalb alles noch einmal mit, und das Modell liest es ganz. {PR14, PR3; nicht „voll bezahlt“, PR19} Dann schreibt es die offenen Zeile für Zeile ab, dazu die Summe, und der Agent trägt beides ein. {PR15, PR13, CF10, Beispiel} So geht jede offene Rechnung zweimal durchs Modell. {PR15, AN2} In der dritten Runde liest es das Ganze wieder und schreibt erst dann die Antwort. {PR14, PR12, PR11} Es geht auch anders. {–}
> Wörter: 106 · geschätzt 50 s (Richtzeit 35 s; die Länge tragen die erklärte und gezählte Runde und der Grund für alle fünfhundert)
> on screen: „Der direkte Weg“; Aufrufkarte `rechnungen_liste` mit `{"jahr": 2026}`, Heldenfeld mit drei Rechnungen, Rundenzähler hinter der Klappe, Karten `zeilen_anfuegen` und `zelle_schreiben`, rote Marken „offen“, D43 mit der Summe
> visual: Dämmerung in der Halle; das Endlospapier steigt hinter dem Glas auf, die Kamera schaut von unten hinauf, das Leselicht fährt in jeder Runde die ganze Höhe; der Zeilenstreifen läuft über den Agenten zu TABELLE

## Doppelseite 5: Code Mode

[[scene:code-mode]]
Im Code Mode schlägt das Modell nur die drei Beschreibungen nach, die es braucht. {AN9, CF20, AN2, Beispiel} Dann schreibt es ein kleines Programm, das die Rechnungen holt, die offenen heraussucht, einträgt und summiert. {CF2, CF8, AN30, AN9, Beispiel} Das Programm läuft in einer Sandbox, abgeschottet, ohne Internet. {CF9, CF40, AN45, PR69, AN10} Über den Agenten ruft das Programm dieselben MCP-Werkzeuge auf. {CF10, PR80} Ins Kontextfenster schickt der Agent nur das Ergebnis. {CF5, AN9, CF10} Die fünfhundert Rechnungen gehen dabei nie durchs Modell. {AN9, CF5, Beispiel} Lohnt sich das immer? {–}
> Wörter: 68 · geschätzt 37 s mit Pausen von 0,5 s nach „braucht“ und 1,5 s nach „auf“ (Richtzeit 34 s)
> on screen: „Code Mode“ (Tinte); im Fenster die Karten `nachschlagen` und `code_ausfuehren`; Karteikasten mit drei Karten (JSON, dann TypeScript); die Kobaltkarte mit dem Programm; Schild „SANDBOX“, Blindkappe „kein Internet“; Ergebniszettel `{ "anzahl": 41,` / `"summe": "23874.60" }`; Bleistiftstrich „direkter Weg“
> visual: Nacht, kühles Arbeitslicht; die Sandbox stellt sich auf, dieselben Manilakarten laufen aus ihr über den Agenten zu den Käfigen, die Durchreiche bleibt dunkel; ins Fenster kommt nur ein Zettel, weit unter dem Bleistiftstrich

## Doppelseite 6: Wann es sich lohnt

[[scene:wann-es-sich-lohnt]]
Bei einem einzelnen, einfachen Aufruf kostet Code Mode laut Anthropic rund acht Prozent mehr. {AN19, PR38, CF41} Bei zehn bis neunundvierzig Werkzeugen spart es laut derselben Quelle meist zwanzig bis vierzig Prozent. {AN19, PR36} Je mehr Schritte und Daten eine Aufgabe hat, desto mehr spart es. {PR40, CF5, AN2, AN19}
> Wörter: 41 · geschätzt 20 s (Richtzeit 24 s)
> on screen: „Wann es sich lohnt“; Fenster „direkt“ und „Code Mode“; Skala „ein einfacher Aufruf“ … „viele Werkzeuge“; Papierstreifen „Wie ist das Wetter in Berlin?“; Tafel „Ein Aufruf: rund 8 % mehr“, Tafel „10 bis 49 Werkzeuge:“ / „meist 20 bis 40 % weniger“
> visual: der Prüfraum bei Nacht unter der Arbeitslampe; der Messingschieber gleitet über die Skala, beide Stapel wachsen, der direkte überholt bei einem Drittel der Schiene

## Doppelseite 7: Was kommt

[[scene:was-kommt]]
Die Tabelle ist fertig. {Beispiel} Den Namen Code Mode gab Cloudflare, die Idee dahinter ist älter. {CF1, AN7, PR68} Anthropic bietet das Muster Entwicklern als feste Funktion an. {AN18, PR57; Programmatic Tool Calling ist dasselbe Muster: research/03 (d), AN45} In Claude Code, seinem eigenen KI-Agenten, lässt es sich als Experiment einschalten. {AN27, AN28; Claude Code als Agent von Anthropic: AN0; nicht AN52, keine Zahl nach AN36} Einige andere Agenten schalten es schon von Haus aus ein. {PR61, PR62, ohne Namen} Die Dokumentation von MCP selbst empfiehlt Agenten, ihre Werkzeuge so aufzurufen. {AN45, PR55; MCP-Clients sind die Agenten, PR9a} Code Mode ist also nicht das Ende von MCP, sondern bei großen Aufgaben vielleicht seine Zukunft. {beantwortet beide Fragen vom Anfang: „Ersetzt er MCP?“ PR80; „Ist das die Zukunft?“ als Möglichkeit („vielleicht“), gestützt durch AN18, PR57, PR61, PR62, AN45, PR55, AN27; Bedingung „große Aufgaben“ = viele Schritte und Daten, wie auf 6: AN19, PR36, PR40, CF5}
> Wörter: 73 · geschätzt 40,7 s, dazu mindestens 5 s die Botschaftskarte allein
> on screen: „Was kommt“; Monitor mit „Summe 23.874,60 €“; drei gesetzte Karteikarten „Cloudflare / gab den Namen“, „Anthropic / feste Funktion“ (neuer Text), „Andere Agenten / von Haus aus an“ (neue Karte); Laptop mit `$ CLAUDE_CODE_` / `EXPERIMENTAL_CODE_MODE=1` / `claude` und der Statuszeile `Code Mode (experimental)` / `is on` (wörtlich nach research/02 (e) 8, Q8); Heft „Model Context Protocol · Client Best Practices“, Seite „Programmatic Tool Calling / Code Mode“; Botschaftskarte, Zeile um Zeile auf ihr Wort: „Nicht das Ende von MCP.“ / „Bei großen Aufgaben“ / „vielleicht seine Zukunft.“
> visual: dasselbe Büro wie auf Doppelseite 2, jetzt von innen und bei Nacht; Monitor, drei Karteikarten, Laptop und Heft werden nacheinander hell oder stehen auf; die Botschaftskarte steht auf „also“ auf, ihre drei Zeilen erscheinen auf ihre Wörter, dann steht sie allein

## Doppelseite 8: Rückdeckel

> stumm: Endkarte. Das Buch fällt zu, tannengrüner Rückdeckel mit „CODE MODE“, „EIN POP-UP-BUCH“ (Text bleibt), die Lampe glimmt nach, die Musik klingt aus.
