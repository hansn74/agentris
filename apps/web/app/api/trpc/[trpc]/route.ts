import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@agentris/api';
import { createTRPCContext } from '@agentris/api/src/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
