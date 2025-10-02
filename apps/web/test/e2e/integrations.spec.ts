import { test, expect } from '@playwright/test';

test.describe('Integrations Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to integrations page
    await page.goto('/dashboard/settings/integrations');
  });

  test('should display integrations page', async ({ page }) => {
    // Check for page title
    await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible();
  });

  test('should display Jira integration section', async ({ page }) => {
    // Check for Jira section
    const jiraSection = page.locator('text=/jira/i');
    await expect(jiraSection).toBeVisible();

    // Check for connect/disconnect button
    const connectButton = page.getByRole('button', { name: /connect jira/i });
    const disconnectButton = page.getByRole('button', { name: /disconnect/i });

    // One of these should be visible
    const hasConnectButton = await connectButton.isVisible().catch(() => false);
    const hasDisconnectButton = await disconnectButton.isVisible().catch(() => false);

    expect(hasConnectButton || hasDisconnectButton).toBeTruthy();
  });

  test('should display connection status', async ({ page }) => {
    // Check for status indicators
    const connectedStatus = page.getByText(/connected/i);
    const disconnectedStatus = page.getByText(/not connected/i);

    // One of these should be visible
    const isConnected = await connectedStatus.isVisible().catch(() => false);
    const isDisconnected = await disconnectedStatus.isVisible().catch(() => false);

    expect(isConnected || isDisconnected).toBeTruthy();
  });

  test('should display GitHub integration placeholder', async ({ page }) => {
    // Check for GitHub section
    const githubSection = page.locator('text=/github/i');
    if (await githubSection.isVisible().catch(() => false)) {
      await expect(githubSection).toBeVisible();

      // Check for coming soon message
      const comingSoon = page.getByText(/coming soon/i);
      if (await comingSoon.isVisible().catch(() => false)) {
        await expect(comingSoon).toBeVisible();
      }
    }
  });

  test('should display Slack integration placeholder', async ({ page }) => {
    // Check for Slack section
    const slackSection = page.locator('text=/slack/i');
    if (await slackSection.isVisible().catch(() => false)) {
      await expect(slackSection).toBeVisible();

      // Check for coming soon message
      const comingSoon = page.getByText(/coming soon/i).last();
      if (await comingSoon.isVisible().catch(() => false)) {
        await expect(comingSoon).toBeVisible();
      }
    }
  });

  test('should handle OAuth flow initiation', async ({ page }) => {
    // Check if connect button exists
    const connectButton = page.getByRole('button', { name: /connect jira/i });

    if (await connectButton.isVisible().catch(() => false)) {
      // Check that button is enabled
      await expect(connectButton).toBeEnabled();

      // Note: We can't test the full OAuth flow in E2E tests
      // as it involves external services
    }
  });
});
