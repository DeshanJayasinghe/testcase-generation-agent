# Ably Integration Setup Guide

## Overview

This agent integrates with Ably for real-time event streaming, allowing your frontend and backend to receive live updates about test generation, execution, and bug fixing progress.

## Step 1: Get Ably API Key

1. Go to https://ably.com and sign up (free tier available)
2. Create a new app in the dashboard
3. Copy your API Key (format: `xVLyHw.ABC123:def456ghi789`)
4. Add it to your `.env` file:

```bash
ABLY_API_KEY=xVLyHw.your-actual-api-key-here
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `ably` - Ably SDK for real-time messaging
- `express` - HTTP server for agent API

## Step 3: Test Ably Connection

```bash
npm run test:ably
```

Expected output:
```
🧪 Testing Ably connection...
✅ Connected to Ably
📡 Ably service ready
✅ Ably connected!
📤 Publishing test event...
✅ Test event published successfully!
```

## Step 4: Start the Agent Server

```bash
npm run server
```

The server will start on port 3002 (or PORT from .env).

## Step 5: API Endpoints

### Health Check
```bash
GET http://localhost:3002/health
```

Response:
```json
{
  "status": "healthy",
  "ably": {
    "connected": true,
    "state": "connected"
  },
  "timestamp": "2026-01-03T..."
}
```

### Start Workflow
```bash
POST http://localhost:3002/workflow/start
Content-Type: application/json

{
  "filePath": "/path/to/file.ts",
  "testType": "jest",
  "requirements": [
    {
      "id": "req-1",
      "description": "Test function behavior",
      "type": "functional",
      "priority": "high"
    }
  ],
  "projectId": "project-123",
  "userId": "user-456",
  "autoApplyFixes": true,
  "maxRetries": 2,
  "enableAbly": true
}
```

Response:
```json
{
  "success": true,
  "workflowId": "workflow-1234567890-abc123",
  "status": "started",
  "message": "Test generation workflow initiated",
  "channel": "workflow:workflow-1234567890-abc123"
}
```

## Step 6: Subscribe to Events (Frontend/Backend)

### Event Types

1. **workflow.started** - Workflow initiated
2. **workflow.stage.changed** - Stage changed (generating, executing, fixing, etc.)
3. **workflow.test.generated** - Test cases generated
4. **workflow.test.executed** - Test execution completed
5. **workflow.fix.generated** - Bug fix generated
6. **workflow.progress** - Progress update
7. **workflow.completed** - Workflow completed successfully
8. **workflow.failed** - Workflow failed

### Example: Frontend Subscription (React)

```typescript
import * as Ably from 'ably';

const client = new Ably.Realtime({
  key: process.env.REACT_APP_ABLY_API_KEY,
});

const channel = client.channels.get('workflow:workflow-123');

channel.subscribe((message) => {
  const event = message.data;
  console.log('Event:', event.type, event.data);
  
  switch (event.type) {
    case 'workflow.stage.changed':
      setProgress(event.data.stage);
      break;
    case 'workflow.test.generated':
      setTestCases(event.data.testCases);
      break;
    case 'workflow.completed':
      setStatus('completed');
      break;
  }
});
```

## Channel Naming Convention

- **Workflow-specific**: `workflow:{workflowId}`
- **Project/User**: `project:{projectId}:user:{userId}`
- **Project broadcast**: `project:{projectId}:broadcast`

## Environment Variables

Add to `.env`:
```bash
ABLY_API_KEY=your_ably_api_key_here
PORT=3002
```

## Integration with Other Repos

### Backend Repo
1. Install Ably SDK: `npm install ably`
2. Subscribe to workflow channels
3. Forward events to frontend via WebSocket or HTTP polling

### Frontend Repo
1. Install Ably SDK: `npm install ably`
2. Subscribe to workflow channels
3. Update UI in real-time based on events

## Troubleshooting

### "ABLY_API_KEY not found"
- Check `.env` file exists and contains `ABLY_API_KEY`
- Restart the server after adding the key

### "Connection failed"
- Verify API key is correct in Ably dashboard
- Check internet connection
- Check firewall/proxy settings

### "Not receiving events"
- Verify channel names match
- Check Ably dashboard → Logs to see published messages
- Ensure subscription is active

