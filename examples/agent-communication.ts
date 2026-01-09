/**
 * Agent Communication Protocol Example
 *
 * This example demonstrates how to use the agent communication protocol
 * to enable agents to communicate with each other in a multi-agent system.
 *
 * Run with:
 * npm run build
 * node dist/examples/agent-communication.js
 */

import {
  AgentMessageBus,
  MessageType,
  createRequest,
  createResponse,
  createNotification,
  createError,
  formatMessage,
  getGlobalMessageBus,
  type AgentMessage,
  type MessageHandler,
} from '../src/communication/index.js';

/**
 * Example 1: Basic Agent Communication
 *
 * Demonstrates simple request-response between two agents.
 */
async function basicCommunication() {
  console.log('\n=== Example 1: Basic Communication ===\n');

  const messageBus = new AgentMessageBus({ enableLogging: true });

  // Define message handlers
  const agent1Handler: MessageHandler = async (message: AgentMessage) => {
    console.log(`Agent 1 received: ${formatMessage(message)}`);

    if (message.type === MessageType.REQUEST) {
      const response = createResponse(
        'agent-1',
        message.from!,
        { result: 'Agent 1 processed your request' },
        message.correlationId!
      );
      await messageBus.sendMessage(response);
    }
  };

  const agent2Handler: MessageHandler = async (message: AgentMessage) => {
    console.log(`Agent 2 received: ${formatMessage(message)}`);

    if (message.type === MessageType.REQUEST) {
      const response = createResponse(
        'agent-2',
        message.from!,
        { result: 'Agent 2 processed your request' },
        message.correlationId!
      );
      await messageBus.sendMessage(response);
    }
  };

  // Register agents
  messageBus.registerAgent('agent-1', agent1Handler);
  messageBus.registerAgent('agent-2', agent2Handler);

  // Agent 1 sends request to Agent 2
  const request = createRequest('agent-1', 'agent-2', {
    task: 'Analyze this data',
    data: [1, 2, 3, 4, 5],
  });

  console.log(`Sending request: ${formatMessage(request)}`);

  try {
    const response = await messageBus.sendRequest(request, { timeout: 5000 });
    console.log(`Received response: ${formatMessage(response)}`);
    console.log(`Response payload:`, response.payload);
  } catch (error) {
    console.error('Request failed:', error);
  }

  // Show metrics
  const metrics = messageBus.getMetrics();
  console.log('\nMetrics:', metrics);
}

/**
 * Example 2: Broadcast Communication
 *
 * Demonstrates broadcasting messages to multiple agents.
 */
async function broadcastCommunication() {
  console.log('\n\n=== Example 2: Broadcast Communication ===\n');

  const messageBus = new AgentMessageBus({ enableLogging: true });

  // Create multiple agents
  const agents = ['researcher', 'analyst', 'critic', 'synthesizer'];

  agents.forEach(agentId => {
    const handler: MessageHandler = async (message: AgentMessage) => {
      console.log(`[${agentId}] Received: ${message.type}`);
      console.log(`[${agentId}] Payload:`, message.payload);

      // Each agent sends back their analysis
      const response = createNotification(
        agentId,
        {
          agent: agentId,
          analysis: `${agentId} analyzed the topic`,
        },
        message.from
      );

      await messageBus.sendMessage(response);
    };

    messageBus.registerAgent(agentId, handler);
  });

  // Coordinator broadcasts task to all agents
  const coordinatorId = 'coordinator';
  messageBus.registerAgent(coordinatorId, async (message: AgentMessage) => {
    if (message.type === MessageType.NOTIFICATION) {
      console.log(`Coordinator received response from ${message.from}`);
    }
  });

  const broadcast = createNotification(coordinatorId, {
    task: 'Analyze the latest AI trends',
    deadline: '2024-12-31',
  });

  console.log('Broadcasting task to all agents...\n');
  await messageBus.broadcast(broadcast, { excludeSender: true });

  // Wait for all responses
  await new Promise(resolve => setTimeout(resolve, 500));

  // Show metrics
  const metrics = messageBus.getMetrics();
  console.log('\nBroadcast Metrics:', metrics);
}

