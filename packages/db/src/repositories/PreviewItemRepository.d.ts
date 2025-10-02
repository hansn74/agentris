import { type PrismaClient, type PreviewItem, type Prisma } from '@prisma/client';
export interface CreatePreviewItemInput {
    previewId: string;
    itemType: string;
    name: string;
    currentState?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    proposedState: Prisma.InputJsonValue;
    impact: string;
    description: string;
}
export interface UpdatePreviewItemInput {
    currentState?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    proposedState?: Prisma.InputJsonValue;
    impact?: string;
    description?: string;
}
export interface PreviewItemBulkCreateInput {
    previewId: string;
    items: Omit<CreatePreviewItemInput, 'previewId'>[];
}
export declare class PreviewItemRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: CreatePreviewItemInput): Promise<PreviewItem>;
    createMany(input: PreviewItemBulkCreateInput): Promise<number>;
    findById(id: string): Promise<PreviewItem | null>;
    findByPreviewId(previewId: string): Promise<PreviewItem[]>;
    findByPreviewIdAndType(previewId: string, itemType: string): Promise<PreviewItem[]>;
    findByImpact(previewId: string, impact: string): Promise<PreviewItem[]>;
    update(id: string, data: UpdatePreviewItemInput): Promise<PreviewItem>;
    delete(id: string): Promise<void>;
    deleteByPreviewId(previewId: string): Promise<number>;
    countByType(previewId: string): Promise<Record<string, number>>;
    countByImpact(previewId: string): Promise<Record<string, number>>;
    getHighImpactItems(previewId: string): Promise<PreviewItem[]>;
    hasChanges(previewId: string): Promise<boolean>;
}
//# sourceMappingURL=PreviewItemRepository.d.ts.map