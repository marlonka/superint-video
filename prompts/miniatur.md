# Erklärfilm im Miniatur-Look

Ein Erklärfilm im Look von „Videos aus Code“: eine fotografische Miniaturwelt, ganz aus Code gerechnet, ein Ort, durch den die Kamera fährt, Dinge, die von selbst handeln, keine Menschen. Ändere nur die Zeilen im Kasten **Eingaben** und schicke den ganzen Block ab.

Das Rendern dauert bei sechs Minuten Film rund zwei Stunden, das Bauen deutlich länger: Jeder Raum ist viel Code. Das lohnt sich für Filme, die länger halten sollen.

````text
Nutze die Skills superint-video, superint-explainer und superint-miniature und produziere einen Film.

## Eingaben
THEMA:       <Thema oder Frage>
BOTSCHAFT:   <der eine Satz, den der Film vertritt und den man danach weitererzählt>
LÄNGE:       ca. 3 min            # Richtwert: die Stimme bestimmt die Länge, nie kürzen, nur um sie zu treffen
SPRACHE:     de
ORT:         <optional: Haus, Schiff, Fabrik, Uhrwerk ... sonst wählst du>
REFERENZEN:  <optional: Fotos für die erste Nahaufnahme, an denen du dich misst>
MUSS:        <optional: was unbedingt vorkommen muss>
VERMEIDEN:   <optional: was nicht vorkommen darf>
STOPPS:      keine                # keine | concept, script, frames, contact
ORDNER:      ./<ordnername>

## Anspruch
Die erste Einstellung hält als Foto stand. Jeder Raum ist ein echter Schritt des Themas, und man sieht ihn dabei, wie er ihn tut. Alles passiert auf einem gesprochenen Wort. Was ich hier sage, kommt nicht wörtlich in den Film, weder als Stimme noch im Bild.

## Arbeitsweise
- Lege das Projekt mit `superint-video new` an (`--preset miniature-3d --workflow superint-explainer`) und arbeite den Ablauf ab.
- Frag höchstens drei Dinge, und nur, was fehlt. Halte sonst nur an den STOPPS an.
- Beurteile nur, was du gerendert und dir angesehen hast.
````
