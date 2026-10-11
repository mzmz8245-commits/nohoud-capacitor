import { recentMessages, rememberMessage } from './store.js';

const FALLBACKS = {
  hourly: [
    'خذ دقيقة هادئة: استغفر الله، ثم عد إلى عملك بقلب أخف.',
    'جدّد نيتك الآن؛ فالخطوة الصغيرة المخلصة قد تفتح باباً كبيراً من الخير.',
    'الحمد لله على نعمةٍ حاضرة. سمِّ نعمة واحدة واشكر الله عليها.',
    'اجعل هذه اللحظة وقفة قرب: سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر.',
  ],
  prayer: [
    'حان وقت الصلاة؛ أقبل عليها بهدوء، واجعلها راحةً لقلبك وتجديداً لعهدك مع الله.',
    'الصلاة موعد نور في يومك. توضأ واستقبلها بنية صادقة.',
    'توقّف لحظات عن كل شيء؛ هذا نداء للصلاة ووقت للسكينة.',
  ],
  sunrise: [
    'أشرقت شمس يوم جديد؛ احمد الله على فرصة أخرى للخير وابدأ بنية طيبة.',
    'مع الشروق، اجعل أول خطواتك اليوم ذكراً وشكراً وعزماً هادئاً.',
  ],
  dhuha: [
    'حان وقت الضحى؛ صلِّ ما تيسر، واطلب من الله بركة يومك.',
    'وقفة الضحى هدية لطيفة في منتصف الصباح؛ اغتنمها بقلب حاضر.',
  ],
  witr: [
    'اقترب وقت الوتر؛ اختم يومك بركعة ودعاء، فربك قريب مجيب.',
    'قبل أن تنام، اجعل للوتر نصيباً من ليلك ولو بالقليل المستطاع.',
  ],
};

function fallback(kind, seed = Date.now()) {
  const list = FALLBACKS[kind] || FALLBACKS.hourly;
  return list[Math.abs(Number(seed)) % list.length];
}

async function openai(text) {
  const response = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'أنت محرر رسائل عربية قصيرة لتطبيق نُهوض. اكتب رسالة واحدة فقط، بين 12 و28 كلمة، بلغة دافئة غير مبالغ فيها. لا تخترع آية أو حديثاً أو تنسب قولاً لمصدر. لا تستخدم رموزاً تعبيرية أو علامات اقتباس.' },
        { role: 'user', content: text },
      ],
      max_completion_tokens: 120,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI failed (${response.status})`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function gemini(text) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `اكتب رسالة عربية قصيرة واحدة (12 إلى 28 كلمة) لتطبيق نُهوض. لا تخترع أحاديث أو آيات ولا تنسب قولاً لمصدر. لا رموز تعبيرية.\n${text}` }] }] }),
  });
  if (!response.ok) throw new Error(`Gemini failed (${response.status})`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

export async function generateMessage({ kind, title, prayerName, time, playerId }) {
  const previous = await recentMessages();
  const prompt = kind === 'hourly'
    ? 'اكتب همسة إيمانية أو تحفيزاً لطيفاً للقرآن أو دعاءً عاماً غير منسوب لمصدر، مناسباً لهذه الساعة.'
    : `اكتب تذكيراً مناسباً لـ${title}${prayerName ? ` (${prayerName})` : ''} عند ${time}. اجعله عملياً ومطمئناً، ولا تستخدم حديثاً إلا إن كان النص مؤكداً مسبقاً.`;
  const uniqueness = previous.length ? `لا تكرر أياً من الرسائل السابقة: ${previous.slice(0, 12).join(' | ')}` : 'هذه أول رسالة في السجل.';
  let message;
  try {
    if (process.env.AI_PROVIDER === 'gemini' && process.env.GEMINI_API_KEY) message = await gemini(`${prompt}\n${uniqueness}`);
    else if (process.env.OPENAI_API_KEY) message = await openai(`${prompt}\n${uniqueness}`);
  } catch (error) {
    console.warn('AI generation fallback:', error.message);
  }
  if (!message || message.length < 8 || message.length > 240 || previous.includes(message)) {
    message = fallback(kind, `${playerId}:${Date.now()}`.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  }
  await rememberMessage(message);
  return message;
}
