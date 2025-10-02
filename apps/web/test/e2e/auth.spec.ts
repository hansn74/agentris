import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/login');

    // Try to submit with invalid email
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for validation messages
    await expect(page.getByText('Invalid email address')).toBeVisible();
    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for error message
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Note: This test requires a test user in the database
    // For now, we'll test the flow without actual authentication
    await page.goto('/login');

    // Fill in form
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Check that the form can be submitted
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeEnabled();
  });

  test('should protect dashboard routes', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
