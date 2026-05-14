import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

client.on('error', (err: Error) => console.error('[Redis] Error:', err.message));
client.on('connect', () => console.log('[Redis] Conectado'));

let connected = false;

export async function getRedisClient() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}

export { client as redisClient };
