function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

function validNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'استخدم POST فقط' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const playerId = String(body.playerId || body.onesignalPlayerId || '').trim();
    const latitude = validNumber(body.latitude ?? body.location?.latitude, -90, 90);
    const longitude = validNumber(body.longitude ?? body.location?.longitude, -180, 180);
    if (!playerId || playerId.length > 200) return json(res, 400, { error: 'playerId مطلوب' });
    if (latitude == null || longitude == null) return json(res, 400, { error: 'إحداثيات صحيحة مطلوبة' });
    const timezone = String(body.timezone || 'UTC');
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    const user = {
      playerId,
      location: { latitude, longitude },
      timezone,
      method: Number(body.method || 3),
      enabled: body.enabled !== false,
      hourly: body.hourly !== false,
      hourlyIntervalMinutes: Math.max(30, Math.min(1440, Number(body.hourlyIntervalMinutes || 60))),
      sunnah: { dhuha: body.sunnah?.dhuha !== false, witr: body.sunnah?.witr !== false },
      dhuhaOffsetMinutes: Math.max(10, Math.min(120, Number(body.dhuhaOffsetMinutes || 15))),
      witrMode: body.witrMode === 'beforeSleep' ? 'beforeSleep' : 'lastThird',
      witrTimeMinutes: Math.max(0, Math.min(1439, Number(body.witrTimeMinutes || 1320))),
      updatedAt: new Date().toISOString(),
    };
    const { saveUser } = await import('./_lib/store.js');
    await saveUser(user);
    return json(res, 200, { ok: true, message: 'تم حفظ الموقع وإعدادات الإشعارات' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'تعذر حفظ الاشتراك' });
  }
}
