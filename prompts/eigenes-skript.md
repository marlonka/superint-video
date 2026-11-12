# Video zu einem vorhandenen Skript

Lege den Sprechertext als Datei ab (zum Beispiel `skript.md`) und erstelle das Projekt damit. Der Text wird unverändert nach `script.md` übernommen.

```sh
superint-video new <ordnername> --preset flat-explainer --workflow superint-explainer --topic "<Titel>" --seconds <60> --script skript.md
```

```text
Nutze die Skills superint-video und superint-explainer und produziere das Video in ./<ordnername> nach brief.md.

Das Skript in script.md ist fertig: Ändere keine gesprochenen Wörter. Lege trotzdem das Claim-Register an und prüfe jede Behauptung gegen Quellen; sag mir im Bericht, was nicht stimmt oder nur unter Bedingungen gilt, und schlage Korrekturen vor. Entwickle drei Konzepte für die Bildwelt, wähle eins, setze Szenenmarken, baue Beat-Board und Style-Frames und rendere das MP4.
<Optional: Die Länge richtet sich nach dem Skript, nicht nach den Sekunden im Briefing.>
<Optional: Stimme: eine KI-Stimme spricht das Skript (braucht einen API-Schlüssel) | ich spreche es selbst ein | ohne Stimme.>
```
