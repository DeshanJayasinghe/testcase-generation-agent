import 'dotenv/config';
import express from 'express';
import { runClosedLoopWorkflow, WorkflowOptions } from './workflows/closedLoopWorkflow.js';
import { ablyService } from './services/ablyService.js';

const app = express();
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    ably: {
      connected: ablyService.isReady(),
      state: ablyService.getConnectionState(),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start workflow endpoint
 */
app.post('/workflow/start', async (req, res) => {
  try {
    const options: WorkflowOptions = {
      filePath: req.body.filePath,
      testType: req.body.testType || 'jest',
      requirements: req.body.requirements,
      autoApplyFixes: req.body.autoApplyFixes ?? true,
      maxRetries: req.body.maxRetries ?? 2,
      workflowId: req.body.workflowId || `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: req.body.projectId || 'default',
      userId: req.body.userId || 'system',
      channelName: req.body.channelName,
      enableAbly: req.body.enableAbly ?? true,
    };

    // Validate required fields
    if (!options.filePath) {
      return res.status(400).json({
        error: 'filePath is required',
      });
    }

    if (!['jest', 'junit'].includes(options.testType)) {
      return res.status(400).json({
        error: 'testType must be "jest" or "junit"',
      });
    }

    // Start workflow asynchronously (don't wait for completion)
    runClosedLoopWorkflow(options).catch(error => {
      console.error('Workflow error:', error);
    });

    // Return immediately with workflow ID
    res.json({
      success: true,
      workflowId: options.workflowId,
      status: 'started',
      message: 'Test generation workflow initiated',
      channel: options.channelName || ablyService.getWorkflowChannel(options.workflowId),
    });

  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({
      error: 'Failed to start workflow',
      message: error.message,
    });
  }
});

/**
 * Get workflow status (if stored in memory/database)
 * Note: This is a simple implementation. For production, store workflow state in a database.
 */
app.get('/workflow/:workflowId/status', (req, res) => {
  const { workflowId } = req.params;
  
  // In a real implementation, you'd query a database or cache
  // For now, just return a placeholder
  res.json({
    workflowId,
    message: 'Workflow status not persisted. Use Ably events for real-time updates.',
    ablyChannel: ablyService.getWorkflowChannel(workflowId),
  });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`🚀 Test Agent HTTP server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Ably state: ${ablyService.getConnectionState()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  ablyService.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  ablyService.disconnect();
  process.exit(0);
});

