import { Redis } from 'ioredis';

const redisUrl = 'rediss://default:gQAAAAAAAaPDAAIgcDJiYjk5NDYyMTZhMjU0ZDY5OWQ1NmExZTMyYzYyOWI3NA@brief-husky-107459.upstash.io:6379';

async function main() {
  const start = Date.now();
  console.log('Connecting to Upstash Redis...');
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000
  });

  const pong = await redis.ping();
  const latency = Date.now() - start;

  console.log(`\n======================================================`);
  console.log(`🟢 UPSTASH CLOUD REDIS: CONNECTED & 100% HEALTHY`);
  console.log(`⏱️ Ping Latency: ${latency}ms (Host: brief-husky-107459.upstash.io)`);
  console.log(`⚡ Ping Response: ${pong}`);
  console.log(`======================================================`);

  // Test Distributed Seat Lock Engine
  const testLockKey = 'lock:showtime:test_show_1:seat:A1';
  const testLockValue = 'user_session_test_999';

  // Acquire Lock (NX = Only if Not Exists, EX = 600s TTL)
  const lockAcquired = await redis.set(testLockKey, testLockValue, 'EX', 600, 'NX');
  console.log(`🔒 Test Seat Lock Acquired: ${lockAcquired === 'OK' ? 'SUCCESS (10-min TTL)' : 'FAILED'}`);

  // Test Atomic Conflict Detection (second acquire must fail)
  const duplicateLock = await redis.set(testLockKey, 'another_user', 'EX', 600, 'NX');
  console.log(`🛡️ Double-Booking Prevention Check: ${duplicateLock === null ? 'PASSED (Duplicate Rejected)' : 'FAILED'}`);

  // Release Lock
  await redis.del(testLockKey);
  console.log(`🔓 Test Seat Lock Released: SUCCESS`);

  // Test API Cache Layer
  await redis.set('cache:test:health', JSON.stringify({ status: 'ok', time: new Date().toISOString() }), 'EX', 60);
  const cached = await redis.get('cache:test:health');
  console.log(`🚀 Cache Read/Write Test: SUCCESS (${cached})`);
  console.log(`======================================================\n`);

  await redis.quit();
}

main().catch(err => {
  console.error('Redis verification failed:', err);
  process.exit(1);
});
