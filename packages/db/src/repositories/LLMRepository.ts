import { PrismaClient, LLMRequest, LLMUsage, LLMCache, LLMProvider, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { CryptoService } from '../utils/crypto';

export class LLMRepository {
  constructor(private prisma: PrismaClient) {}

  // LLMRequest methods
  async createRequest(data: {
    provider: LLMProvider;
    model: string;
    prompt: string;
    response?: string;
    tokenCount: number;
    cost: number;
    userId: string;
    cacheHit?: boolean;
    error?: string;
  }): Promise<LLMRequest> {
    // Encrypt sensitive fields before storing
    const encryptedData = {
      ...data,
      prompt: await CryptoService.encrypt(data.prompt),
      response: data.response ? await CryptoService.encrypt(data.response) : undefined,
      error: data.error ? await CryptoService.encrypt(data.error) : undefined,
    };

    const created = await this.prisma.lLMRequest.create({
      data: encryptedData,
    });

    // Decrypt before returning
    return {
      ...created,
      prompt: await CryptoService.decrypt(created.prompt),
      response: created.response ? await CryptoService.decrypt(created.response) : null,
      error: created.error ? await CryptoService.decrypt(created.error) : null,
    };
  }

  async getRequestById(id: string): Promise<LLMRequest | null> {
    const request = await this.prisma.lLMRequest.findUnique({
      where: { id },
    });

    if (!request) return null;

    // Decrypt sensitive fields
    return {
      ...request,
      prompt: await CryptoService.decrypt(request.prompt),
      response: request.response ? await CryptoService.decrypt(request.response) : null,
      error: request.error ? await CryptoService.decrypt(request.error) : null,
    };
  }

  async getRequestsByUser(userId: string, limit?: number): Promise<LLMRequest[]> {
    const requests = await this.prisma.lLMRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Decrypt sensitive fields for each request
    return Promise.all(
      requests.map(async (request) => ({
        ...request,
        prompt: await CryptoService.decrypt(request.prompt),
        response: request.response ? await CryptoService.decrypt(request.response) : null,
        error: request.error ? await CryptoService.decrypt(request.error) : null,
      }))
    );
  }

  // LLMUsage methods
  async upsertUsage(data: {
    userId: string;
    date: Date;
    provider: LLMProvider;
    totalTokens?: number;
    totalCost?: number;
    requestCount?: number;
    cacheHits?: number;
  }): Promise<LLMUsage> {
    const dateString = data.date.toISOString().split('T')[0];
    const dateOnly = new Date(dateString + 'T00:00:00Z');
    
    return this.prisma.lLMUsage.upsert({
      where: {
        userId_date_provider: {
          userId: data.userId,
          date: dateOnly,
          provider: data.provider,
        },
      },
      update: {
        totalTokens: { increment: data.totalTokens || 0 },
        totalCost: { increment: data.totalCost || 0 },
        requestCount: { increment: data.requestCount || 0 },
        cacheHits: { increment: data.cacheHits || 0 },
      },
      create: {
        userId: data.userId,
        date: dateOnly,
        provider: data.provider,
        totalTokens: data.totalTokens || 0,
        totalCost: data.totalCost || 0,
        requestCount: data.requestCount || 0,
        cacheHits: data.cacheHits || 0,
      },
    });
  }

  async getUsageByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LLMUsage[]> {
    const where: Prisma.LLMUsageWhereInput = { userId };
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return this.prisma.lLMUsage.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getAggregatedUsage(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    _sum: {
      totalTokens: number | null;
      totalCost: number | null;
      requestCount: number | null;
      cacheHits: number | null;
    };
  }> {
    const where: Prisma.LLMUsageWhereInput = {};
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return this.prisma.lLMUsage.aggregate({
      where,
      _sum: {
        totalTokens: true,
        totalCost: true,
        requestCount: true,
        cacheHits: true,
      },
    });
  }

  // LLMCache methods
  generateCacheKey(provider: LLMProvider, model: string, prompt: string): string {
    const hash = createHash('sha256');
    hash.update(`${provider}:${model}:${prompt}`);
    return hash.digest('hex');
  }

  async getCachedResponse(cacheKey: string): Promise<LLMCache | null> {
    const cached = await this.prisma.lLMCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.expiresAt > new Date()) {
      // Update hit count and last accessed
      await this.prisma.lLMCache.update({
        where: { id: cached.id },
        data: {
          hitCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });
      
      // Decrypt response before returning
      return {
        ...cached,
        response: await CryptoService.decrypt(cached.response),
      };
    }

    // Remove expired cache
    if (cached) {
      await this.prisma.lLMCache.delete({
        where: { id: cached.id },
      });
    }

    return null;
  }

  async setCachedResponse(data: {
    cacheKey: string;
    provider: LLMProvider;
    model: string;
    response: string;
    tokenCount: number;
    ttlSeconds?: number;
  }): Promise<LLMCache> {
    const ttl = data.ttlSeconds || 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Encrypt response before storing
    const encryptedResponse = await CryptoService.encrypt(data.response);

    const cached = await this.prisma.lLMCache.upsert({
      where: { cacheKey: data.cacheKey },
      update: {
        response: encryptedResponse,
        tokenCount: data.tokenCount,
        expiresAt,
        hitCount: 0,
        lastAccessed: new Date(),
      },
      create: {
        cacheKey: data.cacheKey,
        provider: data.provider,
        model: data.model,
        response: encryptedResponse,
        tokenCount: data.tokenCount,
        expiresAt,
      },
    });

    // Return with decrypted response
    return {
      ...cached,
      response: data.response, // Return original unencrypted version
    };
  }

  async clearExpiredCache(): Promise<number> {
    const result = await this.prisma.lLMCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  async clearAllCache(): Promise<number> {
    const result = await this.prisma.lLMCache.deleteMany({});
    return result.count;
  }

  async getCacheStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    avgHitRate: number;
  }> {
    const stats = await this.prisma.lLMCache.aggregate({
      _count: { id: true },
      _sum: { hitCount: true },
      _avg: { hitCount: true },
    });

    return {
      totalEntries: stats._count.id,
      totalHits: stats._sum.hitCount || 0,
      avgHitRate: stats._avg.hitCount || 0,
    };
  }
}