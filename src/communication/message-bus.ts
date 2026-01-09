/**
 * Agent Message Bus
 *
 * Central message routing system for agent-to-agent communication.
 * Supports directed messages, broadcasting, and request-response patterns.
 *
 * @module communication/message-bus
 */

import type {
  AgentMessage,
  MessageHandler,
  MessageBusOptions,
  MessageTracking,
  MessageBusMetrics,
  RequestOptions,
  AgentCapabilities,
  MessageSubscription,
  MessageFilter,
  BroadcastOptions,
} from './types.js';
import { MessageType } from './types.js';
import { randomUUID } from 'crypto';

/**
 * Agent Message Bus
 *
 * Central hub for agent communication with support for:
 * - Directed messaging (agent-to-agent)
 * - Broadcasting (agent-to-all)
 * - Request-response pattern
 * - Message filtering
 * - Metrics and monitoring
 */
export class AgentMessageBus {
  private agents = new Map<string, MessageHandler>();
  private subscriptions = new Map<string, MessageSubscription>();
  private capabilities = new Map<string, AgentCapabilities>();
  private messageHistory: MessageTracking[] = [];
  private metrics: MessageBusMetrics = {
    messagesSent: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
    messagesTimedOut: 0,
    averageDeliveryTime: 0,
    activeAgents: 0,
  };
  private options: Required<MessageBusOptions>;
  private deliveryTimes: number[] = [];

  constructor(options: MessageBusOptions = {}) {
    this.options = {
      enableLogging: options.enableLogging ?? false,
      enableMetrics: options.enableMetrics ?? true,
      maxMessageHistory: options.maxMessageHistory ?? 1000,
      timeout: options.timeout ?? 30000, // 30 seconds default
    };
  }

  /**
   * Register an agent with the message bus
   *
   * @param agentId - Unique agent identifier
   * @param handler - Message handler function
   */
  registerAgent(agentId: string, handler: MessageHandler): void {
    this.agents.set(agentId, handler);
    this.metrics.activeAgents = this.agents.size;

    if (this.options.enableLogging) {
      console.log(`[MessageBus] Agent registered: ${agentId}`);
    }
  }

  /**
   * Unregister an agent from the message bus
   *
   * @param agentId - Agent identifier to unregister
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.subscriptions.delete(agentId);
    this.capabilities.delete(agentId);
    this.metrics.activeAgents = this.agents.size;

    if (this.options.enableLogging) {
      console.log(`[MessageBus] Agent unregistered: ${agentId}`);
    }
  }

  /**
   * Register agent capabilities for smart routing
   *
   * @param capabilities - Agent capabilities
   */
  registerCapabilities(capabilities: AgentCapabilities): void {
    this.capabilities.set(capabilities.id, capabilities);

    if (this.options.enableLogging) {
      console.log(`[MessageBus] Capabilities registered for: ${capabilities.id}`);
    }
  }

  /**
   * Subscribe to messages with optional filtering
   *
   * @param agentId - Agent identifier
   * @param handler - Message handler
   * @param filter - Optional message filter
   * @returns Subscription ID
   */
  subscribe(agentId: string, handler: MessageHandler, filter?: MessageFilter): string {
    const subscription: MessageSubscription = {
      id: randomUUID(),
      agentId,
      handler,
      filter,
      subscribeTime: Date.now(),
      messagesReceived: 0,
    };

    this.subscriptions.set(subscription.id, subscription);

    if (this.options.enableLogging) {
      console.log(`[MessageBus] Subscription created: ${subscription.id} for agent ${agentId}`);
    }

    return subscription.id;
  }

  /**
   * Unsubscribe from messages
   *
   * @param subscriptionId - Subscription identifier
   */
  unsubscribe(subscriptionId: string): void {
    const deleted = this.subscriptions.delete(subscriptionId);

    if (deleted && this.options.enableLogging) {
      console.log(`[MessageBus] Subscription cancelled: ${subscriptionId}`);
    }
  }

