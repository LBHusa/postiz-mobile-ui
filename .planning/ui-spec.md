# UI-Spezifikation — Mobile-First Postiz-Fork

**Stand:** 2026-04-30
**Hosting:** `socialmedia.wawihub.de` (existing Postiz-Domain, Mobile-Layer als parallele Route-Group)
**Design-Vorbild:** Notion Mobile (Calendar-Database + Page-Pattern)
**Prinzip:** UI ist die Wahrheit, Backend folgt. Niemals oberflaechlich. Keine Quick Wins.

---

## 1. Architektur-Prinzipien (verbindlich fuer ALLE Screens)

### 1.1 Anti-Hardcoding
| UI-Element | Quelle |
|---|---|
| Plattform-Liste, Logos, Names | `GET /public/v1/integrations` (Postiz API) |
| Disabled-State / Verbindungs-Status | `integration.disabled` + `GET /public/v1/is-connected` |
| Status-States | Server-Agent `/api/workflow/states` (Liste + Labels + Farben) |
| Plattform-Limits (Char-Count) | `GET /public/v1/integration-settings/:id` |
| Aspect-Ratio pro Plattform | Server-Agent-Config (TOML) |
| Format-Optionen pro Plattform | Server-Agent `/api/workflow/formats?platform=:p` (gruppiert nach Plattform) |
| Saeulen / Funnel-Stufen | Server-Agent `/api/workflow/strategy` |

**Was hardcoded bleiben darf:** UI-Strings (Labels), Property-Namen, KI-Visual-Texte, BottomNav-Tabs.

### 1.2 KI-Visualitaet (ueberall sichtbar)

Niemals "stille" KI-Operationen. Bei jeder KI-Aktion sichtbar:

1. **Globaler Top-Bar-Banner**: `🤖 KI arbeitet — Body...` mit Pulse-Animation, tappbar fuer Detail + Cancel.
2. **Skeleton-Placeholder** im betroffenen Bereich (Body-Lines, Bild-Shimmer).
3. **Status-Pille pulsiert** bei `Re-Gen`-State (`● Re-Gen ↻` mit pulse + rotate).
4. **Toast-Notifications**: Start, Success, Error.
5. **Inline-Indikator pro Aktion**: `🎨 Bild wird generiert...`, `✍️ Body wird ueberarbeitet...`, `⟳` neben Felder.

### 1.3 Notion-Pattern fuer Detail-Page

- Eine durchgaengige Seite, scrollable.
- Title oben, Properties darunter (Datum/Uhrzeit/Status/Plattformen), Body fliesst, Media inline.
- Nur Comments + Status sind sichtbar als getrennte Sektionen.
- Inline-Edit auf allem (Title, Properties, Body).

### 1.4 Plus-Tap = direkt Page (kein Sheet vorher)

Wie Notion: Tap auf "+" im Calendar oeffnet **direkt** eine leere Detail-Page mit vorgewaehltem Datum + Status `Idee`. Keine Konfigurations-Hurde davor.

### 1.5 V1-Plattformen

- **Manueller Posting-Workflow**: LinkedIn + Meta (Instagram + Facebook)
- **Vorschlags-Workflow**: NUR LinkedIn (Worker-Erweiterung fuer IG/FB spaeter)

### 1.6 Multi-Plattform-Default

Standard: ein Body fuer alle gewaehlten Plattformen (Variante A). Optional: "Anpassen fuer ausgewaehlte Plattformen"-Button → Server-Agent generiert Plattform-Variation. Postiz-API kann per-Plattform-Body-Override nativ.

### 1.7 Account-Verbindung nur am Desktop

Mobile-UI zeigt nur verbundene Accounts. Tap auf "+ Neuen Account verbinden" oeffnet Hinweis "verbinde am Desktop unter socialmedia.wawihub.de".

---

## 2. Status-States (auf Server-Agent definiert, ueber API ans Frontend)

