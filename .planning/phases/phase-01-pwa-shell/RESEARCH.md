# RESEARCH: Phase 1 — Next.js 16 PWA + Mobile-Route /m/*

**Recherchiert:** 2026-04-30 by researcher@postiz-mobile-team
**Verbindlichkeit:** dieses Dokument ist Foundation fuer Phase-1 Implementation. Bei Konflikt mit PLAN.md gilt RESEARCH.md (Source-cited).

Stack-Validierung vorab: Next.js **16.2.1** (root pnpm override), App Router, React 19.2.4, Tailwind 3.4.17, `apps/frontend/next.config.js` ist ESM (`"type": "module"`), `tsconfig.json` strict + isolatedModules + `plugins: [{ name: "next" }]`. Source-Root ist **`apps/frontend/src/app/`** (NICHT `apps/frontend/app/`).

---

## 1. Service-Worker-Strategie — EMPFEHLUNG: `@serwist/next@9.5.10`

### Kompatibilitaet
- **Next.js 16 wird offiziell unterstuetzt.** Issue [serwist/serwist#301 "Support next.js 16"](https://github.com/serwist/serwist/issues/301) wurde am **2025-11-22 als completed geschlossen**. Folge-Bugfixes fuer Turbopack (#335, #336) sind im Februar 2026 gelandet, der letzte Doku-Fix (#348) am **2026-04-29**.
- **Aktuelle Version:** `@serwist/next@9.5.10`, peerDep `next >= 14.0.0` (Next 16 ist abgedeckt; npm-registry-Abfrage bestaetigt).
- **`next-pwa` ist tot** (letztes Release 2023, kein Next-15+/App-Router-Support). Maintainer (Duc Anh, ducanh2912) hat selbst auf Serwist migriert.
- Alternative "nur Manifest, kein SW" ist auch installable in Chrome/Edge — ABER Lighthouse-Audit "Installable" verlangt seit 2024 mind. minimal-funktionierenden SW. iOS Safari ignoriert SW-Pflicht (installable allein durch Manifest + apple-touch-icon).

### Begruendung Serwist:
1. Phase-1 Acceptance-Kriterium #10 verlangt Lighthouse-PWA-Audit "Installable" PASSED — am sichersten mit echtem SW.
2. Postiz hat Sentry mit `productionBrowserSourceMaps: true` und `withSentryConfig` Wrapper. Serwist's `withSerwistInit` ist als Wrapper konzipiert und vertraegt sich mit anderen Wrappern (Komposition: `withSentryConfig(withSerwist(nextConfig), ...)`).
3. V2 (Offline-Drafts, IndexedDB-Outbox) braucht eh Service-Worker — Serwist jetzt aufsetzen erspart Migration spaeter.
4. Fuer Phase-1 V1: nur `defaultCache` runtime-strategy + leeres Precache, keine echten Offline-Pages. ~30 Zeilen Code.

### Dateien (konkret)

**`apps/frontend/src/app/sw.ts`** (NEU):
```typescript
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

**`apps/frontend/next.config.js`** (MODIFY):
```javascript
// @ts-check
import { withSentryConfig } from '@sentry/nextjs';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',     // WICHTIG: src/-prefix wegen Postiz-Layout
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development', // sonst HMR-noise
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... bestehender Inhalt unveraendert ...
};