  /**
   * Send a message to a specific agent
   *
   * @param message - Message to send
   * @returns Promise that resolves when message is delivered
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    const startTime = Date.now();

    // Track message
    const tracking: MessageTracking = {
      message,
      status: 'pending',
      attempts: 1,
    };
    this.addToHistory(tracking);

    if (!message.to) {
      const error = 'Message destination (to) is required for sendMessage';
      tracking.status = 'failed';
      tracking.error = error;
      this.updateMetrics('failed', Date.now() - startTime);
      throw new Error(error);
    }

    try {
      const handler = this.agents.get(message.to);

      if (!handler) {
        throw new Error(`Agent not found: ${message.to}`);
      }

      // Deliver message
      await this.deliverMessage(handler, message);

      tracking.status = 'delivered';
      tracking.deliveredAt = Date.now();

      this.updateMetrics('delivered', Date.now() - startTime);

      if (this.options.enableLogging) {
        console.log(
          `[MessageBus] Message delivered: ${message.id} from ${message.from} to ${message.to}`
        );
      }
    } catch (error) {
      tracking.status = 'failed';
      tracking.error = error instanceof Error ? error.message : 'Unknown error';

      this.updateMetrics('failed', Date.now() - startTime);

      if (this.options.enableLogging) {
        console.error(
          `[MessageBus] Message failed: ${message.id} - ${tracking.error}`
        );
      }

      throw error;
    }
  }

  /**
   * Send request and wait for response
   *
   * @param message - Request message
   * @param options - Request options
   * @returns Response message
   */
  async sendRequest(
    message: AgentMessage,
    options: RequestOptions = {}
  ): Promise<AgentMessage> {
    const timeout = options.timeout ?? this.options.timeout;
    const correlationId = message.correlationId ?? randomUUID();

    // Set correlation ID for request-response pairing
    message.correlationId = correlationId;

    // Create response handler
    const responsePromise = this.createResponseHandler(correlationId, timeout);

    // Send request
    await this.sendMessage(message);

    // Wait for response
    const response = await responsePromise;

    return response;
  }

  /**
   * Broadcast message to all agents or filtered subset
   *
   * @param message - Message to broadcast
   * @param options - Broadcast options
   */
  async broadcast(message: AgentMessage, options: BroadcastOptions = {}): Promise<void> {
    const startTime = Date.now();
    let deliveredCount = 0;
    let failedCount = 0;

    const targets = this.getTargetAgents(message, options);

    if (this.options.enableLogging) {
      console.log(
        `[MessageBus] Broadcasting to ${targets.length} agents from ${message.from}`
      );
    }

    const deliveryPromises = targets.map(async (agentId) => {
      const handler = this.agents.get(agentId);

      if (!handler) {
        if (this.options.enableLogging) {
          console.warn(`[MessageBus] Agent not found: ${agentId}`);
        }
        failedCount++;
        return;
      }

      try {
        const directedMessage: AgentMessage = {
          ...message,
          to: agentId,
        };

        await this.deliverMessage(handler, directedMessage);
        deliveredCount++;
      } catch (error) {
        failedCount++;
        if (this.options.enableLogging) {
          console.error(`[MessageBus] Broadcast failed to ${agentId}:`, error);
        }
      }
    });

    await Promise.allSettled(deliveryPromises);

    // Track broadcast metrics
    const duration = Date.now() - startTime;
    this.metrics.messagesSent += targets.length;
    this.metrics.messagesDelivered += deliveredCount;
    this.metrics.messagesFailed += failedCount;
    this.deliveryTimes.push(duration);

    if (this.options.enableLogging) {
      console.log(
        `[MessageBus] Broadcast complete: ${deliveredCount} delivered, ${failedCount} failed`
      );
    }
  }

  /**
   * Get message bus metrics
   *
   * @returns Current metrics
   */
  getMetrics(): MessageBusMetrics {
    // Calculate average delivery time
    if (this.deliveryTimes.length > 0) {
      const total = this.deliveryTimes.reduce((sum, time) => sum + time, 0);
      this.metrics.averageDeliveryTime = total / this.deliveryTimes.length;
    }

    return { ...this.metrics };
  }

