# Phase 1: PWA + Mobile-Layout-Shell

**Branch:** `feat/mobile-shell` (von `husatech-main` ab)
**Coding-Team-Fokus:** frontend (lead) + qa
**Frontend-Design-Skill:** noch nicht relevant (Phase ist Setup, kein UI-Design)
**Goal:** Mobile-Layer existiert unter `/m/*`, ist als PWA installierbar, hat Bottom-Tab-Navigation, hat Tailwind-Mobile-First-Breakpoints. Noch leer (echte Calendar/Detail/Inbox kommen in Phase 2-3-6).

---

## Files-to-create

### PWA-Manifest
- `apps/frontend/src/app/manifest.ts` — Next.js 16 App Router Convention. Exportiert `MetadataRoute.Manifest`-Objekt mit:
  - `name: "Husatech Social"`
  - `short_name: "HS"`
  - `description: "Mobile Content-Planung fuer Husatech"`
  - `start_url: "/m/kalender"`
  - `display: "standalone"`
  - `theme_color: "#0a0a0a"` (oder aus existing colors.scss `--color-primary`)
  - `background_color: "#0a0a0a"`
  - `icons: [{ src: "/icons/pwa/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/pwa/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/icons/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }]`
  - `orientation: "portrait"`

### PWA-Icons
- `apps/frontend/public/icons/pwa/icon-192.png` (192×192)
- `apps/frontend/public/icons/pwa/icon-512.png` (512×512)
- `apps/frontend/public/icons/pwa/apple-touch-icon.png` (180×180)
- Inhalt: Husatech-Logo (vorerst Platzhalter — koennen echte Logos spaeter ersetzen)

### Mobile-Route-Group
- `apps/frontend/src/app/(mobile)/layout.tsx` — Mobile-Shell-Layout
- `apps/frontend/src/app/(mobile)/page.tsx` — Server-Component: redirect zu `/m/kalender`
- `apps/frontend/src/app/(mobile)/kalender/page.tsx` — Placeholder (Phase 2 ersetzt das)
- `apps/frontend/src/app/(mobile)/vorschlaege/page.tsx` — Placeholder (Phase 6 ersetzt)
- `apps/frontend/src/app/(mobile)/mehr/page.tsx` — Placeholder (Settings/Mehr-Tab)

WICHTIG zu Routing: Die Route-Group `(mobile)` ist URL-transparent — d.h. `/m/kalender` muss explizit als `app/m/kalender` realisiert werden (oder via `route.config` umgemappt). Saubere Loesung: stattdessen `app/m/` als echtes Folder mit `(mobile)` als Group: `app/m/(mobile)/layout.tsx`. **Recherchieren in researcher-Agent**: was ist Next.js 16 App Router Best-Practice fuer "URL-Praefix mit Layout-Override"?

Empfohlene Loesung (verifiziert vor Implementation):
- `apps/frontend/src/app/m/layout.tsx` — Mobile-Shell (uebersteuert `(app)/layout.tsx`)
- `apps/frontend/src/app/m/page.tsx` — redirect
- `apps/frontend/src/app/m/kalender/page.tsx`
- `apps/frontend/src/app/m/vorschlaege/page.tsx`
- `apps/frontend/src/app/m/mehr/page.tsx`

### Mobile-Komponenten
- `apps/frontend/src/components/mobile/BottomNav.tsx` — Fixed-Bottom-Tab-Bar mit 3 Tabs (Kalender / Vorschlaege / Mehr)
  - Verwendet `usePathname()` um aktiven Tab zu highlighten
  - Tabs sind Links zu `/m/kalender`, `/m/vorschlaege`, `/m/mehr`
  - Icons: SVG-Komponenten aus `apps/frontend/src/components/ui/icons/index.tsx` falls vorhanden, sonst inline
  - Vorschlaege-Tab hat Badge-Slot (Anzahl pending — kommt erst in Phase 6 mit echten Daten, jetzt: 0 oder versteckt)

