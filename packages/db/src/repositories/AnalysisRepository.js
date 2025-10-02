"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisRepository = void 0;
class AnalysisRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(input) {
        return this.prisma.analysis.create({
            data: {
                ticketId: input.ticketId,
                type: input.type,
                findings: input.findings,
                confidence: input.confidence,
                score: input.score,
                patterns: input.patterns || [],
            },
        });
    }
    async findById(id) {
        return this.prisma.analysis.findUnique({
            where: { id },
            include: { ticket: true },
        });
    }
    async findByTicketAndType(ticketId, type) {
        return this.prisma.analysis.findUnique({
            where: {
                ticketId_type: {
                    ticketId,
                    type,
                },
            },
        });
    }
    async findByTicket(ticketId) {
        return this.prisma.analysis.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async update(id, input) {
        return this.prisma.analysis.update({
            where: { id },
            data: {
                findings: input.findings,
                confidence: input.confidence,
                score: input.score,
                patterns: input.patterns,
                updatedAt: new Date(),
            },
        });
    }
    async upsert(ticketId, type, input) {
        return this.prisma.analysis.upsert({
            where: {
                ticketId_type: {
                    ticketId,
                    type,
                },
            },
            create: {
                ticketId: input.ticketId,
                type: input.type,
                findings: input.findings,
                confidence: input.confidence,
                score: input.score,
                patterns: input.patterns || [],
            },
            update: {
                findings: input.findings,
                confidence: input.confidence,
                score: input.score,
                patterns: input.patterns || [],
                updatedAt: new Date(),
            },
        });
    }
    async delete(id) {
        return this.prisma.analysis.delete({
            where: { id },
        });
    }
    async deleteByTicket(ticketId) {
        return this.prisma.analysis.deleteMany({
            where: { ticketId },
        });
    }
    async getRecentAnalyses(limit = 10) {
        return this.prisma.analysis.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { ticket: true },
        });
    }
}
exports.AnalysisRepository = AnalysisRepository;
//# sourceMappingURL=AnalysisRepository.js.map