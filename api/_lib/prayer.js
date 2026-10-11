const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function parseClock(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(minutes) {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export async function fetchDay({ latitude, longitude, method = 3, date, timezone }) {
  const params = new URLSearchParams({ latitude, longitude, method, school: 0 });
  const response = await fetch(`https://api.aladhan.com/v1/timings/${date}?${params}`);
  if (!response.ok) throw new Error(`Aladhan failed (${response.status})`);
  const payload = await response.json();
  const timings = payload.data?.timings;
  if (!timings) throw new Error('Aladhan returned no timings');
  return { timings, timezone: timezone || payload.data?.meta?.timezone || 'UTC' };
}

export async function buildEvents(user, date) {
  const day = await fetchDay({ ...user.location, method: user.method || 3, date, timezone: user.timezone });
  const map = {};
  for (const name of PRAYERS) map[name] = parseClock(day.timings[name]);
  const events = [
    { key: 'fajr', title: 'صلاة الفجر', kind: 'prayer', prayerName: 'الفجر', minute: map.Fajr },
    { key: 'sunrise', title: 'الشروق', kind: 'sunrise', minute: map.Sunrise },
    { key: 'dhuhr', title: 'صلاة الظهر', kind: 'prayer', prayerName: 'الظهر', minute: map.Dhuhr },
    { key: 'asr', title: 'صلاة العصر', kind: 'prayer', prayerName: 'العصر', minute: map.Asr },
    { key: 'maghrib', title: 'صلاة المغرب', kind: 'prayer', prayerName: 'المغرب', minute: map.Maghrib },
    { key: 'isha', title: 'صلاة العشاء', kind: 'prayer', prayerName: 'العشاء', minute: map.Isha },
  ];
  const dhuha = map.Sunrise == null ? null : map.Sunrise + Number(user.dhuhaOffsetMinutes ?? 15);
  if (user.sunnah?.dhuha !== false) events.push({ key: 'dhuha', title: 'صلاة الضحى', kind: 'dhuha', minute: dhuha });
  if (user.sunnah?.witr !== false) {
    const tomorrow = new Date(`${date}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const nextDate = tomorrow.toISOString().slice(0, 10);
    const next = await fetchDay({ ...user.location, method: user.method || 3, date: nextDate, timezone: user.timezone });
    const nextFajr = parseClock(next.timings.Fajr);
    const lastThirdStart = nextFajr == null || map.Maghrib == null ? null : map.Maghrib + ((nextFajr + 1440 - map.Maghrib) % 1440) * (2 / 3);
    const witrMinute = user.witrMode === 'beforeSleep' ? Number(user.witrTimeMinutes ?? 22 * 60) : lastThirdStart;
    events.push({ key: 'witr', title: 'صلاة الوتر', kind: 'witr', minute: witrMinute });
  }
  return { timezone: day.timezone, events: events.filter((item) => Number.isFinite(item.minute)).map((item) => ({ ...item, time: formatClock(item.minute) })) };
}

export function localDateInTimezone(timezone, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(date);
}

export function localClockInTimezone(timezone, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
