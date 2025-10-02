import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';
import { z } from 'zod';
import type { Recommendation, OrgPatterns } from '@agentris/shared';

// WebSocket message types
const wsMessageSchema = z.object({
  type: z.enum(['subscribe', 'unsubscribe', 'update', 'recalculate']),
  ticketId: z.string().optional(),
  orgId: z.string().optional(),
  data: z.any().optional()
});

type WSMessage = z.infer<typeof wsMessageSchema>;

interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  orgId?: string;
}

export class RecommendationUpdateService extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private recommendationCache: Map<string, Recommendation[]> = new Map();
  private updateQueue: Map<string, any[]> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startProcessingQueue();
  }

  /**
   * Initialize WebSocket server
   */
  initializeWSS(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      const client: Client = {
        id: clientId,
        ws,
        subscriptions: new Set()
      };

      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected`);

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (data: Buffer) => {
        try {
          const message = wsMessageSchema.parse(JSON.parse(data.toString()));
          this.handleMessage(client, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`Client ${clientId} disconnected`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(client: Client, message: WSMessage) {
    switch (message.type) {
      case 'subscribe':
        if (message.ticketId) {
          client.subscriptions.add(`ticket:${message.ticketId}`);
          client.orgId = message.orgId;
          
          // Send cached recommendations if available
          const cached = this.recommendationCache.get(message.ticketId);
          if (cached) {
            client.ws.send(JSON.stringify({
              type: 'recommendations',
              ticketId: message.ticketId,
              data: cached,
              fromCache: true
            }));
          }
        }
        break;

      case 'unsubscribe':
        if (message.ticketId) {
          client.subscriptions.delete(`ticket:${message.ticketId}`);
        }
        break;

      case 'recalculate':
        if (message.ticketId && message.data) {
          this.queueRecalculation(message.ticketId, message.data);
        }
        break;
    }
  }

  /**
   * Queue a recalculation request
   */
  private queueRecalculation(ticketId: string, changes: any) {
    if (!this.updateQueue.has(ticketId)) {
      this.updateQueue.set(ticketId, []);
    }
    this.updateQueue.get(ticketId)!.push({
      changes,
      timestamp: Date.now()
    });
  }

  /**
   * Process queued updates
   */
  private startProcessingQueue() {
    this.processingInterval = setInterval(() => {
      this.processUpdateQueue();
    }, 2000); // Process every 2 seconds
  }

  /**
   * Process the update queue
   */
  private async processUpdateQueue() {
    for (const [ticketId, updates] of this.updateQueue.entries()) {
      if (updates.length > 0) {
        // Get the latest update (debouncing)
        const latestUpdate = updates[updates.length - 1];
        
        // Clear the queue for this ticket
        this.updateQueue.set(ticketId, []);
        
        // Emit event for recalculation
        this.emit('recalculate', {
          ticketId,
          changes: latestUpdate.changes
        });
      }
    }
  }

  /**
   * Broadcast recommendation updates to subscribed clients
   */
  broadcastRecommendationUpdate(
    ticketId: string,
    recommendations: Recommendation[],
    updateType: 'full' | 'partial' | 'conflict' = 'full'
  ) {
    // Update cache
    this.recommendationCache.set(ticketId, recommendations);

    // Find subscribed clients
    const subscription = `ticket:${ticketId}`;
    const message = JSON.stringify({
      type: 'recommendation-update',
      updateType,
      ticketId,
      data: recommendations,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients.values()) {
      if (client.subscriptions.has(subscription) && 
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Send confidence score updates
   */
  broadcastConfidenceUpdate(
    ticketId: string,
    recommendationId: string,
    newConfidence: number,
    factors: string[]
  ) {
    const subscription = `ticket:${ticketId}`;
    const message = JSON.stringify({
      type: 'confidence-update',
      ticketId,
      recommendationId,
      confidence: newConfidence,
      factors,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients.values()) {
      if (client.subscriptions.has(subscription) && 
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Send pattern analysis updates
   */
  broadcastPatternUpdate(
    orgId: string,
    patterns: OrgPatterns,
    affectedTickets: string[]
  ) {
    const message = JSON.stringify({
      type: 'pattern-update',
      orgId,
      patterns,
      affectedTickets,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients.values()) {
      if (client.orgId === orgId && 
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Send conflict detected notification
   */
  broadcastConflictDetected(
    ticketId: string,
    conflicts: any[],
    severity: 'critical' | 'high' | 'medium' | 'low'
  ) {
    const subscription = `ticket:${ticketId}`;
    const message = JSON.stringify({
      type: 'conflict-detected',
      ticketId,
      conflicts,
      severity,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients.values()) {
      if (client.subscriptions.has(subscription) && 
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get subscription count for a ticket
   */
  getSubscriptionCount(ticketId: string): number {
    const subscription = `ticket:${ticketId}`;
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(subscription)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();
    this.recommendationCache.clear();
    this.updateQueue.clear();
  }
}

// Singleton instance
export const recommendationUpdateService = new RecommendationUpdateService();