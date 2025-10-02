import { type PrismaClient, type Preview, type PreviewItem, type Prisma } from '@prisma/client';
import { PreviewFormat, PreviewData } from '@agentris/shared';
export interface PreviewWithItems extends Preview {
    items: PreviewItem[];
}
export interface CreatePreviewInput {
    ticketId: string;
    runId?: string | null;
    status: string;
    metadata: Prisma.InputJsonValue;
    expiresAt: Date;
}
export interface UpdatePreviewInput {
    status?: string;
    metadata?: Prisma.InputJsonValue;
    expiresAt?: Date;
}
export declare class PreviewRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: CreatePreviewInput): Promise<Preview>;
    findById(id: string): Promise<Preview | null>;
    findByIdWithItems(id: string): Promise<PreviewWithItems | null>;
    findByTicketId(ticketId: string): Promise<Preview[]>;
    findActiveByTicketId(ticketId: string): Promise<Preview | null>;
    findByRunId(runId: string): Promise<Preview | null>;
    update(id: string, data: UpdatePreviewInput): Promise<Preview>;
    delete(id: string): Promise<void>;
    markAsExpired(id: string): Promise<Preview>;
    markAsReady(id: string): Promise<Preview>;
    expireOldPreviews(): Promise<number>;
    deleteExpiredPreviews(hoursToKeep?: number): Promise<number>;
    getLatestPreviewForTicket(ticketId: string): Promise<PreviewWithItems | null>;
    countByStatus(status: string): Promise<number>;
    createWithPreviewData(data: {
        ticketId: string;
        runId?: string;
        format: PreviewFormat;
        previewData: PreviewData;
        expiresInHours?: number;
    }): Promise<Preview>;
    createPreviewItems(previewId: string, items: Array<{
        itemType: string;
        name: string;
        currentState?: any;
        proposedState: any;
        impact: 'LOW' | 'MEDIUM' | 'HIGH';
        description: string;
    }>): Promise<PreviewItem[]>;
    getPreviewWithFormats(ticketId: string): Promise<{
        currentPreview: Preview | null;
        availableFormats: string[];
    }>;
    expirePreviewsForTicket(ticketId: string): Promise<number>;
}
//# sourceMappingURL=PreviewRepository.d.ts.map