"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalRepository = void 0;
const client_1 = require("@prisma/client");
class ApprovalRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.approval.create({
            data,
            include: {
                items: true,
                preview: true,
                user: true,
            },
        });
    }
    async findById(id) {
        return this.prisma.approval.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        previewItem: true,
                    },
                },
                preview: {
                    include: {
                        items: true,
                        ticket: true,
                    },
                },
                user: true,
            },
        });
    }
    async findByPreviewId(previewId) {
        return this.prisma.approval.findMany({
            where: { previewId },
            include: {
                items: {
                    include: {
                        previewItem: true,
                    },
                },
                user: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findByUserId(userId) {
        return this.prisma.approval.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        previewItem: true,
                    },
                },
                preview: {
                    include: {
                        ticket: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findPending() {
        return this.prisma.approval.findMany({
            where: { status: client_1.ApprovalStatus.PENDING },
            include: {
                items: {
                    include: {
                        previewItem: true,
                    },
                },
                preview: {
                    include: {
                        ticket: true,
                    },
                },
                user: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async update(id, data) {
        return this.prisma.approval.update({
            where: { id },
            data,
            include: {
                items: {
                    include: {
                        previewItem: true,
                    },
                },
                preview: {
                    include: {
                        ticket: true,
                    },
                },
                user: true,
            },
        });
    }
    async updateStatus(id, status, comments) {
        return this.prisma.approval.update({
            where: { id },
            data: {
                status,
                comments,
                updatedAt: new Date(),
            },
            include: {
                items: {
                    include: {
                        previewItem: true,
                    },
                },
                preview: {
                    include: {
                        ticket: true,
                    },
                },
                user: true,
            },
        });
    }
    async delete(id) {
        await this.prisma.approval.delete({
            where: { id },
        });
    }
    async getApprovalHistory(filters, pagination) {
        const where = {};
        if (filters?.userId) {
            where.userId = filters.userId;
        }
        if (filters?.previewId) {
            where.previewId = filters.previewId;
        }
        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.startDate || filters?.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }
        const [approvals, total] = await Promise.all([
            this.prisma.approval.findMany({
                where,
                include: {
                    items: {
                        include: {
                            previewItem: true,
                        },
                    },
                    preview: {
                        include: {
                            ticket: true,
                        },
                    },
                    user: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: pagination?.skip,
                take: pagination?.take,
            }),
            this.prisma.approval.count({ where }),
        ]);
        return { approvals, total };
    }
}
exports.ApprovalRepository = ApprovalRepository;
//# sourceMappingURL=ApprovalRepository.js.map