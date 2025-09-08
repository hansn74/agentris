import { describe, it, expect } from 'vitest';
import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken, verifyRefreshToken } from '../callbacks';

describe('Auth Callbacks', () => {
  describe('Token Generation', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken('user-123', 'test@example.com', 'CONSULTANT');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify a valid refresh token', () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      // Generate a token using the same method as in callbacks with test secret
      const token = jwt.sign(
        { userId, email, type: 'refresh' },
        process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!,
        { expiresIn: '7d' }
      );

      const decoded = verifyRefreshToken(token);
      expect(decoded).toBeDefined();
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(userId);
      expect(decoded?.email).toBe(email);
      expect(decoded?.type).toBe('refresh');
    });

    it('should return null for invalid refresh token', () => {
      const decoded = verifyRefreshToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('Password Hashing', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hash(password, 12);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);

      const isValid = await compare(password, hashedPassword);
      expect(isValid).toBe(true);

      const isInvalid = await compare('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });
});
