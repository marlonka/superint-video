# Direction: Code Mode

## Die Form

Ein Pop-up-Buch liegt abends auf einem Schreibtisch unter einer Messinglampe. Es wird aufgeschlagen, Seite für Seite, und jede Doppelseite ist ein Kapitel der Erklärung. Der Film verlässt den Tisch nie. Es gibt keinen Schnitt: eine einzige Kamerafahrt, die Seitenwechsel sind die Kapitelwechsel.

Das Buch ist ein technisches Pop-up-Buch für Erwachsene, gebaut wie eine Schnittzeichnung: Es schneidet die echte Anlage auf, das Dach ist abgeschnitten, darüber steht der Himmel. Daten sind bedrucktes Papier, und die Mechanik des Buchs zeigt, was die Software tut: Laschen schieben Karten durch Kabelkanäle, ein Stapel wächst hinter einem Fenster, ein Leselicht fährt an ihm hinauf, eine Sandbox stellt sich auf.

**Das eine Bild, das auf den Doppelseiten 2 bis 5 gleich bleibt:** Der Bund ist die Grenze zum Modell. Links steht alles, was zum Agenten gehört (Büro, Agent, die Server der Dienste, Karteikasten, Sandbox), rechts nur das Modell mit seinem Kontextfenster. Am Bund liegt im Boden ein Messingdeckel, die Durchreiche. Was durch sie nach rechts ins Fenster geht, kostet Tokens. Die Leserichtung trägt das: Die Frage kommt links aus dem Büro, geht zum Agenten und von dort nach rechts zum Modell.

Alles ist in Code gerechnet. Ein eigener WebGL2-Renderer rechnet jedes Filmbild 64-mal: daher weiche Schatten, Schärfentiefe und Bewegungsunschärfe wie in einer Makroaufnahme.

## Papiermechanik (scenes/book.js, scenes/popup.js)

- Jedes Blatt hängt an einer Bundlinie und dreht sich um sie. Die beiden Stapel neigen sich leicht, so wie ein echtes Buch auf dem Tisch liegt.
- Eine Doppelseite steht zwischen der Rückseite des umgeschlagenen Blatts und der Vorderseite des nächsten. Wird ein Blatt gewendet, klappt die alte Szene zusammen und die neue richtet sich auf, beide vom selben Öffnungswinkel getrieben.
- `vfold`: zwei Flügel, an Linien durch einen Punkt der Bundlinie auf die Seiten geklebt. Flach, wenn das Buch zu ist; senkrecht, wenn es offen liegt. In den Sälen (3 bis 5) ist der Knick des Flügels die Trennwand zwischen Dienste-Saal und Modell-Saal.
- `stand`: eine Lage auf Laschen, parallel zu einem Flügel, ein Stück davor. Mit `life()` gleitet sie, steht auf oder legt sich hin, dreht sich, leuchtet.
- `flat`: ein Plättchen, das flach auf der Seite in einem Schlitz gleitet: Karten und Papierstreifen auf dem Weg durch die Kabelkanäle.
- **Nichts gleitet über den Knick.** Ein Plättchen fährt bis an den Messingdeckel, taucht ab (`show`), und sein Gegenstück taucht 0,25 s später auf der anderen Seite aus dem Deckel auf.
- Was aufrecht steht, steht aufrecht vom Aufklappen bis zum Zuklappen, oder es liegt flach wie eine Bildkarte (`rx` π/2 − 0,02) und steht auf sein Wort auf. Nichts liegt waagerecht in der Luft, nichts sticht beim Wenden durch die Gegenseite.
- Beim Einrasten schwingt jede Lage einmal weich nach (Feder 13 rad/s, Dämpfung 5,2), vordere Lagen einen Hauch später.

## Material und Licht

- Schnittpapier: farbige Bögen, zugeschnitten und übereinandergeklebt. Jede geklebte Lage wirft einen kleinen weichen Schatten auf die darunter (`layer`, Hub 0,2 bis 0,8 mm). Fasern und Körnung im Papier, auch auf Bildschirmen.
- 4 bis 6 Tiefenebenen je Doppelseite: Himmel, Rückwand im Schnitt, Hauptlagen, Heldenlagen vorn, Druck auf der Seite. Schatten zwischen den Ebenen sind echt.
- Einband Leder mit Goldprägung, Vorsatz marmoriert, Buchblock aus Pappe, 1,2 mm je Blatt.
- Schlüssellicht: warm, von hinten links (die Lampe), Radius 7 cm, weiche Schatten nach vorn rechts. Aufhellung groß, kühl, von oben vorn. Kante kühl, von hinten rechts.
- Leuchtendes (Bildschirme, LEDs, Leselicht, Hallenleuchten, Fenster, die Durchreiche) ist ein eigenes Blatt, das glimmt (`e`, `life().glow`), mit etwas Lichthof.
- Das Licht jeder Doppelseite ist eine Farbe des Kapitels, keine Uhr: Es gibt im Bild keine Uhr und nichts, was eine Dauer der Aufgabe behauptet.

