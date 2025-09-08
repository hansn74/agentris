import { prisma } from '@agentris/db';
import { TRPCError } from '@trpc/server';

// Session configuration constants
export const SESSION_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  cleanupInterval: 60 * 60 * 1000, // Clean up expired sessions every hour
} as const;

export class SessionManager {
  /**
   * Invalidate a specific session
   */
  static async invalidateSession(sessionToken: string): Promise<void> {
    try {
      await prisma.session.delete({
        where: { sessionToken },
      });
    } catch {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to invalidate session',
      });
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: { userId },
      });
    } catch {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to invalidate user sessions',
      });
    }
  }

  /**
   * Check if a session is valid and not expired
   */
  static async validateSession(sessionToken: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return false;
    }

    const now = new Date();
    if (session.expires < now) {
      // Session expired, clean it up
      await this.invalidateSession(sessionToken);
      return false;
    }

    return true;
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get active session count for a user
   */
  static async getUserSessionCount(userId: string): Promise<number> {
    return await prisma.session.count({
      where: {
        userId,
        expires: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Extend session expiration
   */
  static async extendSession(sessionToken: string): Promise<void> {
    const newExpiry = new Date(Date.now() + SESSION_CONFIG.maxAge);

    await prisma.session.update({
      where: { sessionToken },
      data: { expires: newExpiry },
    });
  }
}

// Set up periodic cleanup of expired sessions
if (
  process.env.NODE_ENV !== 'test' &&
  typeof globalThis !== 'undefined' &&
  typeof globalThis.setInterval === 'function'
) {
  globalThis.setInterval(async () => {
    try {
      const count = await SessionManager.cleanupExpiredSessions();
      if (count > 0) {
        console.log(`[SESSION] Cleaned up ${count} expired sessions`);
      }
    } catch (error) {
      console.error('[SESSION] Failed to clean up expired sessions:', error);
    }
  }, SESSION_CONFIG.cleanupInterval);
}
