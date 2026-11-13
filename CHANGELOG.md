# Versionsverlauf

## 0.9.0 — 2026-11-13

- **Echtes HTML im Canvas:** Eine Szene kann echtes HTML durch einen Shader schicken. Ein `<canvas>` zeichnet seine Kinder mit dem Attribut `drawable`: als Bild in einem 2D-Canvas oder als WebGL-Textur, die ein Shader biegt, beleuchtet, weichzeichnet und schneidet. Text, Layout, Schriften und CSS bleiben Sache des Browsers. Damit geht eine echte Produktoberfläche auf einer Fläche im Raum mit Perspektive und Schärfentiefe, eine Glaslinse über einer Seite oder ein Shader-Übergang zwischen zwei echten Bildschirmen. Das nutzt HTML-in-Canvas aus Chrome 157 und braucht keinen Schalter.
- **Baustein in der Runtime:** `/runtime/html-in-canvas.js` mit `htmlCanvas(canvas)`: `paint(draw)` zeichnet das HTML, wie es für dieses Bild steht, `shader(…)` legt einen Fragment-Shader über den Canvas und nimmt HTML-Elemente direkt als Textur, `texture(…)` gibt die Textur für eigenes WebGL. Jedes Bild kommt in jeder Sprungreihenfolge Byte für Byte gleich heraus.
- **Bilder aus dem Projektordner erscheinen im Canvas:** Szenen laufen abgeschottet, deshalb ließ der Browser Projektbilder in solchem HTML bisher weg. Der Baustein lädt `<img>` passend und ersetzt CSS-Bilder (Hintergrund, Maske, Rahmen) und SVG-`<image>` durch eine eigene Kopie.
- **Miniatur aus Code:** Bildschirme, Briefe und Zeitungen in der Miniaturwelt können echtes HTML sein. `E.updateLive(slot, element)` nimmt ein `drawable`-Kind des Film-Canvas als lebende Textur, leuchtend als Bildschirm oder vom Raum beleuchtet als Papier, mit Spiegelung, Schärfentiefe und Korn des Renderers.
- **Älterer Chrome:** `check`, `snapshot` und `render` halten mit einem klaren Hinweis an, statt einen Film ohne sein Bild zu machen. Die Vorschau zeigt das HTML dann ohne den Effekt.
- **Für den Coding-Agenten:** Die Skills erklären das Muster, was das Bild eines Elements enthält, die Fallen und drei geprüfte Rezepte (`references/html-in-canvas.md` im Skill `superint-video`). Ein Plugin eines Browser-Herstellers ist dafür nicht nötig.
- **Verständliche Fehlermeldungen:** Antwortet die App nicht mehr, sagt die Startseite das in klaren Worten und in der Sprache der App, statt „Failed to fetch“ zu zeigen, und nennt den nächsten Schritt. Sobald die App wieder läuft, verschwindet der Hinweis von selbst. Häufige Fehler der Startseite (fehlender Filmordner, zu kurze Aufnahme, fehlende Skills und andere) stehen jetzt auf Deutsch und Englisch da; bei allen anderen steht davor, dass der Schritt nicht geklappt hat.
- **Behoben: Die App beendete sich nach dem Ruhezustand.** War der Computer länger als zwei Stunden im Ruhezustand, hielt die App das für zwei Stunden ohne Zuschauer und beendete sich; die offene Seite lief dann ins Leere. Der Ruhezustand zählt jetzt nicht mehr mit, auch nicht für das Studio eines Films.

## 0.8.0 — 2026-11-13

- **Ohne API-Schlüssel:** Ein Film braucht nur noch einen Coding-Agenten, Chrome und FFmpeg. Die Einrichtung hält niemanden mehr wegen eines fehlenden API-Schlüssels auf und sagt, was ohne ihn geht (Bild, Text im Bild, Soundeffekte, die eigene Stimme) und was er dazubringt (KI-Stimme mit exakten Wort-Zeitpunkten, erzeugte Musik, Diktieren, Stile aus Bildern). Das Diktat und „Neuen Stil erstellen“ sagen an Ort und Stelle, dass sie einen brauchen.
- **Wer spricht:** Unter „Neuer Film“ gibt es „Stimme“ mit „KI-Stimme“, „Eigene Stimme“ und „Ohne Stimme“. Vorgewählt ist, was eingerichtet ist; die Wahl steht im Prompt.
- **Eigene Stimme einsprechen:** Der Coding-Agent schreibt den Sprechtext, Studio zeigt ihn Absatz für Absatz: Countdown, Pegel, anhören, noch einmal, übernehmen, alles auch mit Leertaste, `R`, Enter und den Pfeiltasten. Statt aufzunehmen geht eine Audiodatei, je Absatz oder für den ganzen Text (MP3, WAV, M4A, Ogg, WebM, FLAC). Die Aufnahmen bleiben auf dem Rechner, außer ein API-Schlüssel misst ihre Wort-Zeitpunkte.
- **Wort-Zeitpunkte ohne API-Schlüssel:** Anfang, Ende und Pausen jeder Aufnahme sind gemessen, die Wörter dazwischen nach Silben geschätzt und in `audio/words.json` als `estimated` gekennzeichnet. Mit einem API-Schlüssel misst `voice assemble` dieselben Aufnahmen.
- **Über den fertigen Film sprechen:** „Stimme“ im Studio → „Über den Film sprechen“ spielt den Film ohne Ton ab einer gewählten Stelle, während du sprichst; der Sprechtext steht daneben. Die Aufnahme wird die Stimme ab dieser Stelle.
- **Für den Coding-Agenten:** `superint-video voice own <ordner> --wait` öffnet die Aufnahme und wartet, `--file` nimmt eine Datei, `source: own` in `voice.md` stellt `voice check` und `voice assemble` auf die eigene Stimme um. `doctor --json` zeigt unter `capabilities`, was gerade geht (`aiVoice`, `transcription`, `music`, `dictation`, `style`, `ownVoice`, `soundEffects`, `narration`). Die Skills kennen alle drei Wege und warten nie auf einen API-Schlüssel.
- **Filme ohne Stimme oder Musik:** `mix` und `render` arbeiten mit dem, was da ist. Jedes MP4 hat eine Tonspur; ist nichts zu hören, ist sie still, weil manche Upload-Formulare, Schnittprogramme und Fernseher Dateien ohne Tonspur ablehnen. `mix` duckt die Musik auch unter einer Stimme, die über den Film gesprochen wurde.
- **„KI-Modelle“:** Der Bereich in der Einrichtung heißt jetzt „KI-Modelle“ (englisch „AI models“), ebenso der Knopf zum Wählen.
- **Chrome DevTools MCP ohne Trace-Adressen:** Der Prompt zum Einrichten trägt den Server für Claude Code, ChatGPT Codex und Google Antigravity mit `--no-usage-statistics` und `--no-performance-crux` ein. Der zweite Schalter verhindert, dass die Performance-Werkzeuge des Servers Trace-Adressen an Googles CrUX-Dienst schicken.

