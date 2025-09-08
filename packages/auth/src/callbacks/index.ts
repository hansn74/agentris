import type { CallbacksOptions } from 'next-auth';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@agentris/shared';

// Validate required environment variables at startup - fail fast without fallbacks
if (!process.env.JWT_SECRET && !process.env.NEXTAUTH_SECRET) {
  throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!;

export const authCallbacks: Partial<CallbacksOptions> = {
  async jwt({ token, user, trigger, session }) {
    // Initial sign in
    if (trigger === 'signIn' && user) {
      return {
        ...token,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        refreshToken: generateRefreshToken(user.id, user.email as string),
      };
    }

    // Update session
    if (trigger === 'update' && session) {
      return { ...token, ...session.user };
    }

    return token;
  },

  async session({ session, token }) {
    if (token && session.user) {
      session.user.id = token.id as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      (session.user as { role?: UserRole }).role = token.role as UserRole;
    }
    return session;
  },

  async signIn() {
    // Additional sign-in logic can be added here
    // For example, checking if user is active, not banned, etc.
    return true;
  },

  async redirect({ url, baseUrl }) {
    // Allows relative callback URLs
    if (url.startsWith('/')) return `${baseUrl}${url}`;
    // Allows callback URLs on the same origin
    try {
      const urlObj = new globalThis.URL(url);
      if (urlObj.origin === baseUrl) return url;
    } catch {
      // Invalid URL, return to base
    }
    return baseUrl;
  },
};

function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyRefreshToken(
  token: string
): { userId: string; email: string; type: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null) {
      return decoded as { userId: string; email: string; type: string };
    }
    return null;
  } catch {
    return null;
  }
}

export function generateAccessToken(userId: string, email: string, role: UserRole): string {
  return jwt.sign({ userId, email, role, type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
}
