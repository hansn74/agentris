import { PrismaClient, Clarification, Prisma } from '@prisma/client';

export interface CreateClarificationInput {
  ticketId: string;
  question: string;
  source: string;
  askedBy?: string;
  answer?: string;
}

export interface UpdateClarificationInput {
  question?: string;
  answer?: string;
  askedBy?: string;
}

export interface ClarificationFilter {
  ticketId?: string;
  source?: string;
  answered?: boolean;
  askedBy?: string;
}

export class ClarificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateClarificationInput): Promise<Clarification> {
    return this.prisma.clarification.create({
      data: {
        ticketId: input.ticketId,
        question: input.question,
        source: input.source,
        askedBy: input.askedBy,
        answer: input.answer
      }
    });
  }

  async createMany(inputs: CreateClarificationInput[]): Promise<number> {
    const result = await this.prisma.clarification.createMany({
      data: inputs,
      skipDuplicates: true
    });
    return result.count;
  }

  async findById(id: string): Promise<Clarification | null> {
    return this.prisma.clarification.findUnique({
      where: { id },
      include: {
        ticket: true
      }
    });
  }

  async findByTicketId(ticketId: string): Promise<Clarification[]> {
    return this.prisma.clarification.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findUnanswered(ticketId?: string): Promise<Clarification[]> {
    const where: Prisma.ClarificationWhereInput = {
      answer: null
    };
    
    if (ticketId) {
      where.ticketId = ticketId;
    }

    return this.prisma.clarification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: true
      }
    });
  }

  async findAnswered(ticketId?: string): Promise<Clarification[]> {
    const where: Prisma.ClarificationWhereInput = {
      answer: { not: null }
    };
    
    if (ticketId) {
      where.ticketId = ticketId;
    }

    return this.prisma.clarification.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        ticket: true
      }
    });
  }

  async findWithFilter(filter: ClarificationFilter): Promise<Clarification[]> {
    const where: Prisma.ClarificationWhereInput = {};

    if (filter.ticketId) {
      where.ticketId = filter.ticketId;
    }
    
    if (filter.source) {
      where.source = filter.source;
    }
    
    if (filter.askedBy) {
      where.askedBy = filter.askedBy;
    }
    
    if (filter.answered !== undefined) {
      where.answer = filter.answered ? { not: null } : null;
    }

    return this.prisma.clarification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: true
      }
    });
  }

  async update(id: string, input: UpdateClarificationInput): Promise<Clarification> {
    return this.prisma.clarification.update({
      where: { id },
      data: {
        question: input.question,
        answer: input.answer,
        askedBy: input.askedBy
      }
    });
  }

  async addAnswer(id: string, answer: string): Promise<Clarification> {
    return this.prisma.clarification.update({
      where: { id },
      data: { answer }
    });
  }

  async delete(id: string): Promise<Clarification> {
    return this.prisma.clarification.delete({
      where: { id }
    });
  }

  async deleteByTicketId(ticketId: string): Promise<number> {
    const result = await this.prisma.clarification.deleteMany({
      where: { ticketId }
    });
    return result.count;
  }

  async getStatsByTicket(ticketId: string): Promise<{
    total: number;
    answered: number;
    unanswered: number;
    sources: { source: string; count: number }[];
  }> {
    const clarifications = await this.findByTicketId(ticketId);
    
    const stats = {
      total: clarifications.length,
      answered: clarifications.filter(c => c.answer !== null).length,
      unanswered: clarifications.filter(c => c.answer === null).length,
      sources: [] as { source: string; count: number }[]
    };
    
    // Group by source
    const sourceMap = new Map<string, number>();
    clarifications.forEach(c => {
      const count = sourceMap.get(c.source) || 0;
      sourceMap.set(c.source, count + 1);
    });
    
    stats.sources = Array.from(sourceMap.entries()).map(([source, count]) => ({
      source,
      count
    }));
    
    return stats;
  }

  async trackAnswerRate(): Promise<{
    totalQuestions: number;
    answeredQuestions: number;
    answerRate: number;
    bySource: { source: string; total: number; answered: number; rate: number }[];
  }> {
    const allClarifications = await this.prisma.clarification.findMany();
    
    const totalQuestions = allClarifications.length;
    const answeredQuestions = allClarifications.filter(c => c.answer !== null).length;
    const answerRate = totalQuestions > 0 ? (answeredQuestions / totalQuestions) : 0;
    
    // Group by source
    const sourceStats = new Map<string, { total: number; answered: number }>();
    
    allClarifications.forEach(c => {
      const stats = sourceStats.get(c.source) || { total: 0, answered: 0 };
      stats.total++;
      if (c.answer) {
        stats.answered++;
      }
      sourceStats.set(c.source, stats);
    });
    
    const bySource = Array.from(sourceStats.entries()).map(([source, stats]) => ({
      source,
      total: stats.total,
      answered: stats.answered,
      rate: stats.total > 0 ? (stats.answered / stats.total) : 0
    }));
    
    return {
      totalQuestions,
      answeredQuestions,
      answerRate,
      bySource
    };
  }

  async findRecentlyAnswered(limit = 10): Promise<Clarification[]> {
    return this.prisma.clarification.findMany({
      where: {
        answer: { not: null }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        ticket: true
      }
    });
  }
}