## 0.7.1 — 2026-11-12

- **Ein Ordner für alle Einstellungen:** Einstellungen, API-Schlüssel, die Liste der Filme und eigene Stile liegen jetzt unter `%USERPROFILE%\.superint-video` statt unter `%APPDATA%\superint-video`. Wurde die App aus der Claude- oder ChatGPT-Desktop-App gestartet, schrieb Windows diese Dateien in eine eigene Kopie für jede dieser Apps. Dann hatte jede ihre eigenen Einstellungen, und „Einstellungsordner anzeigen“ und „Ordner deiner Stile“ meldeten im Explorer, der Pfad sei nicht verfügbar. Beim ersten Start übernimmt die App von jeder Datei die neueste Fassung aus allen bisherigen Kopien; die alten bleiben unangetastet liegen.

## 0.7.0 — 2026-11-12

- **Feinschliff in Runden:** Die Einrichtung hat „Feinschliff vor dem Render“ mit „Runden vor jedem Render“: 1, 2 oder 3, mit der Maus oder mit Tab und den Pfeiltasten. Darunter steht, was die Wahl bringt und was sie an Zeit und Nutzung kostet. Eine Runde ist ein neuer Sub-Agent des Coding-Agents mit frischen Augen; die Runden laufen nacheinander, jede auf dem Bild der vorigen. Die App bessert selbst nichts nach: `polish` nennt dem Agenten Runde und Zahl (`round`, `rounds`), `polish --accept` sagt in `next`, wenn die nächste Runde fällig ist, und `render` wartet, bis die letzte sauber ist. Einstellung `polishRounds` (`settings set polishRounds 2`); ein Film kann in seinem `brief.md` eine eigene Zahl haben, `new --polish-rounds` schreibt sie hinein.
- **Spätere Runden sehen mehr:** Der erste Durchgang einer neuen Runde geht über den ganzen Film, mit Standbildern zwischen denen der früheren Runden, Nahaufnahmen jedes Standbilds, schnellen Bewegungen, die noch keine Runde gezeigt hat, der Liste dessen, was frühere Runden behoben haben, und eigenen Fragen: Runde 2 nach dem, was die Korrekturen übrig ließen, und nach Details im Vergleich mit den Referenzen, Runde 3 nach Material, Licht, Bewegung und dem ganzen Film.
- **Studio** zeigt neben dem Durchgang die Runde („Runde 2 von 3“) und sagt, wenn eine Runde sauber ist und die nächste folgt.
- **Ein Bild je Stil-Karte:** Jede Karte unter „Stile“ zeigt ein einziges Bild im Format 16:9 statt eines Streifens aus mehreren, sauber zugeschnitten; alle Karten einer Reihe sind gleich hoch, auch „Neuen Stil erstellen“. Hat ein Stil mehrere Bilder, wechselt die Karte langsam zwischen bis zu dreien: Jedes bleibt mindestens neun Sekunden, das nächste blendet weich darüber, und das vordere rückt dabei kaum merklich näher. Es wechselt immer nur eine Karte, der Reihe nach. Nichts bewegt sich, solange die Seite verborgen, die Karte außer Sicht oder unter Maus oder Fokus ist; sind im System die Animationseffekte aus, bleibt das erste Bild stehen.
- **Eigene Bilder für die mitgelieferten Stile:** Flat-Vektor-Erklärfilm, Launch-Film und Miniatur aus Code zeigen je drei Standbilder aus Filmen, die mit ihnen entstanden sind. Sie liegen im neuen Ordner `preview/` eines Stils, getrennt von den Referenzen: Der Coding-Agent misst seine Bilder weiter nur an `references/`, und neue Filme bekommen `preview/` nicht mit. Eigene Stile zeigen ihre ersten Referenzbilder.

