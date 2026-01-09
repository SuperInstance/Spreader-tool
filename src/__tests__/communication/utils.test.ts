/**
 * Agent Communication Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createMessage,
  createRequest,
  createResponse,
  createNotification,
  createError,
  validateMessage,
  isValidMessage,
  extractError,
  formatMessage,
  messageTypeFilter,
  senderFilter,
  recipientFilter,
  correlationFilter,
  andFilter,
  orFilter,
  getMessageAge,
  isMessageExpired,
  cloneMessage,
} from '../../communication/utils.js';
import { MessageType } from '../../communication/types.js';
import type { AgentMessage } from '../../communication/types.js';

describe('Message Creation', () => {
  it('should create basic message', () => {
    const message = createMessage(
      'agent-1',
      MessageType.REQUEST,
      { data: 'test' }
    );

    expect(message.id).toBeTruthy();
    expect(message.from).toBe('agent-1');
    expect(message.type).toBe(MessageType.REQUEST);
    expect(message.payload).toEqual({ data: 'test' });
    expect(message.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('should create message with recipient', () => {
    const message = createMessage(
      'agent-1',
      MessageType.REQUEST,
      {},
      { to: 'agent-2' }
    );

    expect(message.to).toBe('agent-2');
  });

  it('should create message with correlation ID', () => {
    const correlationId = 'corr-123';
    const message = createMessage(
      'agent-1',
      MessageType.REQUEST,
      {},
      { correlationId }
    );

    expect(message.correlationId).toBe(correlationId);
  });

  it('should create request message', () => {
    const message = createRequest('agent-1', 'agent-2', { query: 'test' });

    expect(message.type).toBe(MessageType.REQUEST);
    expect(message.from).toBe('agent-1');
    expect(message.to).toBe('agent-2');
    expect(message.payload).toEqual({ query: 'test' });
  });

  it('should create response message', () => {
    const correlationId = 'corr-123';
    const message = createResponse('agent-2', 'agent-1', { result: 'success' }, correlationId);

    expect(message.type).toBe(MessageType.RESPONSE);
    expect(message.from).toBe('agent-2');
    expect(message.to).toBe('agent-1');
    expect(message.correlationId).toBe(correlationId);
    expect(message.payload).toEqual({ result: 'success' });
  });

  it('should create notification message', () => {
    const message = createNotification('agent-1', { event: 'update' });

    expect(message.type).toBe(MessageType.NOTIFICATION);
    expect(message.from).toBe('agent-1');
    expect(message.to).toBeUndefined();
    expect(message.payload).toEqual({ event: 'update' });
  });

  it('should create notification with recipient', () => {
    const message = createNotification('agent-1', { event: 'update' }, 'agent-2');

    expect(message.to).toBe('agent-2');
  });

  it('should create error message from Error object', () => {
    const error = new Error('Something went wrong');
    const message = createError('agent-1', 'agent-2', error);

    expect(message.type).toBe(MessageType.ERROR);
    expect(message.from).toBe('agent-1');
    expect(message.to).toBe('agent-2');
    expect(message.payload).toEqual({
      message: 'Something went wrong',
      stack: error.stack,
      name: 'Error',
    });
  });

  it('should create error message from string', () => {
    const message = createError('agent-1', 'agent-2', 'Error message');

    expect(message.type).toBe(MessageType.ERROR);
    expect(message.payload).toEqual({
      message: 'Error message',
      name: 'Error',
    });
  });

  it('should create error message with correlation ID', () => {
    const correlationId = 'corr-123';
    const message = createError('agent-1', 'agent-2', 'Error', correlationId);

    expect(message.correlationId).toBe(correlationId);
  });
});

describe('Message Validation', () => {
  it('should validate valid message', () => {
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
    };

    const validated = validateMessage(message);
    expect(validated).toEqual(message);
  });

  it('should throw on invalid message', () => {
    const invalidMessage = {
      id: 'msg-1',
      // Missing 'from' field
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
    };

    expect(() => validateMessage(invalidMessage)).toThrow();
  });

  it('should check if message is valid', () => {
    const validMessage: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
    };

    expect(isValidMessage(validMessage)).toBe(true);
  });

  it('should return false for invalid message', () => {
    const invalidMessage = { id: 'msg-1' };
    expect(isValidMessage(invalidMessage)).toBe(false);
  });
});

describe('Error Extraction', () => {
  it('should extract error from error message', () => {
    const originalError = new Error('Test error');
    const message = createError('agent-1', 'agent-2', originalError);

    const extracted = extractError(message);

    expect(extracted).toBeInstanceOf(Error);
    expect(extracted?.message).toBe('Test error');
    expect(extracted?.stack).toBe(originalError.stack);
    expect(extracted?.name).toBe('Error');
  });

  it('should return null for non-error message', () => {
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
    };

    expect(extractError(message)).toBeNull();
  });
});

describe('Message Formatting', () => {
  it('should format message for logging', () => {
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
    };

    const formatted = formatMessage(message);

    expect(formatted).toContain('[REQUEST]');
    expect(formatted).toContain('from: agent-1');
    expect(formatted).toContain('to: agent-2');
    expect(formatted).toContain('2024-01-01');
  });

  it('should format message with correlation ID', () => {
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
      correlationId: 'corr-1234567890',
    };

    const formatted = formatMessage(message);

    expect(formatted).toContain('corr: corr-123');
  });
});

describe('Message Filters', () => {
  const testMessages: AgentMessage[] = [
    {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
    },
    {
      id: 'msg-2',
      from: 'agent-2',
      to: 'agent-1',
      type: MessageType.RESPONSE,
      payload: {},
      timestamp: Date.now(),
    },
    {
      id: 'msg-3',
      from: 'agent-1',
      type: MessageType.NOTIFICATION,
      payload: {},
      timestamp: Date.now(),
    },
  ];

  it('should filter by message type', () => {
    const filter = messageTypeFilter(MessageType.REQUEST);
    const filtered = testMessages.filter(filter);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe(MessageType.REQUEST);
  });

  it('should filter by multiple message types', () => {
    const filter = messageTypeFilter(MessageType.REQUEST, MessageType.NOTIFICATION);
    const filtered = testMessages.filter(filter);

    expect(filtered).toHaveLength(2);
  });

  it('should filter by sender', () => {
    const filter = senderFilter('agent-1');
    const filtered = testMessages.filter(filter);

    expect(filtered).toHaveLength(2);
    expect(filtered.every(m => m.from === 'agent-1')).toBe(true);
  });

  it('should filter by recipient', () => {
    const filter = recipientFilter('agent-2');
    const filtered = testMessages.filter(filter);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].to).toBe('agent-2');
  });

  it('should filter by correlation ID', () => {
    const correlationId = 'corr-123';
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
      correlationId,
    };

    const filter = correlationFilter(correlationId);
    expect(filter(message)).toBe(true);

    const filter2 = correlationFilter('other');
    expect(filter2(message)).toBe(false);
  });

  it('should combine filters with AND', async () => {
    const filter = andFilter(
      senderFilter('agent-1'),
      messageTypeFilter(MessageType.REQUEST)
    );

    const filtered: AgentMessage[] = [];
    for (const m of testMessages) {
      const result = await filter(m);
      if (result) filtered.push(m);
    }

    expect(filtered).toHaveLength(1);
    expect(filtered[0].from).toBe('agent-1');
    expect(filtered[0].type).toBe(MessageType.REQUEST);
  });

  it('should combine filters with OR', async () => {
    const filter = orFilter(
      messageTypeFilter(MessageType.RESPONSE),
      messageTypeFilter(MessageType.NOTIFICATION)
    );

    const filtered: AgentMessage[] = [];
    for (const m of testMessages) {
      const result = await filter(m);
      if (result) filtered.push(m);
    }

    expect(filtered).toHaveLength(2);
    expect(
      filtered.every(m => m.type === MessageType.RESPONSE || m.type === MessageType.NOTIFICATION)
    ).toBe(true);
  });
});

describe('Message Utilities', () => {
  it('should calculate message age', () => {
    const oldTimestamp = Date.now() - 5000;
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: oldTimestamp,
    };

    const age = getMessageAge(message);
    expect(age).toBeGreaterThanOrEqual(5000);
    expect(age).toBeLessThan(5100); // Allow 100ms tolerance
  });

  it('should check if message is expired', () => {
    const oldTimestamp = Date.now() - 10000;
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: oldTimestamp,
    };

    expect(isMessageExpired(message, 5000)).toBe(true);
    expect(isMessageExpired(message, 15000)).toBe(false);
  });

  it('should clone message', () => {
    const original: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.REQUEST,
      payload: { data: 'test' },
      timestamp: Date.now(),
      correlationId: 'corr-123',
    };

    const clone = cloneMessage(original);

    expect(clone.id).not.toBe(original.id);
    expect(clone.from).toBe(original.from);
    expect(clone.to).toBe(original.to);
    expect(clone.type).toBe(original.type);
    expect(clone.payload).toEqual(original.payload);
    expect(clone.correlationId).toBe(original.correlationId);
    expect(clone.timestamp).toBeGreaterThanOrEqual(original.timestamp);
  });

  it('should clone message with new sender', () => {
    const original: AgentMessage = {
      id: 'msg-1',
      from: 'agent-1',
      type: MessageType.REQUEST,
      payload: {},
      timestamp: Date.now(),
    };

    const clone = cloneMessage(original, 'agent-2');

    expect(clone.from).toBe('agent-2');
    expect(clone.id).not.toBe(original.id);
  });
});
