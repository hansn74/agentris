'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, splitLink, wsLink } from '@trpc/client';
import React, { useState } from 'react';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => {
    // Check if we're in the browser
    const isClient = typeof window !== 'undefined';
    
    // Only create WebSocket link on client side
    const wsLinkInstance = isClient
      ? wsLink({
          client: {
            url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
            WebSocket: WebSocket,
          },
          transformer: superjson,
        })
      : null;

    return trpc.createClient({
      links: [
        // Split link to route subscriptions through WebSocket
        splitLink({
          condition: (op) => {
            return isClient && op.type === 'subscription';
          },
          true: wsLinkInstance!,
          false: httpBatchLink({
            url: `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/trpc`,
            transformer: superjson,
          }),
        }),
      ],
    });
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
