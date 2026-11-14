<p align="right"><a href="README.en.md">English</a></p>

<h1 align="center">Superint Video</h1>

<p align="center">
  <b>Dein Coding-Agent macht Videos für dich.</b><br>
  Du sagst, worum es gehen soll. Claude Code, ChatGPT Codex oder Google Antigravity recherchiert,<br>
  schreibt, zeichnet, vertont und rendert den Film, und du schaust dabei zu.<br>
  Alles läuft auf deinem eigenen PC, ohne Konto und ohne Abo.
</p>

<p align="center">
  <img alt="Windows 10 und 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-2f7bf5?style=flat-square">
  <img alt="macOS ab 11" src="https://img.shields.io/badge/macOS-ab%2011-6e6e73?style=flat-square">
  <a href="https://github.com/marlonka/superint-video/releases/latest"><img alt="Version 0.11.0" src="https://img.shields.io/badge/Version-0.11.0-2e8b57?style=flat-square"></a>
  <img alt="Lizenz: MIT" src="https://img.shields.io/badge/Lizenz-MIT-3a3a3a?style=flat-square">
</p>

<p align="center">
  <a href="https://github.com/marlonka/superint-video/releases/latest/download/Superint-Video-Setup.exe"><b>Superint Video für Windows herunterladen</b></a>
  · <a href="https://github.com/marlonka/superint-video/releases/latest/download/Superint-Video-macOS.zip">für den Mac</a>
</p>

<p align="center">
  <img src="docs/images/studio.jpg" alt="Das Studio von Superint Video: links die Vorschau eines fertigen Erklärfilms, rechts der Fortschritt des Coding-Agenten, unten die Timeline mit Szenen, Stimme, Musik und Soundeffekten" width="100%">
  <br>
  <sub>Das Studio mit einem fertigen Film. Du siehst, was dein Coding-Agent gerade tut, und änderst selbst, was du willst.</sub>
</p>

## So funktioniert es

Superint Video ist kein Schnittprogramm, in dem du selbst Szenen baust. Es ist die Werkstatt für deinen Coding-Agenten: Claude Code, ChatGPT Codex oder Google Antigravity finden darin alles, was ein Film braucht, und bauen ihn für dich.

1. **Du beschreibst den Film** in Superint Video. Die App schreibt daraus den Prompt für deinen Agenten.
2. **Du trägst den Prompt hinüber.** Superint Video kann deinem Agenten nichts direkt schicken. Diesen einen Handgriff machst du selbst: kopieren, im Agenten einfügen, abschicken.
3. **Dein Agent baut den Film** mit den Werkzeugen von Superint Video: Er recherchiert, schreibt, zeichnet, vertont, prüft und rendert.

Lass Superint Video offen, während er arbeitet. Dann wechselt es zum neuen Film, und du siehst jeden Schritt. Ist die App zu, öffnet dein Agent das Studio selbst. Zuschauen musst du aber nicht: Er arbeitet auch im Hintergrund weiter, bis das MP4 fertig ist.

## Was du brauchst

