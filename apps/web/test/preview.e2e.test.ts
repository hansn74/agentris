import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: any) {
  await page.goto('/auth/signin');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'testpassword');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

test.describe('Preview System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test.describe('Preview Generation', () => {
    test('should generate preview for all field types', async ({ page }) => {
      // Navigate to ticket details
      await page.goto('/dashboard/tickets/test-ticket-1');
      
      // Click generate preview button
      await page.click('button:has-text("Generate Preview")');
      
      // Wait for preview to be generated
      await page.waitForSelector('[data-testid="preview-panel"]', { timeout: 10000 });
      
      // Verify field previews are displayed
      await expect(page.locator('[data-testid="field-preview"]')).toHaveCount(5);
      
      // Check different field types
      await expect(page.locator('text=Text field')).toBeVisible();
      await expect(page.locator('text=Number field')).toBeVisible();
      await expect(page.locator('text=Date field')).toBeVisible();
      await expect(page.locator('text=Picklist field')).toBeVisible();
      await expect(page.locator('text=Checkbox field')).toBeVisible();
    });

    test('should display validation rules clearly', async ({ page }) => {
      await page.goto('/dashboard/tickets/test-ticket-2');
      await page.click('button:has-text("Generate Preview")');
      
      await page.waitForSelector('[data-testid="validation-rule-preview"]');
      
      // Check validation rule display
      const validationRule = page.locator('[data-testid="validation-rule-preview"]').first();
      await expect(validationRule).toContainText('Validation Rule');
      await expect(validationRule).toContainText('Error Message');
      await expect(validationRule).toContainText('Formula');
    });

    test('should show field properties in readable format', async ({ page }) => {
      await page.goto('/dashboard/tickets/test-ticket-3');
      await page.click('button:has-text("Generate Preview")');
      
      // Click on a field to see details
      await page.click('[data-testid="field-preview"]:first-child');
      
      // Check field properties panel
      const propertiesPanel = page.locator('[data-testid="field-properties"]');
      await expect(propertiesPanel).toBeVisible();
      await expect(propertiesPanel).toContainText('Type:');
      await expect(propertiesPanel).toContainText('Required:');
      await expect(propertiesPanel).toContainText('Length:');
      await expect(propertiesPanel).toContainText('Description:');
    });
  });

  test.describe('Impact Analysis', () => {
    test('should highlight potential impacts', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-1');
      
      // Check impact indicators
      await expect(page.locator('[data-testid="impact-high"]')).toBeVisible();
      await expect(page.locator('[data-testid="impact-medium"]')).toBeVisible();
      await expect(page.locator('[data-testid="impact-low"]')).toBeVisible();
      
      // Verify risk score
      const riskScore = page.locator('[data-testid="risk-score"]');
      await expect(riskScore).toBeVisible();
      await expect(riskScore).toContainText(/\d+%/);
    });

    test('should show dependencies and conflicts', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-2');
      
      // Click on impact analysis tab
      await page.click('button:has-text("Impact Analysis")');
      
      // Check for dependency warnings
      await expect(page.locator('[data-testid="dependency-warning"]')).toHaveCount(2);
      
      // Check for conflict indicators
      await expect(page.locator('[data-testid="conflict-indicator"]')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update preview when requirements change', async ({ page, context }) => {
      await page.goto('/dashboard/tickets/test-ticket-4');
      
      // Generate initial preview
      await page.click('button:has-text("Generate Preview")');
      await page.waitForSelector('[data-testid="preview-panel"]');
      
      // Open a second tab to simulate another user updating
      const page2 = await context.newPage();
      await login(page2);
      await page2.goto('/dashboard/tickets/test-ticket-4');
      
      // Update requirements in second tab
      await page2.click('button:has-text("Edit Requirements")');
      await page2.fill('textarea[name="requirements"]', 'Updated requirements with new field');
      await page2.click('button:has-text("Save")');
      
      // First page should receive real-time update
      await expect(page.locator('text=Preview updated')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="field-preview"]')).toHaveCount(6); // One more field
    });

    test('should receive notifications for preview events', async ({ page }) => {
      await page.goto('/dashboard/tickets/test-ticket-5');
      
      // Generate preview
      await page.click('button:has-text("Generate Preview")');
      
      // Should see toast notification
      await expect(page.locator('[data-testid="toast"]:has-text("Preview Generated")')).toBeVisible();
      
      // Wait for preview to expire (simulated)
      await page.evaluate(() => {
        // Simulate preview expiration event
        window.dispatchEvent(new CustomEvent('preview:expired', { detail: { previewId: 'test' } }));
      });
      
      await expect(page.locator('[data-testid="toast"]:has-text("Preview Expired")')).toBeVisible();
    });
  });

  test.describe('Side-by-side Comparison', () => {
    test('should display current vs proposed state', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-3');
      
      // Click comparison view
      await page.click('button:has-text("Compare Changes")');
      
      // Check for diff viewer
      const diffViewer = page.locator('[data-testid="diff-viewer"]');
      await expect(diffViewer).toBeVisible();
      
      // Verify both sides are shown
      await expect(diffViewer.locator('[data-testid="current-state"]')).toBeVisible();
      await expect(diffViewer.locator('[data-testid="proposed-state"]')).toBeVisible();
      
      // Check for change indicators
      await expect(diffViewer.locator('.added')).toHaveCount(3);
      await expect(diffViewer.locator('.modified')).toHaveCount(2);
    });

    test('should highlight differences clearly', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-4');
      await page.click('button:has-text("Compare Changes")');
      
      // Check color coding
      await expect(page.locator('.added').first()).toHaveCSS('background-color', /green/i);
      await expect(page.locator('.removed').first()).toHaveCSS('background-color', /red/i);
      await expect(page.locator('.modified').first()).toHaveCSS('background-color', /yellow/i);
    });
  });

  test.describe('Performance', () => {
    test('should handle large metadata sets', async ({ page }) => {
      // Navigate to ticket with large metadata
      await page.goto('/dashboard/tickets/test-ticket-large');
      
      // Measure preview generation time
      const startTime = Date.now();
      await page.click('button:has-text("Generate Preview")');
      await page.waitForSelector('[data-testid="preview-complete"]');
      const endTime = Date.now();
      
      // Should complete within 5 seconds even for large sets
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Verify all items are rendered
      await expect(page.locator('[data-testid="field-preview"]')).toHaveCount(100);
      
      // Check pagination is working
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    });

    test('should lazy load preview items', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-large');
      
      // Initially should only load visible items
      const initialItems = await page.locator('[data-testid="preview-item"]:visible').count();
      expect(initialItems).toBeLessThanOrEqual(20);
      
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      
      // More items should be loaded
      const afterScrollItems = await page.locator('[data-testid="preview-item"]:visible').count();
      expect(afterScrollItems).toBeGreaterThan(initialItems);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle preview generation failures gracefully', async ({ page }) => {
      await page.goto('/dashboard/tickets/test-ticket-error');
      
      // Try to generate preview (will fail)
      await page.click('button:has-text("Generate Preview")');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=Failed to generate preview')).toBeVisible();
      
      // Retry button should be available
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle WebSocket disconnection', async ({ page, context }) => {
      await page.goto('/dashboard/tickets/test-ticket-6');
      
      // Disconnect WebSocket (simulate network issue)
      await context.route('ws://localhost:3001', route => route.abort());
      
      // Should show disconnection indicator
      await expect(page.locator('[data-testid="connection-status"]:has-text("Disconnected")')).toBeVisible();
      
      // Should still be able to use HTTP fallback
      await page.click('button:has-text("Generate Preview")');
      await expect(page.locator('[data-testid="preview-panel"]')).toBeVisible();
    });
  });

  test.describe('Preview Management', () => {
    test('should extend preview expiration', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-expiring');
      
      // Check expiration warning
      await expect(page.locator('[data-testid="expiration-warning"]')).toBeVisible();
      
      // Extend preview
      await page.click('button:has-text("Extend Preview")');
      await page.selectOption('select[name="duration"]', '7'); // 7 days
      await page.click('button:has-text("Confirm")');
      
      // Warning should disappear
      await expect(page.locator('[data-testid="expiration-warning"]')).not.toBeVisible();
      
      // New expiration date should be shown
      await expect(page.locator('text=/Expires in 7 days/')).toBeVisible();
    });

    test('should delete preview', async ({ page }) => {
      await page.goto('/dashboard/preview/test-preview-delete');
      
      // Delete preview
      await page.click('button:has-text("Delete Preview")');
      await page.click('button:has-text("Confirm Delete")');
      
      // Should redirect to ticket page
      await page.waitForURL(/\/dashboard\/tickets\//);
      
      // Preview should no longer be in list
      await page.click('button:has-text("View Previews")');
      await expect(page.locator('text=test-preview-delete')).not.toBeVisible();
    });
  });
});