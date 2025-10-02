import { PrismaClient, AnalysisType, AmbiguityPattern } from '@prisma/client';
export interface CreateAnalysisInput {
    ticketId: string;
    type: AnalysisType;
    findings: Record<string, any>;
    confidence: number;
    score?: number;
    patterns?: AmbiguityPattern[];
}
export interface UpdateAnalysisInput {
    findings?: Record<string, any>;
    confidence?: number;
    score?: number;
    patterns?: AmbiguityPattern[];
}
export declare class AnalysisRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(input: CreateAnalysisInput): Promise<{
        id: string;
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    findById(id: string): Promise<({
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
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    findByTicketAndType(ticketId: string, type: AnalysisType): Promise<{
        id: string;
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    findByTicket(ticketId: string): Promise<{
        id: string;
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(id: string, input: UpdateAnalysisInput): Promise<{
        id: string;
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    upsert(ticketId: string, type: AnalysisType, input: CreateAnalysisInput): Promise<{
        id: string;
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: string): Promise<{
        id: string;
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteByTicket(ticketId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    getRecentAnalyses(limit?: number): Promise<({
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
        ticketId: string;
        type: import("@prisma/client").$Enums.AnalysisType;
        findings: import("@prisma/client").Prisma.JsonValue;
        confidence: number;
        score: number | null;
        patterns: import("@prisma/client").$Enums.AmbiguityPattern[];
        createdAt: Date;
        updatedAt: Date;
    })[]>;
}
//# sourceMappingURL=AnalysisRepository.d.ts.map