import 'dotenv/config';
import Ably from 'ably';

export interface WorkflowEvent {
  type: 'workflow.started' | 'workflow.stage.changed' | 'workflow.test.generated' | 
        'workflow.test.executed' | 'workflow.fix.generated' | 'workflow.completed' | 
        'workflow.failed' | 'workflow.progress';
  workflowId: string;
  projectId: string;
  userId: string;
  timestamp: Date;
  data: any;
}

class AblyService {
  private client: Ably.Realtime | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize Ably connection
   */
  initialize(): void {
    const apiKey = process.env.ABLY_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  ABLY_API_KEY not found in environment variables. Ably events will be disabled.');
      console.warn('   To enable Ably:');
      console.warn('   1. Get your API key from https://ably.com');
      console.warn('   2. Add ABLY_API_KEY=your-key-here to your .env file');
      return;
    }

    try {
      this.client = new Ably.Realtime({
        key: apiKey,
        clientId: `test-agent-${process.pid}-${Date.now()}`,
      });

      // Connection event handlers
      this.client.connection.on('connected', () => {
        console.log('✅ Connected to Ably');
        this.isInitialized = true;
      });

      this.client.connection.on('disconnected', () => {
        console.log('⚠️  Disconnected from Ably');
        this.isInitialized = false;
      });

      this.client.connection.on('suspended', () => {
        console.log('⚠️  Ably connection suspended');
      });

      this.client.connection.on('failed', (error) => {
        console.error('❌ Ably connection failed:', error);
      });

      // Wait for connection
      this.client.connection.once('connected', () => {
        console.log('📡 Ably service ready');
      });

    } catch (error: any) {
      console.error('❌ Failed to initialize Ably:', error.message);
    }
  }

  /**
   * Check if Ably is initialized and connected
   */
  isReady(): boolean {
    return this.isInitialized && 
           this.client !== null && 
           this.client.connection.state === 'connected';
  }

  /**
   * Publish workflow event to Ably channel
   */
  async publishEvent(
    channelName: string,
    event: WorkflowEvent
  ): Promise<void> {
    if (!this.isReady()) {
      console.warn('⚠️  Ably not ready, skipping event publish:', event.type);
      return;
    }

    try {
      const channel = this.client!.channels.get(channelName);
      await channel.publish(event.type, event);
      console.log(`📤 Published ${event.type} to channel: ${channelName}`);
    } catch (error: any) {
      console.error(`❌ Failed to publish event ${event.type}:`, error.message);
    }
  }

  /**
   * Subscribe to channel for receiving commands/messages
   */
  subscribeToChannel(
    channelName: string,
    callback: (message: Ably.Message) => void
  ): void {
    if (!this.isReady()) {
      console.warn('⚠️  Ably not ready, cannot subscribe to:', channelName);
      return;
    }

    try {
      const channel = this.client!.channels.get(channelName);
      channel.subscribe((message) => {
        console.log(`📥 Received message on ${channelName}:`, message.name);
        callback(message);
      });
      console.log(`📥 Subscribed to channel: ${channelName}`);
    } catch (error: any) {
      console.error(`❌ Failed to subscribe to ${channelName}:`, error.message);
    }
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribeFromChannel(channelName: string): void {
    if (!this.client) return;

    try {
      const channel = this.client.channels.get(channelName);
      channel.unsubscribe();
      console.log(`📴 Unsubscribed from channel: ${channelName}`);
    } catch (error: any) {
      console.error(`❌ Failed to unsubscribe from ${channelName}:`, error.message);
    }
  }

  /**
   * Get channel name for a specific project/user
   */
  getProjectChannel(projectId: string, userId: string): string {
    return `project:${projectId}:user:${userId}`;
  }

  /**
   * Get channel name for a specific workflow
   */
  getWorkflowChannel(workflowId: string): string {
    return `workflow:${workflowId}`;
  }

  /**
   * Get channel name for a specific project (all users)
   */
  getProjectBroadcastChannel(projectId: string): string {
    return `project:${projectId}:broadcast`;
  }

  /**
   * Disconnect from Ably
   */
  disconnect(): void {
    if (this.client) {
      this.client.close();
      this.isInitialized = false;
      console.log('🔌 Disconnected from Ably');
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): string {
    if (!this.client) return 'not_initialized';
    return this.client.connection.state;
  }
}

// Export singleton instance
export const ablyService = new AblyService();

// Auto-initialize on module load
ablyService.initialize();