| State | Symbol | Farbe | Bedeutung | Postiz-Mapping |
|---|---|---|---|---|
| `idea` | ○ | grau | Trigger gesetzt, KI noch nicht durch | `DRAFT` |
| `draft` | ● | gelb | KI hat generiert oder du editierst | `DRAFT` |
| `re_gen` | ↻ | gelb pulse | KI ueberarbeitet gerade | `DRAFT` |
| `approved` | ✓ | hellblau | du bist fertig, wartet auf Schedule | `DRAFT` |
| `scheduled` | 📤 | blau | an Postiz uebergeben | `QUEUE` |
| `online` | 🌍 | gruen | gepostet | `PUBLISHED` |
| `failed` | ⚠ | rot | Posting fehlgeschlagen | `ERROR` |
| `proposal` | ◌ | grau gestrichelt | Vom Server-Agent vorgeschlagen, noch nicht angenommen | (existiert nicht in Postiz, lebt nur in Server-Agent-DB) |

State-Transitions sind nicht frei: jeder Uebergang ist validiert (z.B. `online` -> read-only, `proposal` -> `draft` nur via "Annehmen"-Action).

---

## 3. BottomNav (3 Tabs)

```
┌────────────────────────────────────────┐
│  📅 Kalender   💡 Vorschlaege   ⚙ Mehr │
└────────────────────────────────────────┘
```

- **Kalender**: Default-Tab beim App-Open
- **Vorschlaege**: Badge mit Anzahl `pending` Proposals
- **Mehr**: Settings, Account-Switch, Logout, Verbundene-Accounts-Liste

---

## 4. Screen 1: Calendar

### 4.1 Default — Monatsansicht

```
┌──────────────────────────────────────┐
│  ≡   April 2026         [Mo|Wo]  +   │
├──────────────────────────────────────┤
│   Mo  Di  Mi  Do  Fr  Sa  So         │
│                                       │
│   31   1   2   3   4   5   6         │
│        ●   ●               ●         │
│                                       │
│    7   8   9  10  11  12  13         │
│   ●●           ●                     │
│                                       │
│   14  15  16  17  18  19  20         │
│        ●●  ●●●         ●             │
│                                       │
│   21  22  23  24  25  26  27         │
│   ●           ◌◌                     │  ← gestrichelt = Vorschlag
│                                       │
│  [28] 29  30   1   2   3   4         │  ← heute = Pille
│   ●●  ●        ●●                    │
└──────────────────────────────────────┘
```

**Punkte-Visualisierung:**
- Voller Kreis ● = echter Post (Status nach Color-Coding aus 2.)
- Gestrichelter Kreis ◌ = Vorschlag (Server-Agent-DB, noch nicht angenommen)
- Mehrere Punkte = mehrere Posts/Vorschlaege am Tag (max 4 sichtbar, dann "+N")

**Tap-Verhalten:**
- Tap auf Tag mit nur 1 Post → direkt Detail-Page
- Tap auf Tag mit mehreren Posts → Bottom-Sheet mit Tagesliste
- Tap auf leeren Tag → Bottom-Sheet "+ Neuer Post fuer 28. April"
- Tap auf Vorschlag (gestrichelt) im Sheet → expanded Card mit `[Annehmen]` direkt
- Tap auf "+" oben rechts → Plus-Sheet fuer "heute" / "morgen" / Datum-Picker

### 4.2 Wochenansicht (Toggle "Wo")

```
┌──────────────────────────────────────┐
│  ≡   KW 18 · 27.4 - 3.5  [Mo|Wo]  + │
├──────────────────────────────────────┤
│  Mo  Di  Mi  Do  Fr  Sa  So         │
│  27  28  29  30   1   2   3         │
│   2   3   1   0   2   0   0         │  ← Counter
│                                       │
├─ Mo 27 ──────────────────────────────┤
│  ┌─────────────────────────────────┐ │
│  │ ● 09:00  in              [▾]    │ │
│  │ "Wie ich gestern fast..."       │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ ● 14:00  in,ig            [▾]   │ │
│  │ "Gestern hatte ich ein..."      │ │
│  └─────────────────────────────────┘ │
│                                       │
├─ Di 28 ──────────────────────────────┤
│  ┌─────────────────────────────────┐ │
│  │ ◌ 11:00  in (Vorschlag)   [▾]   │ │  ← Vorschlag inline
│  │ "Diagnose vs. Symptom"          │ │
│  └─────────────────────────────────┘ │
│  ...                                  │
└──────────────────────────────────────┘
```

Plattform-Logos rechts kommen aus `integration.picture` URL.

### 4.3 Bottom-Sheet bei Tap auf Tag

