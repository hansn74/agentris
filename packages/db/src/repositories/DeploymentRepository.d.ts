import { PrismaClient, Deployment, DeploymentLog, DeploymentRollback, LogLevel } from '@prisma/client';
import { z } from 'zod';
export declare const CreateDeploymentSchema: z.ZodObject<{
    organizationId: z.ZodString;
    deploymentId: z.ZodString;
    status: z.ZodString;
    metadata: z.ZodAny;
}, z.core.$strip>;
export declare const CreateDeploymentLogSchema: z.ZodObject<{
    deploymentId: z.ZodString;
    level: z.ZodEnum<{
        INFO: "INFO";
        WARNING: "WARNING";
        ERROR: "ERROR";
    }>;
    message: z.ZodString;
    metadata: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const CreateDeploymentRollbackSchema: z.ZodObject<{
    deploymentId: z.ZodString;
    rollbackMetadata: z.ZodAny;
    reason: z.ZodString;
    initiatedBy: z.ZodString;
}, z.core.$strip>;
export declare const UpdateDeploymentStatusSchema: z.ZodObject<{
    deploymentId: z.ZodString;
    status: z.ZodString;
    metadata: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const UpdateRollbackStatusSchema: z.ZodObject<{
    rollbackId: z.ZodString;
    status: z.ZodEnum<{
        PENDING: "PENDING";
        IN_PROGRESS: "IN_PROGRESS";
        COMPLETED: "COMPLETED";
        FAILED: "FAILED";
    }>;
    completedAt: z.ZodOptional<z.ZodDate>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;
export type CreateDeploymentLogInput = z.infer<typeof CreateDeploymentLogSchema>;
export type CreateDeploymentRollbackInput = z.infer<typeof CreateDeploymentRollbackSchema>;
export type UpdateDeploymentStatusInput = z.infer<typeof UpdateDeploymentStatusSchema>;
export type UpdateRollbackStatusInput = z.infer<typeof UpdateRollbackStatusSchema>;
export declare class DeploymentRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    createDeployment(data: CreateDeploymentInput): Promise<Deployment>;
    getDeploymentById(deploymentId: string): Promise<Deployment | null>;
    getDeploymentsByOrganization(organizationId: string): Promise<Deployment[]>;
    updateDeploymentStatus(data: UpdateDeploymentStatusInput): Promise<Deployment>;
    createDeploymentLog(data: CreateDeploymentLogInput): Promise<DeploymentLog>;
    createDeploymentLogs(logs: CreateDeploymentLogInput[]): Promise<void>;
    getDeploymentLogs(deploymentId: string, level?: LogLevel, limit?: number): Promise<DeploymentLog[]>;
    createDeploymentRollback(data: CreateDeploymentRollbackInput): Promise<DeploymentRollback>;
    getRollbackById(rollbackId: string): Promise<DeploymentRollback | null>;
    getRollbacksByDeployment(deploymentId: string): Promise<DeploymentRollback[]>;
    updateRollbackStatus(data: UpdateRollbackStatusInput): Promise<DeploymentRollback>;
    getActiveDeployments(organizationId?: string): Promise<Deployment[]>;
    getDeploymentHistory(userId: string, limit?: number): Promise<Deployment[]>;
    deleteOldLogs(daysToKeep?: number): Promise<number>;
}
//# sourceMappingURL=DeploymentRepository.d.ts.map