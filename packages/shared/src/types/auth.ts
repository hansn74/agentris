import { z } from 'zod';

export const UserRoleEnum = z.enum(['CONSULTANT', 'MANAGER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: UserRoleEnum,
  emailVerified: z.date().nullable(),
  createdAt: z.date(),
  lastActive: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: UserRoleEnum,
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export interface AuthSession {
  user: SessionUser;
  expires: string;
}

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: UserRoleEnum.default('CONSULTANT'),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const PasswordResetInputSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type PasswordResetInput = z.infer<typeof PasswordResetInputSchema>;
