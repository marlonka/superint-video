# Superint Video: Handbuch

Alles, was in die [README](../README.md) nicht passt: Installation im Detail, Studio, Agenten-Einrichtung, Presets, Prüfen und Rendern, Projektformat, Bauen aus dem Quellcode, Grenzen und Fehlerbehebung.

## Schnellstart: fertiges Windows-Paket

1. Lade unter [Releases](https://github.com/marlonka/superint-video/releases/latest) die Datei `superint-video-0.7.1-windows-x64.zip` herunter.
2. Entpacke das ZIP in einen beschreibbaren Ordner.
3. Stelle die Laufzeit-Abhängigkeiten bereit:

| Abhängigkeit                         | Verwendung                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Chrome, Chromium oder Microsoft Edge | HTML-Vorschau und Frame-Rendering                                                  |
| FFmpeg **und** ffprobe im `PATH`     | Medienanalyse, Audio und MP4-Encoding; FFmpeg benötigt `libx265`, `libx264`, AAC und `zscale` |

**Rust und Node.js werden zum Ausführen des fertigen Pakets nicht benötigt.** Studio, Szenen-Runtime und Starterprojekt sind in der EXE enthalten. Browser und FFmpeg werden separat installiert; die Anwendung lädt sie nicht selbst herunter.

Öffne PowerShell im entpackten Ordner:

```powershell
.\superint-video.exe doctor --json
.\superint-video.exe new .\mein-video --topic "Warum ist der Himmel blau?" --seconds 30
```

`new` startet Studio im Hintergrund und öffnet es im Browser. `superint-video studio .\mein-video` holt es später zurück, auch für ein bestehendes Projekt; `--stop` beendet es, und ohne Zuschauer und ohne Render beendet es sich nach zwei Stunden selbst. Wer das nicht will, gibt `new` und `render` `--no-studio` mit (in CI und mit `SUPERINT_NO_STUDIO` ist es von selbst aus). Der Port wird automatisch gewählt. Für einen festen Port kannst du `studio .\mein-video --port 4317` verwenden, sofern er frei ist.

`doctor` prüft die Programm-Erkennung. Danach prüfst du mit `check` echte Frames im Browser; erst damit wird auch das Rendering ausgeführt.

### Programmpfade explizit setzen

Falls die automatische Erkennung nicht passt, setze in derselben PowerShell-Sitzung deine tatsächlichen Installationspfade:

```powershell
$env:SUPERINT_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:SUPERINT_FFMPEG = 'C:\Tools\ffmpeg\bin\ffmpeg.exe'
$env:SUPERINT_FFPROBE = 'C:\Tools\ffmpeg\bin\ffprobe.exe'
.\superint-video.exe doctor --json
```

### Download prüfen

Das Release enthält `SHA256SUMS.txt` mit den Prüfsummen des ZIPs und der EXE. Vergleiche den ZIP-Hash mit der entsprechenden Zeile:

```powershell
Get-FileHash .\superint-video-0.7.1-windows-x64.zip -Algorithm SHA256
```

## Die App: Startseite und Einrichtung

Ein Doppelklick auf `Superint Video.exe` (oder der Befehl `superint-video app`) öffnet die App in einem eigenen Fenster. Sie läuft im Hintergrund weiter und beendet sich nach zwei Stunden ohne Zuschauer selbst; `superint-video app --stop` beendet sie sofort. Beide Programme gehören in denselben Ordner.

**Sprache.** App und Studio sprechen Deutsch und Englisch. Beim ersten Start gilt die Sprache des Systems; der Globus oben rechts (im Studio: „⋯“) stellt um, und die Wahl bleibt gespeichert (`superint-video settings set uiLanguage de`). Die Namen unten sind die deutschen; auf Englisch heißen die Teile New film, Styles, Your films und Setup. Texte, die der Coding-Agent schreibt (Befunde, Schritte, Notizen), und Fehlermeldungen des Werkzeugs erscheinen so, wie sie geschrieben wurden; die Skills sagen ihm, sie in deiner Sprache zu schreiben.

**Einrichtung zuerst.** Solange etwas fehlt, ohne das kein Film entsteht, zeigt die App nur die Einrichtung: zwei nummerierte Schritte mit einem Balken, der zeigt, wie viele erledigt sind, danach Freiwilliges ohne Nummer. Ein erledigter Schritt bekommt einen Haken, der nächste ist hervorgehoben. Jede Zeile sagt, wofür etwas da ist, und hat rechts den einen Knopf, der sie erledigt; hervorgehoben ist immer nur der nächste. Ist der letzte Schritt erledigt, bleibt die Einrichtung stehen, bis du „Weiter zum ersten Film“ wählst:

- **Coding-Agent.** Claude Code, ChatGPT Codex oder Google Antigravity macht den Film, einer genügt. Ist einer installiert, kopiert „Skills hinzufügen“ die Superint-Skills in dessen Ordner; fehlt er, führt „Claude Code holen“ oder „ChatGPT Codex holen“ zur Installation.
- **Werkzeuge.** Chrome (oder Edge) zeichnet jedes Bild, FFmpeg fügt Bilder und Ton zur MP4-Datei zusammen.
- **API-Schlüssel (freiwillig).** Kein Schritt: Ein Film entsteht auch ohne. Die Einrichtung sagt, was ohne API-Schlüssel geht (Bild, Text im Bild, Soundeffekte und deine eigene Stimme, aufgenommen in der App oder als Audiodatei; auch ein Film ganz ohne Stimme) und was einer dazubringt (die KI-Stimme mit exakten Wort-Zeitpunkten, erzeugte Musik, Diktieren auf der Startseite, Stile aus Bildern). Ein API-Schlüssel von Google AI Studio oder OpenRouter genügt, „API-Schlüssel holen“ führt zum Anbieter. Darunter sind „Weitere Anbieter“ eingeklappt: Google Cloud und OpenAI (nur fürs Diktat und für neue Stile). Unter jedem Anbieter stehen die Modelle, die ein Film damit nutzt, solange Stil oder Projekt nichts anderes sagen: bei Google AI Studio `gemini-3.8-flash-tts` (Stimme), `gemini-3.5-transcribe` (Wort-Zeitpunkte) und `lyria-3.5` (Musik), bei OpenRouter dieselben Modelle unter dessen Namen (`google/gemini-3.8-flash-tts`, `google/gemini-3.5-transcribe`, `google/lyria-3-pro-preview`).
- **Freiwillig.** Earshot für Soundeffekte. „Installieren“ öffnet ein Fenster, das zuerst [uv](https://docs.astral.sh/uv/) über winget holt, falls es fehlt, und dann Earshot von GitHub installiert; „Auftrag für Claude Code oder Codex kopieren“ gibt dieselbe Aufgabe deinem Coding-Agent. Nicht `pip install earshot`: Auf PyPI gehört der Name einem anderen Projekt. Nach der Installation genügt „Erneut prüfen“, ein Neustart der App ist nicht nötig. Dazu [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp): Damit öffnet dein Coding-Agent Websites und macht Screenshots, etwa für einen Launch-Film über eine Website. Die Zeile sagt, bei welchem Coding-Agenten es eingerichtet ist und bei welchem es fehlt; „Auftrag kopieren“ gibt deinem Coding-Agenten die Anleitung für Claude Code, ChatGPT Codex und Google Antigravity, mit `--no-usage-statistics`, damit keine Nutzungsdaten an Google gehen. Es braucht Node.js LTS. Die App liest dafür nur die Einstellungen der Agenten und ändert sie nicht.

Fehlt Chrome oder FFmpeg, öffnet „Installieren“ ein sichtbares Terminal-Fenster mit einem festen winget-Befehl (`winget install --id Gyan.FFmpeg --exact --source winget` oder `Google.Chrome`). Die App stimmt dabei nichts für dich zu: Fragt winget nach Bedingungen, antwortest du im Fenster. Danach „Erneut prüfen“. Ohne winget führt „Download-Seite“ zum Hersteller.

„Ohne Einrichtung fortfahren“ zeigt die Startseite trotzdem; dann erinnert oben ein Balken über die ganze Breite an das, was fehlt, auch im Studio jedes Films.

Oben links stehen Name und Version, oben rechts „Einrichtung“: Die Einrichtung ist eine eigene Seite, die dieser Knopf jederzeit öffnet und „Fertig“ wieder schließt. Ein Punkt am Knopf zeigt, wenn dort etwas fehlt oder die Skills eines Coding-Agenten älter sind als die App. Zur Einrichtung gehören außer den Schritten oben „Filme speichern und öffnen“ (Speicherort für Filme, Wechsel zu einem neuen Film, eigenes Fenster), „Feinschliff vor dem Render“, die „Modelle“ und unten „Einstellungsordner anzeigen“.

Die Startseite hat drei Teile:

- **Neuer Film** baut den Prompt für den Coding-Agenten: Thema eintippen oder über das Mikrofon einsprechen, „Prompt kopieren“, in Claude Code, ChatGPT Codex oder Google Antigravity einfügen. Ohne weitere Wahl sucht der Agent Stil und Länge passend zum Thema aus, das Bild ist 16:9, und der Film spricht die Sprache, in der das Thema geschrieben ist; die App erkennt sie und zeigt sie an („Deutsch (wie das Thema)“). Ist ein Standard-Stil gewählt, steht er vorne; „Frag mich vorher“ lässt den Agenten nach dem Stil fragen. Die Länge tippst du frei oder wählst einen Vorschlag von 15 Sekunden bis 60 Minuten: „3 min“, „90 s“, „2:30“ oder nur eine Zahl für Minuten; darunter steht, wie die App sie versteht. Zur Wahl stehen gut 40 Sprachen. Sobald der Agent den Film anlegt, wechselt die Startseite von selbst dorthin.
- **Stile** zeigt, wie die Filme aussehen. Das Bild einer Karte wechselt langsam zwischen bis zu drei Standbildern (sind im System die Animationseffekte aus, bleibt es beim ersten); ein eigener Stil zeigt seine ersten Referenzbilder. Jede Stil-Karte hat „Als Standard“ und ein Menü „⋯“: „Referenzbilder hinzufügen“ (öffnet den Ordner für eigene Referenzbilder), „Kopie anlegen“ (eine eigene Fassung zum Verändern) und „Als Datei exportieren“. „Stil importieren“ nimmt eine solche Datei an, „Ordner deiner Stile“ zeigt, wo eigene Stile liegen. Vorne steht „Neuen Stil erstellen“, deine eigenen Stile folgen, dann die mitgelieferten.
- **Erstellte Filme** listet die Filme auf diesem Rechner mit ihrem Stand: der aktuelle Schritt, ein laufender Render, fertig. Dazu gehört jeder Film, den der Agent anlegt oder dessen Studio einmal offen war, und alles, was im Speicherort für Filme liegt. Das Menü „⋯“ eines Films hat „Als Vorlage nutzen“, „Duplizieren“, „Ordner anzeigen“ und „Von der Liste nehmen“ (nimmt den Film nur von der Liste; der Ordner bleibt).

**Von einem Film ausgehen.** „Als Vorlage nutzen“ trägt den Film unter „Neuer Film“ ein („Ausgehend von …“, „Ohne Vorlage“ nimmt ihn wieder heraus). Du schreibst dann nur, worum es im neuen Film geht; der Prompt sagt dem Coding-Agenten, mit `superint-video duplicate` eine Kopie anzulegen und nur zu ändern, was das neue Thema braucht. Stil und Format bleiben wie in der Vorlage, solange du kein anderes Format wählst. „Duplizieren“ legt die Kopie sofort an, nennt sie „… (Kopie)“ und öffnet sie im Studio, etwa um Texte von Hand zu ändern. In beiden Fällen kommen Briefing, Szenen, Kit, Referenzen und Ton mit, sodass die Kopie sofort abspielt; fertige Videos, Bericht, Status und Prüfungen des alten Films bleiben zurück. Von der Kommandozeile: `superint-video duplicate <filmordner> --topic "…"`.

**Wo die Filme liegen.** Jeder Film ist ein Ordner mit allem, was zu ihm gehört: Briefing, Szenen, Ton und unter `renders\` das fertige Video. Ohne dein Zutun liegen diese Ordner in `Superint Video` in deinem Videos-Ordner (`C:\Users\<du>\Videos\Superint Video`; hast du den Videos-Ordner in Windows verschoben, dort). In der Einrichtung unter „Speicherort für Filme“ wählst du einen anderen Ordner, „Ordner anzeigen“ öffnet ihn, „Üblichen Ordner nehmen“ stellt zurück. Der Coding-Agent legt neue Filme von selbst dort an, benannt nach dem Thema; ein Ordner, den du im Prompt nennst, hat Vorrang. Filme gehören nicht in den Programmordner und nicht in ein Code-Repository: Sie sind groß und kein Quellcode. Ältere Filme erscheinen in der Liste, sobald ihr Ordner im Speicherort für Filme liegt.

**Eigenen Stil erstellen.** „Neuen Stil erstellen“ unter „Stile“ öffnet ein Formular, so einfach wie „Neuer Film“: Zieh bis zu 12 Bilder hinein, deren Look dir gefällt (PNG, JPEG oder WebP; Einfügen aus der Zwischenablage und „Bilder hinzufügen“ gehen auch), beschreib den Look in eigenen Worten, getippt oder über das Mikrofon, gib ihm einen Namen und drück „Stil erstellen“. Bilder oder Beschreibung allein genügen; beides zusammen trifft besser. Ein Modell deines API-Schlüssels sieht sich die Bilder an und schreibt den Look als prüfbare Regeln auf: Farben mit Hex-Werten, eine der mitgelieferten Schriften mit Gewichten, Formen und Materialien, Licht, Bewegung, Bildaufbau, was dazugehört, was nicht, und die Fallstricke. Das dauert ein bis zwei Minuten; die Zeile unter dem Formular sagt, welches Modell arbeitet und wie lange schon, „Abbrechen“ hört auf. Danach steht der Stil als Karte bei deinen Stilen, mit deinen Bildern als Referenzen. Er baut auf dem neutralen Stil auf, dessen Karte „Neuen Stil erstellen“ ersetzt (unter „Neuer Film“ ist „Neutral“ weiter wählbar); `STYLE.md` und `kit/theme.css` im Ordner des Stils kannst du von Hand nachbessern. Ein Stil hält fest, wie etwas aussieht. Motive, Logos, Figuren und Namen aus den Bildern übernimmt er nicht, und jeder Film bringt seine eigenen Inhalte mit.

**Aus einem Film einen Stil machen.** Hat ein Film einen Look, den du wieder haben willst, wähl in seinem Menü „⋯“ „Daraus einen Stil machen“. Das Modell liest `STYLE.md`, `direction.md` und das Kit des Films, sieht sich seine Referenzen und Standbilder an (Vorschaubild, Style-Frames, Bilder aus dem Feinschliff und dem letzten Render) und schreibt daraus einen Stil für beliebige Themen; was nur zum Thema des Films gehört, bleibt draußen. Kit, Zeichenbibliotheken und Bausteine des Films kommen mit, der Film selbst bleibt, wie er ist. Im Feld darunter sagst du, was bleiben oder wegfallen soll.

Von der Kommandozeile, auch für deinen Coding-Agenten: `superint-video preset create --reference a.png,b.jpg --describe "…" --name "Mein Stil"` und `superint-video preset from-film <filmordner> --name "Mein Stil"`.

**Stile weitergeben.** „Als Datei exportieren“ schreibt den ganzen Stil als `<name>.superint-style.zip` in deinen Downloads-Ordner und zeigt die Datei dort; Referenzbilder sind dabei. „Stil importieren“ fügt eine solche Datei zu deinen Stilen hinzu. Gibt es den Namen schon, bekommt der neue Stil eine Nummer („Mein Stil (2)“), ersetzt wird nichts. Ein Stil enthält Code, der läuft, während ein Film entsteht: Importiere nur Stile von Leuten, denen du vertraust. Von der Kommandozeile: `preset export <name>` und `preset import <datei>`.

**API-Schlüssel.** Für die KI-Stimme, erzeugte Musik, das Diktat und Stile aus Bildern brauchst du einen API-Schlüssel aus deinem eigenen Konto: Google AI Studio ist der Standardweg, OpenRouter die Alternative, einer genügt. Du trägst ihn in der Einrichtung ein; die App fragt den Anbieter gleich nach dem Speichern, ob er funktioniert, und „Prüfen“ fragt später noch einmal. Die App speichert ihn nur auf diesem Rechner, unter Windows für dein Benutzerkonto verschlüsselt (`%USERPROFILE%\.superint-video\keys.dat`), und zeigt ihn nie wieder an, auch dem Coding-Agenten nicht. Eine `.env`-Datei oder Umgebungsvariable gilt weiterhin und hat Vorrang. Mit nur einem OpenRouter-Schlüssel laufen die Google-Modelle von selbst über OpenRouter. Ohne API-Schlüssel sprichst du den Film selbst oder er bleibt ohne Stimme; `superint-video doctor --json` zeigt unter `capabilities`, was gerade geht.

**Wer spricht.** Unter „Neuer Film“ steht neben Stil und Länge „Stimme“: „KI-Stimme“, „Eigene Stimme“ oder „Ohne Stimme“. Vorgewählt ist die KI-Stimme, wenn ein API-Schlüssel sie erreicht, sonst die eigene Stimme. Die Wahl steht in klaren Worten im Prompt, und der Coding-Agent richtet den Film danach aus.

**Eigene Stimme.** Der Coding-Agent schreibt den Sprechtext und ruft dann die Aufnahme auf (`superint-video voice own <ordner> --wait`): Studio öffnet „Eigene Stimme“ und zeigt den Text Absatz für Absatz, den aktuellen groß, den nächsten blass darunter. Die Leertaste startet nach einem kurzen Countdown und stoppt wieder, ein Pegel zeigt, ob das Mikrofon dich hört und ob du zu laut bist. Danach hörst du rein (Leertaste), nimmst noch einmal auf (`R`) oder übernimmst (Enter); die Pfeiltasten wechseln den Absatz, die Punkte oben zeigen, welche schon aufgenommen sind. Statt aufzunehmen kannst du eine Audiodatei geben, für einen Absatz oder eine für den ganzen Text (MP3, WAV, M4A, Ogg, WebM oder FLAC); die ganze Datei teilt das Werkzeug an ihren längsten Pausen in die Absätze. Sind alle Absätze übernommen, macht der Coding-Agent von selbst weiter. Jede Aufnahme wird leicht gesäubert (Rumpeln unter 80 Hz weg, Stille an den Rändern gekürzt, Pegel angeglichen) und liegt im Film unter `audio/own/`. Sie bleibt auf deinem Rechner; nur wenn ein API-Schlüssel für Wort-Zeitpunkte eingerichtet ist, geht sie zum Messen an dieses Modell, und die Aufnahme-Ansicht sagt das. Ohne ihn werden die Wort-Zeitpunkte geschätzt: Anfang, Ende und jede Pause sind gemessen, dazwischen teilen sich die Wörter die Zeit nach ihren Silben. Das reicht für Bildwechsel an Satzanfängen und Pausen; auf ein Wort mitten im Satz kann das Bild ein paar Frames daneben liegen.

**Über den fertigen Film sprechen.** Im Studio öffnet „Stimme“ oben dieselbe Ansicht; „Über den Film sprechen“ spielt den Film ohne Ton ab einer Stelle, die du wählst, während du sprichst. Gibt es einen Sprechtext, steht er als Stichworte daneben. Eine Aufnahme, danach „Mit dem Film anhören“, „Noch einmal“ oder „Als Stimme übernehmen“: Sie ist dann die Stimme ab dieser Stelle, und `Strg+Z` im Studio holt die alte zurück. Danach mischt und rendert der Coding-Agent neu (`mix`, `render`).

**Filme ohne Stimme oder Musik.** `mix` und `render` arbeiten mit dem, was da ist: nur Soundeffekte, nur Musik oder nichts. Jedes MP4 hat eine Tonspur; ist nichts zu hören, ist sie still. Manche Upload-Formulare, Schnittprogramme und Fernseher lehnen eine Datei ohne Tonspur ab oder melden sie als fehlerhaft, und die stille Spur kostet fast nichts.

**Google Cloud.** Wer Gemini über ein Google-Cloud-Projekt nutzt (Gemini Enterprise Agent Platform, früher Vertex AI), meldet sich unter „Weitere Anbieter“ mit „Mit Google anmelden (ADC)“ an. Das ist Googles empfohlener Weg (ADC, Application Default Credentials): Ein Fenster holt bei Bedarf die Google Cloud CLI über winget und öffnet die Anmeldung im Browser; danach bekommt die App für dein Konto Zugangsschlüssel, die nach einer Stunde ablaufen. Es gibt kein Geheimnis zum Kopieren, die Anmeldung gehört zu deinem Konto, lässt sich jederzeit widerrufen (`gcloud auth application-default revoke`) und erscheint in den Audit-Logs deines Projekts. Die App speichert davon nichts; die Anmeldung verwaltet Googles CLI selbst (`%APPDATA%\gcloud`). Sie braucht eine Projekt-ID: die aus „Projekt und Region“, sonst `GOOGLE_CLOUD_PROJECT`, sonst das Abrechnungsprojekt der Anmeldung (`gcloud auth application-default set-quota-project`). „Stattdessen einen API-Schlüssel eintragen“ bleibt für alle, die den Express-Modus ohne eigenes Projekt nutzen; ein gespeicherter Schlüssel geht der Anmeldung vor. Mit Google Cloud gehen dieselben Google-Modelle über dein Projekt, abgerechnet dort und zu dessen Bedingungen, und AI Studio springt erst ein, wenn Google Cloud am Limit ist. „Projekt und Region“ nimmt die Projekt-ID und die Region: `eu` ist Standard, `us` und `global` gehen auch. Ohne Projekt-ID arbeitet der Schlüssel im Express-Modus, den Google nur global anbietet; für die Region `eu` also die Projekt-ID eintragen. Musik (`lyria-3-pro-preview`, Lyria 3.5 gibt es dort noch nicht) entsteht immer global. Wer Googles SDK-Variablen schon gesetzt hat, braucht nichts einzutragen: `GOOGLE_API_KEY` mit `GOOGLE_GENAI_USE_ENTERPRISE=true`, dazu `GOOGLE_CLOUD_PROJECT` und `GOOGLE_CLOUD_LOCATION`.

**OpenAI.** Ein OpenAI-Schlüssel dient nur dem Diktat (`gpt-transcribe`). „In der EU verarbeiten“ schickt die Aufnahme an `eu.api.openai.com`. Das geht nur mit einem OpenAI-Projekt, bei dem auf platform.openai.com unter Settings, Project bei „Project Residency“ Europa steht; die meisten Projekte sind Global, dann bleibt der Haken aus. Lehnt OpenAI den Schlüssel bei gesetztem Haken ab, sagt die Prüfung das dazu. Für Filme reicht er nicht: OpenAIs Sprachmodelle der Speech-API enden am 6. Januar 2027, ihr Nachfolger ist ein Gesprächsmodell, das nicht zusagt, einen Text Wort für Wort vorzulesen, und Wort-Zeitpunkte liefert nur noch `whisper-1`, das am 26. Februar 2027 endet.

**Sprechen statt tippen.** Das Mikrofon unten rechts im Feld unter „Neuer Film“ nimmt das Thema auf; beim ersten Mal fragt der Browser, ob die Seite das Mikrofon benutzen darf. Solange es zuhört, ist der Knopf blau, der Rand des Felds auch, und eine Wellenform mit der Zeit zeigt, dass es dich hört. Ein zweiter Klick auf das Mikrofon schreibt die Aufnahme auf und setzt den Text dort ein, wo der Cursor stand; „✕“ oder Escape verwirft sie. Das Diktat braucht einen API-Schlüssel; ohne sagt der Knopf das. Aufgeschrieben wird mit dem Schlüssel aus der Einrichtung: mit Google (Google Cloud oder AI Studio) durch `gemini-3.5-transcribe` im Modus `smart`, der Füllwörter, Versprecher und Neuanfänge weglässt und deine eigenen Korrekturen übernimmt („nein, lieber 90 Sekunden“), sonst mit OpenAI durch `gpt-transcribe` oder mit OpenRouter durch `microsoft/mai-transcribe-2`. Die Sprache erkennt das Modell selbst. Eine Aufnahme dauert höchstens fünf Minuten und wird nirgends gespeichert.

**Modelle (für Profis).** Wer die genauen Modell-IDs kennt, etwa ein neues `gemini-4-transcribe`, wählt sie in der Einrichtung unter „Modelle“ → „Modelle wählen“: Stimme (Modell und Name), Wort-Zeitpunkte, Musik, Diktat und neue Stile. Den Namen der Stimme wählst du bei Gemini- und ElevenLabs-Modellen aus einer Liste, bei Gemini mit dem Wort, mit dem Google die Stimme beschreibt; bei anderen Modellen tippst du ihn. Die ID schreibst du genau so, wie der Anbieter sie schreibt, und sie sagt zugleich den Anbieter: `gemini-…` und `lyria-…` sind von Google (über Google Cloud, solange dessen Schlüssel da ist, sonst AI Studio), `anbieter/modell` geht über OpenRouter (etwa `elevenlabs/eleven-v4-turbo` oder `microsoft/mai-transcribe-2`), `gpt-…` ist von OpenAI und nur fürs Diktat und für neue Stile. Neue Stile schreibt üblicherweise `gemini-4-hydrogen` (über OpenRouter `google/gemini-4-hydrogen`, mit einem OpenAI-Schlüssel allein `gpt-6.1-sol`); das Modell muss Bilder ansehen können. Leere Felder behalten die Standardmodelle; „Zurück zu den Standardmodellen“ leert alle. Die Modelle gelten für neue Filme und gehen dem Stil vor; ein Film kann in `voice.md` oder `music-prompt.md` trotzdem andere nennen, und der Coding-Agent sieht deine Wahl in `doctor --json`. „Prüfen“ beim Schlüssel fragt den Anbieter auch nach deinem Diktiermodell. Aus der Kommandozeile zeigt `superint-video models`, welches Modell welche Aufgabe übernimmt, über welchen Anbieter es gerade läuft und welche Alternativen bekannt sind. `superint-video models check <id> --job timings` fragt kostenlos, ob deine Schlüssel das Modell erreichen, und `superint-video models set narration <id>` prüft und speichert es für alle neuen Filme (Aufgaben: `narration`, `voice`, `timings`, `music`, `dictation`, `style`; leer heißt zurück zum Standard). So kann auch dein Coding-Agent das Modell wechseln, wenn du ihn darum bittest.

Im Studio eines Films führt das Logo oben links zur Startseite und „Zurück zu …“ wieder zurück.

**Feinschliff vor dem Render.** Bevor ein Film gerendert wird, sieht ein Sub-Agent deines Coding-Agents jedes Bild mit frischen Augen an und bessert nach (der Polish-Durchgang, siehe [Prüfen, Snapshots erstellen und rendern](#prüfen-snapshots-erstellen-und-rendern)). Unter „Runden vor jedem Render“ wählst du vorher, wie oft: **1** ist üblich; bei **2** sucht danach eine zweite Runde mit neuen Augen, was nach den ersten Korrekturen noch falsch ist, und arbeitet Details aus; bei **3** geht eine dritte Runde Material, Licht und Bewegung im ganzen Film durch. Jede weitere Runde kostet etwa so viel Zeit und Nutzung deines Coding-Agents wie die erste oder mehr. Die Wahl gilt für jeden Film, auch für einen, der gerade entsteht. Die Knöpfe gehen auch mit Tab und den Pfeiltasten. Die App selbst bessert nichts nach: Sie speichert die Zahl, das Werkzeug nennt sie dem Coding-Agenten bei jedem `polish`, und `render` wartet, bis die letzte Runde sauber ist. Ein einzelner Film kann eine eigene Zahl haben: `polishRounds: 3` oben in seinem `brief.md` (oder `new --polish-rounds 3`). Von der Kommandozeile: `superint-video settings set polishRounds 2`.

Von der Kommandozeile zeigt `superint-video settings` die Einstellungen, und `superint-video settings set preset flat-explainer` ändert eine (leerer Wert: zurück zum Üblichen). `new` übernimmt den Standard-Stil: Mit ihm genügt `superint-video new --topic "…"`, und der Film entsteht im Speicherort für Filme (`filmsFolder` in der Ausgabe von `settings`). Länge, Format und Sprache nennt der Prompt für jeden Film; ohne sie gilt, was der Stil mitbringt. Die Dateien liegen unter `%USERPROFILE%\.superint-video` (anderswo `~/.config/superint-video`, oder dort, wohin `SUPERINT_HOME` zeigt). Bis 0.7.0 lagen sie unter `%APPDATA%\superint-video`. Startet aber eine verpackte App wie Claude oder ChatGPT die App, legt Windows neue Dateien dort in eine eigene Kopie für diese App, die der Explorer nicht findet. Beim ersten Start übernimmt die App von jeder Datei die neueste Fassung aus diesen Kopien; die alten bleiben unangetastet liegen.

## Im Studio arbeiten

| Aufgabe            | Bedienung                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- |
| Medien hinzufügen  | **Medien** öffnen, Dateien importieren und mit **Einfügen** am Abspielkopf einsetzen |
| Text ändern        | Im angehaltenen Bild auf den Text klicken und neu tippen: Enter übernimmt, Umschalt+Enter macht eine neue Zeile, Esc bricht ab. Fährt die Maus über das Bild, zeigt ein Rahmen jeden Text, der so geht. Rechts stehen dieselben Texte mit den anderen Eigenschaften der Szene |
| Timing ändern      | Clip ziehen, ausgewählte Kanten kürzen oder Start/Dauer in Frames eingeben            |
| Vorschau prüfen    | Wiedergabe, einzelne Frames und direkte Frame-Eingabe; **Zoom** stellt die Größe der Vorschau, „Ganzes Bild“ passt sie ein |
| Clip bearbeiten    | **Teilen**, **Duplizieren**, **Löschen** und Undo/Redo in der Timeline; **Ganzer Film** zeigt die ganze Länge |
| Projekt einstellen | **Film**: Abmessungen, Dauer, Hintergrund und Schrift                                 |
| Schrift ändern     | **Film** → **Schrift**: „Wie im Stil“ oder eine Schrift, die der Film mitbringt, oder eine der mitgelieferten (Geist, Nunito, Jost, Fraunces, Courier Prime, JetBrains Mono, Caveat). Sie gilt für jede Szene, die ihre Haupttexte in der Schrift des Films setzt; Schriften mit eigener Rolle (Code, Handschrift) bleiben |
| Zuschauen          | **Fortschritt**: Briefing, Stil, Skills, Referenzen, aktueller Schritt, Dokumente und letzte Änderungen |
| Weitere Aktionen   | **⋯**: Kontext kopieren, Projekt prüfen, Prüfergebnisse, Tastenkürzel, helles oder dunkles Design, Sprache |
| Video exportieren  | **Exportieren**, Ausgabepfad und Qualität wählen; Fortschritt und Abbrechen sind verfügbar |

Medien- und Eigenschaftenbereiche lassen sich schließen; auf schmalen Fenstern öffnen sie als überlagerte Bereiche. Farbige Szeneninhalte bleiben unverändert.

Studio speichert Timeline-Änderungen lokal in `video.json`. Ein abgeschlossener Bearbeitungsschritt entspricht einem Undo-Schritt. Alles, was du hier drückst, kann auch dein Coding-Agent: `superint-video edit` schickt dieselben Änderungen, bei offenem Studio über das Studio, sodass du sie sofort siehst und mit `Strg+Z` zurücknimmst. Die Schrift des Films stellt `superint-video fonts .\mein-video Jost` um, `--reset` geht zurück zur Schrift des Stils, und ohne Namen listet der Befehl die Auswahl. Schriftgröße und Layout stehen im HTML der Szene; im Studio änderbar sind sie, wenn die Szene sie als Eigenschaft anbietet (etwa eine Zahl für die Größe oder eine Farbe). HTML und Assets bearbeitest du in deinem Editor oder mit dem Agenten. Änderungen von außen aktualisieren das Projekt und leeren die Undo-Historie. Bei einem Konflikt bietet Studio einen Recovery-Download an; lade ihn vor dem Neuladen herunter.

**Tastenkürzel:** `S` teilen, `D` duplizieren, `Entf` löschen, `Strg+Z` rückgängig, `Strg+Umschalt+Z` wiederholen. `Alt+←/→` verschiebt einen Clip um einen Frame; zusätzlich `Umschalt` kürzt oder verlängert sein Ende. Space steuert die Wiedergabe außerhalb fokussierter Bedienelemente. Die vollständige Liste steht unter **More → Keyboard shortcuts**.

## Mit deinem Coding-Agenten Videos erstellen

Superint Video ist das Werkzeug, dein Coding-Agent der Regisseur. Ein eingebauter Chat oder ein eigenes Sprachmodell ist nicht enthalten.

### Agenten einrichten

Das Werkzeug selbst hat keinen Geschmack. Was ein Film wird, kommt aus drei austauschbaren Teilen:

| Teil | Bestimmt | Liegt in |
| --- | --- | --- |
| **Ablauf-Skill** | Welche Art Film, wie er geplant, geschrieben, komponiert und geprüft wird | `skills/superint-explainer` (Erklärvideo), `skills/superint-launch` (Launch-, Update-, Produktfilm, aufgebaut auf [cinetic](https://github.com/Leonxlnx/cinetic) von Leon), oder ein eigener |
| **Stil-Preset** | Look: Farbe, Licht, Schrift, Formen, Figuren, Bewegung | `blank` (kein Hauslook), `flat-explainer`, `miniature-3d`, `launch`, oder ein eigenes |
| **Referenzen** | Woran der Agent seine Bilder misst | Standbilder, Screenshots, Clips in `references/` von Preset oder Projekt |

Dazu kommen der [Werkzeug-Skill](../skills/superint-video/SKILL.md) (Projekt, Szenen-API, CLI, Review, Rendern) und [`superint-audio`](../skills/superint-audio/SKILL.md) (Stimme, Musik, SFX, Mix; je Anbieter eine eigene Datei, Google AI Studio oder OpenRouter). Die App kopiert sie in der Einrichtung mit einem Klick („Skills hinzufügen“). Sind die Skills im Ordner des Agenten nicht mehr die der App, etwa nach einem Update, steht dort „Skills aktualisieren“: Die App ersetzt sie durch ihre eigenen und hebt die bisherigen unter `%USERPROFILE%\.superint-video\replaced-skills\<agent>` auf, je Skill die letzte Fassung. Einen verknüpften Skill-Ordner (Symlink oder Junction) fasst sie nie an. Von Hand kopierst du alle Ordner aus `skills/` (im Paket oder Repository) an die Stelle, an der dein Agent Skills sucht:

| Agent | Ordner |
| --- | --- |
| Claude Code, für alle Projekte | `%USERPROFILE%\.claude\skills\<skill>` |
| Claude Code, nur ein Projekt | `<projekt>\.claude\skills\<skill>` |
| ChatGPT Codex | `%USERPROFILE%\.codex\skills\<skill>` |
| Google Antigravity (App und CLI) | `%USERPROFILE%\.gemini\config\skills\<skill>` |
| Google Antigravity, nur ein Projekt | `<projekt>\.agents\skills\<skill>` |

Alternativ schreibst du in den Auftrag: „Lies zuerst `<pfad>\skills\superint-video\SKILL.md`.“ Der Skill verwendet `superint-video` als Befehlsnamen. Lege den Paketordner in den `PATH` oder nenne dem Agenten den Pfad zu `superint-video.exe` (im Repository `.\dist\superint-video.exe`).

Du sagst nur, was du willst, in welchem Stil und ungefähr wie lang (Richtwert, kein Schnittmaß); der Agent fragt nur nach, was er nicht selbst gut entscheiden kann, etwa Screenshots des gewünschten Looks oder das Material zu deinem Produkt. Die Regeln in Skills und Presets sind eine Untergrenze, keine Obergrenze: Ein stärkeres Modell darf es besser machen und begründet das im Bericht.

**Zuschauen:** Studio öffnet sich mit dem neuen Projekt; ist die Startseite der App offen, wechselt sie von selbst dorthin. Unter „Fortschritt“ steht auch der Feinschliff (der Polish-Durchgang): welche Runde läuft, wie viele Bilder angesehen sind, was zu beheben ist, und über „Befunde ansehen“ jedes Bild mit Befund und Korrektur. Der Bereich „Fortschritt“ rechts zeigt Briefing, Stil, Skills, Referenzen, den aktuellen Schritt, die letzten Änderungen, was gerade läuft („Läuft gerade“) und was der Agent zuletzt angesehen hat („Zuletzt angesehen“); die Vorschau lädt neu, sobald eine Szene dazukommt. Während eines Renders zeigt die Vorschau das gerade berechnete Bild mit Prozent, Bildern pro Sekunde, Restzeit und einem Filmstreifen, auch wenn der Agent ihn über die Kommandozeile gestartet hat. Am Ende läuft dort der fertige Film. Am Ende steht im Bericht ein Making-of zum Einfügen unter das Video.

### Ein Video beauftragen

Ein Satz genügt:

```text
Nutze den Skill superint-video: Explainer im Flat-Vector-Stil, 60 Sekunden, Thema „Warum Schlaf das Gehirn putzt“, Ordner ./schlaf.
```

```text
Nutze den Skill superint-video: 25-Sekunden-Launch-Film für mein Produkt <Name>, Material unter <URL>, im Branding aus ./brand, Ordner ./launch.
```

Für ein Erklärvideo arbeitet der Agent dann in festen Schritten (`superint-explainer`), die jeweils eine Datei im Projekt hinterlassen:

1. Recherche mit Themen-Memo und Claim-Register (`research.md`): jede tragende Behauptung mit Quelle, Geltungsbereich und Status
2. Drei Konzepte mit eigener Bildwelt, begründete Auswahl (`concepts.md`) und eine bezifferte Gestaltungsvorgabe (`direction.md`)
3. Drei Skriptentwürfe, der beste überarbeitet in Lehrer-, Hör- und Wahrheitsdurchgang (`script.md`)
4. Beat-Board mit Auslösewort je Bildereignis (`beats.md`)
5. Style-Frames für Hook, Aha und Titel
6. Restliche Szenen aus den Preset-Bausteinen
7. Review per Kontaktbogen mit Checkliste
8. Polish mit frischen Augen, bis ein Durchgang sauber ist, in so vielen Runden, wie in der Einrichtung eingestellt
9. Render und Übergabe: Du siehst den Film, bevor irgendetwas anderes passiert
10. Nach deiner Abnahme: Thumbnail und Bericht mit Titelvorschlägen und Quellen (`report.md`)

Jeder Schritt läuft in Kritikrunden. Willst du zwischendurch entscheiden, setze Stopps (`concept`, `script`, `frames`, `contact`). Hast du schon einen Sprechertext, gib ihn mit; er wird unverändert übernommen.

Der vollständige Auftrag mit allen Eingaben steht in [prompts/explainer.md](../prompts/explainer.md); dazu Varianten für Shorts, eigene Skripte und Änderungen in [prompts/](../prompts/README.md).

**Ton:** Stimme, Wort-Timestamps und Musik erzeugen die Befehle `voice`, `transcribe` und `music`. Standard ist Google AI Studio mit `GEMINI_API_KEY` (`gemini-3.8-flash-tts`, `gemini-3.5-transcribe`, `lyria-3.5`), dieselben Modelle gibt es über Google Cloud mit `GOOGLE_CLOUD_API_KEY`, die Alternative ist OpenRouter mit `OPENROUTER_API_KEY`. Die Soundeffekte kommen aus [Earshot](https://github.com/Leonxlnx/earshot) (lokal, MIT): `sfx kit` rendert sie, `sfx place` setzt sie auf die Frames. `mix` mischt und mastert auf −14 LUFS, `listen` lässt einen Take oder den fertigen Film über Earshot gegenhören. Ohne API-Schlüssel sprichst du selbst (`voice own`, siehe „Eigene Stimme“) oder der Film bleibt ohne Stimme; Musik gibt es dann nur aus einer Datei, die du mitbringst.

## Presets, Referenzen und Briefing

Ein Preset legt nur den Look fest: Formate, Farben, Schrift, Formen, Bewegung, Bausteine und Referenzbilder. Wie der Film geplant und geschnitten wird, kommt aus dem Ablauf-Skill, darum passt jedes Preset zu jedem Ablauf. Mitgeliefert:

- `blank`: kein Hauslook. Geist, dunkler Grund, ein Akzent, neutrale Helfer. Der Look kommt aus Briefing, Brand-Kit und Referenzen; der übliche Start für Launch-Filme.
- `flat-explainer`: flache Vektorgrafik mit Cel-Shading, Figuren-Rig, Requisiten und Orte, helle Farbwelten, runde Schrift (Nunito); Bausteine für Titel, Kernaussage, Zahl, Größenvergleich, Ablauf, Zoom, „einer unter vielen“, Verlauf und Outro, jeweils für 16:9, 9:16 und 1:1. Standard-Ablauf: `superint-explainer`.
- `miniature-3d`: eine fotografische Miniaturwelt, vollständig aus Code gerechnet, mit eigenem WebGL2-Renderer: echte Tiefenunschärfe, Bewegungsunschärfe, weiche Schatten, Spiegelungen, Filmkorn. Räume eines aufgeschnittenen Hauses bei Nacht, Dinge handeln von selbst, keine Menschen, eine durchgehende Kamerafahrt auf den Wortzeiten der Stimme. Nur 16:9, rund eine Sekunde Rechenzeit je Bild. Das Projekt startet mit einem fertigen Raum und einer fotorealen Tasse. Renderer, Rezepte und der ganze Beispielfilm stehen im Skill `superint-miniature`.
- `launch`: die echte Oberfläche des Produkts, in Code nachgebaut, auf dunklem Grund; Geist und JetBrains Mono, die Farben der Marke oder eine Graustufe mit Weiß als Aktionsfarbe; große Zeilen über einem weich gezeichneten Bild, ein Schlussbild aus der letzten Form des Films. Für Launch-, Update- und Feature-Filme, die zur Musik geschnitten sind. Standard-Ablauf: `superint-launch`; der Launch-Film von Superint Video liegt als Beispiel im Skill.

```powershell
.\superint-video.exe preset list
.\superint-video.exe new .\schlaf --preset flat-explainer --workflow superint-explainer --topic "Warum Schlaf das Gehirn putzt" --seconds 60 --reference .\look\01.jpg,.\look\02.jpg
.\superint-video.exe new .\launch --preset blank --workflow superint-launch --topic "Acme 2.0" --seconds 25
```

`new` braucht `--preset`, der Look ist also immer eine bewusste Wahl. Es kopiert das Preset vollständig ins Projekt, legt die Referenzen nach `references/` und schreibt `brief.md` mit Thema, Botschaft, Ablauf, Look, Referenzen, Länge, Format, Sprache, Stopps und Wortbudget für den Sprechertext. Weitere Optionen: `--message "<der eine Satz>"`, `--language`, `--audience`, `--must "<text>"`, `--avoid "<text>"`, `--stop <namen>` (die Stopps nennt der Ablauf-Skill, beim Erklärvideo `concept,script,frames,contact`), `--script <datei>`, `--polish-rounds 1-3` (Runden des Feinschliffs nur für diesen Film).

**Referenzen für immer:** `preset reference flat-explainer .\look\*.jpg` legt Bilder ans Preset; jedes neue Projekt bekommt eine Kopie und der Agent misst Style-Frames und Kontaktbögen daran. Bei eingebauten Presets landen sie in `%USERPROFILE%\.superint-video\presets\_references\<name>`. Screenshots fremder Filme gehören nicht in Git.

**Eigene Presets:** Am schnellsten schreibt ein Modell den Stil aus Bildern oder aus einem fertigen Film (`preset create`, `preset from-film`, siehe „Eigenen Stil erstellen“ oben). Von Hand: `preset new mein-stil --from blank --reference a.png,b.png` legt `%USERPROFILE%\.superint-video\presets\mein-stil` an (oder im Ordner aus `SUPERINT_PRESETS`). Dort passt du `STYLE.md`, `kit/` und `blocks/` an. `preset export mein-stil` macht daraus eine Datei zum Weitergeben, `preset import <datei>` nimmt eine an. Aufbau und Felder: [Preset-Referenz](../skills/superint-video/references/styles.md).

Stile nachzuempfinden ist erlaubt; Presets und Skills weisen den Agenten an, keine Namen, Logos oder Figuren anderer Kanäle zu übernehmen.

## Prüfen, Snapshots erstellen und rendern

Im entpackten Paket:

```powershell
.\superint-video.exe inspect .\mein-video --json
.\superint-video.exe edit .\mein-video --clip intro --prop title="Neuer Titel" --set opacity=0.8
.\superint-video.exe check .\mein-video --json
.\superint-video.exe snapshot .\mein-video --frames 0,45,89 --output renders/snapshots
.\superint-video.exe review .\mein-video
.\superint-video.exe polish .\mein-video
.\superint-video.exe polish .\mein-video --accept
.\superint-video.exe render .\mein-video --output renders/video.mp4
```

Die Frame-Nummern müssen innerhalb der Projektdauer liegen. Snapshots enthalten PNGs, ein Kontaktblatt und `frames.json` mit Frame-Nummern und Revision. `check` meldet geprüfte Frames und Diagnosen; beurteilt wird das Ergebnis zusätzlich anhand der Bilder und des Videos.

`review` ist die Arbeitsrunde nach dem ersten kompletten Bau, noch vor dem Rendern. Jede Runde bekommt einen eigenen Ordner `renders/review/<n>/` mit:

- einem Kontaktblatt, auf dem alle 3 Sekunden ein Standbild liegt
- dem Arbeitsblatt `review.md`, mit einer Zeile pro Bild: was gerade gesprochen wird, was gemessen wurde, und leere Spalten für Mangel und Änderung

Über den ganzen Film misst das Tool drei Dinge:

- Stellen, an denen das Bild länger als 3 Sekunden fast stillsteht
- Figuren, die der Bildrand zu einem schmalen Streifen anschneidet
- Markierungen, die ihr Ziel nicht umschließen

Die letzten beiden misst es nur, wenn die Szenen ihre Akteure melden (siehe Szenen-API). Das Urteil fällst du oder dein Agent, das Tool misst nur.

```powershell
.\superint-video.exe review .\mein-video --offset 1.5
.\superint-video.exe review .\mein-video --strip 600-615 --frames 300 --crop 640,200,640,360
.\superint-video.exe review .\mein-video --frames 300 --camera -640,60,4
```

- `--offset 1.5` legt das Raster zwischen die Bilder der letzten Runde.
- `--strip` zeigt jeden einzelnen Frame eines Abgangs.
- `--crop x,y,breite,höhe` speichert einen Ausschnitt in voller Auflösung.
- `--camera x,y,zoom` macht Nahaufnahmen in Szenen mit Prüfkamera.

`polish` ist der letzte Blick vor dem Render, gedacht für Augen, die den Film nicht gebaut haben: einen Sub-Agenten, ein stärkeres Modell oder dich. Jeder Durchgang bekommt einen Ordner `renders/polish/<n>/` mit:

- einem Standbild alle 5 Sekunden (`--every`) in voller Größe
- Nahaufnahmen der vier Bildviertel in voller Auflösung, überall dort, wo ein Standbild eine neue Ansicht zeigt
- beiden Seiten jedes Schnitts nebeneinander: Was vorher da ist und nachher fehlt, springt
- Streifen über die schnellsten Bewegungen jeder Szene, je acht Bilder im Abstand von drei Frames
- dem Arbeitsblatt `polish.md` mit den Fragen, die ein Zuschauer in der ersten Sekunde beantwortet (richtig gebaut? ein Blickwinkel, ein Licht? sieht es aus wie sein Name? fertig? sauber?), und einer Zeile pro Bild für Mangel und Korrektur

Nach den Korrekturen zeigt der nächste Durchgang nur die Bilder, deren Pixel sich geändert haben, und die Zeilen, die offen geblieben sind. Steht in jeder Zeile `ok` oder `kept: <Grund>`, hält `polish --accept` den Durchgang fest.

**Runden.** Ein Film bekommt eine bis drei Runden (`polishRounds`, eingestellt unter „Feinschliff vor dem Render“ oder im `brief.md` des Films). Eine Runde ist ein Prüfer: ein neuer Sub-Agent, der Durchgang um Durchgang arbeitet, bis einer sauber ist. Die Runden laufen nacheinander, jede auf dem Bild, das die vorige hinterlassen hat. Ist eine Runde festgehalten und eine weitere fällig, sagt `polish --accept` das (`next`), und der nächste `polish` beginnt die neue Runde über den ganzen Film: mit Standbildern zwischen denen der früheren Runden (Runde 2 um ein halbes Raster versetzt, Runde 3 um ein Viertel), Nahaufnahmen jedes Standbilds, schnellen Bewegungen, die noch keine Runde gezeigt hat, einer Liste dessen, was frühere Runden gefunden und behoben haben, und eigenen Fragen: Runde 2 prüft, ob die Korrekturen halten, und sucht dieselbe Art Fehler anderswo, im Hintergrund, zwischen den Standbildern, im Vergleich mit den Referenzen und in den Texten im Bild; Runde 3 verfolgt jedes Ding durch den ganzen Film und sieht auf Licht und Tiefe, Material und kleine Teile, Bewegung, Bildaufbau und das Ende. Studio zeigt neben dem Durchgang die Runde („Runde 2 von 3“). Eine Änderung nach der letzten Runde braucht nur einen Durchgang über das Geänderte.

`render` verlangt bei Filmen mit `brief.md` einen festgehaltenen Durchgang der letzten Runde für das Bild, wie es jetzt ist. Notizen, Ton und Bericht ändern daran nichts, jede Änderung am Bild schon. Für Testrender gibt es `--quality draft`, zum bewussten Überspringen `--unpolished`. Projekte ohne Briefing, etwa aus `init`, rendern wie bisher.

Relative Ausgabepfade beziehen sich auf den Projektordner: Das Beispiel erzeugt `mein-video/renders/video.mp4`. Bestehende MP4s werden nur mit `--overwrite` ersetzt. Studio exportiert innerhalb des Projekts; die CLI erlaubt auch absolute Ausgabeziele.

Der Export erzeugt MP4, mit AAC bei aktivierten Audiospuren. Standard ist HEVC mit x265: etwa halb so große Dateien bei gleichem Bild. `--codec x264` liefert H.264, das auch dort abspielt, wo HEVC eine Erweiterung braucht. Vor Abschluss werden Abmessungen, Bildrate, Frame-Anzahl, Dauer und erwartetes Audio geprüft. `--quality draft` ändert Encoder-Geschwindigkeit und Qualität; Abmessungen und FPS bleiben gleich. Mehrere Browser nehmen die Bilder parallel auf, standardmäßig halb so viele wie CPU-Threads, höchstens 8. `--workers N` legt die Zahl fest. Die Bilder sind gleich, egal wie viele Browser arbeiten. Ausnahme: Beim ersten Zeichnen in einem frischen Browser weichen vereinzelt Pixel um eine Helligkeitsstufe ab, das macht die GPU auch mit einem einzigen Browser.

## Projektstruktur und Szenen-API

```text
mein-video/
├── brief.md            # Auftrag (von new)
├── research.md         # Fakten mit Quellen (Agent)
├── concepts.md         # Konzepte und Auswahl (Agent)
├── script.md           # Sprechertext mit Szenenmarken
├── video.json          # Abmessungen, FPS, Spuren, Clips und Eigenschaften
├── STYLE.md            # Art Direction des Presets
├── kit/                # Theme, Fonts und Hilfsfunktionen des Presets
├── blocks/             # Szenen-Bausteine zum Kopieren
├── scenes/             # HTML-Szenen
├── assets/             # Lokale Bilder, Fonts, Videos und Audio
└── renders/            # MP4s und Review-Snapshots
```

Mit `init` statt `new` entsteht ein minimales Projekt ohne Preset und Briefing.

`video.json` ist die maßgebliche Timeline. HTML definiert Aussehen und Animation; Clips definieren Platzierung, Dauer und Source-Offset. Zeitwerte werden als ganze Frames gespeichert. Bei 30 fps entsprechen 150 Frames fünf Sekunden.

Animierte Szenen registrieren sich über `defineScene({ render })`. Die Runtime stellt `interpolate`, `ease`, `spring` und reproduzierbaren Zufall bereit. Jeder Frame muss direkt, rückwärts und nach einem Sprung gleich aussehen: keine akkumulierte Animation, keine Uhrzeit als Animationsquelle und kein unkontrolliertes `Math.random()`.

Fonts, Bilder und Abhängigkeiten werden lokal eingebunden. Zeitgesteuertes Video und Audio gehören in Manifest-Clips; Szenen-HTML mit eigenen `<video>`-/`<audio>`-Elementen wird abgelehnt. Details: [Szenen-API](../skills/superint-video/references/scene-api.md), [Projektformat](FORMAT.md), [JSON Schema](video.schema.json).

## Aus dem Quellcode bauen

Zusätzlich zu den Laufzeit-Abhängigkeiten benötigst du Rust mit Windows-MSVC-Buildtools, PowerShell und Node.js mit npm. Lokal geprüft: **Rust 1.100.0, Node.js 26.13.1 LTS, npm 12.2.2**. Abhängigkeiten sind in `Cargo.lock` und `studio/package-lock.json` festgehalten.

```powershell
git clone https://github.com/marlonka/superint-video.git
Set-Location superint-video
.\scripts\build.ps1
.\dist\superint-video.exe doctor --json
```

Der Build installiert Studio-Abhängigkeiten, generiert Manifest-Typen, prüft Schema und Svelte, führt Tests aus, baut Studio und bettet es in die Rust-EXE ein. Anschließend prüft er die echte HTTP-API und erzeugt unter `dist/` das Windows-ZIP mit Dokumentation, Skill und Prüfsummen. Optionen: `-SkipInstall` bei bereits installierten npm-Abhängigkeiten, `-DebugBuild` für eine Debug-EXE; `-SkipChecks` überspringt die normalen Prüfungen.

### Demo öffnen

Die Repository-Demo enthält drei HTML-Szenen, lokales SVG, ein synthetisches Video und synthetisches Audio. Video und Audio liegen nicht im Repository, sondern entstehen beim ersten Mal mit FFmpeg:

```powershell
.\scripts\generate-demo-assets.ps1
.\dist\superint-video.exe studio .\examples\demo
.\dist\superint-video.exe render .\examples\demo --output renders/demo.mp4
```

`-Force` erzeugt die Demo-Medien neu. Die separate `examples/fixture` zeigt Frame-Markierungen, Lücken, Source-Offsets und Überlagerungen.

## Tests und aktueller Stand

`scripts/build.ps1` baut und prüft alles lokal. Die Windows-CI führt dasselbe bei jedem Pull Request, jedem Push auf `main` und bei Release-Tags aus. Chromium-/FFmpeg-Integrationstests werden lokal separat ausgeführt:

```powershell
cargo test --test render_contract --test media_contract --test failure_contract -- --ignored --test-threads=1
```

Die lokale Prüfung umfasst über 100 Rust-Tests, die Szenen-Tests, 13 echte Chromium-/FFmpeg-Integrationstests und die HTTP-API in zehn Prüfgruppen. Die Gestaltungsregeln für Studio und App stehen im Repository in [docs/design.md](https://github.com/marlonka/superint-video/blob/main/docs/design.md) und [docs/REDESIGN.md](https://github.com/marlonka/superint-video/blob/main/docs/REDESIGN.md).

### Grenzen

- Windows x64 ist die geprüfte Plattform. macOS/Linux sind nicht als funktionierende Builds bestätigt.
- Kurze SDR-Projekte verwenden; HDR wird abgelehnt. MP4-Export benötigt gerade Abmessungen.
- Kein Proxy-/Transcoding-Workflow, Ripple-Editing, Speed-Ramping oder Plugin-System für Übergänge.
- Audio unterstützt Platzierung, Source-Offset, Lautstärke, Mute und Fades. Signale werden summiert; es gibt keinen automatischen Limiter. Video-Audio wird ausdrücklich aktiviert.
- Teilen innerhalb eines Fades wird abgelehnt. Den betreffenden Fade vor dem Schnitt kürzen oder entfernen.
- Medienindexierung, Vorbereitung und vollständige Audio-Decodierung benötigen Speicher. Lange Aufnahmen vor dem Import kürzen; ungewöhnliche Medien zuerst prüfen.
- Studio rendert jeweils einen Auftrag. Abbrechen während der Vorbereitung kann bis zum aktuellen Tool-/Readiness-Timeout dauern.
- Die lokalen Server sind für Loopback ausgelegt. Nicht als öffentlich erreichbaren Dienst betreiben.

Reproduzierbarkeit bezieht sich auf dieselben Projekt-Frames in einer dokumentierten Umgebung. Browser, Betriebssystem, Fonts und Media-Tools können das Ergebnis zwischen Rechnern verändern.

## Datenschutz und KI-Kennzeichnung

**Was deinen Rechner verlässt.** Superint Video sammelt keine Nutzungsdaten und hat kein Konto. Bild, Studio und Render laufen lokal. Ins Netz gehen nur:

- Für Stimme, Transkription und Musik die Texte, Prompts und Aufnahmen, die dein Agent dafür schreibt, deine eigene Stimme nur, wenn ein API-Schlüssel für Wort-Zeitpunkte eingerichtet ist (sonst bleibt sie auf dem Rechner), und deine Aufnahme, wenn du auf der Startseite „Sprechen“ benutzt, an den Anbieter, den du eingerichtet hast: Google AI Studio, Google Cloud oder OpenRouter, fürs Diktat auch OpenAI (und von OpenRouter an das gewählte Modell). Es gelten deren Bedingungen; bei Google Cloud die deines Cloud-Projekts, mit Projekt-ID in der gewählten Region. Bei der kostenlosen Stufe der Gemini API darf Google Eingaben und Ausgaben zur Verbesserung seiner Produkte verwenden; vertrauliche Inhalte gehören nur in einen bezahlten Zugang.
- Für einen eigenen Stil gehen die Bilder, die du auswählst, und deine Beschreibung an das Modell des Anbieters, dessen Schlüssel du eingerichtet hast (Google AI Studio, Google Cloud, OpenRouter oder OpenAI), verkleinert auf höchstens 1568 Pixel. Bei einem Stil aus einem Film sind es dessen `STYLE.md`, `direction.md`, die Farb- und Schriftwerte des Kits, bis zu 12 Referenzen und Standbilder. Nimm nur Bilder, die du weitergeben darfst.
- `listen` schickt die Datei, die du anhören lässt, über Earshot an Gemini.
- `doctor --online` und die Einrichtung prüfen deinen API-Schlüssel beim Anbieter und fragen die Modellliste ab.
- „Installieren“ in der Einrichtung startet `winget`, das Chrome oder FFmpeg aus den offiziellen Quellen lädt.

Was dein Coding-Agent (Claude Code, ChatGPT Codex, Google Antigravity) mit deinen Dateien macht, regeln dessen Anbieter. API-Schlüssel bleiben auf deinem Rechner: in der App unter Windows für dein Benutzerkonto verschlüsselt, sonst in einer `.env`, die Git ignoriert.

**KI-Inhalte kennzeichnen.** Stimme und Musik kommen in der Regel aus generativen Modellen, und die Szenen schreibt ein KI-Agent. Jedes exportierte MP4 trägt das in seinen Metadaten (`comment`, `description`). Wenn du einen Film veröffentlichst, kennzeichne ihn auch sichtbar als KI-erzeugt oder KI-gestützt, wie es Plattformen (etwa YouTube bei realistisch wirkenden Inhalten) und in der EU der AI Act verlangen. Eine echte Stimme darfst du nur mit Einwilligung der Person nachbilden; der Skill `superint-audio` beschreibt den Weg über Googles Einwilligungssatz.

## Fehler beheben

| Problem                                    | Nächster Schritt                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Browser oder FFmpeg fehlt                  | `doctor --json` ausführen; Installation, `PATH` oder `SUPERINT_*`-Pfade korrigieren           |
| Fehlender Font, Asset oder Szenenfehler    | `check --json` und Studio-Diagnosen lesen; Referenzen auf lokale Projektdateien berichtigen   |
| Ausgabe existiert bereits                  | Neuen Namen wählen oder bewusst `--overwrite` bzw. **Replace existing output file** verwenden |
| Änderungen kollidieren                     | Recovery herunterladen, danach Projekt neu laden; parallele Schreibvorgänge vermeiden         |
| Fester Port belegt                         | Studio ohne `--port` starten oder einen freien Port wählen                                    |
| Rust kompiliert vor dem Studio-Build nicht | `.\scripts\build.ps1` verwenden; generierte Studio-Dateien werden in Rust eingebettet         |
