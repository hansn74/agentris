import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@agentris/api';

// Type assertion needed due to Prisma type inference issue
export const trpc = createTRPCReact<AppRouter>() as any;
