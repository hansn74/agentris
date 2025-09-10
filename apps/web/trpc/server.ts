import { headers } from 'next/headers';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createServerSideHelpers } from '@trpc/react-query/server';
import superjson from 'superjson';
import type { AppRouter } from '@agentris/api';

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers() {
        return {
          cookie: headers().get('cookie') ?? '',
        };
      },
      transformer: superjson,
    }),
  ],
});