- `apps/frontend/src/components/mobile/MobileShell.tsx` — Wrapper-Component fuer das Mobile-Layout
  - Top-Bar (Header + ggfs. Title + Icons)
  - Main-Content-Area (children)
  - BottomNav unten
  - Implementiert KI-Visual-Top-Bar-Banner-Slot (kommt in Phase 5 zum Leben — jetzt: leerer Slot)

### Service-Worker (PWA)
- `apps/frontend/src/app/sw.ts` ODER via `@serwist/next` (Next 16 kompatibel)
- **Nur installable** in Phase 1 — kein Offline-Caching (V1)
- Researcher pruefen: ist `@serwist/next` v9 stable mit Next 16? Falls nein: `next-pwa` ist dead, dann nur Manifest ohne Service-Worker (PWA ist trotzdem installable durch Manifest allein, nur ohne offline-shell)

---

## Files-to-modify

### `apps/frontend/tailwind.config.cjs`
- **Aenderung:** `screens`-Block ergaenzen — Standard-Tailwind-Mobile-First neben den existierenden Customs
- **Vorher:** `screens: { mobile: { raw: '(max-width: 1025px)' }, tablet: ..., iconBreak: ..., maxMedia: ..., minCustom: ..., custom: ..., xs: { max: '401px' } }`
- **Nachher:** Standard-Breakpoints zusaetzlich:
  ```js
  screens: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
    // Existing customs unveraendert:
    mobile: { raw: '(max-width: 1025px)' },
    tablet: { raw: '(max-width: 1300px)' },
    iconBreak: { raw: '(max-width: 1560px)' },
    maxMedia: { raw: '(max-width: 1400px)' },
    minCustom: { raw: '(min-height: 800px)' },
    custom: { raw: '(max-height: 800px)' },
    xs: { max: '401px' },
  }
  ```

### `apps/frontend/src/app/(app)/layout.tsx` (oder root layout)
- **Aenderung:** `viewport`-Export ergaenzen
  ```ts
  import type { Viewport } from 'next'
  export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,  // PWA-Standalone bevorzugt
    viewportFit: 'cover',  // iPhone Notch
    themeColor: '#0a0a0a',
  }
  ```

### Repo-`CLAUDE.md`
- **Aenderung:** Section ueber Mobile-Architektur einfuegen + bestehende Drift-Errors korrigieren
  - "Vite ReactJS" → "Next.js 16 App Router"
  - `tailwind.config.js` → `tailwind.config.cjs`
  - **Neue Sektion**: "Mobile-First Layer"
    - Routes unter `apps/frontend/src/app/m/*`
    - Components unter `apps/frontend/src/components/mobile/*`
    - Tailwind: Mobile-First mit `sm/md/lg`-Breakpoints (statt der existierenden `mobile:`-Customs)
    - Service-Account-Token fuer Server-Agent in env (`HUSATECH_AGENT_TOKEN`)
    - Server-Agent unter `agent.husatech.de` (oder Subpath, configurable)

### `apps/frontend/.env.example`
- **Aenderung:** zwei neue Vars
  - `HUSATECH_AGENT_BASE_URL` (z.B. `http://127.0.0.1:9100` lokal, `https://agent.husatech.de` prod)
  - `HUSATECH_AGENT_TOKEN` (Shared-Token fuer Auth zu Server-Agent)

---

## Out-of-Scope (Phase 1 macht NICHT)

- Echte Calendar-Logik (Phase 2)
- Echte Detail-Page (Phase 3)
- Echte Vorschlaege (Phase 6)
- Server-Agent Code (Phase 4-6)
- Re-Gen-Loop (Phase 5)
- KI-Visual-Animations mit echten States (Phase 5 — Slot ist da, aber leer)
- Offline-Funktionalitaet (V2)
- Push-Notifications (V2 — Telegram reicht)
- Auth-Flow Mobile-spezifisch (User ist im Postiz schon eingeloggt, Cookie wird mitgenommen)

