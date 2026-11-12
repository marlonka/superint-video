# Launch-Film, Update-Video, Produktvideo

Ein kurzer Produktfilm: Launch, „v2 ist da“, Feature-Video, UI-Walkthrough, Loop oder Logo-Sting. Ändere nur die Zeilen im Kasten **Eingaben** und schicke den ganzen Block ab.

Der Ablauf (Produktinventar, Copy-Regeln, Spine, Directions, Track, Review) steht im Skill `superint-launch`, aufgebaut auf [cinetic](https://github.com/Leonxlnx/cinetic) von Leon (MIT). Das Werkzeug steht im Skill `superint-video`.

````text
Nutze die Skills superint-video und superint-launch und produziere einen Produktfilm.

## Eingaben
PRODUKT:     <Name und ein Satz, was es ist>
MATERIAL:    <URL, Screenshots, Changelog, echte UI-Texte und Zahlen>
FORMAT:      Launch-Film          # Launch-Film | Update-Video | Feature-Video | UI-Walkthrough | Loop | Logo-Sting | Social Ad
LÄNGE:       ca. 25 s             # Richtwert
SEITEN:      16:9                 # 9:16, 1:1, 4:5; Varianten werden neu kadriert, nicht beschnitten
SPRACHE:     de
BRAND:       <Ordner mit Logo, Farben, Schriften, Screenshots | erfinden aus drei Wörtern: …>
PRESET:      blank                # der Look; blank = Look kommt aus Brand und Referenzen
REFERENZEN:  <optional: Standbilder/Screenshots von Filmen, deren Look du willst, kommagetrennt>
TON:         <Musik-Datei mit Lizenz | Musik generieren | keiner>
STOPPS:      keine                # keine | direction, script, frames, contact
ORDNER:      ./<ordnername>

## Anspruch
Ein Fremder weiß nach 3 Sekunden, was das Produkt ist, und am Ende, was es tut. Jedes Bild zeigt das Produkt bei genau dem, was die Zeile sagt, mit seiner echten Oberfläche, in Code nachgebaut. Ein Element trägt durch jeden Szenenwechsel. Keine erfundenen Funktionen, Zahlen oder Kunden.

## Arbeitsweise
- Lege das Projekt mit `superint-video new` an (PRESET → --preset, `--workflow superint-launch`, REFERENZEN → --reference, STOPPS → --stop) und arbeite den Ablauf des Skills ab.
- Frag höchstens drei Dinge, und nur, was fehlt. Halte sonst nur an den STOPPS an.
- Beurteile nur, was du gerendert und dir angesehen hast.

## Abgabe
Vor dem Render läuft ohne Nachfrage der Polish-Durchgang des Skills (frische Augen, wenn möglich ein Sub-Agent mit dem stärksten verfügbaren Modell), bis ein Durchgang sauber ist, in so vielen Runden, wie in der Einrichtung eingestellt. Dann das Hauptformat rendern und mir sofort MP4 und Studio-Adresse nennen.

Nach meiner Abnahme: Varianten, Poster, Kontaktbogen, script.md, direction.md, process/ und report.md mit gewählter Direction und Begründung, Musiklizenz bzw. Herkunft und was geprüft ist.
````