```
╭──────────────────────────────────────╮
│  ════                                 │
│  Donnerstag, 28. April                │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ ● 09:00  in                      │ │
│  │ "Wie ich gestern fast meine..." │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ ◌ 11:00  in (Vorschlag)   [▾]   │ │
│  │ "Diagnose vs. Symptom"          │ │
│  │  ↓ expanded:                    │ │
│  │  [Stichpunkte + Daten-Basis]    │ │
│  │  [✓ Annehmen] [↻ Anders] [✕]   │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ + Neuer Post fuer diesen Tag    │ │
│  └─────────────────────────────────┘ │
╰──────────────────────────────────────╯
```

---

## 5. Screen 2: Detail-Page (Notion-Style)

```
┌────────────────────────────────────────┐
│  ←                              ⋯       │
├────────────────────────────────────────┤
│                                          │
│  Mein Beitrag-Titel                     │  ← inline editierbar
│                                          │
│  📅 28. Apr 2026 · 🕐 09:00 · ● Draft   │  ← inline-properties tap-edit
│                                          │
│  Body-Text in Tiptap...                 │
│  ↓                                       │
│  Markierte Passage              💬¹     │  ← inline-comment-anker
│  (gelb hinterlegt)                      │
│  ↓                                       │
│  ┌────────────────────────────────────┐│
│  │      [Bild-Vorschau 4:5]           ││
│  │                                    ││
│  │ 💬 Bild kommentieren               ││
│  │ ┌─────────┐  ┌─────────┐           ││
│  │ │ 🤖 KI   │  │ 📁 Upload│           ││  ← zwei Buttons
│  │ └─────────┘  └─────────┘           ││
│  └────────────────────────────────────┘│
│                                          │
│  Body geht weiter...                    │
│                                          │
├────────────────────────────────────────┤
│  Plattformen  (live aus useIntegrations)│
│  ┌────────────────────────────────────┐│
│  │ ☑ Lukas Husa · in           [▾]   ││  ← dynamisch
│  │   ↓ expanded:                       ││
│  │   ▸ Format: Text + Karussell  ▾    ││  ← Plattform-spezifisch
│  │   ▸ Body: identisch                ││  ← oder "abweichend"
│  │ ☑ husatech_ig · ig          [▾]    ││
│  │   ↓ expanded:                       ││
│  │   ▸ Format: Reel              ▾    ││
│  │   ▸ Body: identisch                ││
│  │ ☐ Husatech GmbH · fb               ││
│  └────────────────────────────────────┘│
│                                          │
│  ┌────────────────────────────────────┐│
│  │  ✨ Anpassen fuer ausgewaehlte      ││
│  │    Plattformen                      ││
│  └────────────────────────────────────┘│
│                                          │
│  ─── ─── ─── ─── ─── ─── ───             │
│                                          │
│  💬 Kommentare (3)                       │
│  ┌────────────────────────────────────┐│
│  │ ¹ "Anfang haerter machen"          ││
│  │   ↳ markiert: "Manchmal frage..."  ││
│  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐│
│  │ ² "Bild zu dunkel"                 ││
│  │   ↳ Bild                            ││
│  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐│
│  │ ³ "Hashtags fehlen"  (Page)        ││
│  └────────────────────────────────────┘│
│  [+ neuer Kommentar]                    │
│                                          │
├────────────────────────────────────────┤
│  [💬+]  [📷]  [🎬]  [Status ▾]  [📤]    │
│  Komm.  Bild  Video  Stat.    Online    │
└────────────────────────────────────────┘
```

### 5.1 Comment-Mechanik (3 Modi)

1. **Inline**: Long-Press auf Textstelle → System-Menue + Custom "💬 Kommentieren". Markierte Stelle bekommt Anker `¹` + gelbes Highlight. Comment-Bottom-Sheet oeffnet sich.
2. **Page**: Tap `[💬+]` unten → "Kommentar zur ganzen Seite" Bottom-Sheet.
3. **Media**: Tap "💬 Bild kommentieren" am Media-Block. Comment ist mit Bild verknuepft.

### 5.2 Media-Operations (Bild + Video)

Pro Media-Block zwei Buttons:
- **🤖 KI generieren**: ImageProvider.generate(prompt mit Brand-Voice + Comment) — neues Bild ueberschreibt alt
- **📁 Upload**: System-File-Picker fuer eigene Datei (besonders Videos!)

