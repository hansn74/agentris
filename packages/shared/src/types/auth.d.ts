import { z } from 'zod';
export declare const UserRoleEnum: z.ZodEnum<["CONSULTANT", "MANAGER", "ADMIN"]>;
export type UserRole = z.infer<typeof UserRoleEnum>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["CONSULTANT", "MANAGER", "ADMIN"]>;
    emailVerified: z.ZodNullable<z.ZodDate>;
    createdAt: z.ZodDate;
    lastActive: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    name: string | null;
    email: string;
    role: "CONSULTANT" | "MANAGER" | "ADMIN";
    emailVerified: Date | null;
    lastActive: Date;
}, {
    id: string;
    createdAt: Date;
    name: string | null;
    email: string;
    role: "CONSULTANT" | "MANAGER" | "ADMIN";
    emailVerified: Date | null;
    lastActive: Date;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const SessionUserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["CONSULTANT", "MANAGER", "ADMIN"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string | null;
    email: string;
    role: "CONSULTANT" | "MANAGER" | "ADMIN";
}, {
    id: string;
    name: string | null;
    email: string;
    role: "CONSULTANT" | "MANAGER" | "ADMIN";
}>;
export type SessionUser = z.infer<typeof SessionUserSchema>;
export interface AuthSession {
    user: SessionUser;
    expires: string;
}
export declare const LoginInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export declare const RegisterInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["CONSULTANT", "MANAGER", "ADMIN"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    role: "CONSULTANT" | "MANAGER" | "ADMIN";
    password: string;
}, {
    name: string;
    email: string;
    password: string;
    role?: "CONSULTANT" | "MANAGER" | "ADMIN" | undefined;
}>;
export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export declare const PasswordResetInputSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    newPassword: string;
}, {
    token: string;
    newPassword: string;
}>;
export type PasswordResetInput = z.infer<typeof PasswordResetInputSchema>;
//# sourceMappingURL=auth.d.ts.map