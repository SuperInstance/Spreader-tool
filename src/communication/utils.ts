/**
 * Agent Communication Utilities
 *
 * Helper functions for creating and validating agent messages.
 *
 * @module communication/utils
 */

import { randomUUID } from 'crypto';
import type { AgentMessage, MessageType } from './types.js';
import { AgentMessageSchema } from './types.js';

/**
 * Create a new agent message
 *
 * @param from - Sender agent ID
 * @param type - Message type
 * @param payload - Message payload
 * @param options - Optional message properties
 * @returns Validated agent message
 */
export function createMessage(
  from: string,
  type: MessageType,
  payload: unknown,
  options: {
    to?: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): AgentMessage {
  const message: AgentMessage = {
    id: randomUUID(),
    from,
    to: options.to,
    type,
    payload,
    timestamp: Date.now(),
    correlationId: options.correlationId,
    metadata: options.metadata,
  };

  return validateMessage(message);
}

/**
 * Create a request message
 *
 * @param from - Sender agent ID
 * @param to - Recipient agent ID
 * @param payload - Request payload
 * @param metadata - Optional metadata
 * @returns Request message
 */
export function createRequest(
  from: string,
  to: string,
  payload: unknown,
  metadata?: Record<string, unknown>
): AgentMessage {
  return createMessage(from, 'request' as MessageType, payload, { to, metadata });
}

/**
 * Create a response message
 *
 * @param from - Sender agent ID
 * @param to - Recipient agent ID
 * @param payload - Response payload
 * @param correlationId - Correlation ID for request-response pairing
 * @param metadata - Optional metadata
 * @returns Response message
 */
export function createResponse(
  from: string,
  to: string,
  payload: unknown,
  correlationId: string,
  metadata?: Record<string, unknown>
): AgentMessage {
  return createMessage(from, 'response' as MessageType, payload, {
    to,
    correlationId,
    metadata,
  });
}

/**
 * Create a notification message
 *
 * @param from - Sender agent ID
 * @param payload - Notification payload
 * @param to - Optional recipient agent ID
 * @param metadata - Optional metadata
 * @returns Notification message
 */
export function createNotification(
  from: string,
  payload: unknown,
  to?: string,
  metadata?: Record<string, unknown>
): AgentMessage {
  return createMessage(from, 'notification' as MessageType, payload, { to, metadata });
}

/**
 * Create an error message
 *
 * @param from - Sender agent ID
 * @param to - Recipient agent ID
 * * @param error - Error object or message
 * @param correlationId - Correlation ID for request-response pairing
 * @param metadata - Optional metadata
 * @returns Error message
 */
export function createError(
  from: string,
  to: string,
  error: Error | string,
  correlationId?: string,
  metadata?: Record<string, unknown>
): AgentMessage {
  const errorPayload = {
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    name: error instanceof Error ? error.name : 'Error',
  };

  return createMessage(from, 'error' as MessageType, errorPayload, {
    to,
    correlationId,
    metadata,
  });
}

/**
 * Validate an agent message
 *
 * @param message - Message to validate
 * @returns Validated message
 * @throws Error if validation fails
 */
export function validateMessage(message: unknown): AgentMessage {
  try {
    return AgentMessageSchema.parse(message);
  } catch (error) {
    throw new Error(
      `Message validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a message is valid
 *
 * @param message - Message to check
 * @returns True if valid, false otherwise
 */
export function isValidMessage(message: unknown): message is AgentMessage {
  const result = AgentMessageSchema.safeParse(message);
  return result.success;
}

/**
 * Extract error from error message
 *
 * @param message - Error message
 * @returns Error object or null
 */
export function extractError(message: AgentMessage): Error | null {
  if (message.type !== 'error') {
    return null;
  }

  const payload = message.payload as { message: string; stack?: string; name?: string };

  const error = new Error(payload.message);
  if (payload.stack) {
    error.stack = payload.stack;
  }
  if (payload.name) {
    error.name = payload.name;
  }

  return error;
}

/**
 * Format message for logging
 *
 * @param message - Message to format
 * @returns Formatted string
 */
export function formatMessage(message: AgentMessage): string {
  const parts = [
    `[${message.type.toUpperCase()}]`,
    `from: ${message.from}`,
  ];

  if (message.to) {
    parts.push(`to: ${message.to}`);
  }

  if (message.correlationId) {
    parts.push(`corr: ${message.correlationId.substring(0, 8)}`);
  }

  parts.push(`at: ${new Date(message.timestamp).toISOString()}`);

  return parts.join(' ');
}

/**
 * Create a message filter for specific message types
 *
 * @param types - Message types to filter
 * @returns Filter function
 */
export function messageTypeFilter(...types: MessageType[]): (message: AgentMessage) => boolean {
  return (message: AgentMessage) => types.includes(message.type);
}

/**
 * Create a message filter for specific sender
 *
 * @param senderId - Sender agent ID
 * @returns Filter function
 */
export function senderFilter(senderId: string): (message: AgentMessage) => boolean {
  return (message: AgentMessage) => message.from === senderId;
}

/**
 * Create a message filter for specific recipient
 *
 * @param recipientId - Recipient agent ID
 * @returns Filter function
 */
export function recipientFilter(recipientId: string): (message: AgentMessage) => boolean {
  return (message: AgentMessage) => message.to === recipientId;
}

/**
 * Create a message filter for specific correlation ID
 *
 * @param correlationId - Correlation ID
 * @returns Filter function
 */
export function correlationFilter(correlationId: string): (message: AgentMessage) => boolean {
  return (message: AgentMessage) => message.correlationId === correlationId;
}

/**
 * Combine multiple filters with AND logic
 *
 * @param filters - Filter functions to combine
 * @returns Combined filter function
 */
export function andFilter(
  ...filters: Array<(message: AgentMessage) => boolean | Promise<boolean>>
): (message: AgentMessage) => boolean | Promise<boolean> {
  return async (message: AgentMessage) => {
    for (const filter of filters) {
      const result = await filter(message);
      if (!result) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Combine multiple filters with OR logic
 *
 * @param filters - Filter functions to combine
 * @returns Combined filter function
 */
export function orFilter(
  ...filters: Array<(message: AgentMessage) => boolean | Promise<boolean>>
): (message: AgentMessage) => boolean | Promise<boolean> {
  return async (message: AgentMessage) => {
    for (const filter of filters) {
      const result = await filter(message);
      if (result) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Calculate message age in milliseconds
 *
 * @param message - Message to check
 * @returns Age in milliseconds
 */
export function getMessageAge(message: AgentMessage): number {
  return Date.now() - message.timestamp;
}

/**
 * Check if message is expired
 *
 * @param message - Message to check
 * @param maxAge - Maximum age in milliseconds
 * @returns True if expired
 */
export function isMessageExpired(message: AgentMessage, maxAge: number): boolean {
  return getMessageAge(message) > maxAge;
}

/**
 * Clone a message with a new ID
 *
 * @param message - Message to clone
 * @param newFrom - Optional new sender
 * @returns Cloned message
 */
export function cloneMessage(message: AgentMessage, newFrom?: string): AgentMessage {
  return {
    ...message,
    id: randomUUID(),
    from: newFrom ?? message.from,
    timestamp: Date.now(),
  };
}
