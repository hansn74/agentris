import { type PrismaClient, type AutomationRun, type AutomationStep, AutomationStatus, type Prisma } from '@prisma/client';
export interface AutomationRunWithSteps extends AutomationRun {
    steps: AutomationStep[];
}
export interface CreateAutomationRunInput {
    ticketId: string;
    status: AutomationStatus;
    metadata: Prisma.InputJsonValue;
}
export interface UpdateAutomationRunInput {
    status?: AutomationStatus;
    metadata?: Prisma.InputJsonValue;
    error?: string | null;
    completedAt?: Date | null;
}
export declare class AutomationRunRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: CreateAutomationRunInput): Promise<AutomationRun>;
    findById(id: string): Promise<AutomationRun | null>;
    findByIdWithSteps(id: string): Promise<AutomationRunWithSteps | null>;
    findByTicketId(ticketId: string): Promise<AutomationRun[]>;
    findByStatus(status: AutomationStatus): Promise<AutomationRun[]>;
    update(id: string, data: UpdateAutomationRunInput): Promise<AutomationRun>;
    delete(id: string): Promise<void>;
    findWithPagination(where: Prisma.AutomationRunWhereInput, limit: number, offset: number): Promise<{
        runs: AutomationRun[];
        total: number;
    }>;
    markAsCompleted(id: string, status: 'SUCCESS' | 'FAILED' | 'PARTIAL', error?: string): Promise<AutomationRun>;
    getLatestRunForTicket(ticketId: string): Promise<AutomationRun | null>;
    countByStatus(status: AutomationStatus): Promise<number>;
    getRunningRuns(): Promise<AutomationRun[]>;
    cleanupOldRuns(daysToKeep: number): Promise<number>;
}
//# sourceMappingURL=AutomationRunRepository.d.ts.map