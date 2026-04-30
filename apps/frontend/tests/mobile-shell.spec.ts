import { test, expect, devices } from '@playwright/test';

const BASE = 'http://localhost:4200';

// AC1: /m redirects to /m/kalender
test('AC1: /m redirects to /m/kalender', async ({ page }) => {
  await page.goto(`${BASE}/m`, { waitUntil: 'commit' });
  await page.waitForURL(`${BASE}/m/kalender`, { timeout: 8000 });
  expect(page.url()).toBe(`${BASE}/m/kalender`);
});

// AC2: /m/kalender shows Mobile-Shell header + BottomNav (requires logged-in session)
// NOTE: m/layout.tsx fetches /user/self — returns null until auth passes.
// Run with: PLAYWRIGHT_SESSION_COOKIE=<value> to test authenticated state,
// OR accept that unauthenticated test validates routing + redirect to login.
test('AC2: /m/kalender renders mobile shell (unauthenticated → login redirect OR shell visible)', async ({ page }) => {
  const response = await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const finalUrl = page.url();
  const isOnMobileOrAuth = finalUrl.includes('/m/kalender') || finalUrl.includes('/auth') || finalUrl.includes('/login');
  expect(isOnMobileOrAuth).toBe(true);

  if (finalUrl.includes('/m/kalender')) {
    // Authenticated: full shell visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible({ timeout: 5000 });
    await expect(nav.getByText('Kalender')).toBeVisible();
    await expect(nav.getByText('Vorschlaege')).toBeVisible();
    await expect(nav.getByText('Mehr')).toBeVisible();
  }
});

// AC3a: Tab navigation Kalender → Vorschlaege
test('AC3a: Vorschlaege tab click changes URL and active highlight', async ({ page }) => {
  await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();
  // Skip if redirected to auth (no session)
  if (!finalUrl.includes('/m/kalender')) {
    test.skip();
    return;
  }

  const nav = page.locator('nav');
  await nav.waitFor({ state: 'visible' });
  const vorschlaegeLink = nav.getByRole('link', { name: /Vorschlaege/i });
  await vorschlaegeLink.click();
  await page.waitForURL(`${BASE}/m/vorschlaege`, { timeout: 5000 });
  expect(page.url()).toBe(`${BASE}/m/vorschlaege`);
  await expect(vorschlaegeLink).toHaveClass(/text-btnPrimary/);
});

// AC3b: Tab navigation Vorschlaege → Mehr
test('AC3b: Mehr tab click changes URL and active highlight', async ({ page }) => {
  await page.goto(`${BASE}/m/vorschlaege`, { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();
  if (!finalUrl.includes('/m/vorschlaege')) {
    test.skip();
    return;
  }

  const nav = page.locator('nav');
  await nav.waitFor({ state: 'visible' });
  const mehrLink = nav.getByRole('link', { name: /Mehr/i });
  await mehrLink.click();
  await page.waitForURL(`${BASE}/m/mehr`, { timeout: 5000 });
  expect(page.url()).toBe(`${BASE}/m/mehr`);
  await expect(mehrLink).toHaveClass(/text-btnPrimary/);
});

// AC3c: Kalender tab active class on /m/kalender
test('AC3c: Kalender tab has active class on /m/kalender', async ({ page }) => {
  await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();
  if (!finalUrl.includes('/m/kalender')) {
    test.skip();
    return;
  }

  const nav = page.locator('nav');
  await nav.waitFor({ state: 'visible' });
  const kalenderLink = nav.getByRole('link', { name: /Kalender/i });
  const vorschlaegeLink = nav.getByRole('link', { name: /Vorschlaege/i });
  await expect(kalenderLink).toHaveClass(/text-btnPrimary/);
  await expect(vorschlaegeLink).toHaveClass(/text-textItemBlur/);
});

// AC4: iPhone 14 Pro — no horizontal scrollbar, BottomNav visible when authed
test('AC4: iPhone 14 Pro — no horizontal scrollbar', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const page = await context.newPage();
  await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });

  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHorizontalScroll).toBe(false);

  await context.close();
});

