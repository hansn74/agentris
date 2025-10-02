"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchRepository = void 0;
class BatchRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Create a new ticket batch
     */
    async createBatch(data) {
        return this.prisma.ticketBatch.create({
            data: {
                name: data.name,
                groupingCriteria: data.groupingCriteria,
                createdById: data.createdById,
                metadata: data.metadata,
                tickets: {
                    create: data.ticketIds.map(ticketId => ({
                        ticketId
                    }))
                }
            },
            include: {
                tickets: {
                    include: {
                        ticket: true
                    }
                },
                createdBy: true
            }
        });
    }
    /**
     * Get batch by ID with relations
     */
    async getBatchById(batchId) {
        return this.prisma.ticketBatch.findUnique({
            where: { id: batchId },
            include: {
                tickets: {
                    where: { excluded: false },
                    include: {
                        ticket: {
                            include: {
                                analyses: true
                            }
                        }
                    }
                },
                createdBy: true,
                approvedBy: true,
                approval: true,
                results: true
            }
        });
    }
    /**
     * Get all batches with optional filters
     */
    async getBatches(filters) {
        const where = {};
        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.createdById) {
            where.createdById = filters.createdById;
        }
        if (filters?.approvedById) {
            where.approvedById = filters.approvedById;
        }
        return this.prisma.ticketBatch.findMany({
            where,
            include: {
                tickets: {
                    where: { excluded: false }
                },
                createdBy: true,
                approval: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    /**
     * Add tickets to an existing batch
     */
    async addTicketsToBatch(batchId, ticketIds) {
        return this.prisma.batchTicket.createMany({
            data: ticketIds.map(ticketId => ({
                batchId,
                ticketId
            })),
            skipDuplicates: true
        });
    }
    /**
     * Exclude a ticket from a batch
     */
    async excludeTicketFromBatch(batchId, ticketId) {
        return this.prisma.batchTicket.update({
            where: {
                batchId_ticketId: {
                    batchId,
                    ticketId
                }
            },
            data: {
                excluded: true,
                excludedAt: new Date()
            }
        });
    }
    /**
     * Re-include an excluded ticket in a batch
     */
    async includeTicketInBatch(batchId, ticketId) {
        return this.prisma.batchTicket.update({
            where: {
                batchId_ticketId: {
                    batchId,
                    ticketId
                }
            },
            data: {
                excluded: false,
                excludedAt: null
            }
        });
    }
    /**
     * Update batch status
     */
    async updateBatchStatus(batchId, status, approvedById) {
        const updateData = { status };
        if (status === 'PROCESSING') {
            updateData.processedAt = new Date();
        }
        if (status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED' || status === 'FAILED') {
            updateData.completedAt = new Date();
        }
        if (approvedById) {
            updateData.approvedBy = { connect: { id: approvedById } };
        }
        return this.prisma.ticketBatch.update({
            where: { id: batchId },
            data: updateData
        });
    }
    /**
     * Create batch approval
     */
    async createBatchApproval(data) {
        return this.prisma.batchApproval.create({
            data: {
                batchId: data.batchId,
                userId: data.userId,
                status: data.status,
                comments: data.comments,
                approvalData: data.approvalData
            }
        });
    }
    /**
     * Update batch approval
     */
    async updateBatchApproval(batchId, data) {
        return this.prisma.batchApproval.update({
            where: { batchId },
            data
        });
    }
    /**
     * Record batch processing result for a ticket
     */
    async recordProcessingResult(data) {
        return this.prisma.batchProcessingResult.upsert({
            where: {
                batchId_ticketId: {
                    batchId: data.batchId,
                    ticketId: data.ticketId
                }
            },
            create: data,
            update: data
        });
    }
    /**
     * Get batch processing results
     */
    async getBatchResults(batchId) {
        return this.prisma.batchProcessingResult.findMany({
            where: { batchId },
            include: {
                ticket: true
            },
            orderBy: { processedAt: 'desc' }
        });
    }
    /**
     * Get batches containing a specific ticket
     */
    async getBatchesForTicket(ticketId) {
        return this.prisma.batchTicket.findMany({
            where: {
                ticketId,
                excluded: false
            },
            include: {
                batch: {
                    include: {
                        createdBy: true,
                        approval: true
                    }
                }
            }
        });
    }
    /**
     * Delete a batch
     */
    async deleteBatch(batchId) {
        return this.prisma.ticketBatch.delete({
            where: { id: batchId }
        });
    }
    /**
     * Get batch statistics
     */
    async getBatchStatistics(batchId) {
        const batch = await this.getBatchById(batchId);
        if (!batch)
            return null;
        const results = await this.getBatchResults(batchId);
        const totalTickets = batch.tickets.length;
        const processedTickets = results.length;
        const successfulTickets = results.filter(r => r.success).length;
        const failedTickets = results.filter(r => !r.success).length;
        return {
            batchId,
            status: batch.status,
            totalTickets,
            processedTickets,
            successfulTickets,
            failedTickets,
            successRate: processedTickets > 0 ? (successfulTickets / processedTickets) * 100 : 0,
            createdAt: batch.createdAt,
            processedAt: batch.processedAt,
            completedAt: batch.completedAt
        };
    }
}
exports.BatchRepository = BatchRepository;
//# sourceMappingURL=BatchRepository.js.map