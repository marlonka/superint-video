---
model: gemini-3.8-flash-tts
voice: Sadaltager
style: calm, clear and warm, an unhurried explanation
language: de
takes: 3
sentencePause: 0.6
paragraphPause: 2.6
terms: [KI-Agenten, Sprachmodell, Tokens, Token, Kontextfenster, MCP, MCP-Werkzeuge, Anthropic, Claude, Code Mode, Sandbox, Cloudflare, Claude Code]
---

# Stimme: Sadaltager, die Hausstimme. Stil kurz und für den ganzen Film gleich.
# Absatz der Datei = Doppelseite + 1 (Absatz 1 ist der Einband, Absatz 8 die letzte Bildseite).
# Wortlaut und Satzzeichen genau wie in script.md; keine Gedankenstriche, keine geschriebenen Pausenzeichen.
# Runde 3b: Das Buch wird unter laufender Stimme aufgeschlagen. Die Stimme beginnt bei 0,5 s; der Deckel hebt sich auf „sparsamer“ in Absatz 1,
#   das Titelblatt wendet sich 0,4 s nach dem letzten Wort von Absatz 2 („Zukunft?“), nicht darunter. Stille zwischen den Absätzen:
#   0,5 s nach Absatz 1, sonst 2,6 s, in denen sich ein Blatt wendet (nach Absatz 2: 0,4 s Ruhe, 1,9 s Wendung, 0,3 s);
#   die Nachbearbeitung setzt sie (tools/pauses.py).
# Pausen im Absatz, die das Bild braucht; die Nachbearbeitung setzt sie an der Satzgrenze nach den Wortzeiten (die Zeiten in beats.md rechnen sie ein):
# - Absatz 6 (Code Mode): nach „… die es braucht.“ 0,5 s (ab `nachschlagen` bis `programm` mindestens 6 s);
#   nach „… dieselben MCP-Werkzeuge auf.“ 1,5 s (die Aufrufe aus der Sandbox, ab `aufrufe` bis `zeile` mindestens 7 s).
# - Nach Absatz 8 mindestens 5 s Stille für die Botschaftskarte.
# Die Schätzungen in script.md und beats.md rechnen mit derselben Satzpause von 0,6 s.
#
# Aussprache (deutsche Stimme, englische Begriffe bleiben englisch). Erst roh aufnehmen, dann nach Gehör und Transkription:
# - MCP: als deutsche Buchstaben, „Em-Tse-Pe“, auch in MCP-Werkzeuge. Liest die Stimme es als Wort, englisch oder als Betonung
#   (Gemini nimmt Versalien als Betonung), in diesem Absatz „Em-Zeh-Peh“ schreiben (auch „Em-Zeh-Peh-Werkzeuge“) und nur ihn neu aufnehmen.
#   MCP steht jetzt in Absatz 1 („Ersetzt er MCP“), 2 („MCP-Werkzeuge“), 4, 6, 8; Absatz 1, 2 und den letzten Satz von 8 zuerst prüfen.
# - KI: „Ka-I“, auch in „die KI des Agenten“, „Die KI selbst“ (Absatz 2) und „seine KI“ (Absatz 3).
# - „Nein.“ am Anfang von Absatz 2: ruhig, sachlich, kein Ausruf; danach die normale Satzpause.
# - Token, Tokens: englisch gesprochen, „Tohken“, Mehrzahl „Tohkens“ mit s, nie „Tokene“.
# - Code Mode: englisch. Gefahr: deutsches „Mode“ (zweisilbig, wie Kleidermode). Dann „Kohd Mohd“ schreiben; das gehärtete End-d ist hinnehmbar.
# - Claude, Claude Code: englisch, „Klohd“, „Klohd Kohd“; nie deutsch „Klau-de“. In Absatz 8 die beiden Namen mit „Code“ hörbar auseinanderhalten.
# - Anthropic: englisch, Betonung auf „thro“. Cloudflare: englisch, „Klaudfler“. Sandbox: so lassen, nach Gehör entscheiden.
# - Zahlen prüfen: „zweitausendsechsundzwanzig“ (stolpert die Stimme, „2026“ schreiben), „fünfundfünfzigtausend“, „neunundvierzig“.
# - Die Bitte in Absatz 3 nach dem Doppelpunkt ist eine wörtliche Nachricht: gleiche Stimme, kein Rollenwechsel.
# - Wird eine Ausweichschreibung eingesetzt, in beats.md das Auslösewort nachziehen (`stecker`, `aufrufe`, `claude`, `andere`, die `mcp` auf 3 und 7, `ende`).
#
# Tragende Zeilen, jeder Take davon geht vor voice assemble durch `listen`:
# - Absatz 1, die beiden ersten Sätze des Films (sachlich, ohne Anlauf; „Ersetzt er MCP, …?“ als echte Frage, der Einschub als Einschub)
# - Absatz 2 „Nein. Im Code Mode …“ (die Antwort, klar und ruhig) und „Ist das die Zukunft?“ (eine echte, offene Frage, nicht kokett, nicht feierlich)
# - Absatz 5 „Jede Antwort des Modells ist eine Runde, und dazwischen behält es nichts.“ (Erklärung, nicht Pointe)
# - Absatz 6 „Lohnt sich das immer?“ (eine echte, offene Frage)
# - Absatz 7 der erste Satz: Er beantwortet die Frage; ruhig, nicht trotzig
# - Absatz 8, der letzte Satz (beantwortet beide Fragen vom Anfang; ruhig, nicht feierlich; „nicht das Ende von MCP“ ohne Triumph, das Gewicht auf dem letzten Wort „Zukunft“)

