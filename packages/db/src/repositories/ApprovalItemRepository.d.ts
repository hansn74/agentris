import { PrismaClient, ApprovalItem, ApprovalItemStatus, Prisma } from '@prisma/client';
export declare class ApprovalItemRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: Prisma.ApprovalItemCreateInput): Promise<ApprovalItem>;
    createMany(data: Prisma.ApprovalItemCreateManyInput[]): Promise<Prisma.BatchPayload>;
    findById(id: string): Promise<ApprovalItem | null>;
    findByApprovalId(approvalId: string): Promise<ApprovalItem[]>;
    findByPreviewItemId(previewItemId: string): Promise<ApprovalItem | null>;
    update(id: string, data: Prisma.ApprovalItemUpdateInput): Promise<ApprovalItem>;
    updateStatus(id: string, status: ApprovalItemStatus, reason?: string, modifiedData?: any): Promise<ApprovalItem>;
    bulkUpdateStatus(ids: string[], status: ApprovalItemStatus, reason?: string): Promise<Prisma.BatchPayload>;
    delete(id: string): Promise<void>;
    deleteMany(approvalId: string): Promise<Prisma.BatchPayload>;
    findByStatus(status: ApprovalItemStatus, approvalId?: string): Promise<ApprovalItem[]>;
    findModifiedItems(approvalId?: string): Promise<ApprovalItem[]>;
}
//# sourceMappingURL=ApprovalItemRepository.d.ts.map