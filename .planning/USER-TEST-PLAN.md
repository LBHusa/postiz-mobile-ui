# Husatech Postiz-Fork — Manual-Test-Plan für Lukas

**Stand:** 2026-04-30
**Zweck:** Diese Tests musst DU manuell durchgehen nachdem alle 7 Phasen deployed sind. Sie decken Live-Posting, iOS-Safari-Install, und visuelle End-to-End-Flows ab — Sachen die Playwright nicht automatisieren konnte.

---

## Setup vor den Tests

1. **Server 77 Deployment** ist live (siehe `DEPLOYMENT.md`)
2. **socialmedia.wawihub.de** zeigt neuen Husatech-Postiz-Build
3. **agent.husatech.de** (oder konfiguriertes Endpoint) erreichbar
4. **Telegram-Bot konfiguriert** (Token + Chat-ID in `.env`)
5. **LinkedIn + Meta-Accounts verbunden** in Postiz-Desktop unter `socialmedia.wawihub.de/launches`

**Geräte für Tests:**
- Dein iPhone (Safari)
- Dein Desktop-Browser (Chrome empfohlen für DevTools)
- Telegram-App auf deinem Phone

---

## TEST-GRUPPE 1: PWA Install + Layout

### T1.1 — iPhone Safari "Add to Home Screen"
1. Öffne Safari auf iPhone (NICHT Chrome — iOS-Chrome installiert keine PWAs)
2. Navigiere zu `https://socialmedia.wawihub.de/m/kalender`
3. Logge ein (gleiche Credentials wie Desktop-Postiz)
4. Tap Share-Button (Box mit Pfeil)
5. Tap "Zum Home-Bildschirm hinzufügen"
6. Bestätige Name "Husatech" (oder "Husatech Social")

**✅ Erwartete Ergebnisse:**
- Husatech-Icon erscheint im Add-to-Home-Sheet (Platzhalter-Icon ok für V1)
- Nach Install: Tap auf Home-Screen-Icon öffnet App **ohne** Safari-URL-Bar (Standalone-Mode)
- Status-Bar ist dunkel (`#0a0a0a` Theme)
- Du landest direkt im Kalender, BottomNav unten sichtbar

**❌ Falls Probleme:**
- Icon fehlt → manifest.ts oder `apple-touch-icon` defekt
- Safari-URL-Bar bleibt → `apple-mobile-web-app-capable` meta fehlt
- Falsch redirectet → start_url im manifest.ts checken

### T1.2 — Bottom-Tab-Navigation
1. PWA gestartet, du bist auf Kalender-Tab
2. Tap "Vorschläge"
3. Tap "Mehr"
4. Tap "Kalender"

**✅ Erwartet:** URL ändert sich `/m/kalender → /m/vorschlaege → /m/mehr → /m/kalender`. Aktiver Tab ist visuell hervorgehoben (Farbe).

### T1.3 — Lighthouse PWA-Audit (Desktop Chrome)
1. Chrome → DevTools → Lighthouse
2. URL: `https://socialmedia.wawihub.de/m/kalender`
3. Category: "Progressive Web App" anhaken → Generate Report

**✅ Erwartet:**
- "Installable" criterion ist GREEN
- Service Worker registriert (Serwist-`sw.js`)
- Manifest valide

---

## TEST-GRUPPE 2: Calendar (Phase 2)

### T2.1 — Monatsansicht zeigt Posts
1. Öffne `/m/kalender` (Mobile oder Desktop-Browser im iPhone-Mode)
2. Stelle sicher dass es echte Posts in den nächsten 4 Wochen gibt (von Postiz-Desktop)

**✅ Erwartet:**
- Monatsraster mit Mo-So-Spalten
- Heutiger Tag als Pille hervorgehoben
- Tage mit Posts haben farbige Punkte (gelb=Draft, blau=Scheduled, grün=Online)

### T2.2 — Wochen-Toggle
1. Tap [Mo|Wo] oben rechts → Wochenansicht
2. Verifiziere: 7-Tag-Header mit Counter pro Tag
3. Posts gruppiert pro Tag mit Karten

**✅ Erwartet:** Smooth-Switch, kein Daten-Reload-Flash, Toggle persistiert nach Reload (localStorage).

### T2.3 — Tap-on-Day Bottom-Sheet
1. Tap auf Tag mit ≥2 Posts
2. Bottom-Sheet schiebt von unten

**✅ Erwartet:** Sheet zeigt Post-Liste + "+ Neuer Post für diesen Tag".

### T2.4 — Tap-leerer-Tag
1. Tap leerer Tag im Monatsraster
2. Bottom-Sheet zeigt nur "+ Neuer Post für [Datum]"
3. Tap diesen Button

**✅ Erwartet (Phase 3 done):** Navigiert zu `/m/post/[id]` einer NEUEN leeren Post. Status: Idea, Datum vorgewählt.

---

## TEST-GRUPPE 3: Post-Detail-Page (Phase 3)

