import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { api } from './trpc/server';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Auth.js v5 expects AUTH_SECRET, but support both for compatibility
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!authSecret && process.env.NODE_ENV === 'production') {
  throw new Error(
    'Authentication secret not found. Please set AUTH_SECRET or NEXTAUTH_SECRET in your .env file'
  );
}

export const { handlers, signIn, signOut, auth }: any = NextAuth({
  secret: authSecret,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        try {
          // Use the tRPC auth.login procedure for actual authentication
          // @ts-expect-error - tRPC type issue
          const result = await api.auth.login({
            email: parsed.data.email,
            password: parsed.data.password,
          });

          if (result.success && result.user) {
            return {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              role: result.user.role,
            };
          }
        } catch (error) {
          // Authentication failed
          console.error('Authentication error:', error);
          return null;
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