## 0.6.1 — 2026-11-12

- Studio-Build und CI aktualisiert auf Node.js 26.13.1 LTS, npm 12.2.2, Rust 1.100.0, Vite 8 und TypeScript 7. Die Rust- und npm-Abhängigkeiten wurden ebenfalls aktualisiert.
- Der API-Test verwendet auch mit kurzen Windows-Pfaden einen isolierten Projektordner und prüft die Liste der erstellten Filme.

## 0.6.0 — 2026-11-12

- **Chrome DevTools MCP unter „Freiwillig“:** Die Einrichtung zeigt, bei welchem Coding-Agenten [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) eingerichtet ist und bei welchem es fehlt. Damit öffnet der Agent Websites und macht Screenshots, etwa für einen Launch-Film über eine Website. „Auftrag kopieren“ gibt ihm die Anleitung für Claude Code, ChatGPT Codex und Google Antigravity, mit `--no-usage-statistics`. Die App liest dafür nur die Einstellungen der Agenten. Der Skill `superint-launch` sagt dem Agenten, wie er damit Screenshots einer Website in `references/` legt.
- **Stimme aus einer Liste:** Unter „Modelle“ → „Modelle wählen“ ist „Stimme: Name“ bei Gemini-Modellen eine Liste der 30 Stimmen, jede mit dem Wort, mit dem Google sie beschreibt („Kore · bestimmt“), bei ElevenLabs über OpenRouter eine Liste seiner Stimmen. Wechselt das Modell zu einer anderen Familie, gilt wieder deren übliche Stimme. Andere Modelle behalten das Textfeld.
- **Klarer:** Unter „Standardmodelle“ steht jetzt „Die üblichen Modelle der Anbieter, für die du einen API-Schlüssel hast.“

## 0.5.0 — 2026-11-12

- **Eigenen Stil erstellen:** Unter „Stile“ steht vorne „Neuen Stil erstellen“, an der Stelle der Karte „Neutral“; den neutralen Stil gibt es unter „Neuer Film“ weiter. Bis zu 12 Bilder hineinziehen, einfügen oder auswählen, den Look tippen oder einsprechen, einen Namen geben, „Stil erstellen“. Ein Modell deines API-Schlüssels sieht sich die Bilder an und schreibt den Look als Regeln auf: Farben, Schrift aus den mitgelieferten Schriften, Formen, Licht, Bewegung, Bildaufbau, was dazugehört und was nicht. Nach ein bis zwei Minuten steht der Stil als Karte bei deinen Stilen, mit den Bildern als Referenzen und mit „Als Standard“. Er hält fest, wie etwas aussieht, und übernimmt keine Motive, Logos oder Figuren.
- **Aus einem Film einen Stil machen:** Das Menü „⋯“ eines Films hat „Daraus einen Stil machen“. Dasselbe Modell liest `STYLE.md`, `direction.md` und das Kit des Films, sieht sich seine Referenzen und Standbilder an und schreibt daraus einen Stil für andere Themen; was nur zum Thema des Films gehört, bleibt draußen. Kit, Zeichenbibliotheken und Bausteine des Films kommen mit.
- **Auch für den Coding-Agenten:** `superint-video preset create --reference a.png,b.jpg --describe "…" --name "…"` und `superint-video preset from-film <film> --name "…"` machen dasselbe von der Kommandozeile und nennen den Ordner des neuen Stils.
- **Modell für Stile:** Üblich ist `gemini-4-hydrogen` bei Google (AI Studio oder Google Cloud), `google/gemini-4-hydrogen` über OpenRouter und `gpt-6.1-sol` bei OpenAI, je nachdem, welcher Schlüssel da ist. Es ist eine Aufgabe wie die anderen: in der Einrichtung unter „Modelle“ („Neue Stile“), mit `models set style <id>` und `models check <id> --job style`. Ein OpenAI-Schlüssel dient damit dem Diktat und neuen Stilen. Nimmt ein Anbieter die Anfrage nicht an, versucht das Werkzeug den nächsten, für den ein Schlüssel da ist, und sagt es.
- **Von einem Film ausgehen:** Das Menü „⋯“ eines Films hat „Als Vorlage nutzen“ und „Duplizieren“. Die Vorlage steht dann unter „Neuer Film“ („Ausgehend von …“), und der Prompt sagt dem Coding-Agenten, eine Kopie anzulegen und nur zu ändern, was das neue Thema braucht. „Duplizieren“ legt die Kopie sofort an und öffnet sie. Neu dafür ist `superint-video duplicate <film> --topic "…"`: Briefing, Szenen, Kit, Referenzen und Ton kommen mit, fertige Videos, Bericht, Status und Prüfungen bleiben zurück.
- **„Erstellte Filme“** heißt die Liste der Filme jetzt.
- **Sauber ausgerichtet:** „Prompt kopieren“ schließt unten mit dem Prompt ab, die Überschrift „Stile“ steht mit Text und Knöpfen auf einer Linie, und „Passend zum Thema“ im Längenfeld hat dieselbe Schriftfarbe wie die Listen daneben.
- **Kleinigkeiten:** Wer den Speicherort für Filme unverändert speichert, legt ihn nicht mehr fest; er folgt weiter dem üblichen Ordner. Escape verlässt die Startseite nicht mehr, während jemand tippt. Lange Themen werden für die Spracherkennung nur am Anfang gelesen.

