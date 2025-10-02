import { prisma, BatchStatus } from '@agentris/db';

export interface BatchPerformanceMetrics {
  batchId: string;
  totalTickets: number;
  activeTickets: number;
  processingTimeMs: number;
  averageTicketTimeMs: number;
  successRate: number;
  errorRate: number;
  throughput: number; // tickets per second
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
}

export interface BatchPerformanceReport {
  overallMetrics: {
    totalBatches: number;
    averageProcessingTimeMs: number;
    averageTicketsPerBatch: number;
    overallSuccessRate: number;
    peakThroughput: number;
  };
  batchMetrics: BatchPerformanceMetrics[];
  recommendations: string[];
}

export class BatchPerformanceMonitor {
  private metricsCache: Map<string, BatchPerformanceMetrics> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * Start monitoring a batch
   */
  startMonitoring(batchId: string): void {
    this.startTimes.set(batchId, Date.now());
    
    // Initialize metrics
    this.metricsCache.set(batchId, {
      batchId,
      totalTickets: 0,
      activeTickets: 0,
      processingTimeMs: 0,
      averageTicketTimeMs: 0,
      successRate: 0,
      errorRate: 0,
      throughput: 0,
    });

    // Start resource monitoring if available
    this.startResourceMonitoring(batchId);
  }

  /**
   * Stop monitoring and calculate final metrics
   */
  async stopMonitoring(batchId: string): Promise<BatchPerformanceMetrics> {
    const startTime = this.startTimes.get(batchId);
    if (!startTime) {
      throw new Error(`No monitoring started for batch ${batchId}`);
    }

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    // Get batch data
    const batch = await prisma.ticketBatch.findUnique({
      where: { id: batchId },
      include: {
        tickets: true,
        results: true,
      },
    });

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const totalTickets = batch.tickets.length;
    const activeTickets = batch.tickets.filter(t => !t.excluded).length;
    const successfulResults = batch.results.filter(r => r.success).length;
    const failedResults = batch.results.filter(r => !r.success).length;

    const metrics: BatchPerformanceMetrics = {
      batchId,
      totalTickets,
      activeTickets,
      processingTimeMs,
      averageTicketTimeMs: activeTickets > 0 ? processingTimeMs / activeTickets : 0,
      successRate: activeTickets > 0 ? (successfulResults / activeTickets) * 100 : 0,
      errorRate: activeTickets > 0 ? (failedResults / activeTickets) * 100 : 0,
      throughput: processingTimeMs > 0 ? (activeTickets / (processingTimeMs / 1000)) : 0,
    };

    // Add resource metrics if available
    const resourceMetrics = await this.getResourceMetrics(batchId);
    if (resourceMetrics) {
      metrics.memoryUsageMB = resourceMetrics.memoryUsageMB;
      metrics.cpuUsagePercent = resourceMetrics.cpuUsagePercent;
    }

    // Store final metrics
    this.metricsCache.set(batchId, metrics);

    // Clean up
    this.startTimes.delete(batchId);
    this.stopResourceMonitoring(batchId);

    return metrics;
  }

  /**
   * Get current metrics for a batch
   */
  getCurrentMetrics(batchId: string): BatchPerformanceMetrics | undefined {
    return this.metricsCache.get(batchId);
  }

  /**
   * Update metrics during processing
   */
  updateMetrics(
    batchId: string,
    updates: Partial<BatchPerformanceMetrics>
  ): void {
    const current = this.metricsCache.get(batchId);
    if (current) {
      this.metricsCache.set(batchId, { ...current, ...updates });
    }
  }

