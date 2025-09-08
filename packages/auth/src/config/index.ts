import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@agentris/db';
import type { UserRole } from '@agentris/shared';

// Session and JWT configuration constants
const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds
const JWT_REFRESH_EXPIRY = '7d';

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}
if (!process.env.JWT_SECRET && !process.env.NEXTAUTH_SECRET) {
  throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable is required');
}

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || NEXTAUTH_SECRET;

export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },
  jwt: {
    secret: JWT_SECRET,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (trigger === 'signIn' && user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role as UserRole;

        // Generate refresh token
        const refreshToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
          expiresIn: JWT_REFRESH_EXPIRY,
        });

        token.refreshToken = refreshToken;
      }

      // Check token expiration and refresh if needed
      if (trigger === 'update' && token.refreshToken) {
        try {
          const decoded = jwt.verify(token.refreshToken as string, JWT_SECRET) as {
            userId: string;
            email: string;
          };
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
          });

          if (user) {
            token.name = user.name;
            token.email = user.email;
            token.role = user.role as UserRole;
          }
        } catch (error) {
          // Refresh token expired or invalid - return existing token
          console.error('Refresh token validation failed:', error);
        }
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
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  debug: process.env.NODE_ENV === 'development',
};
