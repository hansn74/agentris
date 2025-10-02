"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewItemRepository = void 0;
class PreviewItemRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.previewItem.create({
            data,
        });
    }
    async createMany(input) {
        const result = await this.prisma.previewItem.createMany({
            data: input.items.map(item => ({
                ...item,
                previewId: input.previewId,
            })),
        });
        return result.count;
    }
    async findById(id) {
        return this.prisma.previewItem.findUnique({
            where: { id },
        });
    }
    async findByPreviewId(previewId) {
        return this.prisma.previewItem.findMany({
            where: { previewId },
            orderBy: [
                { itemType: 'asc' },
                { name: 'asc' },
            ],
        });
    }
    async findByPreviewIdAndType(previewId, itemType) {
        return this.prisma.previewItem.findMany({
            where: {
                previewId,
                itemType,
            },
            orderBy: { name: 'asc' },
        });
    }
    async findByImpact(previewId, impact) {
        return this.prisma.previewItem.findMany({
            where: {
                previewId,
                impact,
            },
            orderBy: [
                { itemType: 'asc' },
                { name: 'asc' },
            ],
        });
    }
    async update(id, data) {
        return this.prisma.previewItem.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        await this.prisma.previewItem.delete({
            where: { id },
        });
    }
    async deleteByPreviewId(previewId) {
        const result = await this.prisma.previewItem.deleteMany({
            where: { previewId },
        });
        return result.count;
    }
    async countByType(previewId) {
        const items = await this.prisma.previewItem.groupBy({
            by: ['itemType'],
            where: { previewId },
            _count: {
                itemType: true,
            },
        });
        return items.reduce((acc, item) => {
            acc[item.itemType] = item._count.itemType;
            return acc;
        }, {});
    }
    async countByImpact(previewId) {
        const items = await this.prisma.previewItem.groupBy({
            by: ['impact'],
            where: { previewId },
            _count: {
                impact: true,
            },
        });
        return items.reduce((acc, item) => {
            acc[item.impact] = item._count.impact;
            return acc;
        }, {});
    }
    async getHighImpactItems(previewId) {
        return this.prisma.previewItem.findMany({
            where: {
                previewId,
                impact: 'HIGH',
            },
            orderBy: [
                { itemType: 'asc' },
                { name: 'asc' },
            ],
        });
    }
    async hasChanges(previewId) {
        const count = await this.prisma.previewItem.count({
            where: { previewId },
        });
        return count > 0;
    }
}
exports.PreviewItemRepository = PreviewItemRepository;
//# sourceMappingURL=PreviewItemRepository.js.map