"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetInputSchema = exports.RegisterInputSchema = exports.LoginInputSchema = exports.SessionUserSchema = exports.UserSchema = exports.UserRoleEnum = void 0;
const zod_1 = require("zod");
exports.UserRoleEnum = zod_1.z.enum(['CONSULTANT', 'MANAGER', 'ADMIN']);
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().nullable(),
    role: exports.UserRoleEnum,
    emailVerified: zod_1.z.date().nullable(),
    createdAt: zod_1.z.date(),
    lastActive: zod_1.z.date(),
});
exports.SessionUserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().nullable(),
    role: exports.UserRoleEnum,
});
exports.LoginInputSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.RegisterInputSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    name: zod_1.z.string().min(1, 'Name is required'),
    role: exports.UserRoleEnum.default('CONSULTANT'),
});
exports.PasswordResetInputSchema = zod_1.z.object({
    token: zod_1.z.string(),
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
//# sourceMappingURL=auth.js.map