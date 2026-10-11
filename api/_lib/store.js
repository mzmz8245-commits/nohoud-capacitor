const redisUrl = process.env.REDIS_URL;

function parseRedisUrl(urlStr) {
  if (!urlStr) throw new Error('REDIS_URL is required');
  const parsed = new URL(urlStr);
  const host = parsed.hostname;
  const port = parsed.port || '6379';
  const password = parsed.password || parsed.username;
  const useTls = parsed.protocol === 'rediss:';
  const restUrl = `${useTls ? 'https' : 'http'}://${host}:${port}`;
  return { restUrl, password };
}

async function command(...parts) {
  const { restUrl, password } = parseRedisUrl(redisUrl);
  const response = await fetch(restUrl, {
    method: 'POST',
    headers: {
      ...(password ? { authorization: `Bearer ${password}` } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(parts),
  });
  if (!response.ok) throw new Error(`Redis request failed (${response.status})`);
  const payload = await response.json();
  return payload.result;
}

export async function saveUser(user) {
  await command('SET', `nohoud:user:${user.playerId}`, JSON.stringify(user));
  await command('SADD', 'nohoud:users', user.playerId);
  return user;
}

export async function getUser(playerId) {
  const raw = await command('GET', `nohoud:user:${playerId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function listUsers() {
  const ids = await command('SMEMBERS', 'nohoud:users');
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const values = await Promise.all(ids.map((id) => getUser(id)));
  return values.filter(Boolean);
}

export async function wasSent(playerId, eventKey) {
  return (await command('SISMEMBER', `nohoud:sent:${playerId}`, eventKey)) === 1;
}

export async function markSent(playerId, eventKey) {
  await command('SADD', `nohoud:sent:${playerId}`, eventKey);
  await command('EXPIRE', `nohoud:sent:${playerId}`, 172800);
}

export async function recentMessages() {
  const value = await command('LRANGE', 'nohoud:recent-messages', 0, 39);
  return Array.isArray(value) ? value : [];
}

export async function rememberMessage(message) {
  await command('LPUSH', 'nohoud:recent-messages', message);
  await command('LTRIM', 'nohoud:recent-messages', 0, 39);
}