/**
 * Example 3: Error Handling
 *
 * Demonstrates error handling in agent communication.
 */
async function errorHandling() {
  console.log('\n\n=== Example 3: Error Handling ===\n');

  const messageBus = new AgentMessageBus({ enableLogging: true });

  // Agent that simulates errors
  const failingAgent: MessageHandler = async (message: AgentMessage) => {
    console.log(`Failing agent received: ${formatMessage(message)}`);

    // Simulate an error
    const error = createError(
      'failing-agent',
      message.from!,
      new Error('Processing failed: Invalid data format'),
      message.correlationId
    );

    await messageBus.sendMessage(error);
  };

  // Agent that handles errors gracefully
  const resilientAgent: MessageHandler = async (message: AgentMessage) => {
    console.log(`Resilient agent received: ${formatMessage(message)}`);

    if (message.type === MessageType.ERROR) {
      console.log('Error received, handling gracefully...');
      console.log('Error details:', message.payload);

      // Retry with different approach
      const retryRequest = createRequest(
        'resilient-agent',
        'backup-agent',
        { task: 'Retry with fallback method' }
      );

      // Would send retry request here
      console.log('Would send retry request to backup-agent');
    }
  };

  messageBus.registerAgent('failing-agent', failingAgent);
  messageBus.registerAgent('resilient-agent', resilientAgent);

  // Send request that will fail
  const request = createRequest('resilient-agent', 'failing-agent', {
    data: 'invalid data',
  });

  console.log('Sending request that will fail...\n');

  try {
    const response = await messageBus.sendRequest(request, { timeout: 5000 });
    console.log('Received response:', response);
  } catch (error) {
    console.error('Request failed after retries:', error);
  }

  // Show metrics including failures
  const metrics = messageBus.getMetrics();
  console.log('\nMetrics:', metrics);
}

/**
 * Example 4: Multi-Agent Orchestration
 *
 * Demonstrates a more complex multi-agent workflow.
 */