## 0.4.0 — 2026-11-12

- **Neuer Film wählt passend zum Thema:** Stil und Länge stehen zuerst auf „Passend zum Thema“, und der Prompt bittet den Coding-Agenten, beides nach dem Thema zu wählen. Ein Standard-Stil steht weiter vorne, „Frag mich vorher“ ist die letzte Wahl. Das Format ist 16:9, bis jemand ein anderes wählt. Die Sprache folgt dem Thema: Die App erkennt sie an Schrift und kleinen Wörtern und nennt sie im Prompt („Deutsch (wie das Thema)“); zur Wahl stehen 46 Sprachen statt 9. Die Länge ist ein Feld mit einer Vorschlagsliste, die aussieht und aufgeht wie die Listen daneben und sich mit den Pfeiltasten bedienen lässt, Vorschläge von 15 Sekunden bis 60 Minuten; Getipptes wird beim Verlassen ordentlich geschrieben („90 s“ wird „1 min 30 s“).
- **Startseite neu geordnet:** Neuer Film, Stile, Filme. Die Einrichtung ist eine eigene Seite hinter dem Knopf „Einrichtung“ oben rechts, mit einem Punkt, wenn dort etwas fehlt, statt einer zugeklappten Zeile mit „Anzeigen“. Zu ihr gehören jetzt auch der Speicherort für Filme, der Wechsel zu neuen Filmen, das eigene Fenster und der Einstellungsordner. Die Versionsnummer steht oben links neben dem Namen; die Fußzeile entfällt.
- **Nichts mehr doppelt:** Länge, Format und Sprache standen unter „Vorgaben“ ein zweites Mal. Sie gehören jetzt allein zum Prompt jedes Films; `settings` kennt `seconds`, `format` und `language` nicht mehr, ältere Einstellungsdateien laden weiter. „Vorgaben“ heißt „Stile“, „Filme-Ordner“ heißt „Speicherort für Filme“.
- **Schritte in deiner Sprache:** Die Skills sagen dem Coding-Agenten, Schrittnamen und Notiz in `process/status.json` in der Sprache des Gesprächs zu schreiben, auch wenn der Film eine andere spricht. Sonst zeigte die Startseite etwa „Deliver“.

- **Musik fragt einmal nach:** Antwortet ein Musikmodell ohne Musik (kein Ton zurück, oder Googles Sperre wegen „copyright/recitation“ bei einem Prompt, der kurz darauf durchgeht), fragt das Werkzeug von selbst ein zweites Mal und sagt es; erst ein zweiter Fehlschlag bricht ab. Beides kam in einem Live-Durchlauf aller Modelle vor und ging beim zweiten Versuch mit demselben Prompt durch.

- **Gemini-Stimme über OpenRouter:** `google/gemini-3.8-flash-tts` bekam ohne eigene Stimme die ElevenLabs-Stimme `daniel` und scheiterte mit 400; ebenso hätte der Ausweichweg von AI Studio zum Gemini-Zwilling auf OpenRouter sie geschickt. Die Stimme richtet sich jetzt nach der Modellfamilie, nicht nach dem Anbieter.

- **Schrift des Films:** Im Studio unter „Film“ → „Schrift“ bekommt der ganze Film eine andere Hauptschrift, und `superint-video fonts <film> <schrift>` macht dasselbe für den Coding-Agenten (bei offenem Studio live und mit Strg+Z rücknehmbar). Angeboten werden die Schriften, die der Film selbst mitbringt, bei jedem Stil, auch künftigen, von selbst erkannt, und sieben mitgelieferte unter der SIL Open Font License: Geist, Nunito, Jost, Fraunces, Courier Prime, JetBrains Mono und Caveat. Szenen nehmen die Wahl über `var(--font)` und, für Text in Canvas oder SVG, über `fontFamily()` aus der Szenen-Laufzeit; die Laufzeit lädt die Schrift vor jedem Bild vollständig, sodass Vorschau und Export gleich aussehen. Die Stile `blank`, `flat-explainer` und `launch` folgen ihr; wo die Szenen ihre Schrift selbst festlegen (`miniature-3d`), sagt das Studio es.

- **Der Agent bedient alles selbst:** `superint-video edit` macht von der Kommandozeile, was die Knöpfe im Studio machen: Texte und andere Eigenschaften einer Szene (`--prop title="…"`), Start, Dauer, Position, Deckkraft, Blenden, Lautstärke, Ausblenden und Stummschalten (`--set`), dazu Teilen, Duplizieren, Löschen, Hinzufügen und die Einstellungen des Films als JSON-Operationen (einzeln, als Liste, aus einer Datei oder von stdin). Geprüft wird wie im Studio; ist das Studio des Films offen, geht die Änderung durch das Studio, du siehst sie sofort und nimmst sie mit Strg+Z zurück. `POST /api/edit` nimmt dafür auch eine Liste als einen Schritt.
- **Modelle von der Kommandozeile:** `superint-video models` zeigt für Stimme, Sprecher, Wort-Zeitpunkte, Musik und Diktat das gewählte und das übliche Modell, den Anbieter, über den es gerade läuft, und die bekannten Alternativen. `models check <id> --job <aufgabe>` fragt kostenlos, ob die Schlüssel ein Modell erreichen; `models set <aufgabe> <id>` prüft und speichert es für neue Filme. Wünscht du dir ein anderes Modell, kann der Coding-Agent es so prüfen und umstellen.
- **Prompt nennt das Programm:** Liegt `superint-video` nicht im PATH, schreibt die Startseite seinen Pfad in den Prompt, damit der Coding-Agent es in einer neuen Sitzung sofort findet.