## Farbe

### Einband und Vorsatz

Der zweite Band ist **tannengrün** gebunden, mit der Goldprägung der Reihe. Werte für `scenes/look.js`:

| Token | Wert | Wofür |
| --- | --- | --- |
| `hide` | `#1e3d33` | gemaltes Leder des Einbands |
| `leather` | `#1a362d` | dasselbe Leder als Grundfarbe im Renderer |
| `edge` | `#1d392f` | Kanten und Rücken |
| `pit` | `rgba(2,12,9,.62)` | Narben im Leder |
| `gold` | `#c49846` | Prägung |
| `signal` | `#2a55d4` | Signalfarbe (`signalLight` `#6f93f0`, `signalDark` `#18337f`) |
| `ink` | `#2b2420` | Druckfarbe |

Vorsatz: Marmorpapier in Grün, Schiefer und Ocker, ohne Signalfarbe. Zellen (RGB): `[36,74,62]`, `[47,97,80]`, `[36,74,62]`, `[26,58,48]`, `[61,122,102]`, `[47,97,80]`, `[36,74,62]`, `[75,88,102]`, `[47,97,80]`, `[176,138,72]`, `[36,74,62]`, `[26,58,48]`, `[61,122,102]`, `[47,97,80]`, `[91,127,110]`, `[36,74,62]`. Ränder `[26,58,48]`, `[20,44,37]`, `[75,88,102]`, `[150,112,62]` im Wechsel, Adern Creme `[226,212,184]`. Schild auf dem Vorsatz: „Eine Erklärung, erzählt in Papier.“

### Die Signalfarbe

**Kobalt `#2a55d4`** steht allein für Code Mode: die Programmkarte, die dünne Kobaltlage, die sie im Kontextfenster hinterlässt, das Kobaltplättchen, das sie zur Sandbox bringt, den Zeilenzeiger, den Rand des Ergebniszettels, das Wort „Code Mode“ (Titelblatt, Fuß des rechten Fensters auf 6, Statuszeile auf 7) und die Rauten der Botschaftskarte. Sonst ist nichts im Buch blau oder himmelblau: keine blauen LEDs (grün `#7fd18a`, bernstein `#f0b44c`), keine blauen Kabel, kein blauer Himmel (die Himmel laufen von Gold über Koralle und Malve zu Aubergine), keine blauen Ordner, keine blauen Käfige. Werkzeugbeschreibungen sind immer Manila, auch die Werkzeuge des Code Mode.

Dramaturgie: Kobalt steht auf dem Titelblatt im Namen und kommt erst auf Doppelseite 5 mit der Programmkarte wieder. Die Bildseiten 2 bis 4 sind ohne Blau.

### Die Dienste: eine Farbe je Käfig

Jeder Server-Käfig hat eine kräftige Tür und Rückwand in seiner Farbe; Türschild Creme `#f4eedd` mit Jost 700 in Tinte; sein Kabel in einem dunkleren Ton derselben Farbe. Das Gitter bleibt dunkles Stahlgrau `#5d6164`, nur als Rautenmuster vor der Farbe.

| Dienst | Tür und Rückwand | Kabel | Server darin |
| --- | --- | --- | --- |
| RECHNUNGEN | Ochsenblut `#7b2b2d` | `#5a1f21` | schwarzes Rack, Laufwerksschächte, grüne LEDs |
| TABELLE | Tannengrün hell `#2e5c48` | `#22463a` | graues Rack, kleines Display mit Tabellenraster |
| MAIL | Ocker `#c8902e` | `#9a6d20` | weiße 1-HE-Server |
| KALENDER | Terrakotta `#b75b3b` | `#8c432b` | niedriges Rack, bernsteinfarbene LEDs |
| DATEIEN | Pflaume `#6b3f5e` | `#4f2e45` | Speicher mit 24 Laufwerksschächten |
| CHAT | Senf-Oliv `#8f8a3a` | `#6b672b` | grüngraue Einschübe |
| WETTER | Salbei `#7e9a7c` | `#5e745d` | kleiner Wandkasten |