async function multiAgentOrchestration() {
  console.log('\n\n=== Example 4: Multi-Agent Orchestration ===\n');

  const messageBus = new AgentMessageBus({ enableLogging: true });

  // Store intermediate results
  const results = new Map<string, any>();

  // Researcher agent
  const researcherHandler: MessageHandler = async (message: AgentMessage) => {
    console.log('[Researcher] Gathering information...');

    // Simulate research
    await new Promise(resolve => setTimeout(resolve, 100));

    const researchData = {
      sources: ['Source 1', 'Source 2', 'Source 3'],
      findings: 'Key findings from research',
    };

    results.set('research', researchData);

    const response = createResponse(
      'researcher',
      message.from!,
      researchData,
      message.correlationId!
    );

    await messageBus.sendMessage(response);
  };

  // Analyst agent
  const analystHandler: MessageHandler = async (message: AgentMessage) => {
    console.log('[Analyst] Analyzing data...');

    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 100));

    const analysis = {
      patterns: ['Pattern 1', 'Pattern 2'],
      insights: 'Key insights from analysis',
    };

    results.set('analysis', analysis);

    const response = createResponse(
      'analyst',
      message.from!,
      analysis,
      message.correlationId!
    );

    await messageBus.sendMessage(response);
  };

  // Synthesizer agent
  const synthesizerHandler: MessageHandler = async (message: AgentMessage) => {
    console.log('[Synthesizer] Combining results...');

    // Simulate synthesis
    await new Promise(resolve => setTimeout(resolve, 100));

    const synthesis = {
      summary: 'Combined summary of all findings',
      recommendations: ['Recommendation 1', 'Recommendation 2'],
    };

    results.set('synthesis', synthesis);

    const response = createResponse(
      'synthesizer',
      message.from!,
      synthesis,
      message.correlationId!
    );

    await messageBus.sendMessage(response);
  };

  // Coordinator orchestrates the workflow
  const coordinatorHandler: MessageHandler = async (message: AgentMessage) => {
    if (message.type === MessageType.REQUEST) {
      console.log('[Coordinator] Starting workflow...');

      const task = message.payload as { topic: string };

      // Step 1: Research
      console.log('\nStep 1: Research');
      const researchRequest = createRequest('coordinator', 'researcher', {
        topic: task.topic,
      });
      const researchResult = await messageBus.sendRequest(researchRequest);
      console.log('Research complete:', researchResult.payload);

      // Step 2: Analysis
      console.log('\nStep 2: Analysis');
      const analysisRequest = createRequest('coordinator', 'analyst', {
        researchData: researchResult.payload,
      });
      const analysisResult = await messageBus.sendRequest(analysisRequest);
      console.log('Analysis complete:', analysisResult.payload);

      // Step 3: Synthesis
      console.log('\nStep 3: Synthesis');
      const synthesisRequest = createRequest('coordinator', 'synthesizer', {
        research: researchResult.payload,
        analysis: analysisResult.payload,
      });
      const synthesisResult = await messageBus.sendRequest(synthesisRequest);
      console.log('Synthesis complete:', synthesisResult.payload);

      // Send final response
      const finalResponse = createResponse(
        'coordinator',
        message.from!,
        {
          topic: task.topic,
          results: Array.from(results.entries()),
          finalSynthesis: synthesisResult.payload,
        },
        message.correlationId!
      );

      await messageBus.sendMessage(finalResponse);
    }
  };

  // Register all agents
  messageBus.registerAgent('coordinator', coordinatorHandler);
  messageBus.registerAgent('researcher', researcherHandler);
  messageBus.registerAgent('analyst', analystHandler);
  messageBus.registerAgent('synthesizer', synthesizerHandler);

  // Also register a client to initiate the workflow
  messageBus.registerAgent('client', async (message: AgentMessage) => {
    console.log('[Client] Received final result:', message.payload);
  });

  // Client initiates workflow
  console.log('Initiating multi-agent workflow...\n');

  const workflowRequest = createRequest('client', 'coordinator', {
    topic: 'Latest developments in quantum computing',
  });

  const finalResult = await messageBus.sendRequest(workflowRequest, {
    timeout: 10000,
  });

  console.log('\n=== Workflow Complete ===');
  console.log('Final Result:', finalResult.payload);

  // Show message history
  const history = messageBus.getMessageHistory();
  console.log(`\nTotal messages exchanged: ${history.length}`);

  // Show metrics
  const metrics = messageBus.getMetrics();
  console.log('Final Metrics:', metrics);
}

/**
 * Example 5: Using Global Message Bus
 *
 * Demonstrates using the global message bus singleton.
 */
async function globalMessageBusExample() {
  console.log('\n\n=== Example 5: Global Message Bus ===\n');

  // Get or create global message bus
  const messageBus = getGlobalMessageBus({
    enableLogging: true,
    enableMetrics: true,
  });

  // Register agents
  messageBus.registerAgent('agent-a', async (message: AgentMessage) => {
    console.log(`Agent A: Received ${message.type}`);
  });

  messageBus.registerAgent('agent-b', async (message: AgentMessage) => {
    console.log(`Agent B: Received ${message.type}`);
  });

  // Send message
  const notification = createNotification('agent-a', {
    event: 'System update',
  });

  await messageBus.broadcast(notification);

  console.log('\nGlobal message bus is shared across the application');
}

/**
 * Run all examples
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Agent Communication Protocol Examples                   ║');
  console.log('║   Demonstrating agent-to-agent communication patterns     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await basicCommunication();
    await broadcastCommunication();
    await errorHandling();
    await multiAgentOrchestration();
    await globalMessageBusExample();

    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   All examples completed successfully!                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\nExample failed:', error);
    process.exit(1);
  }
}

// Run examples
main().catch(console.error);
