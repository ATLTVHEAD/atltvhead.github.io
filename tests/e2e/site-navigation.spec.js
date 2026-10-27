import { expect, test } from '@playwright/test';

test('siteNavigation_indexOpensSkateCity', async ({ page }) => {
  await page.goto('/');

  const skateLink = page.getByRole('link', { name: 'Skate City', exact: true });
  await expect(skateLink).toBeVisible();
  await skateLink.click();

  await expect(page).toHaveURL(/\/skate\.html$/);
  await expect(page.getByRole('heading', { name: 'TVHead Skate City' })).toBeVisible();
});

test('siteNavigation_portfolioOpensSkateCity', async ({ page }) => {
  await page.goto('/portfolio.html');

  const skateLink = page.getByRole('link', { name: 'Skate City', exact: true });
  await expect(skateLink).toBeVisible();
  await skateLink.click();

  await expect(page).toHaveURL(/\/skate\.html$/);
  await expect(page.getByRole('heading', { name: 'TVHead Skate City' })).toBeVisible();
});

test('siteNavigation_keepsViewerAndPortfolioContent', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#three-canvas')).toBeAttached();
  await expect(page.getByRole('link', { name: '3D Viewer' })).toBeVisible();

  await page.goto('/portfolio.html');
  await expect(page.getByRole('heading', { name: 'Portfolio', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /View Project/ }).first()).toBeVisible();
});