### Farbskript

| Doppelseite | Licht und Himmel | Gründe | Held der Seite und Akzente |
| --- | --- | --- | --- |
| 0 Einband | Lampe | Leder `#1e3d33` | Gold `#c49846` |
| 1 Titel | Lampe | Creme `#efe6d2` | „CODE MODE“ in Kobalt |
| 2 Die Frage | später Nachmittag, golden: Himmel `#eec58f` oben bis `#f7e4bf` am Horizont, Sonne tief links | Büro: Ziegel `#b9785a`, Laibungen Hafer `#d9c7a8`; Rechenzentrum: warmer Stein `#bdb3a3`, Flachdach Teer `#4a4540`; Wiese dazwischen `#a9b77f`, ferne Dächer `#8a7a6a`; Seite: Erdstreifen `#8a6a4a`, Glasfaserrohr Orange `#d9823a` | Monitor Anthrazit `#2f3437` mit Chatfenster `#f4f1e8`; Agent Creme `#ece4d3` mit Messingschild; Fensterrahmen Eiche `#b98a55`; Tokens Creme `#f3ecd8` |
| 3 Die Werkzeuge | Sonnenuntergang: Himmel Koralle `#e58f72` bis Aprikose `#f4c08e`, Sonnenscheibe `#f6d48a` tief rechts; ihr Licht fällt streifend durch den offenen Dachschnitt auf die Käfige | Dienste-Saal: gekalkte Blockwand `#e6ddcc` mit Fugen, Doppelboden `#d2cabb`, Lochplatten `#bdb5a6`, Dachträger im Schnitt rote Grundierung `#9a4a35`; Modell-Saal: Wand Kohlebraun `#4a4440` | **Manila `#e8d5a2`**: die Beschreibungskarten; die sieben Käfigfarben; Glasfaserrinne Gelb `#e8c23a`; Sprinklerrohr `#a8382e` |
| 4 Der direkte Weg | Dämmerung: Himmel Malve `#7d5f80` bis Rosé `#cf9488` am Horizont; die Hallenleuchten brennen warm `#f6dc93` und werfen Lichtinseln auf den Boden | wie 3, eine Stufe wärmer und dunkler: Blockwand `#d8ccb4`, Doppelboden `#c7bca8`, Modell-Saal `#403a36` | **Endlospapier `#f4f1e4` mit Streifen `#d5e6cf`** und roten Marken `#b8433a`; Aufrufkarten Manila; Zeilenstreifen Creme `#efe6d2`; Rundenzähler Weiß und Schwarz |
| 5 Code Mode | Nacht: Himmel Aubergine `#2a2034` bis `#3d2f45`, Sterne `#f3ecd8`; Hallenleuchten gedimmt; ein kühlweißes Arbeitslicht `#eef0ea` über Agent, Sandbox und Fenster | Dienste-Saal im Halbdunkel: Blockwand `#a99f90`, Boden `#9d9384`; Modell-Saal `#3a3532`; die Käfigfarben gedämpft, nur RECHNUNGEN und TABELLE im Arbeitslicht | **Kobalt `#2a55d4` und Weiß**: Programmkarte, Sandbox `#f4f3ee`, Blindkappe Rot `#b8433a`; Endlospapier klein in der Sandbox |
| 6 Wann es sich lohnt | Nacht im Prüfraum: schmaler Dachschnitt mit Aubergine `#2a2034`; eine warme Arbeitslampe `#ffd98a` über der Werkbank | Wand Oliv `#5a6346`, Lochwand Hartfaser `#c9a46a` mit Werkzeug, Werkbank mit grüner Antistatikmatte `#4f7a5f` | **Messing `#c49846`**: Zuglasche und Skala; die zwei Fenster in Eiche; „Code Mode“ in Kobalt am Fuß des rechten |
| 7 Was kommt | tiefe Nacht im Büro: Fenster Pflaume `#2e2a3c`, Mond `#efe6d2`, gegenüber einzelne warme Fenster `#ffd98a`; die Schreibtischlampe an | Wand Hafer im Lampenlicht `#c9b493`, Dielen `#9c7048`, Ordner Ocker `#c99a4a`, Grün `#5d7f63`, Rot `#a8463a` | **Creme `#f4eedd`**: die Botschaftskarte; Monitor mit der Summe; Laptop Alu `#c9ccc9`, Terminal `#22262a`, „Code Mode“ Kobalt |
| 8 Rückdeckel | Lampe | Leder | Gold |