  /**
   * Generate performance report for multiple batches
   */
  async generatePerformanceReport(
    batchIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<BatchPerformanceReport> {
    // Query batches based on criteria
    const batches = await prisma.ticketBatch.findMany({
      where: {
        ...(batchIds && { id: { in: batchIds } }),
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
        status: {
          in: [BatchStatus.COMPLETED, BatchStatus.PARTIALLY_COMPLETED],
        },
      },
      include: {
        tickets: true,
        results: true,
      },
    });

    const batchMetrics: BatchPerformanceMetrics[] = [];
    let totalProcessingTime = 0;
    let totalTickets = 0;
    let totalSuccessful = 0;
    let peakThroughput = 0;

    for (const batch of batches) {
      const cached = this.metricsCache.get(batch.id);
      
      if (cached) {
        batchMetrics.push(cached);
        totalProcessingTime += cached.processingTimeMs;
        totalTickets += cached.activeTickets;
        totalSuccessful += Math.round(cached.activeTickets * (cached.successRate / 100));
        peakThroughput = Math.max(peakThroughput, cached.throughput);
      } else {
        // Calculate metrics for historical batches
        const metrics = await this.calculateHistoricalMetrics(batch);
        batchMetrics.push(metrics);
        totalProcessingTime += metrics.processingTimeMs;
        totalTickets += metrics.activeTickets;
        totalSuccessful += Math.round(metrics.activeTickets * (metrics.successRate / 100));
        peakThroughput = Math.max(peakThroughput, metrics.throughput);
      }
    }

    const overallMetrics = {
      totalBatches: batches.length,
      averageProcessingTimeMs: batches.length > 0 ? totalProcessingTime / batches.length : 0,
      averageTicketsPerBatch: batches.length > 0 ? totalTickets / batches.length : 0,
      overallSuccessRate: totalTickets > 0 ? (totalSuccessful / totalTickets) * 100 : 0,
      peakThroughput,
    };

    const recommendations = this.generateRecommendations(overallMetrics, batchMetrics);

    return {
      overallMetrics,
      batchMetrics,
      recommendations,
    };
  }

  /**
   * Calculate metrics for historical batches
   */
  private async calculateHistoricalMetrics(batch: any): Promise<BatchPerformanceMetrics> {
    const totalTickets = batch.tickets.length;
    const activeTickets = batch.tickets.filter((t: any) => !t.excluded).length;
    const successfulResults = batch.results.filter((r: any) => r.success).length;
    const failedResults = batch.results.filter((r: any) => !r.success).length;

    // Estimate processing time based on timestamps
    const processingTimeMs = batch.updatedAt && batch.createdAt
      ? new Date(batch.updatedAt).getTime() - new Date(batch.createdAt).getTime()
      : 0;

    return {
      batchId: batch.id,
      totalTickets,
      activeTickets,
      processingTimeMs,
      averageTicketTimeMs: activeTickets > 0 ? processingTimeMs / activeTickets : 0,
      successRate: activeTickets > 0 ? (successfulResults / activeTickets) * 100 : 0,
      errorRate: activeTickets > 0 ? (failedResults / activeTickets) * 100 : 0,
      throughput: processingTimeMs > 0 ? (activeTickets / (processingTimeMs / 1000)) : 0,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    overallMetrics: any,
    batchMetrics: BatchPerformanceMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Check average processing time
    if (overallMetrics.averageProcessingTimeMs > 60000) {
      recommendations.push(
        'Consider reducing batch sizes - average processing time exceeds 1 minute'
      );
    }

    // Check success rate
    if (overallMetrics.overallSuccessRate < 90) {
      recommendations.push(
        'Low success rate detected - review error logs and improve error handling'
      );
    }

    // Check batch size variations
    const batchSizes = batchMetrics.map(m => m.activeTickets);
    const avgSize = overallMetrics.averageTicketsPerBatch;
    const sizeVariance = this.calculateVariance(batchSizes, avgSize);
    
    if (sizeVariance > avgSize * 0.5) {
      recommendations.push(
        'High variance in batch sizes detected - consider standardizing batch sizes'
      );
    }

    // Check for performance degradation
    const throughputs = batchMetrics.map(m => m.throughput);
    if (throughputs.length > 5) {
      const recentAvg = throughputs.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const overallAvg = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      
      if (recentAvg < overallAvg * 0.8) {
        recommendations.push(
          'Performance degradation detected - recent batches processing slower than average'
        );
      }
    }

    // Check memory usage if available
    const memoryMetrics = batchMetrics.filter(m => m.memoryUsageMB);
    if (memoryMetrics.length > 0) {
      const avgMemory = memoryMetrics.reduce((a, b) => a + (b.memoryUsageMB || 0), 0) / memoryMetrics.length;
      if (avgMemory > 500) {
        recommendations.push(
          'High memory usage detected - consider optimizing memory consumption'
        );
      }
    }

    return recommendations;
  }

  /**
   * Calculate variance for a set of numbers
   */
  private calculateVariance(numbers: number[], mean: number): number {
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Start resource monitoring (placeholder for actual implementation)
   */
  private startResourceMonitoring(batchId: string): void {
    // In production, this would integrate with actual monitoring tools
    console.log(`Starting resource monitoring for batch ${batchId}`);
  }

  /**
   * Stop resource monitoring
   */
  private stopResourceMonitoring(batchId: string): void {
    console.log(`Stopping resource monitoring for batch ${batchId}`);
  }

  /**
   * Get resource metrics (placeholder for actual implementation)
   */
  private async getResourceMetrics(batchId: string): Promise<{
    memoryUsageMB: number;
    cpuUsagePercent: number;
  } | null> {
    // In production, this would fetch actual metrics
    return {
      memoryUsageMB: Math.random() * 200 + 100, // Mock: 100-300 MB
      cpuUsagePercent: Math.random() * 50 + 20, // Mock: 20-70%
    };
  }

  /**
   * Export metrics to external monitoring system
   */
  async exportMetrics(
    batchId: string,
    exportFormat: 'json' | 'csv' | 'prometheus' = 'json'
  ): Promise<string> {
    const metrics = this.metricsCache.get(batchId);
    if (!metrics) {
      throw new Error(`No metrics found for batch ${batchId}`);
    }

    switch (exportFormat) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      
      case 'csv':
        const headers = Object.keys(metrics).join(',');
        const values = Object.values(metrics).join(',');
        return `${headers}\n${values}`;
      
      case 'prometheus':
        return this.formatPrometheusMetrics(metrics);
      
      default:
        throw new Error(`Unsupported export format: ${exportFormat}`);
    }
  }

  /**
   * Format metrics for Prometheus
   */
  private formatPrometheusMetrics(metrics: BatchPerformanceMetrics): string {
    const lines: string[] = [
      `# HELP batch_processing_time_ms Batch processing time in milliseconds`,
      `# TYPE batch_processing_time_ms gauge`,
      `batch_processing_time_ms{batch_id="${metrics.batchId}"} ${metrics.processingTimeMs}`,
      '',
      `# HELP batch_tickets_total Total number of tickets in batch`,
      `# TYPE batch_tickets_total gauge`,
      `batch_tickets_total{batch_id="${metrics.batchId}"} ${metrics.totalTickets}`,
      '',
      `# HELP batch_success_rate Batch success rate percentage`,
      `# TYPE batch_success_rate gauge`,
      `batch_success_rate{batch_id="${metrics.batchId}"} ${metrics.successRate}`,
      '',
      `# HELP batch_throughput Tickets processed per second`,
      `# TYPE batch_throughput gauge`,
      `batch_throughput{batch_id="${metrics.batchId}"} ${metrics.throughput}`,
    ];

    if (metrics.memoryUsageMB) {
      lines.push(
        '',
        `# HELP batch_memory_usage_mb Memory usage in megabytes`,
        `# TYPE batch_memory_usage_mb gauge`,
        `batch_memory_usage_mb{batch_id="${metrics.batchId}"} ${metrics.memoryUsageMB}`
      );
    }

    if (metrics.cpuUsagePercent) {
      lines.push(
        '',
        `# HELP batch_cpu_usage_percent CPU usage percentage`,
        `# TYPE batch_cpu_usage_percent gauge`,
        `batch_cpu_usage_percent{batch_id="${metrics.batchId}"} ${metrics.cpuUsagePercent}`
      );
    }

    return lines.join('\n');
  }
}