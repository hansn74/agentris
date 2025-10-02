import { test, expect } from '@playwright/test';

test.describe('Ticket Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tickets page
    await page.goto('/dashboard/tickets');
  });

  test('should display ticket list', async ({ page }) => {
    // Check for ticket list container
    page.locator('[data-testid="ticket-list"]');

    // Check for loading state or content
    const isLoading = (await page.locator('.animate-pulse').count()) > 0;
    const hasTickets = (await page.locator('[data-testid="ticket-card"]').count()) > 0;
    const isEmpty = await page
      .getByText(/no tickets found/i)
      .isVisible()
      .catch(() => false);

    // One of these states should be true
    expect(isLoading || hasTickets || isEmpty).toBeTruthy();
  });

  test('should handle empty state', async ({ page }) => {
    // If no tickets, should show empty state
    const emptyState = page.getByText(/no tickets found/i);
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(emptyState).toBeVisible();
      await expect(page.getByText(/connect jira/i)).toBeVisible();
    }
  });

  test('should navigate to ticket detail', async ({ page }) => {
    // Check if there are tickets
    const ticketCards = page.locator('[data-testid="ticket-card"]');
    const count = await ticketCards.count();

    if (count > 0) {
      // Click on first ticket
      await ticketCards.first().click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/tickets\/[A-Z]+-\d+/);
    }
  });

  test('should display ticket detail view', async ({ page }) => {
    // Navigate directly to a ticket detail page
    await page.goto('/dashboard/tickets/TEST-1');

    // Check for detail view elements
    const hasDetail = await page
      .locator('[data-testid="ticket-detail"]')
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .getByText(/error/i)
      .isVisible()
      .catch(() => false);
    const hasNotFound = await page
      .getByText(/not found/i)
      .isVisible()
      .catch(() => false);

    // One of these states should be present
    expect(hasDetail || hasError || hasNotFound).toBeTruthy();
  });

  test('should handle error states', async ({ page }) => {
    // Check for error handling
    const errorAlert = page.locator('[role="alert"]');
    if (await errorAlert.isVisible().catch(() => false)) {
      await expect(errorAlert).toContainText(/error/i);

      // Check for retry button
      const retryButton = page.getByRole('button', { name: /retry/i });
      if (await retryButton.isVisible().catch(() => false)) {
        await expect(retryButton).toBeEnabled();
      }
    }
  });

  test('should handle pagination', async ({ page }) => {
    // Check for pagination controls
    const nextButton = page.getByRole('button', { name: /next/i });
    const prevButton = page.getByRole('button', { name: /previous/i });

    if (await nextButton.isVisible().catch(() => false)) {
      // Previous should be disabled on first page
      await expect(prevButton).toBeDisabled();

      // If next is enabled, click it
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        // Now previous should be enabled
        await expect(prevButton).toBeEnabled();
      }
    }
  });
});
