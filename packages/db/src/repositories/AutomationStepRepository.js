"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationStepRepository = void 0;
const client_1 = require("@prisma/client");
class AutomationStepRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.automationStep.create({
            data: {
                runId: data.runId,
                stepType: data.stepType,
                status: data.status,
                input: data.input,
                output: data.output !== undefined ? data.output : client_1.Prisma.DbNull,
                error: data.error || null,
                startedAt: data.startedAt || new Date(),
                completedAt: data.completedAt || null,
            },
        });
    }
    async findById(id) {
        return this.prisma.automationStep.findUnique({
            where: { id },
        });
    }
    async findByRunId(runId) {
        return this.prisma.automationStep.findMany({
            where: { runId },
            orderBy: { startedAt: 'asc' },
        });
    }
    async findByRunIdAndType(runId, stepType) {
        return this.prisma.automationStep.findMany({
            where: {
                runId,
                stepType,
            },
            orderBy: { startedAt: 'desc' },
        });
    }
    async update(id, data) {
        return this.prisma.automationStep.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        await this.prisma.automationStep.delete({
            where: { id },
        });
    }
    async deleteByRunId(runId) {
        const result = await this.prisma.automationStep.deleteMany({
            where: { runId },
        });
        return result.count;
    }
    async getLatestStepForRun(runId) {
        return this.prisma.automationStep.findFirst({
            where: { runId },
            orderBy: { startedAt: 'desc' },
        });
    }
    async getRunningSteps(runId) {
        return this.prisma.automationStep.findMany({
            where: {
                runId,
                status: 'RUNNING',
            },
            orderBy: { startedAt: 'asc' },
        });
    }
    async markAsCompleted(id, status, output, error) {
        return this.update(id, {
            status,
            output: output !== undefined ? output : client_1.Prisma.DbNull,
            error: error || null,
            completedAt: new Date(),
        });
    }
    async recordStep(runId, stepType, status, input, output) {
        return this.create({
            runId,
            stepType,
            status,
            input,
            output: output !== undefined ? output : null,
            startedAt: status === 'RUNNING' ? new Date() : undefined,
            completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : null,
        });
    }
    async getStepDuration(id) {
        const step = await this.findById(id);
        if (!step || !step.startedAt || !step.completedAt) {
            return null;
        }
        return step.completedAt.getTime() - step.startedAt.getTime();
    }
    async getAverageStepDuration(stepType) {
        const steps = await this.prisma.automationStep.findMany({
            where: {
                stepType,
                startedAt: { not: null },
                completedAt: { not: null },
            },
        });
        if (steps.length === 0) {
            return 0;
        }
        const totalDuration = steps.reduce((sum, step) => {
            if (step.startedAt && step.completedAt) {
                return sum + (step.completedAt.getTime() - step.startedAt.getTime());
            }
            return sum;
        }, 0);
        return totalDuration / steps.length;
    }
    async getStepSuccessRate(stepType) {
        const [total, successful] = await Promise.all([
            this.prisma.automationStep.count({
                where: { stepType },
            }),
            this.prisma.automationStep.count({
                where: {
                    stepType,
                    status: 'COMPLETED',
                },
            }),
        ]);
        if (total === 0) {
            return 0;
        }
        return (successful / total) * 100;
    }
}
exports.AutomationStepRepository = AutomationStepRepository;
//# sourceMappingURL=AutomationStepRepository.js.map