## Schrift

| Schrift | Wofür | Größe (Versalhöhe-Gefühl, mm) |
| --- | --- | --- |
| Fraunces 900 | Kapitelüberschrift vorn links, immer in Tinte; Titel „CODE MODE“ | Überschrift 11 bis 14, Titel 18 bis 22 |
| Fraunces 600 | Zahlentafeln, Botschaft | Tafeln 4,5, Botschaft 6 |
| Jost 700 versal, gesperrt 0,15 bis 0,3 | Schilder: „MODELL“, „AGENT“, Türschilder, „MCP“, „KONTEXTFENSTER“, „SANDBOX“, „RUNDE“ | 2,4 bis 4 |
| Jost 500 | Bildschirmoberflächen, Skala der Zuglasche | 2,4 bis 3; Summe auf 7: 4 |
| JetBrains Mono 400/700 | Programmcode (nur auf der Programmkarte), Terminal auf 7 | 1,7 bis 2,2; Statuszeile 3 |
| Courier Prime 400/700 | JSON: Beschreibungen, Aufrufkarten, Rechnungen, Ergebniszettel | 1,6 bis 2,0 |
| Caveat 700 | Bleistift: der Strich „direkter Weg“ auf 5 | 3,5 |

Regeln: höchstens sieben Wörter je Zeile; JSON-Zeilen höchstens 26 Zeichen, Programmzeilen höchstens 31 (umbrechen statt verkleinern). Was gelesen werden soll, steht als Heldenlage vorn, mindestens so lange, wie es dauert, es laut zu lesen, plus eine Sekunde, nie unter 3,5 s. Begriffsschilder liegen flach und stehen auf ihr Wort auf. Gedruckte Wörter stehen in `const TX` jeder Doppelseite, mit Register-ID im Kommentar.

## Maßstab

Zwei Maßstäbe, jeder Gegenstand nur in einem: **Orte** im Schnitt (Gebäude, Säle, Käfige, Racks) und **Heldenlagen** vorn auf der Seite (Monitor, Laptop, Karten, Programmkarte, Heldenfeld des Endlospapiers, Botschaftskarte). Eine Heldenlage steht vorn auf der Seite, nie in einem Raum, dessen Maßstab sie sprengt. Keine Figur neben einem Monitor. Die Maschinen (Agent, Rack MODELL, Kontextfenster) haben auf 2 bis 5 dieselbe Größe und denselben Platz: In den Sälen (3 bis 5) stehen sie in ihrem Raum, auf 2 stehen sie als Heldenlagen vor den kleinen Gebäuden im Schnitt, damit man sie auf 3 wiedererkennt.

## Die echten Dinge als Schnittpapier

Maße in Millimetern auf dem Papier.