export default withSentryConfig(withSerwist(nextConfig), {
  // ... bestehende Sentry-Config unveraendert ...
});
```

**Wrapper-Reihenfolge:** Serwist INNEN, Sentry AUSSEN.

**`apps/frontend/.gitignore`** (MODIFY — falls noch nicht drin):
```
public/sw*
public/swe-worker*
```

**`apps/frontend/tsconfig.json`** (MODIFY):
```json
{
  "compilerOptions": {
    "types": ["node", "@serwist/next/typings"],
    "lib": ["dom", "dom.iterable", "esnext", "webworker"]
  }
}
```

---

## 2. App-Router-Strukturentscheidung — `app/(app)/m/*` (NICHT `app/m/*`)

### Entscheidung (Lead-Decision 30.04.2026): **`app/(app)/m/layout.tsx`** — m/ liegt INNERHALB der `(app)`-Route-Group.

**Begruendung:**
1. URL ist `/m/kalender`, `/m/vorschlaege`, `/m/mehr` — explizit im Pfad weil m/ kein Route-Group ist (keine Klammern)
2. `(app)/layout.tsx` (Root mit `<html>`/`<body>`, Plus_Jakarta_Sans, Sentry, Plausible, PHProvider, VariableContextComponent, ChangeDirClient, FetchWrapperComponent) wird AUTOMATISCH vererbt
3. `app/m/*` (Geschwister) waere Multi-Root → triggert "full page reload" beim Navigieren zwischen Desktop/Mobile (Next 16 Docs Caveat)
4. Provider-Stack muss NICHT dupliziert werden — Single-Source-of-Truth

### Konkrete Folder-Struktur:
```
apps/frontend/src/app/
├── (app)/
│   ├── layout.tsx          ← Root: <html><body>+all providers (UNVERAENDERT)
│   ├── (site)/
│   │   └── layout.tsx      ← Desktop-Chrome via <LayoutComponent /> (UNVERAENDERT)
│   └── m/                  ← NEU
│       ├── layout.tsx      ← Mobile-Shell (ohne Sidebar/Topbar, mit BottomNav)
│       ├── page.tsx        ← redirect('/m/kalender')
│       ├── kalender/
│       │   └── page.tsx    ← Placeholder (Phase 2 ersetzt)
│       ├── vorschlaege/
│       │   └── page.tsx    ← Placeholder (Phase 6 ersetzt)
│       └── mehr/
│           └── page.tsx    ← Placeholder
└── manifest.ts             ← NEU, App-Router-Convention
```

### Provider-Aufschluesselung — was muss `m/layout.tsx` mounten?

Vergleiche mit `(app)/(site)/layout.tsx`: das macht NUR `<LayoutComponent>{children}</LayoutComponent>`. Alles andere (Auth-Refresh, Toast, Tooltip, MantineWrapper, CopilotKit, ContextWrapper, ShowMediaBoxModal, etc.) ist INNEN in `LayoutComponent` (siehe `apps/frontend/src/components/new-layout/layout.component.tsx` Zeilen 71-90).

| Provider | Zeile in layout.component.tsx | Mobile noetig? | Begruendung |
|---|---|---|---|
| `<ContextWrapper user={user}>` | 72 | **JA** | User-Context aus `/user/self` SWR-Call — alle Mobile-Pages brauchen User. |
| `<CopilotKit>` | 73-77 | **NEIN** in V1 | AI-Chat-Overlay — Phase 5 entscheidet. Erstmal weglassen. |
| `<MantineWrapper>` | 78 | **JA** (vorerst) | Date-Picker (Phase 2 Calendar) braucht Mantine. Spaeter ersetzbar — fuer Phase 1 mounten. |
| `<ToolTip />` | 79 | NEIN | Desktop-Hover-Tooltips — auf Mobile nutzlos. |
| `<Toaster />` | 80 | **JA** | Mobile-Pages werden auch Toasts feuern. |
| `<CheckPayment>` | 81 | **JA** | Cross-cutting Subscription-Check — sonst Trial-User koennen Mobile-Layer umgehen. |
| `<ShowMediaBoxModal />` | 82 | **JA** in V2 | Media-Picker — Phase 3 (Detail-Page). V1 weglassen. |
| `<ShowLinkedinCompany />` | 83 | NEIN | Provider-spezifisch, V1 weglassen. |
| `<MediaSettingsLayout />` | 84 | NEIN | Settings-Modal-Slot, V1 weglassen. |
| `<ShowPostSelector />` | 85 | NEIN | Desktop-Post-URL-Picker. |
| `<PreConditionComponent />` | 86 | **JA** | Onboarding-Gate — sonst landen User ohne Provider auf leerem Calendar. |
| `<NewSubscription />` | 87 | NEIN | Billing-Upsell-Modal, V1 weglassen. |
| `<ContinueProvider />` | 88 | NEIN | Provider-Connect-Flow-Continuation, V1 weglassen. |

### `apps/frontend/src/app/(app)/m/layout.tsx` (Phase 1 Minimum-Set):

```tsx
'use client';

import { ReactNode, useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { useSearchParams } from 'next/navigation';
import { MobileShell } from '@gitroom/frontend/components/mobile/MobileShell';

export default function MobileLayout({ children }: { children: ReactNode }) {
  const fetch = useFetch();
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <MantineWrapper>
        <Toaster />
        <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
          <PreConditionComponent />
          <MobileShell>{children}</MobileShell>
        </CheckPayment>
      </MantineWrapper>
    </ContextWrapper>
  );
}
```

**WICHTIG:** Die Provider, die in `(app)/layout.tsx` (Root) leben — `VariableContextComponent`, `SentryComponent`, `Plausible`, `PHProvider`, `LayoutContext` (mit `FetchWrapperComponent`), `ChangeDirClient`, `<html>`/`<body>` — werden AUTOMATISCH vererbt. NICHT duplizieren.

`(app)/layout.tsx:54` setzt `className={clsx(jakartaSans.className, 'dark text-primary !bg-primary')}` aufs `<body>`. Das vererbt sich auch — Mobile-Layer ist automatisch im Dark-Mode mit Jakarta-Font.

---

## 3. `apps/frontend/src/app/manifest.ts` — vollstaendiger Code

App-Router-Convention: `manifest.ts` muss IM `app/`-Root liegen. Next.js serviert es als `/manifest.webmanifest`.

```tsx
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Husatech Social',
    short_name: 'HS',
    description: 'Mobile Content-Planung fuer Husatech',
    start_url: '/m/kalender',
    scope: '/m/',
    id: '/m/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    lang: 'de',
    dir: 'ltr',
    categories: ['productivity', 'business', 'social'],
    icons: [
      {
        src: '/icons/pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/pwa/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
```

**Drei kritische Felder:**
- `scope: '/m/'` + `id: '/m/'`: Begrenzt PWA-Sichtbarkeit auf `/m/*`. Ohne `scope` denkt der Browser die ganze Postiz-Domain ist die PWA.
- `maskable`-Icon-Variante: Android Adaptive Icons croppen runde/quadratische Masken. Lighthouse warnt sonst.
- `categories`: Optional aber hilft bei "Apps"-Listings (Edge, Samsung Browser).

**Felder die iOS Safari ignoriert:** `dir`, `lang`, `orientation`, `background_color`, `shortcuts`. Trotzdem mitgeben.

---

## 4. Viewport-Meta — vollstaendiger Code

In **`apps/frontend/src/app/(app)/layout.tsx`** ergaenzen (NICHT im `m/layout.tsx`):

```tsx
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
};
```

**Warum hier und nicht in `m/layout.tsx`:**
- Nur Root und Layout-Segmente koennen `viewport` exportieren — Layouts darunter erben den Wert.
- `m/layout.tsx` muss `'use client'` sein wegen `useSWR`/`useFetch`. **Client Components duerfen `viewport` nicht exportieren** — Build-Time-Fail.
- Daher: `viewport` zentral in `(app)/layout.tsx` (Server Component), betrifft auch Desktop. Maximum-scale + `userScalable: false` ist Standard-PWA-Pattern und stoert Desktop nicht.

`viewportFit: 'cover'` ist Schluessel fuer iPhone Notch — Inhalt unter safe-area. Mobile-Components muessen `env(safe-area-inset-*)` respektieren:
```css
.bottom-nav {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
```

---

## 5. iOS Safari PWA-Quirks 2026

Quelle: [firt.dev/notes/pwa-ios](https://firt.dev/notes/pwa-ios) (Maximiliano Firtman, 2026-Referenz).

### iOS unterstuetzt aus Manifest:
- `name`, `short_name`, `scope`, `start_url`, `icons` (seit iOS 15.4), `display` (standalone), `theme_color` (seit iOS 15), `id` (seit iOS 16.4)

### iOS IGNORIERT:
- `orientation`, `background_color`, `dir`, `lang`, `shortcuts`, `display_override`, `categories`, screenshots

### Apple-Meta-Tags weiterhin PFLICHT in `<head>`:

```tsx
// In apps/frontend/src/app/(app)/layout.tsx <head>-Block ergaenzen:
<head>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="/icons/pwa/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Husatech" />
  {/* bestehende Datafast-Script-Block bleibt unveraendert */}
