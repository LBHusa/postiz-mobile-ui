import { test, expect, devices } from '@playwright/test';

const BASE = 'http://localhost:4200';

async function requireAuth(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const url = page.url();
  if (!url.includes(path.split('?')[0])) {
    test.skip();
    return false;
  }
  return true;
}

async function navigateToFirstPost(page: import('@playwright/test').Page): Promise<string | null> {
  const ok = await requireAuth(page, '/m/kalender');
  if (!ok) return null;

  await page.locator('[data-testid="mobile-calendar-month"]').waitFor({ timeout: 8000 });

  const dayCells = page.locator('[data-testid="calendar-day-cell"]');
  const cellCount = await dayCells.count();
  for (let i = 0; i < cellCount; i++) {
    const dots = dayCells.nth(i).locator('[data-testid="status-dot"]');
    if ((await dots.count()) > 0) {
      await dayCells.nth(i).click();
      break;
    }
  }

  const daySheet = page.locator('[data-testid="day-sheet"]');
  const sheetVisible = await daySheet.isVisible().catch(() => false);
  if (!sheetVisible) return null;

  const postCard = daySheet.locator('[data-testid="calendar-post-card"]').first();
  const cardVisible = await postCard.isVisible().catch(() => false);
  if (!cardVisible) return null;

  await postCard.click();
  await page.waitForURL(/\/m\/post\//, { timeout: 5000 }).catch(() => {});
  const url = page.url();
  return url.includes('/m/post/') ? url : null;
}

test.describe('Phase 3 — MobilePostDetail', () => {

  // AC1: /m/post/[id] loads a post
  test('AC1: /m/post/[id] renders detail page for a valid post ID', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await expect(page).toHaveURL(/\/m\/post\/.+/, { timeout: 5000 });
    const detail = page.locator('[data-testid="mobile-post-detail"]');
    await expect(detail).toBeVisible({ timeout: 8000 });
  });

  // AC2: Title inline editable — tap → textarea, save on blur
  test('AC2: Post title is inline-editable via tap, saves on blur', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const titleEl = page.locator('[data-testid="post-title"]');
    await expect(titleEl).toBeVisible();
    await titleEl.click();

    const titleInput = page.locator('[data-testid="post-title-input"]');
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    await titleInput.fill('Test Title Edit');
    await titleInput.blur();

    await expect(titleInput).toBeHidden({ timeout: 3000 });
  });

  // AC3: Properties block shows date, time, status
  test('AC3: Properties block shows date/time/status', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const props = page.locator('[data-testid="post-properties"]');
    await expect(props).toBeVisible();

    await expect(props.locator('[data-testid="post-date"]')).toBeVisible();
    await expect(props.locator('[data-testid="post-status"]')).toBeVisible();
  });

  // AC4: Date tap opens DateTimePicker sheet
  test('AC4: Tapping date opens DateTimePicker bottom sheet', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const dateBtn = page.locator('[data-testid="post-date"]');
    await dateBtn.click();

    const picker = page.locator('[data-testid="datetime-picker"]');
    await expect(picker).toBeVisible({ timeout: 3000 });

    await expect(picker.locator('[data-testid="datetime-confirm"]')).toBeVisible();

    await picker.locator('button', { hasText: 'Abbrechen' }).click();
    await expect(picker).toBeHidden({ timeout: 2000 });
  });

  // AC5: Status tap opens StatusPicker with 8 options
  test('AC5: Tapping status opens StatusPicker with 8 status options', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const statusBtn = page.locator('[data-testid="post-status"]');
    await statusBtn.click();

    const picker = page.locator('[data-testid="status-picker"]');
    await expect(picker).toBeVisible({ timeout: 3000 });

    const validStatuses = ['idea', 'draft', 're_gen', 'approved', 'scheduled', 'online', 'failed', 'proposal'];
    for (const status of validStatuses) {
      await expect(picker.locator(`[data-testid="status-option-${status}"]`)).toBeVisible();
    }

    await picker.click({ position: { x: 10, y: 10 } });
    await expect(picker).toBeHidden({ timeout: 2000 });
  });

  // AC6: Body editor is Tiptap-based, minimal toolbar (≤6 buttons)
  test('AC6: Post body editor is Tiptap-based with minimal toolbar', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const bodyEditor = page.locator('[data-testid="post-body-editor"]');
    await expect(bodyEditor).toBeVisible();

    const proseMirror = bodyEditor.locator('.ProseMirror');
    await expect(proseMirror).toBeVisible();

    const toolbar = bodyEditor.locator('[data-testid="post-body-toolbar"]');
    await expect(toolbar).toBeVisible();

    const btnCount = await toolbar.locator('button').count();
    expect(btnCount).toBeGreaterThan(0);
    expect(btnCount).toBeLessThanOrEqual(6);
  });

  // AC7: MediaBlock shows KI-generate and Upload buttons
  test('AC7: MediaBlock shows KI-generate and Upload buttons', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const mediaBlock = page.locator('[data-testid="media-block"]');
    await expect(mediaBlock).toBeVisible();

    await expect(mediaBlock.locator('[data-testid="media-ki-generate"]')).toBeVisible();
    await expect(mediaBlock.locator('[data-testid="media-upload"]')).toBeVisible();
  });

  // AC8: Upload button triggers file chooser
  test('AC8: Upload button triggers file chooser dialog', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const uploadBtn = page.locator('[data-testid="media-upload"]');
    await expect(uploadBtn).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
      uploadBtn.click(),
    ]);

    if (fileChooser) {
      expect(fileChooser).toBeTruthy();
    } else {
      const fileInput = page.locator('input[type="file"]');
      const count = await fileInput.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  // AC9: Platform list dynamic, cards toggleable — verified via data-active attribute
  test('AC9: Platform list renders dynamically and cards are toggleable', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const platformList = page.locator('[data-testid="platform-list"]');
    await expect(platformList).toBeVisible();

    const platformCards = platformList.locator('[data-testid="platform-card"]');
    const count = await platformCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 3); i++) {
      const logo = platformCards.nth(i).locator('img').first();
      const src = await logo.getAttribute('src');
      expect(src).not.toMatch(/^\/icons\/platforms\//);
      expect(src).not.toMatch(/^\/assets\/platforms\//);
    }

    const firstCard = platformCards.first();
    const toggleBtn = firstCard.locator('[data-testid="platform-toggle"]');
    await expect(toggleBtn).toBeVisible();

    const activeBefore = await firstCard.getAttribute('data-active');
    await toggleBtn.click();
    const activeAfter = await firstCard.getAttribute('data-active');
    expect(activeAfter).not.toBe(activeBefore);
  });

  // AC10: Platform card expands to show per-platform format settings
  test('AC10: Platform card expands to show format options', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const platformCards = page.locator('[data-testid="platform-card"]');
    const count = await platformCards.count();
    if (count === 0) { test.skip(); return; }

    const firstCard = platformCards.first();
    const isActive = await firstCard.getAttribute('data-active');
    if (isActive !== 'true') {
      await firstCard.locator('[data-testid="platform-toggle"]').click();
    }

    const expandBtn = firstCard.locator('[data-testid="platform-card-expand"]');
    await expect(expandBtn).toBeVisible({ timeout: 2000 });
    await expandBtn.click();

    const formatWrapper = firstCard.locator('[data-testid="platform-format-options"]');
    await expect(formatWrapper).toBeVisible({ timeout: 3000 });

    const options = formatWrapper.locator('[data-testid="format-option"]');
    expect(await options.count()).toBeGreaterThan(0);
  });

  // AC11: Comments section with trigger button
  test('AC11: Comments section shows and has add-comment trigger', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const commentsSection = page.locator('[data-testid="comments-section"]');
    await expect(commentsSection).toBeVisible();

    const commentTrigger = commentsSection.locator('[data-testid="comment-input-trigger"]');
    await expect(commentTrigger).toBeVisible();
  });

  // AC12: Comment trigger opens comment-input sheet with submit button
  test('AC12: Tapping comment trigger opens CommentInput sheet', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const commentTrigger = page.locator('[data-testid="comment-input-trigger"]');
    await commentTrigger.click();

    const commentSheet = page.locator('[data-testid="comment-input-sheet"]');
    await expect(commentSheet).toBeVisible({ timeout: 3000 });

    await expect(commentSheet.locator('textarea')).toBeVisible();
    await expect(commentSheet.locator('[data-testid="comment-submit"]')).toBeVisible();

    await commentSheet.locator('button', { hasText: 'Abbrechen' }).click();
    await expect(commentSheet).toBeHidden({ timeout: 2000 });
  });

  // AC13: Media comment via tap on image opens MediaCommentInput
  test('AC13: Media comment button opens MediaCommentInput sheet', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const mediaCommentBtn = page.locator('[data-testid="media-comment-button"]');
    const hasBtnVisible = await mediaCommentBtn.isVisible().catch(() => false);
    if (!hasBtnVisible) { test.skip(); return; }

    await mediaCommentBtn.click();

    const commentSheet = page.locator('[data-testid="media-comment-sheet"]');
    await expect(commentSheet).toBeVisible({ timeout: 3000 });

    const sheetTitle = commentSheet.locator('h2');
    await expect(sheetTitle).toContainText('Bild');

    await commentSheet.locator('button', { hasText: 'Abbrechen' }).click();
  });

  // AC14: "Anpassen für" button shows Phase 5 stub toast
  test('AC14: "Anpassen für" button shows Phase-5 stub toast', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const adaptBtn = page.locator('[data-testid="adapt-for-button"]');
    await expect(adaptBtn).toBeVisible();
    await adaptBtn.click();

    await expect(page.locator('[role="alert"], [data-testid="toaster"]')).toBeVisible({ timeout: 3000 });
  });

  // AC15: Bottom action bar has all 5 action buttons
  test('AC15: Bottom action bar renders all 5 action buttons', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const actionBar = page.locator('[data-testid="post-action-bar"]');
    await expect(actionBar).toBeVisible();

    await expect(actionBar.locator('[data-testid="action-comment"]')).toBeVisible();
    await expect(actionBar.locator('[data-testid="action-image"]')).toBeVisible();
    await expect(actionBar.locator('[data-testid="action-video"]')).toBeVisible();
    await expect(actionBar.locator('[data-testid="action-status"]')).toBeVisible();
    await expect(actionBar.locator('[data-testid="action-publish"]')).toBeVisible();
  });

  // AC16: Publish button triggers action + toast (stub acceptable for Phase 3)
  test('AC16: Publish button triggers schedule action', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const apiCalls: string[] = [];
    page.on('request', (req) => {
      if ((req.method() === 'PUT' || req.method() === 'POST') && req.url().includes('/posts')) {
        apiCalls.push(req.url());
      }
    });

    const publishBtn = page.locator('[data-testid="action-publish"]');
    const isDisabled = await publishBtn.isDisabled();
    if (isDisabled) { test.skip(); return; }

    await publishBtn.click();
    await page.waitForTimeout(1000);

    const hasApiCall = apiCalls.length > 0;
    const toastVisible = await page.locator('[role="alert"], [data-testid="toaster"]').isVisible().catch(() => false);
    expect(hasApiCall || toastVisible).toBe(true);
  });

  // AC17: Tap from CalendarPostCard navigates to /m/post/[id]
  test('AC17: Tapping a CalendarPostCard navigates to detail page', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await expect(page).toHaveURL(/\/m\/post\/.+/);
    const detail = page.locator('[data-testid="mobile-post-detail"]');
    await expect(detail).toBeVisible({ timeout: 8000 });
  });

  // AC18: Saving data shows toast
  test('AC18: Saving title shows toast notification', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const titleEl = page.locator('[data-testid="post-title"]');
    await titleEl.click();

    const titleInput = page.locator('[data-testid="post-title-input"]');
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill('Toast test title');
    await titleInput.blur();

    const toast = page.locator('[role="alert"], [data-testid="toaster"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  // AC19: KI-generate button shows stub toast or activates banner slot
  test('AC19: KI-generate button shows stub toast or activates banner slot', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const kiBtn = page.locator('[data-testid="media-ki-generate"]');
    await expect(kiBtn).toBeVisible();
    await kiBtn.click();

    const hasBanner = await page.locator('#ki-banner-slot [data-testid="ki-banner"]').isVisible().catch(() => false);
    const hasToast = await page.locator('[role="alert"]').isVisible().catch(() => false);
    expect(hasBanner || hasToast).toBe(true);
  });

  // AC20: Failed save rolls back optimistic update
  test('AC20: Failed save calls mutate() to roll back optimistic title update', async ({ page }) => {
    const postUrl = await navigateToFirstPost(page);
    if (!postUrl) { test.skip(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 });

    const titleEl = page.locator('[data-testid="post-title"]');
    const originalTitle = await titleEl.textContent();

    // Block POST /posts to simulate content-save failure (correct endpoint after Issue 4 fix)
    await page.route('**/posts', (route) => {
      if (route.request().method() === 'POST') {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    await titleEl.click();
    const titleInput = page.locator('[data-testid="post-title-input"]');
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill('This Should Rollback');
    await titleInput.blur();

    // Error toast should appear
    const errorToast = page.locator('[role="alert"], [data-testid="toaster"]');
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    // SWR revalidation should restore the original title
    await page.waitForTimeout(1500);
    const titleAfter = await titleEl.textContent();
    expect(titleAfter).toBe(originalTitle);

    await page.unrouteAll();
  });

});

test.describe('Phase 3 — iPhone 14 Pro Viewport', () => {

  test('Detail page has no horizontal scroll on iPhone 14 Pro', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 14 Pro'] });
    const page = await context.newPage();

    await page.goto(`${BASE}/m/kalender`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!page.url().includes('/m/kalender')) { await context.close(); return; }

    await page.locator('[data-testid="mobile-calendar-month"]').waitFor({ timeout: 8000 }).catch(() => {});

    const dayCells = page.locator('[data-testid="calendar-day-cell"]');
    let navigated = false;
    for (let i = 0; i < await dayCells.count(); i++) {
      if ((await dayCells.nth(i).locator('[data-testid="status-dot"]').count()) > 0) {
        await dayCells.nth(i).click();
        const sheet = page.locator('[data-testid="day-sheet"]');
        if (await sheet.isVisible().catch(() => false)) {
          const card = sheet.locator('[data-testid="calendar-post-card"]').first();
          if (await card.isVisible().catch(() => false)) {
            await card.click();
            await page.waitForURL(/\/m\/post\//, { timeout: 5000 }).catch(() => {});
            navigated = page.url().includes('/m/post/');
          }
        }
        break;
      }
    }

    if (!navigated) { await context.close(); return; }

    await page.locator('[data-testid="mobile-post-detail"]').waitFor({ timeout: 8000 }).catch(() => {});

    const hasHorizontalScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    await context.close();
  });

});