- **Monitor (Heldenlage, 2 und 7).** 96 × 62 auf Fuß, Rahmen Anthrazit 2,5 breit, Säule und Fuß als eigene Lage, Bildfläche ein eigenes glimmendes Blatt (`e` .45). Auf 2 das Chatfenster: Leiste mit drei Punkten und „Agent“, rechts die Nachricht als helle Blase in zwei Zeilen, 3 mm: „Trag alle offenen Rechnungen in eine Tabelle“ / „und schreib die Summe darunter.“ Auf 7 nur das untere Ende der Tabelle: Kopfzeile „Nr · Kunde · Status · Betrag“, die drei letzten Rechnungen, darunter fett die Summenzeile „Summe 23.874,60 €“ in 4 mm. Davor Tastatur (Tasten als Raster), Becher. Kein Mensch.
- **Laptop (Heldenlage, 7).** Aufgeklappt, Bildfläche 78 × 50, Alu, Terminal Anthrazit. JetBrains Mono, umbrochen: `$ CLAUDE_CODE_` / `EXPERIMENTAL_CODE_MODE=1` / `claude`, darunter mit Abstand groß (3 mm) die Statuszeile `Code Mode (experimental)` / `is on`, „Code Mode“ in Kobalt. Keine Sandbox und kein Programmtext von Doppelseite 5 auf diesem Gerät.
- **Bürogebäude und Rechenzentrum im Schnitt (2).** Klein auf den Flügeln: links ein dreistöckiges Bürohaus, Dach geschnitten, ein erleuchtetes Fenster im zweiten Stock (darin höchstens eine 6 mm kleine sitzende Figur am Schreibtisch, sonst Lampe und Stuhl); rechts ein flaches Rechenzentrum mit Kühlaggregaten auf dem Dach, innen Rackreihen. Zwischen beiden über den Knick etwa 50 mm freie Wiese, ein flacher Horizont mit fernen Dächern, kein Hügel. Davor die Heldenlagen: links der Monitor, links am Bund der Agent, rechts am Bund Rack und Kontextfenster. Auf der Seite davor ein Erdstreifen, in dem die Glasfaser im orangefarbenen Schutzrohr von links nach rechts läuft und am Bund in den Messingdeckel mündet.
- **Die zwei Säle (3 bis 5).** Ein Gebäude im Schnitt; der Knick ist die Trennwand. **Links der Dienste-Saal:** gekalkte Blockwand, Doppelboden mit Lochplatten, gelbe Glasfaserrinne unter der Decke, rotes Sprinklerrohr, Dachträger im Schnitt, darüber der Himmel; an der Wand die sieben Käfige (vom Bund nach außen: RECHNUNGEN, TABELLE, MAIL, KALENDER, DATEIEN, CHAT, WETTER), davor der Agent. Kleine Dinge, die ein Saal hat: Feuerlöscher an der Wand, ein Wagen mit Ersatzlaufwerken, gelb-schwarze Bodenmarken vor den Käfigtüren, Etiketten an den Kabeln. **Rechts der Modell-Saal:** dunkler, schwerer: vier GPU-Racks in einer Reihe, kupferne Kühlrohre `#b87333` und schwarze Schläuche an einem Sammelrohr unter der Decke, ein Kühlverteiler am Ende der Reihe; das vorderste Rack trägt „MODELL“, die anderen nur Lichter. Die Glasfaserrinne läuft über die Trennwand und hängt im Modell-Saal als eigene Lage vor dem oberen Ende des Kontextfensters.
- **Durchreiche.** Im Boden am Bund ein Messingdeckel 30 × 12 mit Lüftungsschlitzen, auf beide Seiten gedruckt (je eine Hälfte); darunter eine Lampe, die bernsteinfarben glimmt, wenn etwas ans Modell geht oder von ihm kommt. Von beiden Seiten münden Kabelkanäle hinein. Auf 5, während das Programm in der Sandbox läuft, bleibt sie dunkel.
- **Kabelkanäle.** Schlitze im Doppelboden mit Messingkanten. Links führt jeder Kanal zum Agenten: von jedem Käfig, vom Karteikasten, von der Sandbox, und vom Agenten einer zur Durchreiche. Rechts führt einer von der Durchreiche zum Einlass des Fensters und einer vom Ausgabeschlitz des Modells zur Durchreiche. Kein Kanal verbindet einen Käfig mit dem Modell.
- **Agent.** Ein hüfthoher Schrank 44 × 52, Creme `#ece4d3`, Messingschild „AGENT“ (steht auf 2 auf sein Wort auf), kleines Display mit drei grünen Zeilen, Lüftungsschlitze, an der Seite ein Bündel Anschlüsse. Er ist das Programm, das alles verbindet, und steht immer links direkt am Bund.
- **MCP-Anschluss.** An jedem Käfig dieselbe Alu-Platte 9 × 6 mit zwei Schrauben; der Stecker des Kabels liegt daneben, trägt das Schildchen „MCP“ und steckt sich auf das Wort ein. Danach bleibt er stecken, auf jeder Seite.
- **Modell.** Das vorderste Rack, 64 × 150: Glastür, acht Einschübe mit Kühlrippen, drehenden Lüftern und grünen LEDs. In Brusthöhe an der rechten Kante, neben dem Fenster, der Ausgabeschlitz mit Messingrand; darüber der Rundenzähler hinter einer Klappe (zu auf 2 und 3; sie öffnet sich auf 4 auf das Wort „Runde“ und bleibt dann offen), Schild „RUNDE“, Zahlentrommel 0 bis 3; eine Lampe „rechnet“ glimmt bernstein, solange das Modell schreibt.
- **Kontextfenster.** Ein hohes Fenster vor dem Modell, 40 breit: Eichenrahmen mit Messingbeschlägen, eine waagerechte Sprosse alle 30 mm, auf dem Glas zwei schräge Spiegelstreifen. **Kein oberes Ende:** Holme und Glas laufen hinter der Glasfaserrinne weiter nach oben aus dem Bild; am linken Holm Teilstriche alle 5 mm ohne Zahlen, die oben ebenfalls hinter der Rinne verschwinden. Unten der Einlass, eine Messingklappe mit Messer, und das Schild „KONTEXTFENSTER“ (steht auf sein Wort auf). Was hinter diesem Glas liegt, liest das Modell.
- **Der Stapel im Fenster: stehende Kantenansicht.** Aufrechte Lagen (`rx` 0) dicht vor der Rückwand, jede bedruckt mit den feinen Kanten ihres Papiers, wachsen über `dv`: Anweisungen (Schiefer `#8e969b`, mit kleinem Reiter „Anweisungen“), Werkzeugbeschreibungen (Manilakanten mit Reitern in den Käfigfarben), das Gespräch (Creme), Ergebnisse (Faltkanten des Endlospapiers mit Randlochung, `listingStack`; rote Marken im Verhältnis 41 zu 500, also etwa auf jeder zwölften Faltkante), Kobalt (die Programmlage auf 5). Die Frage ist keine Kantenansicht: Sie bleibt als vier Reihen lesbarer Schnipsel stehen. Höhen im Beispiel: Anweisungen 5, Beschreibungen 45, Frage 12, Rechnungen 55, abgeschriebene Zeilen 6, jede Aufrufkarte und jede Bestätigung 1 mm (Tabelle im Buchplan). Die Höhen zeigen ein Verhältnis, keinen Maßstab.
- **Leselicht.** Ein 2 mm hoher warmweißer Leuchtstreifen (`e` .7) vor dem Stapel. **Regel einer Runde, auf jeder Seite gleich:** Die Durchreiche glimmt (der Agent schickt alles), der Rundenzähler springt um eins (ab 4), dann fährt das Leselicht einmal von ganz unten bis zur obersten Lage, mit fester Geschwindigkeit 40 mm/s. Ein hoher Stapel ist eine lange Fahrt, ein kurzer eine kurze; ganz durch fährt es immer.
- **Tokens (2).** Die Frage auf einem Papierstreifen (Creme, Fraunces 600, 3 mm) reist ganz durch die Kanäle. Am Einlass des Fensters schneidet das Messer sie in 14 Schnipsel (0,4 mm Spalt, leicht schräger Schnitt, verschieden lang): `Trag`·` alle`·` offenen`·` Rech`·`nungen`·` in`·` eine`·` Tabelle`·` und`·` schreib`·` die`·` Summe`·` darunter`·`.` Sie steigen hinter dem Glas auf und setzen sich in vier Reihen über die Anweisungen (12 mm). Die Zerlegung ist eine Veranschaulichung; die echte hängt vom Modell ab.
- **Werkzeugbeschreibung.** Manilakarte 40 × 56 hochkant, oben ein Reiter mit dem Namen des Dienstes in dessen Farbe, 13 kurze Zeilen echtes JSON in Courier Prime, höchstens 26 Zeichen, die drei Schlüssel fett (`toolJson` in `techkit.js`). Die Heldenkarte auf 3 ist `rechnungen_liste`; das Werkzeug liefert die Rechnungen eines Jahres und **kann nicht nach Status filtern**:
  ```
  {
   "name":
    "rechnungen_liste",
   "description":
    "Rechnungen je Jahr",
   "inputSchema": {
    "type": "object",
    "properties": {
     "jahr": {
      "type": "integer"
     }
    } }
  }
  ``` Im Stapel sieht man von jeder Karte Kante und Reiter.
