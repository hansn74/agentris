"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewRepository = void 0;
class PreviewRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.preview.create({
            data,
        });
    }
    async findById(id) {
        return this.prisma.preview.findUnique({
            where: { id },
        });
    }
    async findByIdWithItems(id) {
        return this.prisma.preview.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: { itemType: 'asc' },
                },
            },
        });
    }
    async findByTicketId(ticketId) {
        return this.prisma.preview.findMany({
            where: { ticketId },
            orderBy: { generatedAt: 'desc' },
        });
    }
    async findActiveByTicketId(ticketId) {
        return this.prisma.preview.findFirst({
            where: {
                ticketId,
                status: 'READY',
                expiresAt: {
                    gt: new Date(),
                },
            },
            orderBy: { generatedAt: 'desc' },
        });
    }
    async findByRunId(runId) {
        return this.prisma.preview.findFirst({
            where: { runId },
            orderBy: { generatedAt: 'desc' },
        });
    }
    async update(id, data) {
        return this.prisma.preview.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        await this.prisma.preview.delete({
            where: { id },
        });
    }
    async markAsExpired(id) {
        return this.update(id, {
            status: 'EXPIRED',
        });
    }
    async markAsReady(id) {
        return this.update(id, {
            status: 'READY',
        });
    }
    async expireOldPreviews() {
        const result = await this.prisma.preview.updateMany({
            where: {
                status: 'READY',
                expiresAt: {
                    lt: new Date(),
                },
            },
            data: {
                status: 'EXPIRED',
            },
        });
        return result.count;
    }
    async deleteExpiredPreviews(hoursToKeep = 24) {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hoursToKeep);
        const result = await this.prisma.preview.deleteMany({
            where: {
                status: 'EXPIRED',
                expiresAt: {
                    lt: cutoffDate,
                },
            },
        });
        return result.count;
    }
    async getLatestPreviewForTicket(ticketId) {
        return this.prisma.preview.findFirst({
            where: { ticketId },
            orderBy: { generatedAt: 'desc' },
            include: {
                items: {
                    orderBy: { itemType: 'asc' },
                },
            },
        });
    }
    async countByStatus(status) {
        return this.prisma.preview.count({
            where: { status },
        });
    }
}
exports.PreviewRepository = PreviewRepository;
//# sourceMappingURL=PreviewRepository.js.map