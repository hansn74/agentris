"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalItemRepository = void 0;
const client_1 = require("@prisma/client");
class ApprovalItemRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.approvalItem.create({
            data,
            include: {
                approval: true,
                previewItem: true,
            },
        });
    }
    async createMany(data) {
        return this.prisma.approvalItem.createMany({
            data,
        });
    }
    async findById(id) {
        return this.prisma.approvalItem.findUnique({
            where: { id },
            include: {
                approval: {
                    include: {
                        user: true,
                        preview: true,
                    },
                },
                previewItem: true,
            },
        });
    }
    async findByApprovalId(approvalId) {
        return this.prisma.approvalItem.findMany({
            where: { approvalId },
            include: {
                previewItem: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async findByPreviewItemId(previewItemId) {
        return this.prisma.approvalItem.findUnique({
            where: { previewItemId },
            include: {
                approval: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }
    async update(id, data) {
        return this.prisma.approvalItem.update({
            where: { id },
            data,
            include: {
                approval: true,
                previewItem: true,
            },
        });
    }
    async updateStatus(id, status, reason, modifiedData) {
        return this.prisma.approvalItem.update({
            where: { id },
            data: {
                status,
                reason,
                modifiedData,
                updatedAt: new Date(),
            },
            include: {
                approval: true,
                previewItem: true,
            },
        });
    }
    async bulkUpdateStatus(ids, status, reason) {
        return this.prisma.approvalItem.updateMany({
            where: {
                id: {
                    in: ids,
                },
            },
            data: {
                status,
                reason,
                updatedAt: new Date(),
            },
        });
    }
    async delete(id) {
        await this.prisma.approvalItem.delete({
            where: { id },
        });
    }
    async deleteMany(approvalId) {
        return this.prisma.approvalItem.deleteMany({
            where: { approvalId },
        });
    }
    async findByStatus(status, approvalId) {
        const where = { status };
        if (approvalId) {
            where.approvalId = approvalId;
        }
        return this.prisma.approvalItem.findMany({
            where,
            include: {
                approval: {
                    include: {
                        user: true,
                        preview: true,
                    },
                },
                previewItem: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findModifiedItems(approvalId) {
        const where = {
            status: client_1.ApprovalItemStatus.MODIFIED,
            modifiedData: {
                not: client_1.Prisma.JsonNull,
            },
        };
        if (approvalId) {
            where.approvalId = approvalId;
        }
        return this.prisma.approvalItem.findMany({
            where,
            include: {
                approval: {
                    include: {
                        user: true,
                        preview: true,
                    },
                },
                previewItem: true,
            },
            orderBy: { updatedAt: 'desc' },
        });
    }
}
exports.ApprovalItemRepository = ApprovalItemRepository;
//# sourceMappingURL=ApprovalItemRepository.js.map