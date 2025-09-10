/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@agentris/api';
import { createTRPCContext } from '@agentris/api';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter as any,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
