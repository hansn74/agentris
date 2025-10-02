import { type PrismaClient, type AutomationStep, Prisma } from '@prisma/client';
export interface CreateAutomationStepInput {
    runId: string;
    stepType: string;
    status: string;
    input: Prisma.InputJsonValue;
    output?: Prisma.InputJsonValue | null;
    error?: string | null;
    startedAt?: Date;
    completedAt?: Date | null;
}
export interface UpdateAutomationStepInput {
    status?: string;
    output?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    error?: string | null;
    completedAt?: Date | null;
}
export declare class AutomationStepRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: CreateAutomationStepInput): Promise<AutomationStep>;
    findById(id: string): Promise<AutomationStep | null>;
    findByRunId(runId: string): Promise<AutomationStep[]>;
    findByRunIdAndType(runId: string, stepType: string): Promise<AutomationStep[]>;
    update(id: string, data: UpdateAutomationStepInput): Promise<AutomationStep>;
    delete(id: string): Promise<void>;
    deleteByRunId(runId: string): Promise<number>;
    getLatestStepForRun(runId: string): Promise<AutomationStep | null>;
    getRunningSteps(runId: string): Promise<AutomationStep[]>;
    markAsCompleted(id: string, status: 'COMPLETED' | 'FAILED', output?: Prisma.InputJsonValue, error?: string): Promise<AutomationStep>;
    recordStep(runId: string, stepType: string, status: string, input: Prisma.InputJsonValue, output?: Prisma.InputJsonValue): Promise<AutomationStep>;
    getStepDuration(id: string): Promise<number | null>;
    getAverageStepDuration(stepType: string): Promise<number>;
    getStepSuccessRate(stepType: string): Promise<number>;
}
//# sourceMappingURL=AutomationStepRepository.d.ts.map