- **Länge frei eingeben:** Unter „Neuer Film“ ist die Länge ein Feld mit Vorschlägen bis 20 Minuten statt einer festen Liste bis 5 Minuten. Es versteht „3 min“, „90 s“, „1 min 30 s“, „2:30“, „1,5 min“ und eine bloße Zahl als Minuten, bis 60 Minuten, und sagt darunter, wie es die Eingabe versteht.
- **Musik über Google Cloud:** Lyria 3 Pro antwortet nur über die `v1beta1`-Adresse der Interactions API mit dem Audio; unter `v1` kam eine abgeschlossene Antwort ohne Ton. Live getestet mit Google-Anmeldung (ADC): Prüfung, Diktat, Stimme mit Stil, Wort-Zeitpunkte und Musik.

- **Google Antigravity als Coding-Agent:** Die Einrichtung erkennt Antigravity (App oder CLI) und kopiert die Superint-Skills mit einem Klick nach `%USERPROFILE%\.gemini\config\skills`, wo App und CLI sie finden. Der Auftrag für Earshot heißt jetzt „Auftrag für deinen Coding-Agenten kopieren“.

- **Google Cloud mit Google-Anmeldung:** „Mit Google anmelden (ADC)“ ist jetzt der empfohlene Weg zu Google Cloud, Googles Application Default Credentials statt eines API-Schlüssels. Ein Fenster holt bei Bedarf die Google Cloud CLI über winget und öffnet `gcloud auth application-default login` im Browser; die App holt sich danach kurzlebige Zugangsschlüssel für dein Konto und speichert selbst nichts davon. Gebraucht wird eine Projekt-ID (Einrichtung, `GOOGLE_CLOUD_PROJECT` oder das Abrechnungsprojekt der Anmeldung). Der API-Schlüssel bleibt als „Stattdessen einen API-Schlüssel eintragen“ und geht vor, wenn einer gespeichert ist.

- **Mikrofon im Feld:** Statt „Sprechen“ steht ein Mikrofon-Knopf unten rechts im Eingabefeld. Während der Aufnahme sind er und der Rand des Felds blau, die einzige Farbe der App, und derselbe Knopf schreibt die Aufnahme auf; „✕“ oder Escape verwirft sie.
- **Werkzeuge ohne Neustart finden:** Hat winget ein Werkzeug nur in den PATH eingetragen statt einen Link anzulegen (ohne Entwicklermodus der Normalfall), findet die App es trotzdem: Sie liest den PATH, den Windows gespeichert hat. Das Earshot-Fenster findet uv auch in winget's Paketordner.

- **Text in der Vorschau ändern:** Im angehaltenen Studio-Bild zeigt ein Rahmen, welche Texte sich ändern lassen, sobald die Maus über dem Bild ist. Ein Klick öffnet direkt am Text ein Feld mit dem bisherigen Wortlaut; Enter übernimmt (in die `props` des Clips, wie rechts im Inspektor), Esc bricht ab. Szenen finden ihre Texte über `data-prop="key"` oder, ohne Markierung, als Element mit genau dem Text des Props; der Player meldet sie als `texts` in Bühnenpixeln. Die Skills sagen Claude, Texte so zu markieren.

- **Earshot richtig installieren:** Die Einrichtung empfahl `pip install earshot`, doch auf PyPI gehört der Name einem anderen Projekt (Spracherkennung von pykeio). Jetzt installiert „Installieren“ Earshot von GitHub mit uv (`uv tool install "earshot[mcp,llm] @ git+https://github.com/Leonxlnx/earshot"`) und holt uv vorher über winget, wenn es fehlt; „Auftrag für Claude Code oder Codex kopieren“ gibt dieselbe Aufgabe dem Coding-Agent. Die App findet Werkzeuge, die uv oder pipx nach `%USERPROFILE%\.local\bin` legen, auch ohne Neustart.
- **Einrichtung führt:** Drei nummerierte Schritte mit Fortschrittsbalken, erledigte mit Haken, der nächste hervorgehoben, Freiwilliges ohne Nummer. Nach dem letzten Schritt bleibt die Einrichtung stehen, bis „Weiter zum ersten Film“ gewählt wird, statt sofort zu verschwinden.

