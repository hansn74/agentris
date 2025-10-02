import { PrismaClient, LLMRequest, LLMUsage, LLMCache, LLMProvider } from '@prisma/client';
export declare class LLMRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    createRequest(data: {
        provider: LLMProvider;
        model: string;
        prompt: string;
        response?: string;
        tokenCount: number;
        cost: number;
        userId: string;
        cacheHit?: boolean;
        error?: string;
    }): Promise<LLMRequest>;
    getRequestById(id: string): Promise<LLMRequest | null>;
    getRequestsByUser(userId: string, limit?: number): Promise<LLMRequest[]>;
    upsertUsage(data: {
        userId: string;
        date: Date;
        provider: LLMProvider;
        totalTokens?: number;
        totalCost?: number;
        requestCount?: number;
        cacheHits?: number;
    }): Promise<LLMUsage>;
    getUsageByUser(userId: string, startDate?: Date, endDate?: Date): Promise<LLMUsage[]>;
    getAggregatedUsage(startDate?: Date, endDate?: Date): Promise<{
        _sum: {
            totalTokens: number | null;
            totalCost: number | null;
            requestCount: number | null;
            cacheHits: number | null;
        };
    }>;
    generateCacheKey(provider: LLMProvider, model: string, prompt: string): string;
    getCachedResponse(cacheKey: string): Promise<LLMCache | null>;
    setCachedResponse(data: {
        cacheKey: string;
        provider: LLMProvider;
        model: string;
        response: string;
        tokenCount: number;
        ttlSeconds?: number;
    }): Promise<LLMCache>;
    clearExpiredCache(): Promise<number>;
    clearAllCache(): Promise<number>;
    getCacheStats(): Promise<{
        totalEntries: number;
        totalHits: number;
        avgHitRate: number;
    }>;
}
//# sourceMappingURL=LLMRepository.d.ts.map