import { PrismaClient, Clarification } from '@prisma/client';
export interface CreateClarificationInput {
    ticketId: string;
    question: string;
    source: string;
    askedBy?: string;
    answer?: string;
}
export interface UpdateClarificationInput {
    question?: string;
    answer?: string;
    askedBy?: string;
}
export interface ClarificationFilter {
    ticketId?: string;
    source?: string;
    answered?: boolean;
    askedBy?: string;
}
export declare class ClarificationRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    create(input: CreateClarificationInput): Promise<Clarification>;
    createMany(inputs: CreateClarificationInput[]): Promise<number>;
    findById(id: string): Promise<Clarification | null>;
    findByTicketId(ticketId: string): Promise<Clarification[]>;
    findUnanswered(ticketId?: string): Promise<Clarification[]>;
    findAnswered(ticketId?: string): Promise<Clarification[]>;
    findWithFilter(filter: ClarificationFilter): Promise<Clarification[]>;
    update(id: string, input: UpdateClarificationInput): Promise<Clarification>;
    addAnswer(id: string, answer: string): Promise<Clarification>;
    delete(id: string): Promise<Clarification>;
    deleteByTicketId(ticketId: string): Promise<number>;
    getStatsByTicket(ticketId: string): Promise<{
        total: number;
        answered: number;
        unanswered: number;
        sources: {
            source: string;
            count: number;
        }[];
    }>;
    trackAnswerRate(): Promise<{
        totalQuestions: number;
        answeredQuestions: number;
        answerRate: number;
        bySource: {
            source: string;
            total: number;
            answered: number;
            rate: number;
        }[];
    }>;
    findRecentlyAnswered(limit?: number): Promise<Clarification[]>;
}
//# sourceMappingURL=ClarificationRepository.d.ts.map