Bei Generierung: Shimmer-Animation + "🎨 Bild wird generiert..." inline. Top-Bar-Banner zusaetzlich.

### 5.3 Plattform-Cards (per-Plattform-Settings)

Jede ausgewaehlte Plattform-Zeile ist expandable. Inhalt expandiert pro Plattform individuell:

- **LinkedIn**: Format (Text / Karussell), Carousel-Name (falls Carousel)
- **Instagram**: Format (Post / Story / Reel), Trial-Reel toggle, Collaborators
- **Facebook**: Format (Post / Story / Reel), Page-Picker
- **(weitere falls Lukas Plattform aktiviert)**

Format-Optionen kommen aus Server-Agent `/api/workflow/formats?platform=:p` (dynamisch).

### 5.4 "Anpassen fuer"-Button

```
Tap "✨ Anpassen fuer ausgewaehlte Plattformen"
   ↓
Server-Agent erhaelt: { post_id, current_body, target_platforms: ["instagram", "facebook"] }
   ↓
Server-Agent generiert pro Plattform optimierte Variation
   ↓
Updated Postiz-Post: per-Plattform-Body-Override (Postiz-API: posts[].value[].content)
   ↓
UI sieht "Body: abweichend" pro Plattform-Card, Tap zeigt Variation
```

### 5.5 Status-Picker

Tap `[Status ▾]` → Bottom-Sheet mit allen States aus 2. Bei `re_gen`-Auswahl: HTTP-Call zum Server-Agent direkt mit allen Kommentaren. KI-Loop laeuft, Status zurueck auf `draft` nach Fertigstellung.

---

## 6. Screen 3: Vorschlags-Inbox

### 6.1 Liste mit expandable Cards

```
┌────────────────────────────────────────┐
│  ≡   Vorschlaege         💡  ⋯          │
├────────────────────────────────────────┤
│  KW 19 (4-10. Mai)        4 Vorschlaege │
│                                          │
│  ┌────────────────────────────────────┐│
│  │ Mo 04.05 · 09:15 · in        [▾]   ││  ← collapsed
│  │ "3 Lessons aus 50k EUR"            ││
│  │ TOFU · Zahlen-die-keiner-kennt     ││
│  │ Karussell · 3 Slides                ││
│  └────────────────────────────────────┘│
│                                          │
│  ┌────────────────────────────────────┐│
│  │ Mi 06.05 · 14:30 · in        [▾]   ││  ← expanded
│  │ "Wieso wir Beratungen nicht..."    ││
│  │ MOFU · Bauen-scheitern-weiter      ││
│  │ Foto + Text                         ││
│  │ ──────────────────────              ││
│  │                                     ││
│  │ Inhalt:                             ││
│  │ • Stichpunkt 1                      ││
│  │ • Stichpunkt 2                      ││
│  │ • Stichpunkt 3                      ││
│  │                                     ││
│  │ Medium: Foto mit Hand-Geste         ││
│  │ • Beschreibung des Bildmotivs       ││
│  │                                     ││
│  │ Datenbasis:                         ││
│  │ ↳ MOFU 21d nicht bedient            ││
│  │ ↳ Hand-Gesten Bilder +18% Eng.      ││
│  │ ↳ Saeule "Bauen-scheitern" 14d still││
│  │                                     ││
│  │ [✓ Annehmen] [↻ Anders] [✕ Weg]    ││
│  │ [Vollbild oeffnen →]                ││
│  └────────────────────────────────────┘│
│                                          │
│  ... 2 weitere Vorschlaege ...          │
│                                          │
│  Generiert So 27.04 18:00 ↻             │
└────────────────────────────────────────┘
```

### 6.2 Manueller Trigger "💡 Mehr generieren"

```
Tap 💡 oben rechts
   ↓
╭──────────────────────────────────────╮
│  Mehr Vorschlaege generieren          │
│                                       │
│  Zeitraum                             │
│  ○ Naechste Woche (4 Posts)           │
│  ● Naechste 2 Wochen (8 Posts)        │
│  ○ Naechste 4 Wochen (16 Posts)       │
│                                       │
│  Beruecksichtige bereits geplant      │
│  ☑ Schon vorhandene Posts vermeiden   │
│  ☑ Funnel-Diversitaet sichern         │
│  ☑ Bisher unbenutzte Saeulen bevorzugen │
│                                       │
│  [💡 Generieren]                      │
╰──────────────────────────────────────╯
```

