import { PrismaClient, TicketBatch, BatchStatus, ApprovalStatus, Prisma } from '@prisma/client';
export declare class BatchRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    /**
     * Create a new ticket batch
     */
    createBatch(data: {
        name: string;
        groupingCriteria: any;
        createdById: string;
        ticketIds: string[];
        metadata?: any;
    }): Promise<TicketBatch>;
    /**
     * Get batch by ID with relations
     */
    getBatchById(batchId: string): Promise<({
        approval: {
            id: string;
            batchId: string;
            userId: string;
            status: import("@prisma/client").$Enums.ApprovalStatus;
            comments: string | null;
            approvalData: Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        tickets: ({
            ticket: {
                analyses: {
                    id: string;
                    ticketId: string;
                    type: import("@prisma/client").$Enums.AnalysisType;
                    findings: Prisma.JsonValue;
                    confidence: number;
                    score: number | null;
                    patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
                    createdAt: Date;
                    updatedAt: Date;
                }[];
            } & {
                id: string;
                jiraKey: string;
                jiraId: string;
                summary: string;
                description: string;
                status: import("@prisma/client").$Enums.TicketStatus;
                ambiguityScore: number | null;
                acceptanceCriteria: string | null;
                assignedToId: string;
                organizationId: string;
                userId: string | null;
                automationSuccess: boolean | null;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            batchId: string;
            ticketId: string;
            excluded: boolean;
            addedAt: Date;
            excludedAt: Date | null;
        })[];
        createdBy: {
            id: string;
            email: string;
            name: string | null;
            password: string | null;
            role: import("@prisma/client").$Enums.Role;
            emailVerified: Date | null;
            image: string | null;
            organizationId: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastActive: Date;
        };
        approvedBy: {
            id: string;
            email: string;
            name: string | null;
            password: string | null;
            role: import("@prisma/client").$Enums.Role;
            emailVerified: Date | null;
            image: string | null;
            organizationId: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastActive: Date;
        } | null;
        results: {
            id: string;
            batchId: string;
            ticketId: string;
            success: boolean;
            error: string | null;
            metadata: Prisma.JsonValue | null;
            processedAt: Date;
        }[];
    } & {
        id: string;
        name: string;
        groupingCriteria: Prisma.JsonValue;
        status: import("@prisma/client").$Enums.BatchStatus;
        metadata: Prisma.JsonValue | null;
        createdById: string;
        approvedById: string | null;
        processedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    /**
     * Get all batches with optional filters
     */
    getBatches(filters?: {
        status?: BatchStatus;
        createdById?: string;
        approvedById?: string;
    }): Promise<({
        approval: {
            id: string;
            batchId: string;
            userId: string;
            status: import("@prisma/client").$Enums.ApprovalStatus;
            comments: string | null;
            approvalData: Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        tickets: {
            id: string;
            batchId: string;
            ticketId: string;
            excluded: boolean;
            addedAt: Date;
            excludedAt: Date | null;
        }[];
        createdBy: {
            id: string;
            email: string;
            name: string | null;
            password: string | null;
            role: import("@prisma/client").$Enums.Role;
            emailVerified: Date | null;
            image: string | null;
            organizationId: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastActive: Date;
        };
    } & {
        id: string;
        name: string;
        groupingCriteria: Prisma.JsonValue;
        status: import("@prisma/client").$Enums.BatchStatus;
        metadata: Prisma.JsonValue | null;
        createdById: string;
        approvedById: string | null;
        processedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    /**
     * Add tickets to an existing batch
     */
    addTicketsToBatch(batchId: string, ticketIds: string[]): Promise<Prisma.BatchPayload>;
    /**
     * Exclude a ticket from a batch
     */
    excludeTicketFromBatch(batchId: string, ticketId: string): Promise<{
        id: string;
        batchId: string;
        ticketId: string;
        excluded: boolean;
        addedAt: Date;
        excludedAt: Date | null;
    }>;
    /**
     * Re-include an excluded ticket in a batch
     */
    includeTicketInBatch(batchId: string, ticketId: string): Promise<{
        id: string;
        batchId: string;
        ticketId: string;
        excluded: boolean;
        addedAt: Date;
        excludedAt: Date | null;
    }>;
    /**
     * Update batch status
     */
    updateBatchStatus(batchId: string, status: BatchStatus, approvedById?: string): Promise<{
        id: string;
        name: string;
        groupingCriteria: Prisma.JsonValue;
        status: import("@prisma/client").$Enums.BatchStatus;
        metadata: Prisma.JsonValue | null;
        createdById: string;
        approvedById: string | null;
        processedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Create batch approval
     */
    createBatchApproval(data: {
        batchId: string;
        userId: string;
        status: ApprovalStatus;
        comments?: string;
        approvalData?: any;
    }): Promise<{
        id: string;
        batchId: string;
        userId: string;
        status: import("@prisma/client").$Enums.ApprovalStatus;
        comments: string | null;
        approvalData: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Update batch approval
     */
    updateBatchApproval(batchId: string, data: {
        status: ApprovalStatus;
        comments?: string;
        approvalData?: any;
    }): Promise<{
        id: string;
        batchId: string;
        userId: string;
        status: import("@prisma/client").$Enums.ApprovalStatus;
        comments: string | null;
        approvalData: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Record batch processing result for a ticket
     */
    recordProcessingResult(data: {
        batchId: string;
        ticketId: string;
        success: boolean;
        error?: string;
        metadata?: any;
    }): Promise<{
        id: string;
        batchId: string;
        ticketId: string;
        success: boolean;
        error: string | null;
        metadata: Prisma.JsonValue | null;
        processedAt: Date;
    }>;
    /**
     * Get batch processing results
     */
    getBatchResults(batchId: string): Promise<({
        ticket: {
            id: string;
            jiraKey: string;
            jiraId: string;
            summary: string;
            description: string;
            status: import("@prisma/client").$Enums.TicketStatus;
            ambiguityScore: number | null;
            acceptanceCriteria: string | null;
            assignedToId: string;
            organizationId: string;
            userId: string | null;
            automationSuccess: boolean | null;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        batchId: string;
        ticketId: string;
        success: boolean;
        error: string | null;
        metadata: Prisma.JsonValue | null;
        processedAt: Date;
    })[]>;
    /**
     * Get batches containing a specific ticket
     */
    getBatchesForTicket(ticketId: string): Promise<({
        batch: {
            approval: {
                id: string;
                batchId: string;
                userId: string;
                status: import("@prisma/client").$Enums.ApprovalStatus;
                comments: string | null;
                approvalData: Prisma.JsonValue | null;
                createdAt: Date;
                updatedAt: Date;
            } | null;
            createdBy: {
                id: string;
                email: string;
                name: string | null;
                password: string | null;
                role: import("@prisma/client").$Enums.Role;
                emailVerified: Date | null;
                image: string | null;
                organizationId: string | null;
                createdAt: Date;
                updatedAt: Date;
                lastActive: Date;
            };
        } & {
            id: string;
            name: string;
            groupingCriteria: Prisma.JsonValue;
            status: import("@prisma/client").$Enums.BatchStatus;
            metadata: Prisma.JsonValue | null;
            createdById: string;
            approvedById: string | null;
            processedAt: Date | null;
            completedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        batchId: string;
        ticketId: string;
        excluded: boolean;
        addedAt: Date;
        excludedAt: Date | null;
    })[]>;
    /**
     * Delete a batch
     */
    deleteBatch(batchId: string): Promise<{
        id: string;
        name: string;
        groupingCriteria: Prisma.JsonValue;
        status: import("@prisma/client").$Enums.BatchStatus;
        metadata: Prisma.JsonValue | null;
        createdById: string;
        approvedById: string | null;
        processedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Get batch statistics
     */
    getBatchStatistics(batchId: string): Promise<{
        batchId: string;
        status: import("@prisma/client").$Enums.BatchStatus;
        totalTickets: number;
        processedTickets: number;
        successfulTickets: number;
        failedTickets: number;
        successRate: number;
        createdAt: Date;
        processedAt: Date | null;
        completedAt: Date | null;
    } | null>;
}
//# sourceMappingURL=BatchRepository.d.ts.map