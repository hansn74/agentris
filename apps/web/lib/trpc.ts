import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@agentris/api';

export const trpc = createTRPCReact<AppRouter>();
