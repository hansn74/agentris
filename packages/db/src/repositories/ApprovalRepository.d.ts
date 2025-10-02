import { PrismaClient, Approval, ApprovalStatus, Prisma } from '@prisma/client';
export declare class ApprovalRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: Prisma.ApprovalCreateInput): Promise<Approval>;
    findById(id: string): Promise<Approval | null>;
    findByPreviewId(previewId: string): Promise<Approval[]>;
    findByUserId(userId: string): Promise<Approval[]>;
    findPending(): Promise<Approval[]>;
    update(id: string, data: Prisma.ApprovalUpdateInput): Promise<Approval>;
    updateStatus(id: string, status: ApprovalStatus, comments?: string): Promise<Approval>;
    delete(id: string): Promise<void>;
    getApprovalHistory(filters?: {
        userId?: string;
        previewId?: string;
        status?: ApprovalStatus;
        startDate?: Date;
        endDate?: Date;
    }, pagination?: {
        skip?: number;
        take?: number;
    }): Promise<{
        approvals: Approval[];
        total: number;
    }>;
}
//# sourceMappingURL=ApprovalRepository.d.ts.map