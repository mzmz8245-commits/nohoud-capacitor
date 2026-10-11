export async function sendOneSignal({ playerId, title, message, eventKey }) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    throw new Error('ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY are required');
  }
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: [playerId],
      headings: { ar: title, en: title },
      contents: { ar: message, en: message },
      data: { source: 'nohoud-cron', eventKey },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errors) throw new Error(`OneSignal failed (${response.status}): ${JSON.stringify(data.errors || data)}`);
  return data;
}
