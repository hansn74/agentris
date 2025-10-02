import { PrismaClient, AnalysisType, AmbiguityPattern } from '@prisma/client';

export interface CreateAnalysisInput {
  ticketId: string;
  type: AnalysisType;
  findings: Record<string, any>;
  confidence: number;
  score?: number;
  patterns?: AmbiguityPattern[];
}

export interface UpdateAnalysisInput {
  findings?: Record<string, any>;
  confidence?: number;
  score?: number;
  patterns?: AmbiguityPattern[];
}

export class AnalysisRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateAnalysisInput) {
    return this.prisma.analysis.create({
      data: {
        ticketId: input.ticketId,
        type: input.type,
        findings: input.findings,
        confidence: input.confidence,
        score: input.score,
        patterns: input.patterns || [],
      },
    });
  }

  async findById(id: string) {
    return this.prisma.analysis.findUnique({
      where: { id },
      include: { ticket: true },
    });
  }

  async findByTicketAndType(ticketId: string, type: AnalysisType) {
    return this.prisma.analysis.findUnique({
      where: {
        ticketId_type: {
          ticketId,
          type,
        },
      },
    });
  }

  async findByTicket(ticketId: string) {
    return this.prisma.analysis.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, input: UpdateAnalysisInput) {
    return this.prisma.analysis.update({
      where: { id },
      data: {
        findings: input.findings,
        confidence: input.confidence,
        score: input.score,
        patterns: input.patterns,
        updatedAt: new Date(),
      },
    });
  }

  async upsert(ticketId: string, type: AnalysisType, input: CreateAnalysisInput) {
    return this.prisma.analysis.upsert({
      where: {
        ticketId_type: {
          ticketId,
          type,
        },
      },
      create: {
        ticketId: input.ticketId,
        type: input.type,
        findings: input.findings,
        confidence: input.confidence,
        score: input.score,
        patterns: input.patterns || [],
      },
      update: {
        findings: input.findings,
        confidence: input.confidence,
        score: input.score,
        patterns: input.patterns || [],
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.analysis.delete({
      where: { id },
    });
  }

  async deleteByTicket(ticketId: string) {
    return this.prisma.analysis.deleteMany({
      where: { ticketId },
    });
  }

  async getRecentAnalyses(limit = 10) {
    return this.prisma.analysis.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { ticket: true },
    });
  }
}