- **Aufrufkarte.** Manila 34 × 16, Kopf „Aufruf“ in Jost, zwei Zeilen JSON: `{"name": "rechnungen_liste",` / `"arguments": {"jahr": 2026}}`; dazu `zeilen_anfuegen` (begleitet vom Zeilenstreifen), `zelle_schreiben` mit `{"zelle": "D43", "wert": 23874.6}` und auf 5 `nachschlagen`. Auf 4 kommt sie aus dem Ausgabeschlitz des Modells, auf 5 aus der Sandbox: **dieselbe Karte, anderer Absender**, Wort für Wort gleich.
- **Endlospapier.** Im Fenster und in der Sandbox als stehende Kantenansicht. Wenn ein Ergebnis ankommt, steht davor eine **Heldenlage** auf: ein einzelnes Feld 40 × 22, leicht schräg, mit Randlochung, grünen Streifen und drei lesbaren Rechnungen, R-0112 bis R-0114, die mittlere offen und mit rotem Stempel (offen ist jede Rechnung 5 + 12·k, k < 41; Kunde und Betrag aus `invoice()` in `techkit.js`). Jede Rechnung in vier Zeilen, die Felder in der Reihenfolge der Tabellenspalten: `{ "nr": "R-0113",` / `"kunde": "…",` / `"status": "offen",` / `"betrag": … },`. Dieselbe Reihenfolge gilt für alles Endlospapier (`listing` druckt bisher `betrag` vor `status`).
- **Zeilenstreifen.** Ein Creme-Streifen 70 × 10 mit Spaltenlinien und der Kopfzeile `zeilen_anfuegen`, dicht beschrieben, einzelne rote Marken (dieselben offenen Rechnungen).
- **Programmkarte.** Kobalt 46 × 66, Kanten dunkler, JetBrains Mono Creme, Schlüsselwörter fett, Kopf „PROGRAMM“. Die drei Werkzeugnamen `rechnungen_liste`, `zeilen_anfuegen`, `zelle_schreiben` stehen auf Manila unterlegt, wie die Reiter der Karten auf 3. Text:
  ```
  async () => {
    const alle = await codemode
      .rechnungen_liste(
        { jahr: 2026 });
    const offen = alle.filter(
      r => r.status === "offen");
    await codemode
      .zeilen_anfuegen(
        { zeilen: offen });
    const summe = offen.reduce(
      (s, r) => s + r.betrag, 0);
    await codemode
      .zelle_schreiben(
        { zelle: "D43",
          wert: summe });
    return {
      anzahl: offen.length,
      summe: summe.toFixed(2) };
  }
  ```
  19 Zeilen, die längste 31 Zeichen.
  Ein **Zeilenzeiger** (Kobaltreiter 3 × 2 am linken Rand) rutscht Zeile für Zeile, während das Programm in der Sandbox läuft. Es steht immer nur eine Programmkarte: Nach ihrem Halt am Modell legt sie sich hin, und im selben Augenblick wächst im Fenster die dünne Kobaltlage; ein Kobaltplättchen bringt sie über Durchreiche und Agent zur Sandbox, wo sie wieder aufsteht.