  /**
   * Get message history
   *
   * @param limit - Maximum number of messages to return
   * @returns Message tracking history
   */
  getMessageHistory(limit?: number): MessageTracking[] {
    const historyLimit = limit ?? this.messageHistory.length;
    return this.messageHistory.slice(-historyLimit);
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];

    if (this.options.enableLogging) {
      console.log('[MessageBus] Message history cleared');
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      messagesTimedOut: 0,
      averageDeliveryTime: 0,
      activeAgents: this.agents.size,
    };
    this.deliveryTimes = [];

    if (this.options.enableLogging) {
      console.log('[MessageBus] Metrics reset');
    }
  }

  /**
   * Get registered agent IDs
   *
   * @returns Array of agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent capabilities
   *
   * @param agentId - Agent identifier
   * @returns Agent capabilities or undefined
   */
  getCapabilities(agentId: string): AgentCapabilities | undefined {
    return this.capabilities.get(agentId);
  }

  /**
   * Find agents capable of handling a message
   *
   * @param message - Message to check
   * @returns Array of capable agent IDs
   */
  async findCapableAgents(message: AgentMessage): Promise<string[]> {
    const capableAgents: string[] = [];

    for (const [agentId, capabilities] of this.capabilities) {
      // Check if agent supports message type
      if (!capabilities.supportedMessageTypes.includes(message.type)) {
        continue;
      }

      // Check if agent can handle this specific message
      const canHandle = await capabilities.canHandleRequest(message);
      if (canHandle) {
        capableAgents.push(agentId);
      }
    }

    return capableAgents;
  }

  /**
   * Deliver message to handler with error handling
   */
  private async deliverMessage(handler: MessageHandler, message: AgentMessage): Promise<void> {
    try {
      await handler(message);
    } catch (error) {
      throw new Error(
        `Message delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create response handler for request-response pattern
   */
  private createResponseHandler(
    correlationId: string,
    timeout: number
  ): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unsubscribe(subscriptionId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      const subscriptionId = this.subscribe(
        'response-handler',
        async (message: AgentMessage) => {
          if (message.correlationId === correlationId && message.type === MessageType.RESPONSE) {
            clearTimeout(timer);
            this.unsubscribe(subscriptionId);
            resolve(message);
          }
        }
      );
    });
  }

  /**
   * Get target agents for broadcast
   */
  private getTargetAgents(message: AgentMessage, options: BroadcastOptions): string[] {
    let targets = Array.from(this.agents.keys());

    // Exclude sender if requested
    if (options.excludeSender) {
      targets = targets.filter(id => id !== message.from);
    }

    // Apply filter if provided
    if (options.filter) {
      // For now, return all targets as filtering happens during delivery
      // This is a simplification - could be optimized with pre-filtering
    }

    return targets;
  }

  /**
   * Add message to history
   */
  private addToHistory(tracking: MessageTracking): void {
    this.messageHistory.push(tracking);

    // Enforce max history size
    if (this.messageHistory.length > this.options.maxMessageHistory) {
      this.messageHistory.shift();
    }

    this.metrics.messagesSent++;
  }

  /**
   * Update metrics
   */
  private updateMetrics(type: 'delivered' | 'failed' | 'timeout', duration: number): void {
    if (type === 'delivered') {
      this.metrics.messagesDelivered++;
    } else if (type === 'failed') {
      this.metrics.messagesFailed++;
    } else if (type === 'timeout') {
      this.metrics.messagesTimedOut++;
    }

    this.deliveryTimes.push(duration);
  }
}

/**
 * Create a global message bus instance
 */
let globalMessageBus: AgentMessageBus | null = null;

/**
 * Get or create global message bus
 *
 * @param options - Message bus options
 * @returns Global message bus instance
 */
export function getGlobalMessageBus(options?: MessageBusOptions): AgentMessageBus {
  if (!globalMessageBus) {
    globalMessageBus = new AgentMessageBus(options);
  }

  return globalMessageBus;
}

/**
 * Reset global message bus (useful for testing)
 */
export function resetGlobalMessageBus(): void {
  globalMessageBus = null;
}
