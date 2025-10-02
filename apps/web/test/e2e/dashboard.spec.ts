import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  // Mock authentication for dashboard tests
  test.beforeEach(async ({ page }) => {
    // Set up auth cookie or session
    // This would normally be done with a proper auth setup
    await page.goto('/');
  });

  test('should display main navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for navigation elements
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check for navigation links
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /tickets/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('should toggle mobile sidebar', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Find and click menu button
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Sidebar should be visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Click menu button again to close
    await menuButton.click();
    await expect(sidebar).not.toBeVisible();
  });

  test('should navigate between sections', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to tickets
    await page.getByRole('link', { name: /tickets/i }).click();
    await expect(page).toHaveURL(/\/tickets/);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);

    // Navigate back to dashboard
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    const desktopSidebar = page.locator('aside');
    await expect(desktopSidebar).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    const tabletSidebar = page.locator('aside');
    await expect(tabletSidebar).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    const mobileSidebar = page.locator('aside');
    // Sidebar should be hidden by default on mobile
    await expect(mobileSidebar).not.toBeVisible();
  });
});
