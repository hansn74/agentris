"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMRepository = void 0;
const crypto_1 = require("crypto");
const crypto_2 = require("../utils/crypto");
class LLMRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    // LLMRequest methods
    async createRequest(data) {
        // Encrypt sensitive fields before storing
        const encryptedData = {
            ...data,
            prompt: await crypto_2.CryptoService.encrypt(data.prompt),
            response: data.response ? await crypto_2.CryptoService.encrypt(data.response) : undefined,
            error: data.error ? await crypto_2.CryptoService.encrypt(data.error) : undefined,
        };
        const created = await this.prisma.lLMRequest.create({
            data: encryptedData,
        });
        // Decrypt before returning
        return {
            ...created,
            prompt: await crypto_2.CryptoService.decrypt(created.prompt),
            response: created.response ? await crypto_2.CryptoService.decrypt(created.response) : null,
            error: created.error ? await crypto_2.CryptoService.decrypt(created.error) : null,
        };
    }
    async getRequestById(id) {
        const request = await this.prisma.lLMRequest.findUnique({
            where: { id },
        });
        if (!request)
            return null;
        // Decrypt sensitive fields
        return {
            ...request,
            prompt: await crypto_2.CryptoService.decrypt(request.prompt),
            response: request.response ? await crypto_2.CryptoService.decrypt(request.response) : null,
            error: request.error ? await crypto_2.CryptoService.decrypt(request.error) : null,
        };
    }
    async getRequestsByUser(userId, limit) {
        const requests = await this.prisma.lLMRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        // Decrypt sensitive fields for each request
        return Promise.all(requests.map(async (request) => ({
            ...request,
            prompt: await crypto_2.CryptoService.decrypt(request.prompt),
            response: request.response ? await crypto_2.CryptoService.decrypt(request.response) : null,
            error: request.error ? await crypto_2.CryptoService.decrypt(request.error) : null,
        })));
    }
    // LLMUsage methods
    async upsertUsage(data) {
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
    async getUsageByUser(userId, startDate, endDate) {
        const where = { userId };
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = startDate;
            if (endDate)
                where.date.lte = endDate;
        }
        return this.prisma.lLMUsage.findMany({
            where,
            orderBy: { date: 'desc' },
        });
    }
    async getAggregatedUsage(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = startDate;
            if (endDate)
                where.date.lte = endDate;
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
    generateCacheKey(provider, model, prompt) {
        const hash = (0, crypto_1.createHash)('sha256');
        hash.update(`${provider}:${model}:${prompt}`);
        return hash.digest('hex');
    }
    async getCachedResponse(cacheKey) {
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
                response: await crypto_2.CryptoService.decrypt(cached.response),
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
    async setCachedResponse(data) {
        const ttl = data.ttlSeconds || 3600; // Default 1 hour
        const expiresAt = new Date(Date.now() + ttl * 1000);
        // Encrypt response before storing
        const encryptedResponse = await crypto_2.CryptoService.encrypt(data.response);
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
    async clearExpiredCache() {
        const result = await this.prisma.lLMCache.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
        return result.count;
    }
    async clearAllCache() {
        const result = await this.prisma.lLMCache.deleteMany({});
        return result.count;
    }
    async getCacheStats() {
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
exports.LLMRepository = LLMRepository;
//# sourceMappingURL=LLMRepository.js.map