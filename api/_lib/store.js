import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function saveUser(user) {
  await redis.set(`nohoud:user:${user.playerId}`, JSON.stringify(user));
  await redis.sadd('nohoud:users', user.playerId);
  return user;
}

export async function getUser(playerId) {
  const raw = await redis.get(`nohoud:user:${playerId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function listUsers() {
  const ids = await redis.smembers('nohoud:users');
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const values = await Promise.all(ids.map((id) => getUser(id)));
  return values.filter(Boolean);
}

export async function wasSent(playerId, eventKey) {
  const res = await redis.sismember(`nohoud:sent:${playerId}`, eventKey);
  return res === 1;
}

export async function markSent(playerId, eventKey) {
  await redis.sadd(`nohoud:sent:${playerId}`, eventKey);
  await redis.expire(`nohoud:sent:${playerId}`, 172800);
}

export async function recentMessages() {
  const value = await redis.lrange('nohoud:recent-messages', 0, 39);
  return Array.isArray(value) ? value : [];
}

export async function rememberMessage(message) {
  await redis.lpush('nohoud:recent-messages', message);
  await redis.ltrim('nohoud:recent-messages', 0, 39);
}
