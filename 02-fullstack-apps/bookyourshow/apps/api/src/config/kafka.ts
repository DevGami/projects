import { Kafka, Producer, logLevel } from 'kafkajs';
import { env } from './env.js';
import { logger } from '../middleware/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// Kafka Client (KafkaJS)
// ═══════════════════════════════════════════════════════════════════════════
const kafka = new Kafka({
  clientId: 'bookyourshow-api',
  brokers: env.KAFKA_BROKERS.split(','),
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
});

// ── Producer Singleton ──────────────────────────────────────────────────────
let producer: Producer | null = null;
let isConnected = false;

export async function connectKafka(): Promise<void> {
  try {
    producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30_000,
    });

    await producer.connect();
    isConnected = true;
    console.log('✅ Kafka connected');
  } catch (error) {
    console.error('❌ Kafka connection failed:', error);
    // Don't throw — Kafka is not critical for API startup
    // Events will be silently dropped until Kafka reconnects
    isConnected = false;
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    isConnected = false;
    console.log('🔌 Kafka disconnected');
  }
}

// ── Health Check ────────────────────────────────────────────────────────────
export function isKafkaConnected(): boolean {
  return isConnected;
}

// ── Publish Event ───────────────────────────────────────────────────────────
export async function publishEvent(
  topic: string,
  key: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!producer || !isConnected) {
    logger.warn(`Kafka not connected — dropping event on topic "${topic}" with key "${key}"`);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify({
            ...payload,
            _meta: {
              source: 'bookyourshow-api',
              timestamp: new Date().toISOString(),
              eventId: `${topic}:${key}:${Date.now()}`,
            },
          }),
          headers: {
            'content-type': Buffer.from('application/json'),
          },
        },
      ],
    });

    logger.info(`📨 Kafka event published: ${topic} [key=${key}]`);
  } catch (error) {
    logger.error(`Failed to publish Kafka event on "${topic}":`, error);
    // Don't throw — event publishing should not break the main flow
  }
}

export { kafka };
