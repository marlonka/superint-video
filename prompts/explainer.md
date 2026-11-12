# Erklärvideo

Der Hauptauftrag: ein animiertes Erklärvideo zu einem beliebigen Thema, vollständig vom Agenten recherchiert, geschrieben, gestaltet und gerendert. Ändere nur die Zeilen im Kasten **Eingaben** und schicke den ganzen Block ab.

Der Ablauf selbst (Claim-Register, drei Konzepte, drei Skripte, Beat-Board, Style-Frames, Review-Runden mit `superint-video review`, der Polish-Durchgang mit `superint-video polish` vor dem Render, Bericht nach der Abnahme) steht im Skill `superint-explainer`, das Werkzeug im Skill `superint-video`. Der Prompt legt nur fest, *was* entstehen soll, *was der Film sagt* und *wie hoch* die Latte liegt.

````text
Nutze die Skills superint-video und superint-explainer und produziere ein Erklärvideo.

## Eingaben
THEMA:       <Thema oder Frage>
BOTSCHAFT:   <der eine Satz, den der Film vertritt und den man danach weitererzählt>
LÄNGE:       ca. 60 s             # Richtwert: die Stimme bestimmt die Länge, nie kürzen, nur um sie zu treffen
SPRACHE:     de                   # Sprechertext und Bildschirmtext
FORMAT:      16:9                 # 9:16 für Shorts, 1:1 für Feeds
PRESET:      flat-explainer       # der Look; `superint-video preset list` zeigt alle
REFERENZEN:  <optional: Standbilder/Screenshots des gewünschten Looks, kommagetrennt>
ZIELGRUPPE:  neugierige Erwachsene ohne Vorwissen
MUSS:        <optional: was unbedingt vorkommen muss>
VERMEIDEN:   <optional: was nicht vorkommen darf>
STOPPS:      keine                # keine = ganz autonom | concept, script, frames, contact
STIMME:      <KI-Stimme | ich spreche selbst | ohne Stimme>   # ohne API-Schlüssel: selbst sprechen oder ohne Stimme
TON:         <Musik und SFX, soweit eingerichtet (doctor --json → capabilities) | nur SFX | keiner>
ORDNER:      ./<ordnername>

## Anspruch
Die Messlatte ist ein Film, den ein Top-Studio für Wissensvideos veröffentlichen würde: Er vertritt seine BOTSCHAFT mit wahren, starken Gründen, lässt eine Idee klicken, und jedes Bild ist eine fertige Illustration. Leg deinen Kontaktbogen neben die Referenzbilder in `references/`: Was daneben leer, dunkel, abstrakt oder unfertig wirkt, ist nicht fertig.

- Zeig die echten Dinge des Themas: Menschen, Orte, Gegenstände, Geld, Karten. Keine Symbolwelt, die man erst entschlüsseln muss.
- Wenige zusammenhängende Welten, eine pro Kapitel des Arguments, mit einer durchgehenden Art Direction. Die Kamera fährt durch die Welt, Figuren gehen von Ort zu Ort, alle 2–4 s passiert etwas Neues.
- Neue Welt nur, wenn das Argument weitergeht (typisch alle 10–30 s), mit gestaltetem Übergang: Kamerafahrt, Figur geht hinüber, Match-Cut, Blende.
- Kein Schnitt auf ein neues Design alle 5–10 s, nicht alles in Dunkelblau.
- Figuren mit Gesicht und Charakter, die auf ihr Wort handeln.
- Das Ende sagt die Botschaft über ein eigenes Bild, danach steht eine Endkarte, auf der die Musik ausklingt.
- Der Stil anderer Kanäle ist ein Handwerksstandard, keine Vorlage. Übernimm nie Namen, Logos oder Figuren anderer Kanäle.

Prioritäten in dieser Reihenfolge: verstanden → überraschend → schön → poliert.

## Arbeitsweise
- Lege das Projekt mit `superint-video new` aus den Eingaben an (PRESET → --preset, `--workflow superint-explainer`, REFERENZEN → --reference, BOTSCHAFT → --message, MUSS → --must, VERMEIDEN → --avoid, STOPPS → --stop) und arbeite den Ablauf des Skills Schritt für Schritt ab.
- Frag mich nichts. Entscheide wie eine gute Regisseurin oder ein guter Regisseur und begründe die Entscheidungen im Bericht. Halte nur an den STOPPS an.
- Erste Entwürfe sind Rohmaterial. Arbeite in Kritikrunden mit konkreten Mängellisten; wenn eine Runde nur poliert, verbessere die Idee statt der Oberfläche.
- Beurteile nur, was du gerendert und dir als Bild angesehen hast, nie den Code.
- Die BOTSCHAFT ist der Winkel: Suche die stärksten belegten Gründe dafür und den stärksten Einwand. Wenn die Belege sie nicht tragen, sag es mir vor dem Skript, statt dir einen anderen Winkel zu suchen oder Vorbehalte wegzulassen.

## Abgabe
Vor dem Render läuft ohne Nachfrage der Polish-Durchgang des Skills: Frische Augen (wenn möglich ein Sub-Agent mit dem stärksten verfügbaren Modell) sehen sich alle 5 s ein Standbild, Nahaufnahmen, jeden Schnitt und die schnellsten Bewegungen an und bessern nach, bis ein Durchgang sauber ist, in so vielen Runden, wie in der Einrichtung unter „Feinschliff vor dem Render“ eingestellt. Dann rendern und mir sofort MP4 und Studio-Adresse nennen, ohne weiteren Schritt.

Nach meiner Abnahme: Thumbnail, Kontaktbogen, research.md, concepts.md, direction.md, script.md, beats.md, process/ und report.md auf Deutsch mit: Botschaft und den Gründen, die der Film dafür gibt, gewähltem Konzept und Begründung, Gestaltungsentscheidungen, Titelvorschlag plus drei inhaltlich verschiedenen Alternativen, Beschreibung mit Quellen je Behauptung, gemessener Lautheit (falls Ton) und was geprüft bzw. nicht geprüft ist.
````

## Varianten

- **Short:** `FORMAT: 9:16`, `LÄNGE: 35 s`. Siehe [short.md](short.md) für die Zusätze.
- **Erst Konzepte sehen:** `STOPPS: concept`. Für maximale Kontrolle `concept, script, frames, contact`.
- **Aha vorgeben:** Schreib unter MUSS den Aha-Moment, den du willst („Der Clou: Schlaf spült das Gehirn wortwörtlich durch“).

## Alternativ mit vorbereitetem Ordner

```sh
superint-video new <ordnername> --preset flat-explainer --workflow superint-explainer --topic "<Thema>" --message "<Botschaft>" --seconds 60 --must "<…>" --avoid "<…>" --stop concept
```

```text
Nutze die Skills superint-video und superint-explainer und produziere das Video in ./<ordnername> nach brief.md. Messlatte: ein Film, den ein Top-Studio für Wissensvideos veröffentlichen würde. Frag nichts außerhalb der Stopps im Briefing.
```
