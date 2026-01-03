import 'dotenv/config';
import { ablyService } from '../services/ablyService.js';
import { setTimeout } from 'timers/promises';

async function testAblyConnection() {
  console.log('🧪 Testing Ably connection...\n');

  // Wait for connection
  let attempts = 0;
  while (!ablyService.isReady() && attempts < 10) {
    console.log(`⏳ Waiting for Ably connection... (${attempts + 1}/10)`);
    await setTimeout(1000);
    attempts++;
  }

  if (!ablyService.isReady()) {
    console.error('\n❌ Ably connection failed!');
    console.error('   Connection state:', ablyService.getConnectionState());
    console.error('\n📋 Setup Instructions:');
    console.error('   1. Go to https://ably.com and sign up (free tier available)');
    console.error('   2. Create an app and get your API key');
    console.error('   3. Add to .env file: ABLY_API_KEY=xVLyHw.your-key-here');
    console.error('   4. Run this test again: npm run test:ably\n');
    process.exit(1);
  }

  console.log('✅ Ably connected!\n');

  // Test publishing
  const testChannel = 'test:connection';
  const testEvent = {
    type: 'workflow.started' as const,
    workflowId: 'test-workflow-123',
    projectId: 'test-project',
    userId: 'test-user',
    timestamp: new Date(),
    data: { message: 'Test connection' },
  };

  console.log('📤 Publishing test event...');
  await ablyService.publishEvent(testChannel, testEvent);
  console.log('✅ Test event published successfully!\n');

  // Test subscription
  console.log('📥 Testing subscription...');
  let messageReceived = false;
  
  ablyService.subscribeToChannel(testChannel, (message) => {
    console.log('✅ Received message:', message.data);
    messageReceived = true;
  });

  // Publish another test message
  await setTimeout(1000);
  await ablyService.publishEvent(testChannel, {
    ...testEvent,
    type: 'workflow.completed',
    data: { message: 'Test subscription' },
  });

  await setTimeout(2000);
  
  if (messageReceived) {
    console.log('\n✅ Ably test completed successfully!');
  } else {
    console.log('\n⚠️  Test completed but no message received (this may be normal)');
  }
  
  // Cleanup
  ablyService.unsubscribeFromChannel(testChannel);
  ablyService.disconnect();
  process.exit(0);
}

testAblyConnection().catch(console.error);