### T3.1 — Post öffnen vom Kalender
1. Tap auf existierenden Post-Punkt im Kalender → Bottom-Sheet → Tap auf Post-Karte
2. Detail-Page öffnet sich

**✅ Erwartet:**
- Title oben (inline-editable)
- Properties-Block (Datum, Uhrzeit, Status, Plattformen)
- Body in Tiptap-Editor
- Media-Block (falls Bild vorhanden) mit 2 Buttons [🤖 KI generieren] [📁 Upload]
- Plattform-List dynamisch (LinkedIn / Meta / etc.)
- Comments-Section unten
- Bottom-Action-Bar [💬+] [📷] [🎬] [Status ▾] [📤 Online]

### T3.2 — Title editieren
1. Tap Title → Input erscheint
2. Tippe neuen Title → Tap außerhalb (Blur)

**⚠ Bekannt (Phase-5-stub bis Phase 5 deployed):**
- Toast: "Body-Speichern via Server-Agent ist Phase 5 — vorerst ungespeichert"
- Title revertet nach Refresh (kein Persist)

**✅ Sobald Phase 5 deployed:** Title speichert via Server-Agent.

### T3.3 — Media-Upload
1. Tap [📁 Upload] im Media-Block
2. System-File-Picker öffnet → wähle Datei

**✅ Erwartet:** Datei lädt hoch via `/api/upload`, mediaId im Post-State, Bild/Video-Vorschau erscheint. Toast Erfolg.

### T3.4 — Media-Comment
1. Tap "💬 Bild kommentieren"
2. Bottom-Sheet: schreibe Kommentar → Speichern

**✅ Erwartet:** Comment in Comments-Section sichtbar, mit "↳ Bild" Verknüpfung.

### T3.5 — Datum + Uhrzeit ändern
1. Tap Datum-Property → DateTimePicker-Sheet
2. Datum ändern → Bestätigen

**✅ Erwartet:** Toast "Datum gespeichert". Reload zeigt neues Datum.

### T3.6 — Status auf Online
1. Tap [📤 Online] in Bottom-Action-Bar

**✅ Erwartet:** Toast "Post eingeplant". Status ändert auf Scheduled. Postiz übernimmt Posting zur Zeit.

⚠ Live-Posting selbst NICHT manuell triggern für diesen Test — verwende dafür einen echten Test-Post bewusst.

---

## TEST-GRUPPE 4: KI-Re-Gen-Loop (Phase 5)

### T4.1 — Status auf Re-Gen mit Comments
1. Öffne einen Draft-Post in Mobile
2. Schreibe ≥2 Comments (Page-Comment, Media-Comment)
3. Tap [Status ▾] → wähle "Re-Gen"

**✅ Erwartet:**
- Top-Bar zeigt "🤖 KI arbeitet — Body+Bild..." mit Pulse-Animation
- Status-Pille pulsiert
- Nach 10-30 Sekunden: Banner verschwindet, Body + Bild sind aktualisiert
- Toast: "✓ Beitrag fertig"
- Comments bleiben sichtbar (KI hat sie als Input genutzt)

**❌ Falls fail:**
- Banner verschwindet nicht → Server-Agent down oder Error → check `agent.husatech.de/health`
- Body unverändert → Re-Gen-Workflow hatte Issue → check Server-Agent Logs

### T4.2 — Cancel-Button
1. Wie T4.1, aber tap [✕] Cancel-Button im Banner während KI läuft
2. ✅ Erwartet: Banner verschwindet, Status zurück auf Draft. (Server-Agent läuft im Hintergrund fertig — V1)

---

## TEST-GRUPPE 5: Vorschlags-Workflow (Phase 6)

### T5.1 — Manueller Trigger
1. Öffne `/m/vorschlaege`
2. Tap [💡] oben rechts
3. Wähle "Nächste 2 Wochen (8 Posts)" → Generieren

**✅ Erwartet:**
- Top-Bar: "🤖 KI plant strategisch..." (kann 30-90s dauern)
- Telegram-Notification arrived auf deinem Phone: "8 Vorschläge für 2 Wochen bereit"
- Inbox-Liste füllt sich mit 8 expandable Cards

### T5.2 — Vorschlag akzeptieren
1. Tap [▾] auf einem Vorschlag → expanded
2. Verifiziere: Stichpunkte + Datenbasis sichtbar
3. Tap [✓ Annehmen]

**✅ Erwartet:** Server-Agent erstellt vollen Beitrag → Calendar zeigt nicht-mehr-gestrichelten Punkt am vorgesehenen Datum. Detail-Page öffnet automatisch.

### T5.3 — Vorschlag im Kalender
1. Wechsle zu Kalender-Tab
2. Verifiziere: gestrichelte Punkte ◌ für Vorschläge (nicht akzeptiert)
3. Tap auf Tag mit gestricheltem Punkt → Bottom-Sheet zeigt Vorschlag mit Inline-[Annehmen]

### T5.4 — Sonntags-Cron
1. Nach Server-77-Deployment: warte bis Sonntag 18:00 (Europa/Berlin)
2. Verifiziere: Telegram-Notification erscheint mit "4 neue Vorschläge für KW XX"
3. Öffne `/m/vorschlaege` → 4 neue Vorschläge sichtbar

