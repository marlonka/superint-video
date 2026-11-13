# Superint Video für Entwickler

Wie Superint Video aufgebaut ist, wie dein Coding-Agent es bedient und wie du es selbst baust. Für Installation und den ersten Film reicht die [README](../README.md); alles über App und Studio steht im [Handbuch](HANDBUCH.md). *English: [DEVELOPERS.md](DEVELOPERS.md).*

## So entsteht ein Film

Ein Satz an den Coding-Agenten genügt:

```text
Nutze den Skill superint-video: Explainer im Flat-Vector-Stil, 60 Sekunden,
Thema „Warum Schlaf das Gehirn putzt“.
```

Der Agent fragt nur nach, was er nicht selbst gut entscheiden kann, etwa Screenshots des gewünschten Looks. Dann arbeitet er in Schritten, die jeweils eine Datei im Projekt hinterlassen: Recherche mit Quellen, drei Konzepte, Skript, Beats, Style-Frames, Szenen, Ton, Review, Feinschliff und Render. Der Feinschliff läuft vor jedem Render von selbst: Frische Augen gehen Bild für Bild durch den Film (alle 10 Sekunden ein Standbild), beheben, was auffällt, und arbeiten Details aus, in ein bis drei Runden. Nach deiner Abnahme folgt ein Bericht mit einem Making-of.

- **Eine Welt statt Folien.** Jedes Bild ist eine reine Funktion der Zeit, und jede Bewegung hängt an einem Wort der Stimme.
- **Recherche, die trägt.** Jede Aussage im Film steht mit Quelle im Claim-Register. Drei Konzepte und drei Skriptentwürfe treten gegeneinander an.
- **Ton, der sitzt.** Mehrere Takes pro Absatz, transkribiert und gegen das Skript gemessen. Die Musik folgt den echten Wortzeiten, das Master liegt bei −14 LUFS.

## Drei Teile, ein Werkzeug