- **Werkzeuge des Code Mode.** Zwei kleine Manilakarten 24 × 14 mit den Namen `nachschlagen` und `code_ausfuehren` (so wie Cloudflares `search` und `execute`); ihre Kanten liegen im Fenster dort, wo auf 4 die 45 mm Beschreibungen lagen, nur 3 mm hoch.
- **Karteikasten.** Eiche, Messingbeschläge, Deckel, vorn links neben dem Agenten, kein Schild. Darin Karten mit denselben Reitern wie auf 3. Wird nachgeschlagen, heben sich genau drei Karten (`rechnungen_liste`, `zeilen_anfuegen`, `zelle_schreiben`) und drehen sich (`ry` π) von der JSON-Seite auf ihre Rückseite: dieselbe Beschreibung als TypeScript in Creme, z. B. `rechnungen_liste(` / `input: { jahr?: number }` / `): Promise<Rechnung[]>`.
- **Sandbox.** Ein Kasten 90 × 64, vorn links neben dem Agenten: Rückwand Weiß `#f4f3ee`, Vorderseite ein Rahmen mit ausgeschnittener Öffnung (Glas nur als zwei Spiegelstreifen), Dachleiste mit Schild „SANDBOX“. Links eine Netzwerkbuchse mit roter Blindkappe und dem Schildchen „kein Internet“. Eine einzige Leitung führt zum Agenten. Sie liegt flach wie eine Bildkarte, steht auf ihr Wort auf (Rückwand, Rahmen, Dachleiste, 0,2 s gestaffelt) und bleibt stehen.
- **Ergebniszettel.** Creme 30 × 9 mit Kobaltkante, Courier Prime: `{ "anzahl": 41,` / `"summe": "23874.60" }`.
- **Prüfstand (6).** Zwei Kontextfenster derselben Bauart, kleiner (28 breit), links und rechts dicht am Bund, ebenfalls ohne oberes Ende (sie verschwinden hinter dem Schirm der Arbeitslampe). Am Fuß „direkt“ (Tinte) und „Code Mode“ (Kobalt). Vorn auf der rechten Seite eine **Zuglasche**: Messingschiene 150 lang, darauf eine Skala von „ein Aufruf“ bis „viele Schritte“, ein Schieber mit Griff (`flat`, `dx`). Steht er links, sind beide Stapel 30 mm hoch und der Code-Mode-Stapel endet 2,5 mm höher; gleitet er nach rechts, wachsen beide, der direkte schneller, bei etwa einem Drittel der Schiene überholt er; am rechten Ende 100 gegen 70 mm. Davor am linken Ende der Skala ein Papierstreifen wie auf 2: „Wie ist das Wetter in Berlin?“.
- **MCP-Heft (7).** Ein dünnes Heft 50 × 70, Creme mit Tinte: „Model Context Protocol“ / „Client Best Practices“; aufgeschlagen die Überschrift „Programmatic Tool Calling“ / „Code Mode“, ein Kobaltlesezeichen.
- **Botschaftskarte (7).** Creme 130 × 52, doppelte Linie, Kobaltrauten in den Ecken, Fraunces 600 6 mm, drei Zeilen (Wortlaut im Buchplan).