[[scene:einband]]
Code Mode soll KI-Agenten sparsamer machen. Ersetzt er MCP, den gemeinsamen Anschluss für ihre Werkzeuge?

[[scene:titel]]
Nein. Im Code Mode schreibt die KI des Agenten ein kleines Programm, das dieselben MCP-Werkzeuge aufruft. Die KI selbst liest nur das Endergebnis. Ist das die Zukunft?

[[scene:frage]]
Ein Beispiel zeigt den Unterschied. Jemand bittet seinen KI-Agenten: Trag alle offenen Rechnungen in eine Tabelle. Der Agent gibt die Bitte an seine KI, ein Sprachmodell. Das Modell zerlegt sie in Tokens, kleine Stücke Text. Alles, was es liest, liegt in seinem Kontextfenster, und jedes Token kostet.

[[scene:werkzeuge]]
Für die Aufgabe hat der Agent über MCP Dienste angeschlossen, für Rechnungen und Tabellen, aber auch für Mail, Kalender und Dateien. Jeder Dienst bietet Werkzeuge, jedes mit einer Beschreibung, was es tut und welche Angaben es braucht. Viele Agenten legen alle Beschreibungen vorab ins Kontextfenster. Laut Anthropic, dem Hersteller von Claude, sind das bei fünf verbreiteten Diensten rund fünfundfünfzigtausend Tokens.

[[scene:direkter-weg]]
Zuerst schreibt das Modell einen Aufruf für alle Rechnungen von zweitausendsechsundzwanzig. Nach „offen“ sucht das Werkzeug nicht, nur nach ganzen Jahren. Der Agent führt ihn aus, und fünfhundert Rechnungen landen im Kontextfenster. Jede Antwort des Modells ist eine Runde, und dazwischen behält es nichts. Für die zweite schickt der Agent deshalb alles noch einmal mit, und das Modell liest es ganz. Dann schreibt es die offenen Zeile für Zeile ab, dazu die Summe, und der Agent trägt beides ein. So geht jede offene Rechnung zweimal durchs Modell. In der dritten Runde liest es das Ganze wieder und schreibt erst dann die Antwort. Es geht auch anders.

[[scene:code-mode]]
Im Code Mode schlägt das Modell nur die drei Beschreibungen nach, die es braucht. Dann schreibt es ein kleines Programm, das die Rechnungen holt, die offenen heraussucht, einträgt und summiert. Das Programm läuft in einer Sandbox, abgeschottet, ohne Internet. Über den Agenten ruft das Programm dieselben MCP-Werkzeuge auf. Ins Kontextfenster schickt der Agent nur das Ergebnis. Die fünfhundert Rechnungen gehen dabei nie durchs Modell. Lohnt sich das immer?

[[scene:wann-es-sich-lohnt]]
Bei einem einzelnen, einfachen Aufruf kostet Code Mode laut Anthropic rund acht Prozent mehr. Bei zehn bis neunundvierzig Werkzeugen spart es laut derselben Quelle meist zwanzig bis vierzig Prozent. Je mehr Schritte und Daten eine Aufgabe hat, desto mehr spart es.

[[scene:was-kommt]]
Die Tabelle ist fertig. Den Namen Code Mode gab Cloudflare, die Idee dahinter ist älter. Anthropic bietet das Muster Entwicklern als feste Funktion an. In Claude Code, seinem eigenen KI-Agenten, lässt es sich als Experiment einschalten. Einige andere Agenten schalten es schon von Haus aus ein. Die Dokumentation von MCP selbst empfiehlt Agenten, ihre Werkzeuge so aufzurufen. Code Mode ist also nicht das Ende von MCP, sondern bei großen Aufgaben vielleicht seine Zukunft.
