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
    async createWithPreviewData(data) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours ?? 24));
        return this.prisma.preview.create({
            data: {
                ticketId: data.ticketId,
                runId: data.runId,
                status: 'READY',
                metadata: data.previewData,
                generatedAt: new Date(),
                expiresAt,
            },
        });
    }
    async createPreviewItems(previewId, items) {
        return this.prisma.previewItem.createMany({
            data: items.map(item => ({
                previewId,
                itemType: item.itemType,
                name: item.name,
                currentState: item.currentState,
                proposedState: item.proposedState,
                impact: item.impact,
                description: item.description,
            })),
        }).then(() => this.prisma.previewItem.findMany({
            where: { previewId },
        }));
    }
    async getPreviewWithFormats(ticketId) {
        const preview = await this.findActiveByTicketId(ticketId);
        if (!preview) {
            return {
                currentPreview: null,
                availableFormats: [],
            };
        }
        const metadata = preview.metadata;
        const availableFormats = [];
        if (metadata?.type) {
            availableFormats.push(metadata.type);
            // Add other formats based on content type
            if (metadata.type === 'diagram') {
                availableFormats.push('text');
            }
            else if (metadata.type === 'mockup') {
                availableFormats.push('table', 'text');
            }
            else if (metadata.type === 'code-diff') {
                availableFormats.push('text');
            }
        }
        return {
            currentPreview: preview,
            availableFormats,
        };
    }
    async expirePreviewsForTicket(ticketId) {
        const result = await this.prisma.preview.updateMany({
            where: {
                ticketId,
                status: 'READY',
            },
            data: {
                status: 'EXPIRED',
                expiresAt: new Date(),
            },
        });
        return result.count;
    }
}
exports.PreviewRepository = PreviewRepository;
//# sourceMappingURL=PreviewRepository.js.map