## Beispieldaten (durchgehend gleich)

500 Rechnungen des Jahres 2026, R-0001 bis R-0500, davon 41 offen, Summe 23.874,60 €. Spalten der Tabelle: Nr (A), Kunde (B), Status (C), Betrag (D); Kopfzeile in Zeile 1, Rechnungen in 2 bis 42, Summe in D43. Beispieldaten des Films; nirgends heißt es, sie seien gemessen.

## Figuren

Keine Figur in Heldengröße. Auf 2 höchstens eine 6 mm kleine sitzende Figur im erleuchteten Bürofenster, Rücken zum Betrachter; hält sie nicht, bleiben Lampe und Stuhl. Auf 7 niemand: eine Jacke über der Stuhllehne, der Becher dampft. In den Sälen und im Prüfraum keine Menschen, keine Roboter, kein Gesicht an einer Maschine.

## Kamera

- Makro, lange Brennweite (Blickwinkel 0,3 bis 0,55 rad), geringe Schärfentiefe (Blende 2 bis 3,5 mm), die Schärfe auf dem, wovon die Stimme spricht. Zum Lesen von Karten: fov .32 bis .36, Schärfe genau auf der Karte, mindestens 3,5 s Halt.
- Je Kapitel höchstens sieben Stationen: Totale, Fahrt zu dem, was erzählt wird, entlang der Kanäle zum nächsten Ding, zurück in die Totale vor dem Wenden. Eine Fahrt über die halbe Seite dauert 2 bis 3 s.
- Wo Agent, Käfige und Sandbox zusammen wirken (5), ein Bild für alle: fov um .44, Auge um .16.
- Blick meist 25 bis 40 Grad über dem Tisch; für den Stapel auf 4 tiefer (Auge .12 bis .14).

## Was der Film nicht tut

- Kein Logo. Cloudflare, Anthropic und Claude Code erscheinen nur als gesetzte Schrift; andere Firmen gar nicht.
- Keine Roboter, keine Gesichter an Maschinen, keine Maskottchen, kein Konfetti, keine Glühbirnen, Gehirne, Berge.
- Nie ein Weg vom Modell direkt zu einem Werkzeug: Alles läuft über den Agenten.
- Nie ein Bild, in dem Code Mode MCP ersetzt: Die MCP-Stecker bleiben stecken, und die Aufrufe aus der Sandbox sind dieselben Manilakarten.
- Kein Fenster mit oberem Ende, keine Füllstandsmarke, keine Token-Zahl für die Beispielaufgabe, keine Geldbeträge für Tokens.
- Keine Sandbox an Claude Code, keine Zahl zu Claude Code.
- Keine Quellen, Fußnoten oder schwebenden Einblendungen. Was zu lesen ist, steht gedruckt im Buch.
- Kein Begriff, kein Schild und kein Kobalt vor seinem Wort (außer dem Titel).
- Höchstens zwei Dinge bewegen sich gleichzeitig deutlich. Nichts schwebt, nichts gleitet über den Knick.
- Keine Zahl und kein Name, die nicht im Register von research.md stehen.
