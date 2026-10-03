import { Kafka, Producer, logLevel } from 'kafkajs';
import { env } from './env.js';
import { logger } from '../middleware/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// Kafka Client (KafkaJS)
// ═══════════════════════════════════════════════════════════════════════════
const kafkaConfig: any = {
  clientId: 'bookyourshow-api',
  brokers: env.KAFKA_BROKERS.split(','),
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
};

// Enable SASL and SSL if credentials are provided (e.g. Upstash Kafka)
if (env.KAFKA_SASL_USERNAME && env.KAFKA_SASL_PASSWORD) {
  kafkaConfig.ssl = true;
  kafkaConfig.sasl = {
    mechanism: 'scram-sha-256',
    username: env.KAFKA_SASL_USERNAME,
    password: env.KAFKA_SASL_PASSWORD,
  };
}

const kafka = new Kafka(kafkaConfig);

// ── Producer Singleton ──────────────────────────────────────────────────────
let producer: Producer | null = null;
let isConnected = false;

export async function connectKafka(): Promise<void> {
  // Gracefully skip Kafka in production if it hasn't been configured yet
  if (env.NODE_ENV === 'production' && env.KAFKA_BROKERS === 'localhost:9092' && !env.KAFKA_SASL_USERNAME) {
    logger.warn('⚠️ Kafka not configured for production (using localhost default) — skipping connection to prevent crash loops');
    return;
  }

  try {
    producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30_000,
    });

    await producer.connect();
    isConnected = true;
    logger.info('✅ Kafka connected');
  } catch (error) {
    logger.error('❌ Kafka connection failed:', error);
    // Don't throw — Kafka is not critical for API startup
    // Events will be silently dropped until Kafka reconnects
    isConnected = false;
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    isConnected = false;
    logger.info('🔌 Kafka disconnected');
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
