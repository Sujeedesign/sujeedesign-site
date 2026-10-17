import { expect, test } from '@playwright/test';

test('inserts a typed theme section and restores its GrapesJS project JSON', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor));

  const block = page.locator('#visual-blocks .gjs-block');
  await expect(block).toHaveCount(1);
  await block.click();

  const canvas = page.frameLocator('iframe.gjs-frame');
  const section = canvas.locator('[data-sjd-section="pilot-demo"]');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-sjd-field="title"]')).toHaveText('Titre de départ');

  const project = await page.evaluate(() => window.sjdVisualEditor.getProjectData());
  expect(JSON.stringify(project)).toContain('sjd-demo-section');
  await page.evaluate((data) => window.sjdVisualEditor.loadProjectData(data), project);
  await expect(canvas.locator('[data-sjd-section="pilot-demo"] [data-sjd-field="title"]'))
    .toHaveText('Titre de départ');
});

test('the allowed title trait updates the themed canvas without exposing style editing', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor));
  const block = page.locator('#visual-blocks .gjs-block');
  await block.click();

  const titleTrait = page.locator('#visual-traits input').first();
  await expect(titleTrait).toBeVisible();
  await titleTrait.fill('Titre édité');
  await titleTrait.press('Tab');
  await expect(titleTrait).toHaveValue('Titre édité');
  await expect(page.frameLocator('iframe.gjs-frame').locator('[data-sjd-field="title"]'))
    .toHaveText('Titre édité');
  await expect(page.locator('#visual-styles')).toBeEmpty();
});
