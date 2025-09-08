import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { hash, compare } from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma, Role } from '@agentris/db';
import { checkRateLimit } from '../middleware/rateLimit';
import { SessionManager } from '../services/sessionManager';
import { BCRYPT_SALT_ROUNDS, TOKEN_EXPIRY, VALIDATION } from '../constants/auth';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z
  .string()
  .min(
    VALIDATION.PASSWORD_MIN_LENGTH,
    `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`
  );

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().min(VALIDATION.NAME_MIN_LENGTH, 'Name is required'),
        role: z.enum(['CONSULTANT', 'MANAGER', 'ADMIN']).default('CONSULTANT'),
      })
    )
    .mutation(async ({ input }) => {
      const { email, password, name, role } = input;

      // Rate limiting
      checkRateLimit(email, 'register');

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email already exists',
        });
      }

      // Hash password
      const hashedPassword = await hash(password, BCRYPT_SALT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: role as Role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      // Create verification token
      const verificationToken = nanoid();
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token: verificationToken,
          expires: new Date(Date.now() + TOKEN_EXPIRY.VERIFICATION),
          userId: user.id,
        },
      });

      // In production, send verification email
      // For MVP, log notification without sensitive data
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUTH] Verification email would be sent to: ${email} (token stored securely)`);
      }

      return {
        success: true,
        user,
        message: 'Registration successful. Please check your email for verification.',
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
      })
    )
    .mutation(async ({ input }) => {
      const { email, password } = input;

      // Rate limiting
      checkRateLimit(email, 'login');

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.password) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      const isValidPassword = await compare(password, user.password);

      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Update last active
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActive: new Date() },
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Invalidate all sessions for the user
    await SessionManager.invalidateUserSessions(ctx.session.user.id);
    return { success: true, message: 'Successfully logged out from all devices' };
  }),

  invalidateAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    // Invalidate all sessions for the current user
    await SessionManager.invalidateUserSessions(ctx.session.user.id);
    return {
      success: true,
      message: 'All sessions have been invalidated. Please log in again.',
    };
  }),

  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: emailSchema,
      })
    )
    .mutation(async ({ input }) => {
      const { email } = input;

      // Rate limiting
      checkRateLimit(email, 'passwordReset');

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists
        return {
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        };
      }

      // Check for existing non-expired tokens
      const existingToken = await prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          used: false,
          expires: { gt: new Date() },
        },
      });

      if (existingToken) {
        // Rate limiting - don't create new token if one exists
        return {
          success: true,
          message: 'A password reset link has already been sent. Please check your email.',
        };
      }

      // Create reset token
      const resetToken = nanoid();
      await prisma.passwordResetToken.create({
        data: {
          token: resetToken,
          userId: user.id,
          expires: new Date(Date.now() + TOKEN_EXPIRY.PASSWORD_RESET),
        },
      });

      // In production, send email
      // For MVP, log notification without sensitive data
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[AUTH] Password reset email would be sent to: ${email} (token stored securely)`
        );
      }

      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ input }) => {
      const { token, newPassword } = input;

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetToken || resetToken.used || resetToken.expires < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token',
        });
      }

      // Hash new password
      const hashedPassword = await hash(newPassword, BCRYPT_SALT_ROUNDS);

      // Update user password
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      // Mark token as used
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });

      return {
        success: true,
        message: 'Password has been reset successfully',
      };
    }),

  verifyEmail: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { token } = input;

      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
      });

      if (!verificationToken || verificationToken.expires < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired verification token',
        });
      }

      // Update user as verified
      if (verificationToken.userId) {
        await prisma.user.update({
          where: { id: verificationToken.userId },
          data: { emailVerified: new Date() },
        });
      }

      // Delete used token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });

      return {
        success: true,
        message: 'Email verified successfully',
      };
    }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        lastActive: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),
});
