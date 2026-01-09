/**
 * Agent Communication Protocol Types
 *
 * Standardized message format for agent-to-agent communication
 * to enable better orchestration and debugging in multi-agent systems.
 *
 * @module communication/types
 */

import { z } from 'zod';

/**
 * Message type enum
 */
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ERROR = 'error',
}

/**
 * Zod schema for AgentMessage validation
 */
export const AgentMessageSchema = z.object({
  id: z.string().min(1, 'Message ID is required'),
  from: z.string().min(1, 'Sender agent ID is required'),
  to: z.string().optional(),
  type: z.nativeEnum(MessageType),
  payload: z.unknown().optional(), // Make payload optional
  timestamp: z.number().int().positive(),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Agent message interface
 */
export interface AgentMessage {
  id: string;
  from: string; // Agent ID
  to?: string; // Agent ID (optional, for directed messages)
  type: MessageType;
  payload?: unknown; // Make payload optional to match schema
  timestamp: number;
  correlationId?: string; // For request-response pairing
  metadata?: Record<string, unknown>;
}

/**
 * Message handler function signature
 */
export type MessageHandler = (message: AgentMessage) => Promise<AgentMessage | void>;

/**
 * Communicating agent interface
 */
export interface CommunicatingAgent {
  id: string;
  sendMessage(message: AgentMessage): void | Promise<void>;
  onMessage(handler: MessageHandler): void;
}

/**
 * Message bus options
 */
export interface MessageBusOptions {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  maxMessageHistory?: number;
  timeout?: number; // Message timeout in milliseconds
}

/**
 * Message delivery status
 */
export type MessageDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'timeout';

/**
 * Message tracking information
 */
export interface MessageTracking {
  message: AgentMessage;
  status: MessageDeliveryStatus;
  attempts: number;
  deliveredAt?: number;
  error?: string;
}

/**
 * Message bus metrics
 */
export interface MessageBusMetrics {
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  messagesTimedOut: number;
  averageDeliveryTime: number;
  activeAgents: number;
}

/**
 * Request-response options
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  expectedResponseType?: MessageType;
}

/**
 * Agent capabilities for message routing
 */
export interface AgentCapabilities {
  id: string;
  supportedMessageTypes: MessageType[];
  canHandleRequest: (message: AgentMessage) => boolean | Promise<boolean>;
}

/**
 * Subscription filter for selective message handling
 */
export type MessageFilter = (message: AgentMessage) => boolean | Promise<boolean>;

/**
 * Message subscription
 */
export interface MessageSubscription {
  id: string;
  agentId: string;
  filter?: MessageFilter;
  handler: MessageHandler;
  subscribeTime: number;
  messagesReceived: number;
}

/**
 * Broadcast options
 */
export interface BroadcastOptions {
  excludeSender?: boolean;
  filter?: MessageFilter;
  timeout?: number;
}
