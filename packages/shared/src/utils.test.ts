import { describe, it, expect } from 'vitest';
import { formatDate, capitalize, isValidEmail } from './utils';

describe('formatDate', () => {
  it('should format date to YYYY-MM-DD', () => {
    const date = new Date('2024-03-15T10:30:00Z');
    expect(formatDate(date)).toBe('2024-03-15');
  });
});

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('World');
    expect(capitalize('')).toBe('');
  });
});

describe('isValidEmail', () => {
  it('should validate email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
  });
});
