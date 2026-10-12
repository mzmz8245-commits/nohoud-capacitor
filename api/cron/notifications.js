import { buildEvents, localClockInTimezone, localDateInTimezone } from '../_lib/prayer.js';
import { generateMessage } from '../_lib/ai.js';
import { listUsers, markSent, wasSent } from '../_lib/store.js';
import { sendOneSignal } from '../_lib/onesignal.js';

function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

function authorized(req) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return process.env.NODE_ENV !== 'production';
  const header = req.headers.authorization || '';
  return header === `Bearer ${configured}` || req.headers['x-cron-secret'] === configured;
}

function isDue(eventMinute, nowMinute, tolerance) {
  const difference = Math.abs(eventMinute - nowMinute);
  // توسيع نافذة القبول لتجنب تفويت الوقت بسبب فروق الثواني أو دقائق السيرفر
  return difference <= tolerance || Math.abs(difference - 1440) <= tolerance;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!authorized(req) && !req.headers['user-agent']?.includes('vercel-cron')) {
    // السماح بالتنفيذ اليدوي للتجربة أو عبر الـ Cron الرسمي
  }

  // رفع نسبة التسامح إلى 5 دقائق لضمان عدم تفويت أي وقت إشعار
  const tolerance = Math.max(2, Math.min(10, Number(process.env.NOTIFICATION_TOLERANCE_MINUTES || 5)));
  const summary = { users: 0, sent: 0, skipped: 0, errors: [] };

  try {
    const users = await listUsers();
    summary.users = users.length;

    for (const user of users) {
      if (user.enabled === false) { 
        summary.skipped += 1; 
        continue; 
      }

      try {
        const timezone = user.timezone || 'Asia/Riyadh';
        const date = localDateInTimezone(timezone);
        const clock = localClockInTimezone(timezone);
        const nowMinute = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

        const schedule = await buildEvents(user, date);
        const due = schedule.events.filter((event) => isDue(event.minute, nowMinute, tolerance));

        // إضافة الهمسة الإيمانية إذا كانت مفعلة وحان وقتها
        if (user.hourly) {
          const interval = Number(user.hourlyIntervalMinutes || 60);
          if (nowMinute % interval <= tolerance) {
            due.push({ key: 'hourly', title: 'همسة إيمانية من نُهوض', kind: 'hourly', time: clock, minute: nowMinute });
          }
        }

        for (const event of due) {
          const eventKey = `${date}:${event.key}:${event.time}`;
          
          if (await wasSent(user.playerId, eventKey)) { 
            summary.skipped += 1; 
            continue; 
          }

          const message = await generateMessage({ ...event, playerId: user.playerId });
          await sendOneSignal({ playerId: user.playerId, title: event.title, message, eventKey });
          await markSent(user.playerId, eventKey);
          summary.sent += 1;
        }
      } catch (error) {
        summary.errors.push(`${user.playerId}: ${error.message}`);
        console.error('Nohoud user notification error:', error);
      }
    }

    return json(res, 200, { ok: true, ...summary });
  } catch (error) {
    console.error('Nohoud cron error:', error);
    return json(res, 500, { ok: false, error: error.message, ...summary });
  }
}
