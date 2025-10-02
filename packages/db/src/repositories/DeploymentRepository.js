"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentRepository = exports.UpdateRollbackStatusSchema = exports.UpdateDeploymentStatusSchema = exports.CreateDeploymentRollbackSchema = exports.CreateDeploymentLogSchema = exports.CreateDeploymentSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
// Validation schemas
exports.CreateDeploymentSchema = zod_1.z.object({
    organizationId: zod_1.z.string(),
    deploymentId: zod_1.z.string(),
    status: zod_1.z.string(),
    metadata: zod_1.z.any(),
});
exports.CreateDeploymentLogSchema = zod_1.z.object({
    deploymentId: zod_1.z.string(),
    level: zod_1.z.nativeEnum(client_1.LogLevel),
    message: zod_1.z.string(),
    metadata: zod_1.z.any().optional(),
});
exports.CreateDeploymentRollbackSchema = zod_1.z.object({
    deploymentId: zod_1.z.string(),
    rollbackMetadata: zod_1.z.any(),
    reason: zod_1.z.string(),
    initiatedBy: zod_1.z.string(),
});
exports.UpdateDeploymentStatusSchema = zod_1.z.object({
    deploymentId: zod_1.z.string(),
    status: zod_1.z.string(),
    metadata: zod_1.z.any().optional(),
});
exports.UpdateRollbackStatusSchema = zod_1.z.object({
    rollbackId: zod_1.z.string(),
    status: zod_1.z.nativeEnum(client_1.RollbackStatus),
    completedAt: zod_1.z.date().optional(),
    error: zod_1.z.string().optional(),
});
class DeploymentRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    // Deployment CRUD operations
    async createDeployment(data) {
        const validated = exports.CreateDeploymentSchema.parse(data);
        return this.prisma.deployment.create({
            data: validated,
            include: {
                organization: true,
            },
        });
    }
    async getDeploymentById(deploymentId) {
        return this.prisma.deployment.findUnique({
            where: { deploymentId },
            include: {
                organization: true,
                logs: {
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
                rollbacks: true,
            },
        });
    }
    async getDeploymentsByOrganization(organizationId) {
        return this.prisma.deployment.findMany({
            where: { organizationId },
            include: {
                organization: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateDeploymentStatus(data) {
        const validated = exports.UpdateDeploymentStatusSchema.parse(data);
        const updateData = {
            status: validated.status,
        };
        if (validated.metadata) {
            updateData.metadata = validated.metadata;
        }
        return this.prisma.deployment.update({
            where: { deploymentId: validated.deploymentId },
            data: updateData,
            include: {
                organization: true,
            },
        });
    }
    // DeploymentLog operations
    async createDeploymentLog(data) {
        const validated = exports.CreateDeploymentLogSchema.parse(data);
        return this.prisma.deploymentLog.create({
            data: validated,
        });
    }
    async createDeploymentLogs(logs) {
        const validated = logs.map(log => exports.CreateDeploymentLogSchema.parse(log));
        await this.prisma.deploymentLog.createMany({
            data: validated,
        });
    }
    async getDeploymentLogs(deploymentId, level, limit = 100) {
        const where = { deploymentId };
        if (level) {
            where.level = level;
        }
        return this.prisma.deploymentLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    // DeploymentRollback operations
    async createDeploymentRollback(data) {
        const validated = exports.CreateDeploymentRollbackSchema.parse(data);
        return this.prisma.deploymentRollback.create({
            data: {
                ...validated,
                status: client_1.RollbackStatus.PENDING,
            },
            include: {
                deployment: true,
                user: true,
            },
        });
    }
    async getRollbackById(rollbackId) {
        return this.prisma.deploymentRollback.findUnique({
            where: { id: rollbackId },
            include: {
                deployment: true,
                user: true,
            },
        });
    }
    async getRollbacksByDeployment(deploymentId) {
        return this.prisma.deploymentRollback.findMany({
            where: { deploymentId },
            include: {
                user: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateRollbackStatus(data) {
        const validated = exports.UpdateRollbackStatusSchema.parse(data);
        const updateData = {
            status: validated.status,
        };
        if (validated.completedAt) {
            updateData.completedAt = validated.completedAt;
        }
        if (validated.error) {
            updateData.error = validated.error;
        }
        return this.prisma.deploymentRollback.update({
            where: { id: validated.rollbackId },
            data: updateData,
            include: {
                deployment: true,
                user: true,
            },
        });
    }
    // Utility methods
    async getActiveDeployments(organizationId) {
        const where = {
            status: {
                in: ['PENDING', 'IN_PROGRESS', 'DEPLOYING'],
            },
        };
        if (organizationId) {
            where.organizationId = organizationId;
        }
        return this.prisma.deployment.findMany({
            where,
            include: {
                organization: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getDeploymentHistory(userId, limit = 50) {
        return this.prisma.deployment.findMany({
            where: {
                organization: {
                    userId,
                },
            },
            include: {
                organization: true,
                logs: {
                    where: { level: client_1.LogLevel.ERROR },
                    take: 5,
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    // Cleanup methods
    async deleteOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.prisma.deploymentLog.deleteMany({
            where: {
                timestamp: {
                    lt: cutoffDate,
                },
            },
        });
        return result.count;
    }
}
exports.DeploymentRepository = DeploymentRepository;
//# sourceMappingURL=DeploymentRepository.js.map