- **Einen Windows-PC** mit Windows 10 oder 11 (64 Bit) **oder einen Mac** mit macOS 11 oder neuer (Apple-Chip oder Intel).
- **Einen Coding-Agenten:** [Claude Code](https://claude.com/product/claude-code), [ChatGPT Codex](https://openai.com/codex/) oder [Google Antigravity](https://antigravity.google/), mit deinem Konto dort. Er macht die eigentliche Arbeit am Film.
- **Chrome und FFmpeg.** Fehlt eines davon, installiert die App es für dich.
- **Freiwillig: einen API-Schlüssel** von Google AI Studio oder OpenRouter, für eine KI-Stimme und Musik. Ohne ihn sprichst du den Film selbst ein, oder er kommt ohne Stimme aus.

## Installieren

1. **Herunterladen:** [`Superint-Video-Setup.exe`](https://github.com/marlonka/superint-video/releases/latest/download/Superint-Video-Setup.exe)
2. **Doppelklick** auf die Datei. Vielleicht meldet Windows „Der Computer wurde durch Windows geschützt“, weil das Programm noch keine Signatur hat. Dann klickst du auf **Weitere Informationen** und **Trotzdem ausführen**.
3. **Installieren:** Lass den Haken bei „Desktop-Symbol erstellen“ gesetzt, klick auf **Installieren** und dann auf **Fertigstellen**. Adminrechte brauchst du nicht.
4. **Einrichten:** Superint Video öffnet sich mit der Einrichtung. Sie zeigt nur, was noch fehlt, und jede Zeile hat rechts den einen Knopf, der es erledigt:
   - **Coding-Agent:** „Skills hinzufügen“ zeigt deinem Agenten, wie er mit Superint Video Filme macht.
   - **Chrome und FFmpeg:** „Installieren“ öffnet ein Fenster, das sie über winget holt.
   - **API-Schlüssel (freiwillig):** einfügen und speichern. Er bleibt verschlüsselt auf deinem PC.

Danach startest du Superint Video wie jedes andere Programm, über das Symbol auf dem Desktop oder über das Startmenü.

### Auf dem Mac

1. **Herunterladen:** [`Superint-Video-macOS.zip`](https://github.com/marlonka/superint-video/releases/latest/download/Superint-Video-macOS.zip). Safari entpackt sie meist von selbst, sonst doppelklickst du sie.
2. **In „Programme“ ziehen:** Zieh „Superint Video“ aus „Downloads“ in den Ordner „Programme“.
3. **Öffnen:** Doppelklick. Beim ersten Mal sagt macOS, es könne die App nicht überprüfen, weil sie noch keine Apple-Signatur hat. Klick auf **Fertig**, öffne **Systemeinstellungen** → **Datenschutz & Sicherheit**, scroll nach unten und klick bei „Superint Video“ auf **Dennoch öffnen**.
4. **Einrichten** wie oben. Chrome und FFmpeg holt „Installieren“ in einem Terminal-Fenster über [Homebrew](https://brew.sh); installier Homebrew also vorher. Der API-Schlüssel liegt in einer Datei, die nur dein Benutzerkonto lesen kann.

<p align="center">
  <img src="docs/images/app-setup.jpg" alt="Die Einrichtung: Coding-Agent, Werkzeuge, Stimme und Musik mit den Modellen je Anbieter, und rechts je Zeile ein Knopf" width="80%">
</p>

## Dein erster Film

1. Öffne Superint Video und schreib unter **Neuer Film**, worum es gehen soll. Ein Satz genügt, etwa „Warum Schlaf das Gehirn putzt“.
2. Klick auf **Prompt kopieren**.
3. Füge den Prompt in Claude Code, ChatGPT Codex oder Google Antigravity ein und schick ihn ab. Superint Video bleibt dabei offen.

Dein Agent fragt nach, wenn ihm etwas fehlt, und legt dann los: Recherche, Skript, Bilder, Ton, Feinschliff und am Ende das MP4. Superint Video wechselt von selbst zum neuen Film, du siehst jeden Schritt, und die Vorschau wächst mit. Texte und Timing änderst du dort jederzeit selbst. Der fertige Film liegt in deinem Ordner `Videos\Superint Video` (auf dem Mac `Filme/Superint Video`).

<p align="center">
  <img src="docs/images/app-start.jpg" alt="Die Startseite: ein Feld für das Thema des Films, darunter Stil, Länge, Format und Sprache, der fertige Prompt mit dem Knopf „Prompt kopieren“ und vier Filme mit Vorschaubild und Stand" width="100%">
</p>

Mehr Ideen findest du in den [Starter-Prompts](prompts/README.md). Wie ein Ergebnis aussieht, zeigt der [Launch-Film](https://github.com/marlonka/superint-video/releases/download/v0.3.0/superint-video-launch.mp4) (32 s, mit Ton), den Superint Video über sich selbst gemacht hat.

## Häufige Fragen

**Was kostet das?** Superint Video selbst ist kostenlos und quelloffen. Du brauchst deinen Coding-Agenten mit dessen Abo oder Guthaben. Ein API-Schlüssel ist freiwillig; Google AI Studio hat eine kostenlose Stufe mit Tageslimit.

**Welche Filme kann ich machen?** Erklärfilme, Launch- und Update-Filme für ein Produkt, kurze Clips und Loops. Mitgeliefert sind drei Stile: flache Vektorgrafik, eine fotografische Miniaturwelt aus Code und ein Launch-Look. Unter „Stile“ machst du aus deinen eigenen Bildern einen neuen.

**Wo liegen meine Filme?** In `Videos\Superint Video` (auf dem Mac `Filme/Superint Video`), jeder Film in einem eigenen Ordner. Einen anderen Ort wählst du in der Einrichtung.

**Wie bekomme ich eine neue Version?** Lade das Setup erneut herunter und installier es einfach drüber. Auf dem Mac ersetzt du die App in „Programme“ durch die neue. Filme, Einstellungen und API-Schlüssel bleiben erhalten. Bietet die Einrichtung danach „Skills aktualisieren“ an, klick darauf.

**Wie deinstalliere ich es?** In den Windows-Einstellungen unter **Apps** → **Installierte Apps** → **Superint Video** → **Deinstallieren**. Deine Filme und Einstellungen bleiben liegen.

**Geht es auch ohne Installation?** Ja. Lade aus den [Releases](https://github.com/marlonka/superint-video/releases/latest) das ZIP, entpack es (Rechtsklick → **Alle extrahieren**) und starte darin `Superint Video.exe`. In der Einrichtung legt „Auf den Desktop legen“ das Symbol an. Die zweite Datei, `superint-video.exe`, ist das Werkzeug für deinen Coding-Agenten; sie musst du nie selbst öffnen.

**Mein Coding-Agent sagt, `superint-video` lasse sich auf dem Mac nicht öffnen.** Dann hält macOS die heruntergeladene App noch fest. Gib einmal im Terminal ein: `xattr -dr com.apple.quarantine "/Applications/Superint Video.app"`.

**Was geht noch nicht?** Am meisten erprobt ist Windows; die Mac-Fassung ist neu. Kurze Filme gehen gut, sehr lange Projekte, HDR und Ripple-Editing noch nicht. Mehr dazu im [Handbuch](docs/HANDBUCH.md#grenzen).

**Etwas klappt nicht?** Schau unter [Fehler beheben](docs/HANDBUCH.md#fehler-beheben) nach oder öffne ein [Issue](https://github.com/marlonka/superint-video/issues/new/choose).

## Datenschutz und KI-Inhalte

Superint Video sammelt keine Nutzungsdaten und braucht kein Konto. Bilder, Studio und Render bleiben auf deinem PC. Nur wenn du einen API-Schlüssel einträgst, gehen die Texte für KI-Stimme und Musik an diesen Anbieter, zu dessen Bedingungen. Was dein Coding-Agent mit deinen Dateien macht, regelt dessen Anbieter.

Stimme und Musik kommen meist aus generativen Modellen, und jedes MP4 sagt das in seinen Metadaten. Kennzeichne deine Filme beim Veröffentlichen auch sichtbar als KI-gestützt, und bilde echte Stimmen nur mit Einwilligung nach. Mehr dazu im [Handbuch](docs/HANDBUCH.md#datenschutz-und-ki-kennzeichnung).

## Mehr lesen

- [Handbuch](docs/HANDBUCH.md): App, Studio, Stile, Ton, Rendern, Grenzen und Fehler beheben
- [Für Entwickler](docs/ENTWICKLER.md): wie es aufgebaut ist, alle Befehle, aus dem Quellcode bauen
- [Versionsverlauf](CHANGELOG.md) · [Mitmachen](CONTRIBUTING.md) · [Sicherheit](SECURITY.md)

## Lizenz und Dank

Superint Video steht unter der [MIT-Lizenz](LICENSE). Der Launch-Ablauf baut auf [cinetic](https://github.com/Leonxlnx/cinetic) auf, die Klänge und das Gehör kommen aus [Earshot](https://github.com/Leonxlnx/earshot), beide von Leonxlnx und unter MIT. Die Schriften Nunito und Geist stehen unter der SIL Open Font License. Alle Abhängigkeiten und ihre Lizenzen stehen in den [Drittanbieterhinweisen](THIRD_PARTY_NOTICES.md).
