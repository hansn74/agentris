import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { appRouter } from '../routers';
import { prisma } from '@agentris/db';
import { hash } from 'bcryptjs';

// Mock Prisma
vi.mock('@agentris/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  Role: {
    CONSULTANT: 'CONSULTANT',
    MANAGER: 'MANAGER',
    ADMIN: 'ADMIN',
  },
}));

describe('Auth Router', () => {
  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createInnerTRPCContext({ session: null });
    caller = appRouter.createCaller(ctx);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const input = {
        email: 'test@example.com',
        password: 'TestPass123!',
        name: 'Test User',
        role: 'CONSULTANT' as const,
      };

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue({
        id: 'user-123',
        email: input.email,
        name: input.name,
        role: input.role,
        createdAt: new Date(),
      });
      (prisma.verificationToken.create as any).mockResolvedValue({});

      const result = await caller.auth.register(input);

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(input.email);
      expect(result.user.name).toBe(input.name);
      expect(result.user.role).toBe(input.role);
    });

    it('should throw error if user already exists', async () => {
      const input = {
        email: 'existing@example.com',
        password: 'TestPass123!',
        name: 'Existing User',
        role: 'CONSULTANT' as const,
      };

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'existing-user',
        email: input.email,
      });

      await expect(caller.auth.register(input)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should validate email format', async () => {
      const input = {
        email: 'invalid-email',
        password: 'TestPass123!',
        name: 'Test User',
        role: 'CONSULTANT' as const,
      };

      await expect(caller.auth.register(input)).rejects.toThrow();
    });

    it('should validate password length', async () => {
      const input = {
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
        role: 'CONSULTANT' as const,
      };

      await expect(caller.auth.register(input)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const hashedPassword = await hash('TestPass123!', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'CONSULTANT',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.user.update as any).mockResolvedValue(mockUser);

      const result = await caller.auth.login({
        email: 'test@example.com',
        password: 'TestPass123!',
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.role).toBe(mockUser.role);
    });

    it('should throw error for invalid credentials', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(
        caller.auth.login({
          email: 'nonexistent@example.com',
          password: 'WrongPass123!',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for wrong password', async () => {
      const hashedPassword = await hash('CorrectPass123!', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'WrongPass123!',
        })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('requestPasswordReset', () => {
    it('should create password reset token for existing user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.findFirst as any).mockResolvedValue(null);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      const result = await caller.auth.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });

    it('should not reveal if user does not exist', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await caller.auth.requestPasswordReset({
        email: 'nonexistent@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('If an account exists');
    });

    it('should handle rate limiting', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const existingToken = {
        id: 'token-123',
        userId: 'user-123',
        expires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.findFirst as any).mockResolvedValue(existingToken);

      const result = await caller.auth.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already been sent');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockToken = {
        id: 'token-123',
        token: 'valid-token',
        userId: 'user-123',
        used: false,
        expires: new Date(Date.now() + 3600000), // 1 hour from now
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockToken);
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.passwordResetToken.update as any).mockResolvedValue({});

      const result = await caller.auth.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'token-123' },
        data: { used: true },
      });
    });

    it('should throw error for invalid token', async () => {
      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);

      await expect(
        caller.auth.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPass123!',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw error for expired token', async () => {
      const mockToken = {
        id: 'token-123',
        token: 'expired-token',
        userId: 'user-123',
        used: false,
        expires: new Date(Date.now() - 3600000), // 1 hour ago
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockToken);

      await expect(
        caller.auth.resetPassword({
          token: 'expired-token',
          newPassword: 'NewPass123!',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw error for used token', async () => {
      const mockToken = {
        id: 'token-123',
        token: 'used-token',
        userId: 'user-123',
        used: true,
        expires: new Date(Date.now() + 3600000),
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockToken);

      await expect(
        caller.auth.resetPassword({
          token: 'used-token',
          newPassword: 'NewPass123!',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const mockToken = {
        id: 'token-123',
        token: 'valid-token',
        userId: 'user-123',
        expires: new Date(Date.now() + 86400000), // 24 hours from now
      };

      (prisma.verificationToken.findUnique as any).mockResolvedValue(mockToken);
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.verificationToken.delete as any).mockResolvedValue({});

      const result = await caller.auth.verifyEmail({
        token: 'valid-token',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { emailVerified: expect.any(Date) },
      });
    });

    it('should throw error for invalid token', async () => {
      (prisma.verificationToken.findUnique as any).mockResolvedValue(null);

      await expect(
        caller.auth.verifyEmail({
          token: 'invalid-token',
        })
      ).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('Protected Routes', () => {
    it('should throw unauthorized error for protected routes without session', async () => {
      await expect(caller.auth.logout()).rejects.toThrow('UNAUTHORIZED');
    });

    it('should allow access to protected routes with valid session', async () => {
      // Mock the session deleteMany to succeed
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 1 });

      const authenticatedCtx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            image: null,
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const authenticatedCaller = appRouter.createCaller(authenticatedCtx);
      const result = await authenticatedCaller.auth.logout();

      expect(result.success).toBe(true);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should retrieve user data with getMe', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CONSULTANT',
        emailVerified: new Date(),
        createdAt: new Date(),
        lastActive: new Date(),
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const authenticatedCtx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            image: null,
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const authenticatedCaller = appRouter.createCaller(authenticatedCtx);
      const result = await authenticatedCaller.auth.getMe();

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.role).toBe(mockUser.role);
    });
  });
});