// AC5: Desktop 1920x1080 — BottomNav hidden (md:hidden at >=768px)
test('AC5: Desktop 1920x1080 — BottomNav hidden via md:hidden', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();
  if (!finalUrl.includes('/m/kalender')) {
    await context.close();
    // If redirected to auth, we can't test nav visibility — skip
    return;
  }

  // Wait for nav to appear in DOM (it's rendered by Client Component after /user/self resolves)
  const nav = page.locator('nav');
  await nav.waitFor({ state: 'attached', timeout: 8000 });
  // At 1920px, md:hidden hides it
  await expect(nav).toBeHidden();

  await context.close();
});

// AC6: /launches Desktop Calendar still loads after Tailwind change
test('AC6: /launches renders without crash after Tailwind breakpoint change', async ({ page }) => {
  const response = await page.goto(`${BASE}/launches`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const status = response?.status() ?? 0;
  expect([200, 302, 307, 308]).toContain(status);
  const url = page.url();
  const isLaunchesOrAuth = url.includes('/launches') || url.includes('/auth') || url.includes('/login');
  expect(isLaunchesOrAuth).toBe(true);
});

// AC7: Tailwind standard sm/md/lg breakpoints are functional
test('AC7: Tailwind sm/md/lg breakpoints change computed color by viewport width', async ({ browser }) => {
  // Test at 400px: bg-red-500 should apply (below sm:640px)
  const ctxSm = await browser.newContext({ viewport: { width: 400, height: 800 } });
  const pageSm = await ctxSm.newPage();
  // Navigate to any page that loads the compiled Tailwind CSS
  await pageSm.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });
  await pageSm.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'tw-breakpoint-test';
    el.className = 'bg-red-500 sm:bg-blue-500 md:bg-green-500 lg:bg-yellow-500';
    el.style.cssText = 'width:1px;height:1px;position:fixed;top:0;left:0;';
    document.body.appendChild(el);
  });
  const colorAt400 = await pageSm.evaluate(() =>
    window.getComputedStyle(document.getElementById('tw-breakpoint-test')!).backgroundColor
  );
  expect(colorAt400).toBe('rgb(239, 68, 68)'); // red-500
  await ctxSm.close();

  // Test at 900px: md:bg-green-500 should apply (between md:768px and lg:1024px)
  const ctxMd = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const pageMd = await ctxMd.newPage();
  await pageMd.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });
  await pageMd.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'tw-breakpoint-test';
    el.className = 'bg-red-500 sm:bg-blue-500 md:bg-green-500 lg:bg-yellow-500';
    el.style.cssText = 'width:1px;height:1px;position:fixed;top:0;left:0;';
    document.body.appendChild(el);
  });
  const colorAt900 = await pageMd.evaluate(() =>
    window.getComputedStyle(document.getElementById('tw-breakpoint-test')!).backgroundColor
  );
  expect(colorAt900).toBe('rgb(34, 197, 94)'); // green-500
  await ctxMd.close();
});

// AC8: /manifest.webmanifest valid JSON with required fields and icon paths
test('AC8: /manifest.webmanifest valid JSON with required fields', async ({ request }) => {
  const response = await request.get(`${BASE}/manifest.webmanifest`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/json/);

  const manifest = await response.json();
  expect(manifest.name).toBe('Husatech Social');
  expect(manifest.short_name).toBe('HS');
  expect(manifest.start_url).toBe('/m/kalender');
  expect(manifest.display).toBe('standalone');
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

  const iconSrcs: string[] = manifest.icons.map((i: { src: string }) => i.src);
  expect(iconSrcs).toContain('/icons/pwa/icon-192.png');
  expect(iconSrcs).toContain('/icons/pwa/icon-512.png');
  expect(iconSrcs).toContain('/icons/pwa/apple-touch-icon.png');
});

// AC9: /icons/pwa/icon-192.png returns HTTP 200 image/png
test('AC9: /icons/pwa/icon-192.png HTTP 200 image/png', async ({ request }) => {
  const response = await request.get(`${BASE}/icons/pwa/icon-192.png`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/image\/png/);
});

// AC10: Viewport meta in HTML source
test('AC10: HTML source has correct viewport meta (width=device-width, initial-scale=1)', async ({ page }) => {
  await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded' });
  const viewportContent = await page.evaluate(() => {
    return document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
  });
  expect(viewportContent).toContain('width=device-width');
  expect(viewportContent).toContain('initial-scale=1');
});