Server-Agent zieht alle existierenden `scheduled + draft + proposal` Posts in der Zukunft, fuellt die Luecken strategisch (Funnel-Balance + Saeulen-Diversitaet + Datum/Uhrzeit-Variation).

### 6.3 Action-Buttons pro Vorschlag

- **[✓ Annehmen]**: Server-Agent erstellt vollen Beitrag (Body + Bild + First-Comment) → erscheint als `Draft` in Calendar am vorgesehenen Datum/Zeit
- **[↻ Anders]**: Bottom-Sheet mit Feedback-Feld → Server-Agent regeneriert Vorschlag mit Hinweis
- **[✕ Verwerfen]**: Vorschlag deaktiviert, Server-Agent merkt sich Reject-Pattern fuer Tuning
- **[Vollbild oeffnen]**: Detail-View des Vorschlags (gleicher Layout wie Screen 2) zum Editieren bevor Annahme

### 6.4 Telegram-Notification

Cron So 18:00: Server-Agent generiert + sendet via `telegram-send` Skill an Lukas: `"4 neue Vorschlaege fuer KW 19 — oeffne agents.wawihub.de/m/vorschlaege"`. (Korrigiert: socialmedia.wawihub.de/m/vorschlaege)

### 6.5 Vorschlaege in Calendar

Vorschlaege erscheinen als gestrichelte Punkte ◌. Tap im Calendar-Sheet auf Vorschlag = Inline-Expand mit `[Annehmen]` direkt — kein Tab-Wechsel zur Inbox noetig.

---

## 7. Klick-Pfade (User-Stories)

### 7.1 Neuer manueller Beitrag

```
Calendar (Monatsansicht)
   ↓ Tap auf "+" oben rechts
Sheet "Datum waehlen": [Heute] [Morgen] [Datum-Picker]
   ↓ Tap "Heute"
DIREKT Detail-Page (Status: Idee, Datum: heute, Uhrzeit: 09:00 default)
   ↓ Title eintippen
   ↓ Body schreiben in Tiptap
   ↓ Tap auf Plattform-Card "LinkedIn" (auto-checked falls erste Plattform)
   ↓ optional: Tap auf weitere Plattformen (IG, FB)
   ↓ optional: Bild via [🤖 KI generieren] oder [📁 Upload]
   ↓ optional: Uhrzeit setzen
   ↓ Tap [Status ▾] → "Approved" → "Schedule"
Postiz nimmt Posting-Pipeline ueber (Temporal)
```

### 7.2 KI-Re-Gen mit Kommentaren

```
Detail-Page eines Drafts
   ↓ Long-Press auf Textstelle "Manchmal frage ich mich"
System-Menue zeigt "💬 Kommentieren"
   ↓ Tap → Bottom-Sheet
   ↓ "Anfang haerter machen, mehr Tension"
   ↓ [Speichern]
Inline-Anker ¹ erscheint, Stelle gelb hinterlegt
   ↓ Tap auf "💬 Bild kommentieren" am Media-Block
   ↓ "Bild zu dunkel, mehr Kontrast"
   ↓ [Speichern]
   ↓ Tap auf [💬+] unten links
   ↓ "Hashtags am Ende fehlen"
   ↓ [Speichern]
   ↓ Tap [Status ▾] → "Re-Gen"
HTTP-Call: POST agent.husatech.de/regen
  body: { post_id, status: "re_gen" }
Server-Agent zieht via Postiz-API alle Comments + Body + Media
   ↓ claude --print mit Brand-Voice + linkedin-review Skill + Comments
   ↓ ImageProvider neu (wegen Bild-Comment)
   ↓ Updates Body + Media via Postiz POST /posts type=update
Top-Bar zeigt waehrenddessen "🤖 KI arbeitet — Body+Bild..."
Status zurueck auf "Draft" nach Fertigstellung
SWR refresh: Detail-Page zeigt neuen Body + Bild
```

### 7.3 Vorschlag annehmen