- **Sprechen statt tippen:** Unter „Neuer Film“ nimmt „Sprechen“ das Thema über das Mikrofon auf. Während du sprichst, zeigt eine Wellenform, dass das Mikrofon dich hört, daneben laufen die Zeit, „✕“ (verwerfen, auch mit Escape) und „✓“ (aufschreiben). Das Modell deines API-Schlüssels schreibt es auf und setzt den Text dort ein, wo der Cursor stand: mit Google `gemini-3.5-transcribe` im Modus `smart` (ohne „äh“, Versprecher und Neuanfänge, mit deinen eigenen Korrekturen), sonst mit OpenAI `gpt-transcribe` oder OpenRouter `microsoft/mai-transcribe-2`. Die Aufnahme bleibt bis zum Senden im Fenster und wird nirgends gespeichert (`POST /api/app/dictate`).
- **Google Cloud als Anbieter:** Ein API-Schlüssel der Gemini Enterprise Agent Platform (früher Vertex AI) bringt dieselben Google-Modelle über dein Google-Cloud-Projekt, abgerechnet dort und zu dessen Bedingungen. Solange er da ist, gehen Googles Modelle über Google Cloud, sonst über AI Studio, beim Tageslimit weiter zum nächsten Weg bis OpenRouter. Mit Projekt-ID laufen Stimme, Wort-Zeitpunkte und Diktat in der Region `eu` (Standard) oder `us`; ohne Projekt ist es der globale Express-Modus. Musik nimmt dort `lyria-3-pro-preview`, global. Googles eigene Variablen gelten auch: `GOOGLE_API_KEY` mit `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`.
- **OpenAI fürs Diktat:** Ein OpenAI-Schlüssel schreibt Diktate mit `gpt-transcribe`, auf Wunsch über `eu.api.openai.com` für ein Projekt mit Datenresidenz in Europa. Für Filme nutzt das Werkzeug OpenAI bewusst nicht: Die Sprachmodelle der Speech-API enden am 6. Januar 2027, ihr Nachfolger liest nicht zugesagt wortgetreu, und Wort-Zeitpunkte gibt nur noch `whisper-1` (bis 26. Februar 2027).
- **Modelle wählen (für Profis):** Die Einrichtung hat einen Bereich „Modelle“: Stimme (Modell und Name), Wort-Zeitpunkte, Musik und Diktat nehmen jede Modell-ID, wie der Anbieter sie schreibt; die ID sagt den Anbieter. Sie gelten für neue Filme vor dem Stil, `voice.md` und `music-prompt.md` eines Films haben weiter das letzte Wort, und `doctor --json` nennt sie dem Agenten (`chosen`). Weitere Anbieter (Google Cloud, OpenAI) sind in der Einrichtung eingeklappt, bis sie einen Schlüssel haben. Einstellungen `narrationModel`, `narrationVoice`, `transcriptionModel`, `musicModel`, `dictationModel`, `googleCloudProject`, `googleCloudLocation`, `openAiRegion`.

