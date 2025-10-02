"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationRunRepository = void 0;
class AutomationRunRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.automationRun.create({
            data,
        });
    }
    async findById(id) {
        return this.prisma.automationRun.findUnique({
            where: { id },
        });
    }
    async findByIdWithSteps(id) {
        return this.prisma.automationRun.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { startedAt: 'asc' },
                },
            },
        });
    }
    async findByTicketId(ticketId) {
        return this.prisma.automationRun.findMany({
            where: { ticketId },
            orderBy: { startedAt: 'desc' },
        });
    }
    async findByStatus(status) {
        return this.prisma.automationRun.findMany({
            where: { status },
            orderBy: { startedAt: 'desc' },
        });
    }
    async update(id, data) {
        return this.prisma.automationRun.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        await this.prisma.automationRun.delete({
            where: { id },
        });
    }
    async findWithPagination(where, limit, offset) {
        const [runs, total] = await Promise.all([
            this.prisma.automationRun.findMany({
                where,
                orderBy: { startedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.automationRun.count({ where }),
        ]);
        return { runs, total };
    }
    async markAsCompleted(id, status, error) {
        return this.update(id, {
            status: status,
            error: error || null,
            completedAt: new Date(),
        });
    }
    async getLatestRunForTicket(ticketId) {
        return this.prisma.automationRun.findFirst({
            where: { ticketId },
            orderBy: { startedAt: 'desc' },
        });
    }
    async countByStatus(status) {
        return this.prisma.automationRun.count({
            where: { status },
        });
    }
    async getRunningRuns() {
        return this.prisma.automationRun.findMany({
            where: { status: 'RUNNING' },
            orderBy: { startedAt: 'asc' },
        });
    }
    async cleanupOldRuns(daysToKeep) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.prisma.automationRun.deleteMany({
            where: {
                completedAt: {
                    lt: cutoffDate,
                },
                status: {
                    in: ['SUCCESS', 'FAILED', 'PARTIAL'],
                },
            },
        });
        return result.count;
    }
}
exports.AutomationRunRepository = AutomationRunRepository;
//# sourceMappingURL=AutomationRunRepository.js.map