</head>
```

**Kritische Gotchas:**
1. `apple-mobile-web-app-capable=yes` ist trotz `display: standalone` weiterhin Pflicht — sonst keine Splash-Screens und kein echter Standalone-Mode
2. `apple-mobile-web-app-status-bar-style: black-translucent` ist die einzige Variante mit Fullscreen — Content muss safe-area respektieren
3. `apple-touch-icon` muss 180x180 PNG ohne Transparenz sein
4. Splash-Screens optional fuer Phase 1 — erstmal weglassen
5. `start_url` muss exakt gleich wie URL beim Add-to-Home-Screen
6. iOS-Standalone hat separate Cookie-Storage vom Safari — User muss in PWA neu einloggen
7. Kein "Browser refresh" in Standalone — daher SW `skipWaiting: true`

### Lighthouse "Installable" Pass-Bedingungen 2026:
- HTTPS oder localhost ✓
- `start_url` antwortet 200 ✓
- `name` ODER `short_name` ✓
- `display` ist `fullscreen|standalone|minimal-ui|window-controls-overlay` ✓
- `icons` mit mind. 192px + 512px PNG ✓
- `prefer_related_applications` nicht `true` (default false → ✓)
- `id` Feld empfohlen (Chrome 117+) ✓
- Service-Worker mit `fetch`-Handler — Serwist bringt das mit ✓

---

## 6. Zusatz-Findings

### 6a. Tailwind-Naming-Konflikt
PLAN.md schlaegt `screens: { sm: '640px', md: '768px', lg: '1024px', ... }` ZUSAETZLICH zu existierenden Customs. Sicher — Tailwind erlaubt mixed `screens`-Defs. Existierende `md:`-Usages (z.B. `launches/filters.tsx:275` `flex flex-col md:flex-row`) ziehen aktuell Tailwind-Default 768px. Nach Hinzufuegen unseres `md: '768px'` aendert sich nichts (gleicher Wert). **Sanity-Check:** nach Tailwind-Config-Aenderung Desktop-Calendar (`/launches`) live ansehen.

### 6b. CSS-Variables-Theming bleibt
Mobile-Components nutzen direkt `bg-primary`, `text-primary` — Postiz-CSS-Variablen aus `colors.scss` greifen automatisch. KEIN eigenes Theme bauen. CLAUDE.md mahnt: `--color-custom*` sind deprecated.

### 6c. PWA `start_url=/m/kalender` Auth-Redirect-Loop
Wenn nicht-eingeloggter User PWA oeffnet → `/m/kalender` → MobileLayout's `useSWR('/user/self')` → 401 → `LayoutContext.afterRequest` redirected zu `/`. Auf `/` rendert `(app)/(site)/auth/...` — Desktop-Login-Page in Mobile-PWA-Standalone. **Akzeptabel fuer Phase 1**, QA prueft bei Acceptance-Test. Long-term: Mobile-Login Phase 2.

### 6d. Sentry-Sourcemap fuer SW
Sentry's `widenClientFileUpload: true` faengt SW-Sourcemap mit, weil Serwist `sw.js` nach `public/` schreibt. Falls SW-Errors kryptisch: in `next.config.js` `sourcemaps.assets` ergaenzen mit `'public/sw.js.map'`. Phase 7 polish.

### 6e. `.env.example` Erweiterungen (Task #6)
```
# Server-Agent (Phase 4-6 — Mobile-Layer talks to husatech-agent for AI-Tasks)
HUSATECH_AGENT_BASE_URL=http://127.0.0.1:9100
HUSATECH_AGENT_TOKEN=
```
Server-side belassen (kein `NEXT_PUBLIC_`-Prefix) — Mobile-Pages erreichen Server-Agent via Postiz-Backend-Proxy.

---

## 7. Quellen-Liste (alle verifiziert 2026-04-30)

1. Next.js 16 Manifest Convention — https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest (v16.2.4)
2. Next.js 16 generateViewport — https://nextjs.org/docs/app/api-reference/functions/generate-viewport (v16.2.4)
3. Next.js 16 Route Groups — https://nextjs.org/docs/app/api-reference/file-conventions/route-groups (v16.2.4)
4. Serwist GitHub Issue #301 (Next 16 Support, closed 2025-11-22) — https://github.com/serwist/serwist/issues/301
5. Serwist Releases — https://github.com/serwist/serwist/releases
6. @serwist/next npm — peerDeps `next >= 14.0.0`, version 9.5.10
7. Serwist next-basic Example — https://github.com/serwist/serwist/tree/main/examples/next-basic
8. iOS Safari PWA Quirks 2026 — https://firt.dev/notes/pwa-ios
9. Postiz Code-Refs:
   - `apps/frontend/src/app/(app)/layout.tsx` Z.33-117
   - `apps/frontend/src/app/(app)/(site)/layout.tsx` Z.1-9
   - `apps/frontend/src/components/new-layout/layout.component.tsx` Z.71-90
   - `apps/frontend/src/components/layout/layout.context.tsx` Z.27-124
   - `apps/frontend/next.config.js` Z.1-112
   - `apps/frontend/tsconfig.json` Z.14-19

---

## TL;DR Empfehlungen

1. **SW-Library:** `@serwist/next@9.5.10`. `apps/frontend/src/app/sw.ts` + Wrapper in `next.config.js` INNERHALB `withSentryConfig`. Dev-Mode mit `disable: process.env.NODE_ENV === 'development'`.
2. **Routing:** `apps/frontend/src/app/(app)/m/{layout.tsx,page.tsx,kalender/,vorschlaege/,mehr/}` — UNTER `(app)/`, NICHT auf `app/`-Root. Erbt Root-Provider, ueberschreibt nur Site-Chrome.
3. **Manifest:** `apps/frontend/src/app/manifest.ts` (App-Root), mit `scope: '/m/'`, `id: '/m/'`, maskable-Icon-Variante.
4. **Viewport:** in `apps/frontend/src/app/(app)/layout.tsx` (Server Component) — `viewportFit: 'cover'`.
5. **iOS-Meta:** `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=Husatech`, `<link rel="apple-touch-icon">` — alle in `(app)/layout.tsx` `<head>`.
6. **Provider in `m/layout.tsx`:** `ContextWrapper` + `MantineWrapper` + `Toaster` + `CheckPayment` + `PreConditionComponent`. NICHT `CopilotKit`, `ToolTip`, `ShowMediaBoxModal`, `ShowLinkedinCompany`, `MediaSettingsLayout`, `ShowPostSelector`, `NewSubscription`, `ContinueProvider`.
7. **CLAUDE.md-Update:** Mobile-Routes-Pfad ist `apps/frontend/src/app/(app)/m/*` (NICHT `apps/frontend/src/app/m/*`).
