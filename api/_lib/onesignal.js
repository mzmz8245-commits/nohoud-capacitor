export async function sendOneSignal({ subscriptionId, title, message, eventKey }) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    throw new Error('ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY are required');
  }
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      target_channel: 'push',
      include_subscription_ids: [subscriptionId],
      headings: { ar: title, en: title },
      contents: { ar: message, en: message },
      ios_interruption_level: 'active',
      data: { source: 'nohoud-cron', eventKey },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errors) throw new Error(`OneSignal failed (${response.status}): ${JSON.stringify(data.errors || data)}`);
  return data;
}
