# Erklärfilm als Pop-up-Buch

Ein Erklärfilm im Stil „Faltwerk“: ein Pop-up-Buch auf einem Schreibtisch, ganz aus Code gerechnet. Jedes Kapitel ist eine Doppelseite, deren Bild aus geschnittenem Papier sich beim Aufschlagen aufstellt und auf die Wörter der Stimme handelt; zwischen den Kapiteln blättert die Seite um. Ändere nur die Zeilen im Kasten **Eingaben** und schicke den ganzen Block ab.

Das Rendern dauert bei vier Minuten Film rund eine Viertelstunde, das Bauen deutlich länger: Jede Doppelseite ist viel Code. Das lohnt sich für Filme, die länger halten sollen.

````text
Nutze die Skills superint-video, superint-explainer und superint-faltwerk und produziere einen Film.

## Eingaben
THEMA:       <Thema oder Frage>
BOTSCHAFT:   <der eine Satz, den der Film vertritt und den man danach weitererzählt>
LÄNGE:       ca. 3 min            # Richtwert: die Stimme bestimmt die Länge, nie kürzen, nur um sie zu treffen
SPRACHE:     de
EINBAND:     <optional: Farbe des Leders, Titel auf dem Buch ... sonst wählst du>
REFERENZEN:  <optional: Bilder, an denen du dich misst>
MUSS:        <optional: was unbedingt vorkommen muss>
VERMEIDEN:   <optional: was nicht vorkommen darf>
STOPPS:      keine                # keine | concept, script, frames, contact
ORDNER:      <optional: leer lassen = dein Filmordner aus der Einrichtung>

## Anspruch
Jede Doppelseite ist ein Kapitel, das man ohne Ton erkennt, gebaut wie echtes Papier: nichts schwebt, nichts fährt durch etwas hindurch. Alles passiert auf einem gesprochenen Wort. Was ich hier sage, kommt nicht wörtlich in den Film, weder als Stimme noch im Bild.

## Arbeitsweise
- Lege das Projekt mit `superint-video new` an (`--preset faltwerk --workflow superint-explainer`) und arbeite den Ablauf ab.
- Frag höchstens drei Dinge, und nur, was fehlt. Halte sonst nur an den STOPPS an.
- Beurteile nur, was du gerendert und dir angesehen hast.
````
