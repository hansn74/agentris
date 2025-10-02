import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { appRouter } from './routers';
import { createTRPCContext } from './trpc';

export const createWSServer = (port: number = 3001) => {
  const wss = new WebSocketServer({
    port,
  });

  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: async (opts) => {
      // For WebSocket connections, we need to handle authentication differently
      // Since we can't access the session directly from the WebSocket connection
      // We'll need to pass authentication tokens through the connection params
      return createTRPCContext({
        session: null, // Will be handled through connection params
      });
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });

  wss.on('connection', (ws) => {
    console.log(`WebSocket client connected (total: ${wss.clients.size})`);
    
    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
    });

    ws.on('close', () => {
      console.log(`WebSocket client disconnected (total: ${wss.clients.size})`);
    });
  });

  console.log(`WebSocket server listening on port ${port}`);

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing WebSocket server');
    handler.broadcastReconnectNotification();
    wss.close();
  });

  return {
    wss,
    handler,
  };
};