| Teil | Bestimmt | Mitgeliefert |
| --- | --- | --- |
| **Ablauf-Skill** | Welche Art Film, wie er geplant, geschrieben und geprüft wird | [`superint-explainer`](../skills/superint-explainer/SKILL.md) für Erklärvideos, [`superint-launch`](../skills/superint-launch/SKILL.md) für Launch-, Update- und Produktfilme (aufgebaut auf [cinetic](https://github.com/Leonxlnx/cinetic)) |
| **Stil-Preset** | Der Look: Farbe, Licht, Schrift, Formen, Figuren, Bewegung | `flat-explainer`, `miniature-3d` (mit eigenem Skill [`superint-miniature`](../skills/superint-miniature/SKILL.md)), `launch`, `blank` |
| **Referenzen** | Woran der Agent seine Bilder misst | Deine Standbilder und Screenshots, am Preset oder im Projekt |

Dazu kommen der Werkzeug-Skill [`superint-video`](../skills/superint-video/SKILL.md) und der Ton-Skill [`superint-audio`](../skills/superint-audio/SKILL.md). Die Regeln in Skills und Presets sind eine Untergrenze: Ein stärkeres Modell darf es besser machen und begründet das im Bericht. Einen Stil gibst du als eine Datei weiter (`<name>.superint-style.zip`).

## Die Kommandozeile

Jeder Schritt ist ein Befehl, und jeder Befehl gibt JSON aus. Die CLI schreibt nie selbst Text: Jeden Prompt an Stimme oder Musik schreibt dein Agent.

```powershell
superint-video new .\schlaf --preset flat-explainer --topic "Warum Schlaf das Gehirn putzt" --seconds 60
superint-video studio .\schlaf --background     # holt Studio zurück
superint-video voice takes .\schlaf             # Takes pro Absatz, transkribiert und gemessen
superint-video voice own .\schlaf --wait        # oder: deine eigene Stimme, in Studio eingesprochen
superint-video music .\schlaf                   # Musikvarianten, gemessen
superint-video sfx kit .\schlaf                 # Klänge aus Earshot, auf die Frames gesetzt mit sfx place
superint-video mix .\schlaf                     # Ducking, Master auf −14 LUFS
superint-video review .\schlaf                  # Kontaktbogen und Arbeitsblatt für die Review-Runde
superint-video polish .\schlaf                  # letzter Blick vor dem Render: das nächste Standbild
superint-video polish .\schlaf --accept         # fertigen Durchgang festhalten
superint-video render .\schlaf --audio audio/master.wav --output renders/video.mp4
superint-video listen .\schlaf\renders\video.mp4 --project .\schlaf   # gegenhören
superint-video doctor --json                    # findet Chrome, FFmpeg, Earshot und die API-Schlüssel
```

Ohne Ordner landet ein neuer Film im Speicherort für Filme. Alle Befehle und Optionen stehen im [Handbuch](HANDBUCH.md) und in `superint-video <befehl> --help`.

## Wo was liegt

| Was | Wo |
| --- | --- |
| Programm (Setup) | `%LOCALAPPDATA%\Programs\Superint Video`, dieser Ordner steht im PATH des Benutzers |
| Programm (ZIP) | wo du es entpackt hast |
| Einstellungen, Filmliste, eigene Stile | `%USERPROFILE%\.superint-video` (`SUPERINT_HOME`) |
| API-Schlüssel aus der App | `%USERPROFILE%\.superint-video\keys.dat`, mit Windows DPAPI für dein Benutzerkonto verschlüsselt |
| Filme | `Videos\Superint Video` (`SUPERINT_FILMS` oder Einrichtung) |
| Skills des Agenten | `%USERPROFILE%\.claude\skills\`, `%USERPROFILE%\.codex\skills\` oder `%USERPROFILE%\.gemini\config\skills\` |

`superint-video.exe` ist die Rust-CLI mit eingebettetem Studio (Svelte 5), Szenen-Runtime und Presets. `Superint Video.exe` ist nur ein kleiner Starter ohne Konsolenfenster, der `superint-video app` aus seinem Ordner aufruft. Beide gehören in denselben Ordner.

## API-Schlüssel beim Entwickeln

Die App speichert Schlüssel verschlüsselt. Eine `.env`-Datei (Vorlage: [`.env.example`](https://github.com/marlonka/superint-video/blob/main/.env.example)) oder Umgebungsvariablen gehen weiterhin und haben Vorrang: Umgebung vor `.env` vor App. Gesucht wird `SUPERINT_ENV`, sonst die erste `.env` über dem Projekt, dem Arbeitsordner oder dem Programm. Die Datei ist in `.gitignore`, liegt aber unverschlüsselt da, und jeder Coding-Agent im Repository kann sie lesen. Liegen Schlüssel in einer `.env`, bietet die Einrichtung „In die App übernehmen“ an: Die Schlüssel kommen verschlüsselt in die App, und eine Datei, die nur Schlüssel enthielt, kommt in den Papierkorb. `doctor --json` nennt Namen und Herkunft, nie Werte.

## Aus dem Quellcode bauen

Du brauchst Windows x64, Rust 1.100 mit den MSVC-Buildtools, Node.js 26.13.1 LTS und npm 12.2.2. Für den Installer zusätzlich [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```powershell
winget install --id JRSoftware.InnoSetup --exact --scope user
git clone https://github.com/marlonka/superint-video
cd superint-video
.\scripts\build.ps1
```

`build.ps1` baut Studio, prüft Typen, Formatierung, Schema und alle Tests und legt in `dist\` ab:

| Datei | Wofür |
| --- | --- |
| `Superint-Video-Setup.exe` | der Installer, den die README verlinkt (nur mit Inno Setup) |
| `superint-video-<version>-windows-x64.zip` | dasselbe zum Entpacken, ohne Installation |
| `Superint Video.exe`, `superint-video.exe` | der Starter und die CLI, zum Ausprobieren direkt aus `dist\` |
| `SHA256SUMS.txt` | Prüfsummen |

Ältere Pakete räumt der Build aus `dist\` weg; sie liegen auf der Release-Seite. Läuft die App aus `dist\`, sperrt Windows die EXE: vorher `.\dist\superint-video.exe app --stop`. Das Installer-Skript ist [`packaging/setup.iss`](https://github.com/marlonka/superint-video/blob/main/packaging/setup.iss). Mehr zu Tests, Projektformat und Releases steht in [CONTRIBUTING.md](../CONTRIBUTING.md), das Format in [FORMAT.md](FORMAT.md), die Schnittstellen in [INTERFACES.md](INTERFACES.md).