- Bereit für Open Source: SECURITY.md, Vorlagen für Issues und Pull Requests, eine englische README (`README.en.md`) und ein überarbeitetes CONTRIBUTING.
- Handbuch und README sagen, was deinen Rechner verlässt (Stimme, Transkription und Musik beim gewählten Anbieter, sonst nichts) und wie du KI-Inhalte kennzeichnest.
- Jedes exportierte MP4 trägt in seinen Metadaten (`comment`, `description`), dass es mit Superint Video und KI-Hilfe entstanden ist.
- Das Windows-ZIP hat Pfade mit `/`, wie es das ZIP-Format verlangt; vorher entstanden beim Entpacken auf macOS und Linux Dateinamen mit `\` statt Ordnern. Die Gestaltungsnotizen für Studio liegen nur noch im Repository.
- Die Demo-Medien in `examples/demo/assets` liegen nicht mehr im Repository; `scripts/generate-demo-assets.ps1` erzeugt sie.
- Die Windows-CI läuft bei jedem Pull Request und jedem Push auf `main`.
- Die Filmliste behandelt einen Ordner gleich, ob sein Pfad lang oder in der Windows-Kurzform (`RUNNER~1`) geschrieben ist; vorher konnte ein wieder geöffneter Film versteckt bleiben, und der Test dazu scheiterte auf GitHubs Windows-Runnern.
- Die Skills nennen keine fremden Kanäle mehr als Stilvorbild.

## 0.3.0 — 2026-11-12

- Neuer Stil `launch` (Launch-Film): die echte Oberfläche des Produkts, in Code nachgebaut, auf dunklem Grund, große Zeilen über einem weich gezeichneten Bild, ein Schlussbild aus der letzten Form. Das Kit bringt das Taktraster der Musik, Kamera mit logarithmischem Zoom, Übergaben einer Form von Bildschirm zu Bildschirm, Tiefenschärfe und vier Arten, eine Zeile hereinzuholen. Standard-Ablauf `superint-launch`.
- Der Launch-Film von Superint Video liegt als Beispiel im Skill `superint-launch`; der Skill sagt jetzt, wie man einen Lyria-Track auf Taktgrenzen auf die Filmlänge schneidet und einen echten Lauf des Produkts als Fall nimmt.
- `sfx place` geht auch ohne Stimme: In einem Film, den die Musik trägt, richten sich die Pegel der Soundeffekte nach der Musik. `mix` meldet eine fehlende Stimme nur noch, wenn es eine aufgenommene gibt, die nicht auf der Timeline liegt.
- „Film fertig“ auf der Startseite stimmt auch bei Filmen, deren Schritte nicht englisch heißen: Der Server entscheidet es (`ready` in `/api/app`) aus dem fertigen Render und dem letzten Schritt.
- Die Menüs „⋯“ an Filmen und Stilen sind ein Bauteil: Pfeiltasten, Pos1, Ende und Escape gehen überall, und der Fokus kehrt zum Knopf zurück.
- Aufgeräumt: Studio und App teilen sich das Starten, Finden und Beenden ihres Servers, Zeit-, Datei- und Vorschaubild-Helfer gibt es nur noch einmal, und Code, den nur Tests riefen, ist weg. Der ganze Rust-Code ist wieder mit `cargo fmt` formatiert.
- Die Versionsgeschichte des Repositorys beginnt mit 0.3.0 neu: Ein Klon von vorher lässt sich nicht weiterziehen, sondern wird neu geklont.

## 0.2.0 — 2026-11-12

### Die App

- Ein Doppelklick auf `Superint Video.exe` (oder `superint-video app`) öffnet eine Startseite in einem eigenen Fenster, auf Deutsch und Englisch. Beim ersten Start gilt die Sprache des Systems, der Globus oben rechts stellt um (`settings set uiLanguage de`). Zahlen, Zeiten und Aufzählungen folgen der Sprache; die mitgelieferten Stile haben deutsche Titel und Beschreibungen (`translations` in `preset.json`).
- **Einrichtung:** Solange ein Coding-Agent mit Skills, Chrome, FFmpeg oder ein API-Schlüssel fehlt, zeigt die App nur sie, in vier Gruppen (Coding-Agent, Werkzeuge, Stimme und Musik, Freiwillig). Jede Zeile hat einen Knopf, der sie erledigt; unter jedem Anbieter stehen die Modelle, die ein Film damit nutzt. Ein abgewiesener Schlüssel bekommt kein Häkchen. „Installieren“ für Chrome und FFmpeg öffnet ein sichtbares Terminal mit einem festen winget-Befehl und stimmt nichts für dich zu.
- **API-Schlüssel** trägt man in der App ein. Sie bleiben auf dem eigenen Rechner, unter Windows für das Benutzerkonto verschlüsselt, und werden nie wieder angezeigt, auch dem Agenten nicht. Mit nur einem OpenRouter-Schlüssel laufen Stimme, Transkription und Musik über OpenRouter. Fehlt ein Schlüssel, sagt der Befehl das, bevor er etwas kostet.
- **Neuer Film** baut den Prompt für Claude Code oder ChatGPT Codex, **Filme** zeigt alle Filme mit ihrem Stand, **Vorgaben** legt Stil, Länge, Format, Sprache und den Filme-Ordner fest. `new` übernimmt diese Vorgaben; `settings` zeigt und ändert sie.
- **Filme-Ordner:** Jeder Film entsteht als eigener Ordner in `Videos\Superint Video`, nie im Programmordner oder in einem Code-Repository (`filmsFolder`; `SUPERINT_FILMS` für Tests).
- **Skills aktualisieren:** Die App vergleicht die Skills im Ordner des Coding-Agenten mit ihren eigenen und ersetzt sie auf Klick. Die bisherigen bleiben unter `replaced-skills` im Einstellungsordner erhalten, verknüpfte Skill-Ordner bleiben unberührt.
- **Stile als Datei:** „Als Datei exportieren“ schreibt `<name>.superint-style.zip`, „Stil importieren“ nimmt eine solche Datei an (auch `preset export` und `preset import`). Ein vergebener Name bekommt eine Nummer, und die Datei kann nichts außerhalb ihres Stil-Ordners schreiben.
- Startseite ohne Kästen und Etiketten, Stil-Karten mit „Als Standard“, „Referenzen“ und „Kopieren“, kurze Bewegungen bei Knöpfen, Menüs und Dialogen. Wer im System weniger Bewegung eingestellt hat, sieht keine.

### Werkzeug, Ablauf und Look getrennt

- Skill `superint-video` beschreibt nur noch das Werkzeug und lässt den Agenten vor `new` fragen: welche Art Film, welches Preset, welche Referenzbilder.
- Ablauf-Skills: `superint-explainer` für Erklärvideos (Recherche mit Claim-Register, Botschaft, drei Konzepte, Skript, Beats, Style-Frames, Review, Abgabe) und `superint-launch` für Launch-, Update- und Produktfilme, aufgebaut auf [cinetic](https://github.com/Leonxlnx/cinetic) von Leonxlnx (MIT).
- Ton-Skill `superint-audio`: Stimme, Musik, SFX und Mix; der Anbieter ist Konfiguration, je Anbieter eine Datei.
- Preset-System mit eingebetteten und eigenen Presets (`%APPDATA%\superint-video\presets`, `SUPERINT_PRESETS`) und den Befehlen `preset list | show | new | reference`. Presets: `flat-explainer` (flache Vektorgrafik mit Figuren, Farbwelten und Bausteinen für 16:9, 9:16 und 1:1), `miniature-3d` mit Skill `superint-miniature` (fotografische Miniaturwelt aus einem eigenen WebGL2-Renderer) und `blank` (kein Hauslook).
- `new` legt ein Projekt mit `brief.md` an (Thema, Länge, Format, Sprache, Zielgruppe, Botschaft mit `--message`, Muss/Vermeiden, Stopps, Wortbudget) und nimmt `--preset`, `--workflow` und `--reference`.
- Die Regeln in Skills und Presets sind eine Untergrenze: Ein stärkeres Modell darf einen besseren Weg gehen und begründet ihn im Bericht. Jede Abgabe endet mit einem Making-of in `report.md`.
- Starter-Prompts in `prompts/`.

### Studio

- Studio zeigt die Arbeit: `new` öffnet es, der Produktionsbereich zeigt Briefing, Stil, Skills, Referenzen, den aktuellen Schritt aus `process/status.json` und die Arbeitsdokumente (`GET /api/doc`). Jeder Render erscheint dort mit aktuellem Bild, Bildern pro Sekunde, Restzeit und Filmstreifen. `--no-studio` und `SUPERINT_NO_STUDIO` schalten das ab, in CI ist es aus.
- Der Polish-Durchgang ist sichtbar: angesehene Bilder, Befunde und Korrekturen.
- Werkzeuge der Timeline tragen Wörter; „Zoom: Ganzes Bild“ und „Ganzer Film“ ersetzen die zwei „Fit“.

### Neue Befehle

- `polish`: der letzte Blick vor dem Render, mit Standbildern alle 5 s, Nahaufnahmen, beiden Seiten jedes Schnitts und den schnellsten Bewegungen. `polish --accept` hält einen sauberen Durchgang fest; `render` verlangt ihn bei Filmen mit Briefing (`--quality draft` für Testrender, `--unpolished` zum Überspringen).
- `listen <datei>`: Earshots Audio-Kritiker hört einen Take, den Mix oder den fertigen Film über Gemini und speichert Bewertung und Probleme mit Zeitstempeln in `process/listen/`.
- `sfx place` schreibt zusätzlich `audio/sfx/cues.json` im Cue-Format von Earshot und braucht für 655 Einsätze rund zwei Sekunden statt über zehn Minuten.

### Ton

- Google AI Studio und OpenRouter mit denselben Google-Modellen: Ist AI Studio am Tageslimit, nimmt das Werkzeug dasselbe Modell über OpenRouter, meldet das und hält den Weg je Take fest. `voice assemble` warnt, wenn ein Film beide Wege mischt.
- `superint-audio/references/google-ai-studio.md`: Preise, TTS-Prompting, Voices API (eigene Stimme nur mit Einwilligung) und Lyria-Prompting.
- `voice check` kennt Googles vollständige Tag-Liste und `voicekey_`-IDs.
- Musik und Geräusche liegen deutlich weiter unter der Stimme: Musik 22 statt 16 dB, Geräusche 14–37 statt 5–13 dB.

### Rendern

- Schnellerer Export: verlustfreie PNG-Screenshots mit `optimizeForSpeed` und mehrere Browser parallel (`render --workers N`), bei gleichen Pixeln.
- `render --codec x265|x264`; Standard ist x265 (HEVC, CRF 20, `hvc1`), etwa halb so groß wie x264 bei gleicher Qualität.
- Miniatur-Look: 64 statt 256 Teilbilder je Bild (3,3-mal so schnell), keine flackernden Wände und Böden mehr.
- Szenen, die auf `requestAnimationFrame` oder ein Bitmap-`<img>` warten, laufen nicht mehr in den 15-Sekunden-Timeout. Damit geht HTML-in-Canvas in einer Szene (`content="drawable"`), noch ohne Bilder aus dem Projekt.
- Der Player blendet inaktive Szenen mit `visibility` aus, damit Szenen Text vor ihrem ersten sichtbaren Frame messen können.

### Sonstiges

- MIT-Lizenz.
- Die EXE-Dateien enthalten keine Pfade des Bau-Rechners mehr (`--remap-path-prefix`), und `scripts/build.ps1` bricht ab, wenn doch einer darin steht.
- Drittanbieterhinweise auf dem Stand der gesperrten Abhängigkeiten.
- `build.rs` baut neu, wenn sich `runtime/`, `studio/dist` oder eingebettete Presets ändern.
- Pfade in JSON-Ausgaben ohne Windows-Präfix `\\?\`.
- README neu, mit Bildern der App; alles Weitere steht im [Handbuch](docs/HANDBUCH.md).

## 0.1.0 — 2026-10-09

- Rust-CLI für Projektanlage, Studio, Inspektion, Prüfung, Snapshots, MP4-Export und Tool-Erkennung.
- Lokales Studio mit Vorschau, Medienbibliothek, Timeline, Kontextkopie und typisierten Szenen-Eigenschaften.
- Monochrome Dark-/Light-Themes, bedarfsabhängige Seitenbereiche, Tastaturbedienung und Layouts für schmale Fenster.
- Verschieben, Kürzen, Teilen, Duplizieren, Undo/Redo und revisionsgeschütztes Speichern.
- Erhalt ungespeicherter Felder bei Wiedergabe; Konflikterkennung bei externen Änderungen und Recovery-Download.
- Frameabhängige HTML-/CSS-/SVG-/JavaScript-Szenen; lokale Video- und Audioclips mit Source-Offsets, Lautstärke und Fades.
- MP4-Export über Chromium und FFmpeg mit Fortschritt, Abbrechen und Prüfung des fertigen Ergebnisses.
- Agent-Skill, Starterprojekt, synthetische Demo, JSON Schema und dokumentierte Prüfungen.
- Deutscher Einstieg, Windows-Paket mit Prüfsummen und Build-Workflow.

Geprüfte Plattform: Windows x64. Browser und FFmpeg bleiben separate Laufzeit-Abhängigkeiten. Die Studio-Oberfläche ist derzeit englisch.