**Optional manuell triggern:** Auf Server `python -m agent.cli generate-proposals` (oder analog).

---

## TEST-GRUPPE 6: End-to-End Flow (kompletter Workflow)

### T6.1 — Vorschlag → Approve → Live-Post
1. Vorschlag akzeptieren → Draft im Detail-Page
2. Body editieren bei Bedarf, KI-nochmal triggern
3. Plattformen wählen (LinkedIn + IG)
4. Tap "Anpassen für IG" → Server-Agent erstellt IG-Variation
5. Tap [📤 Online] → Status Scheduled
6. **Warte bis zur eingeplanten Zeit** — Postiz postet automatisch via Temporal-Workflow
7. Verifiziere Live-Post auf LinkedIn + IG

⚠ **DAS IST DER EINZIGE LIVE-POST-TEST.** Stelle sicher dass der Inhalt wirklich rausgehen darf.

---

## TEST-GRUPPE 7: Desktop-UI nicht regressiert

### T7.1 — Postiz Desktop-Calendar
1. Desktop-Browser (kein Mobile-Mode)
2. `socialmedia.wawihub.de/launches`
3. Login + nutze Calendar normal: Drafts erstellen, schedulen, etc.

**✅ Erwartet:** Desktop-UI unverändert von Pre-Husatech-Fork. 80px-Sidebar, 80px-Top-Header, Standard-Calendar.

### T7.2 — Desktop-Detail-Modal
1. Klick auf Post in Desktop-Calendar → Modal öffnet sich
2. Edit Body, Schedule, Comments — wie immer

**✅ Erwartet:** Keine UI-Regress.

---

## TEST-GRUPPE 8: Edge-Cases

### T8.1 — Offline-Verhalten
1. PWA gestartet, Internet trennen
2. Tap auf "Vorschläge" Tab

**Erwartet (V1):** Loading-State oder Error-Toast. KEIN Crash.
**V2 (out-of-scope):** Offline-Drafting + Outbox.

### T8.2 — Token-Ablauf
1. Server-Agent .env `AGENT_TOKEN` ändern (z.B. zur Hälfte)
2. Mobile-UI: Re-Gen triggern

**Erwartet:** 401-Error-Toast in Mobile-UI. Lukas muss `NEXT_PUBLIC_HUSATECH_AGENT_TOKEN` frontend-side updaten.

### T8.3 — Kein Postiz-Account verbunden
1. Postiz-Desktop alle Integrationen entfernen
2. Mobile-UI Detail-Page öffnen

**Erwartet:** Plattform-Liste ist leer mit Hinweis "Verbinde Plattformen am Desktop". Kein Crash.

---

## TEST-CHECKLISTE — bitte hier abhaken

- [ ] T1.1 iPhone Safari Install
- [ ] T1.2 BottomNav
- [ ] T1.3 Lighthouse PWA
- [ ] T2.1 Monatsansicht
- [ ] T2.2 Wochen-Toggle
- [ ] T2.3 Tap-on-Day Sheet
- [ ] T2.4 Tap-leerer-Tag
- [ ] T3.1 Detail-Page öffnen
- [ ] T3.2 Title-Edit (Phase-5-stub akzeptiert für Phase 3)
- [ ] T3.3 Media-Upload
- [ ] T3.4 Media-Comment
- [ ] T3.5 Datum-Change
- [ ] T3.6 Online-Schedule
- [ ] T4.1 Re-Gen-Loop
- [ ] T4.2 Re-Gen Cancel
- [ ] T5.1 Manueller Vorschlags-Trigger
- [ ] T5.2 Vorschlag annehmen
- [ ] T5.3 Vorschlag im Calendar
- [ ] T5.4 Sonntags-Cron (warte aufs Wochenende)
- [ ] T6.1 End-to-End Live-Post (BEWUSST!)
- [ ] T7.1 Desktop-Calendar regress
- [ ] T7.2 Desktop-Detail-Modal regress
- [ ] T8.1 Offline-Verhalten
- [ ] T8.2 Token-Ablauf
- [ ] T8.3 Keine Plattform verbunden

---

## Falls Bugs gefunden werden

1. **Screenshots / Video** machen
2. **Server-Logs** dumpen: `pm2 logs cc-api --lines 100` und Server-Agent Logs
3. **Browser-Console-Errors** kopieren
4. Issue erstellen oder neue Session mit GitHub-Issue-Link starten

---

## Was NICHT in V1 funktioniert (akzeptiert):

- Inline-Selection-Comments im Tiptap (Long-Press auf Wort)
- Mobile-Login-Page (User loggt sich auf Desktop ein, Cookie wird zur PWA übernommen)
- Offline-Drafting / Outbox
- Push-Notifications nativ (Telegram reicht)
- iPhone-Standalone-Cookie-Storage-Issue (User logget einmal in PWA neu ein — by iOS-Design)
- Multi-User / Team-Features

V2 wird diese Punkte adressieren.
