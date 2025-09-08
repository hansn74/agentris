import { NextResponse } from 'next/server';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export async function GET(): Promise<NextResponse<HealthCheck>> {
  const memoryUsage = process.memoryUsage();

  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memoryUsage: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
    },
  };

  return NextResponse.json(healthCheck, { status: 200 });
}
