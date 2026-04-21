// ============================================================================
// DnD Offline Multiplayer - WebSocket Client
// ============================================================================

import type { MessageType, WebSocketMessage } from '../../shared/index.js';

interface EventHandler {
  (payload: unknown): void;
}

/**
 * WebSocket Manager - Client connection handling with reconnection logic
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private messageQueue: unknown[] = [];
  private eventHandlers: Record<string, EventHandler[]> = {};
  private connected = false;

  connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Process queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) this.send(message as { type: MessageType; payload: unknown });
      }
      
      this.triggerHandlers('open', undefined);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        console.log('Received:', message.type, message.payload);
        
        // Trigger handlers for this message type
        if (this.eventHandlers[message.type]) {
          this.eventHandlers[message.type].forEach(handler => handler(message.payload));
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.connected = false;
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('Max reconnection attempts reached');
        this.triggerHandlers('disconnect', { maxAttemptsReached: true });
      }
    };

    this.ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
      this.triggerHandlers('error', error);
    };
  }

  send(message: { type: MessageType; payload: unknown }): void {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  on(type: string, handler: EventHandler): void {
    if (!this.eventHandlers[type]) {
      this.eventHandlers[type] = [];
    }
    this.eventHandlers[type].push(handler);
  }

  off(type: string, handler: EventHandler): void {
    if (this.eventHandlers[type]) {
      const index = this.eventHandlers[type].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[type].splice(index, 1);
      }
    }
  }

  private triggerHandlers(event: string, data: unknown): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