---

## Acceptance-Kriterium (live verifizierbar)

1. **Lokal:** `pnpm dev` startet — Frontend laeuft auf `localhost:4200`
2. **Lokal:** Browser-Console: `localhost:4200/m` redirectet zu `localhost:4200/m/kalender` (HTTP 307 oder 308)
3. **Lokal:** `localhost:4200/m/kalender` zeigt Mobile-Shell mit Header "Kalender" + leerem Content + BottomNav unten
4. **Lokal:** Tap auf "Vorschlaege" Tab → URL aendert zu `/m/vorschlaege`, Tab-Highlight aendert
5. **Lokal:** Tap auf "Mehr" Tab → URL aendert zu `/m/mehr`
6. **iPhone Safari (lokal via ngrok ODER Deploy auf Test-Server):** "Zur Home-Bildschirm" Option im Share-Menu zeigt Husatech-Icon, oeffnet als Standalone-App ohne URL-Bar
7. **Browser-DevTools mobile-emulation (iPhone 14 Pro):** keine horizontale Scrollbar, viewport-Meta korrekt
8. **Tailwind Test:** `<div className="bg-red-500 sm:bg-blue-500 md:bg-green-500 lg:bg-yellow-500">` aendert Farbe je Window-Breite (Standard-Breakpoints aktiv)
9. **Existing Desktop-UI:** `localhost:4200/launches` (Postiz-Calendar) funktioniert weiterhin unveraendert (Desktop-Code nicht broken)
10. **Lighthouse PWA-Audit:** "Installable" criterion ist passed (manifest + icons + service-worker — falls Serwist eingebaut)

---

## Verification-Approach

- Frontend-Agent: implementiert + ueberprueft Live-Browser
- QA-Agent: durchlaeuft alle 10 Acceptance-Punkte explizit, dokumentiert in `VERIFICATION.md`
- Researcher-Agent: prueft Next.js 16 App Router Best-Practice fuer URL-Praefix-Layouts, prueft Service-Worker-Library-Wahl (`@serwist/next` vs nichts)

---

## Files Liste (komplette Diff-Summary)

```
NEW:
+ apps/frontend/src/app/manifest.ts
+ apps/frontend/public/icons/pwa/icon-192.png
+ apps/frontend/public/icons/pwa/icon-512.png
+ apps/frontend/public/icons/pwa/apple-touch-icon.png
+ apps/frontend/src/app/m/layout.tsx
+ apps/frontend/src/app/m/page.tsx
+ apps/frontend/src/app/m/kalender/page.tsx
+ apps/frontend/src/app/m/vorschlaege/page.tsx
+ apps/frontend/src/app/m/mehr/page.tsx
+ apps/frontend/src/components/mobile/BottomNav.tsx
+ apps/frontend/src/components/mobile/MobileShell.tsx

MODIFY:
~ apps/frontend/tailwind.config.cjs
~ apps/frontend/src/app/(app)/layout.tsx (oder root)
~ CLAUDE.md
~ apps/frontend/.env.example

OPTIONAL (Researcher-Entscheidung):
+ apps/frontend/src/app/sw.ts (falls Serwist)
+ next.config.js modification fuer Serwist
```

---

## Commit-Strategie

- 1 Commit pro logischer Einheit, nicht "alles in einem"
- Beispiele:
  - `feat(mobile): add tailwind mobile-first breakpoints`
  - `feat(mobile): add PWA manifest and icons`
  - `feat(mobile): add mobile route group /m with bottom nav`
  - `feat(mobile): add MobileShell + BottomNav components`
  - `chore: update CLAUDE.md with mobile architecture section`
- Jeder Commit muss buildbar sein
- Jeder Commit muss bestehende Tests (falls da, hier null) gruen lassen
- Letzter Commit oeffnet PR `husatech-main` ← `feat/mobile-shell`