```
Calendar oder Vorschlaege-Tab
   ↓ Tap auf gestrichelten Punkt im Calendar (oder Card in Inbox)
Expanded: Inhalt-Stichpunkte + Daten-Basis sichtbar
   ↓ Tap [✓ Annehmen]
Server-Agent erstellt vollen Beitrag (Body + Bild + First-Comment + Plattform-spezifisch)
Top-Bar: "🤖 KI erstellt deinen Beitrag..."
   ↓ Server-Agent ruft Postiz POST /public/v1/posts (type=draft mit Settings)
Vorschlag-Punkt im Calendar wird zu vollem ● (Draft)
Detail-Page automatisch geoeffnet
   ↓ User reviewt
```

### 7.4 Vorschlaege fuer 3 Wochen Vorausplanung

```
Vorschlaege-Tab
   ↓ Tap 💡 "Mehr generieren"
Sheet
   ↓ Auswahl: "Naechste 4 Wochen (16 Posts)"
   ↓ Tap [Generieren]
Top-Bar: "🤖 KI plant strategisch..." (kann 30-90s dauern)
Server-Agent
   1. zieht existierende Posts (scheduled + draft + proposal) aus Postiz fuer naechste 4 Wochen
   2. analysiert Funnel-Verteilung der existierenden
   3. analysiert Saeulen-Verteilung
   4. analysiert Performance der letzten 4 Wochen
   5. waehlt freie Slots (Mo/Mi/Do/Fr × 3 Tageszeiten randomisiert)
   6. generiert 16 Vorschlaege die Luecken strategisch fuellen
Telegram-Push: "16 Vorschlaege fuer 4 Wochen bereit"
Inbox-Liste aktualisiert
Calendar zeigt 16 gestrichelte Punkte ueber 4 Wochen
```

---

## 8. Server-Agent-Endpoints (vom Mobile-UI gerufen)

| Endpoint | Wann | Body |
|---|---|---|
| `POST agent.husatech.de/regen` | Status auf `re_gen` gesetzt | `{ post_id, status }` |
| `POST agent.husatech.de/initial-gen` | Plus → Detail-Page → "KI generieren" beim leeren Post | `{ post_id, hook? }` |
| `POST agent.husatech.de/adapt-platforms` | "Anpassen fuer"-Button | `{ post_id, target_platforms }` |
| `POST agent.husatech.de/proposals/generate` | Manueller Trigger | `{ weeks_ahead, options }` |
| `POST agent.husatech.de/proposals/:id/accept` | Annehmen | `{}` |
| `POST agent.husatech.de/proposals/:id/regenerate` | Anders | `{ feedback }` |
| `POST agent.husatech.de/proposals/:id/reject` | Verwerfen | `{}` |
| `GET agent.husatech.de/proposals?status=pending` | Inbox laden | — |
| `GET agent.husatech.de/proposals?week=W19` | Calendar-Anreicherung mit Vorschlaegen | — |
| `GET agent.husatech.de/workflow/states` | Status-Picker dynamisch | — |
| `GET agent.husatech.de/workflow/formats?platform=:p` | Plattform-Format-Optionen | — |

Alle Endpoints brauchen `Authorization: Bearer <SHARED_AGENT_TOKEN>`.

---

## 9. Postiz-Endpoints (vom Mobile-UI gerufen, internal /api/* mit Cookie-JWT)

| Endpoint | Zweck |
|---|---|
| `GET /api/posts?startDate&endDate` | Calendar-Daten |
| `GET /api/posts/:id` | Detail-Page |
| `POST /api/posts` | Neuer Post (manuell) |
| `PUT /api/posts/:id` | Body + Properties update |
| `POST /api/posts/:id/comments` | Kommentar schreiben |
| `GET /api/posts/:id/comments` | Kommentare lesen |
| `DELETE /api/posts/:id` | Post loeschen |
| `POST /api/upload` | Media-Upload |
| `GET /api/integrations` | Plattform-Liste (dynamisch) |
| `GET /api/integration-settings/:id` | Plattform-Limits + Format-Optionen |

---

## 10. Was NICHT im UI ist (V1)

- Web-Push-Notifications (Telegram reicht)
- Analytics-Charts mobile (Postiz hat das, sekundaer fuer Mobile)
- Automation-Pipelines / Plugs
- Marketplace
- Skool-Extension
- UGC / Affiliate / Streak / Onboarding
- Settings-Page komplett mobile-optimieren (nur das Noetigste)
- Multi-User / Multi-Tenant-Switch
- Eigener Vorschlags-Worker fuer IG/FB (V2-Erweiterung)
