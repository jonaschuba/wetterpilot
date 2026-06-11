# WetterPilot

UI-Prototyp für die Steuerung von Wetterkarten auf den Studio-LED-Wänden – als Ersatz/Ergänzung zum Stream Deck.

## Idee

Statt ständig zwischen Stream-Deck-Pages zu wechseln, baut der Operator eine **Timeline** aus den Wänden zusammen und fährt sie live mit **NEXT / ZURÜCK** ab.

- **Wände W1–W8** links per **Drag & Drop** in die Timeline ziehen → ergibt die Reihenfolge (z. B. W8 → W5 → W1/W2).
- Pro Wand die **Anzahl der Cues** eintragen (max. 8).
- Live: großer **NEXT**-Button springt zum nächsten Cue, **BACK** geht zurück (Companion-Cues sind einzeln).
- Am Ende der Timeline wird NEXT zu **RESTART ↺** (blau) – ein Klick springt zurück zum ersten Cue und startet erneut.
- Jeder Cue lässt sich auch **direkt anklicken** (manueller Sprung).
- Tastatur: `→` / `Leertaste` = Next, `←` = Back.
- Blöcke in der Timeline lassen sich per Grip (⠿) **umsortieren**.
- UI-Sprache: **Englisch**, Wände heißen **Walls**.

### Farben
Nur RTL-Markenfarben + Neutraltöne: Rot `#FA002E` (On Air / aktiver Cue / NEXT), Cyan `#00ACF2` (erledigte Cues / sekundäre Akzente), Blau `#0036F2` (Reihenfolge-Badge / RESTART), dunkles Grau/Schwarz als Hintergrund.

Keine Presets – die konkreten Karten unterscheiden sich jede Sendung und macht der Operator live. Die Timeline definiert nur Reihenfolge + Cue-Anzahl.

## Architektur (geplant)

- Webtool läuft **lokal auf Rechner B** (Stream Deck hängt dort).
- Spricht über das Netz die **Companion HTTP API auf Rechner A** an.
- Lokal → kein CORS-Problem.

## Status

- ✅ UI-Prototyp (`index.html`, eine Datei, kein Build nötig)
- ⬜ Companion HTTP-Anbindung
- ⬜ Cue-Start (0 oder 1) – muss im Companion getestet werden

## Companion-Steuerungsmodell (geklärt 2026-06-11 aus der Config)

Die Wetter-Wände laufen über **ein Picturall-Playback** (Modul `analogway-picturall`, Playback `7`). Manuelle Steuerung = Companion-Seite **65 „WET MAN"**.

| Aktion | Companion-Action | Parameter |
|---|---|---|
| Wand auswählen | `playback_selectcuestack` + `playback_goto` | Cuestack = **20 + Wandnr** (W1=21 … W8=28), dann `cue:"0.1"` |
| Cue abspielen | `playback_goto` | `playback:7, cue:"N.0"` — **Cues 1-basiert** (1.0, 2.0, …) |
| Nächster Cue | `playback_go` | `playback:7` (native NEXT-Funktion) |
| Recue / Clear | `playback_goto` | `cue:"98.0"` bzw. Cuestack 100 |

**Bestätigt:**
- Cues fangen bei **1** an (nicht 0).
- Beim **Wandwechsel** wird der neue Cuestack gewählt + `goto 0.1` → jede Wand startet wieder bei ihrem Cue 1.
- **Kombi-Wände**: W12 → W1 (Cuestack 21), W34 → W3 (Cuestack 23) — immer die erste der beiden.

Damit bildet die WetterPilot-Timeline (Cue 1..N je Wand) das Modell exakt ab.

### Anbindung: feste Buttons auf Seite 65 auslösen (gewählter Weg)

WetterPilot löst per Companion HTTP API (legacy) die vorhandenen Buttons auf Seite 65 aus.
Aufruf-Schema (Standardport 8000): `http://<COMPANION-IP>:8000/press/bank/65/<bank>`

| Button | Seite/Bank | Wirkung |
|---|---|---|
| W1 Playlist | 65/25 | Cuestack W1 wählen + an Anfang |
| W2 Playlist | 65/26 | … |
| W3 Playlist | 65/27 | (für W34) |
| W4 Playlist | 65/28 | |
| W5 Playlist | 65/29 | |
| W6 Playlist | 65/30 | |
| W7 Playlist | 65/31 | |
| W8 Playlist | 65/32 | |
| CUE 1 … CUE 5 | 65/10, 11, 12, 13, 14 | Cue auf aktueller Wand |
| CUE 6 … CUE 10 | 65/18, 19, 20, 21, 22 | Cue auf aktueller Wand |
| NEXT | 65/24 | ein Cue weiter (playback_go) |

**Ablauf je WetterPilot-„Next":**
1. Neuer Wand-Block → erst „W*x* Playlist" pressen, dann „CUE 1".
2. Cue im selben Block → „CUE *n*" pressen (oder „NEXT").

Kombi-Wände: W12 → W1 Playlist (65/25), W34 → W3 Playlist (65/27).

### Noch offen
- **Companion-IP** von Rechner A (Port vermutlich 8000) – muss vor Ort einmal eingetragen/getestet werden.

## Assets

- `assets/rtl-logo.svg` – RTL-NEWS-Logo
- `assets/fonts/` – RTL United (Bold/Regular/Light)
