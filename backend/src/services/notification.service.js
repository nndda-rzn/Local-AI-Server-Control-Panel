const TIMEOUT_MS = 8000;

function isEnabled() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.GENERIC_WEBHOOK_URL
  );
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: error.message };
  }
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function sendDiscord(text) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return null;
  return postJson(url, { content: text });
}

async function sendGeneric(payload) {
  const url = process.env.GENERIC_WEBHOOK_URL;
  if (!url) return null;
  return postJson(url, payload);
}

function formatMessage({ level, title, body, fields }) {
  const tag = level === 'error' ? '🔴' : level === 'warn' ? '⚠️' : 'ℹ️';
  const lines = [`${tag} *${title}*`];
  if (body) lines.push(body);
  if (fields && typeof fields === 'object') {
    for (const [k, v] of Object.entries(fields)) {
      lines.push(`• *${k}*: \`${String(v).slice(0, 200)}\``);
    }
  }
  lines.push(`_${new Date().toISOString()}_`);
  return lines.join('\n');
}

export async function notify({ level = 'info', title, body, fields }) {
  if (!isEnabled()) return { sent: false, reason: 'no notifier configured' };
  const text = formatMessage({ level, title, body, fields });
  const payload = { level, title, body, fields, timestamp: new Date().toISOString() };

  const results = await Promise.allSettled([
    sendTelegram(text),
    sendDiscord(text),
    sendGeneric(payload)
  ]);

  const channels = [];
  results.forEach((r, idx) => {
    const name = ['telegram', 'discord', 'generic'][idx];
    if (r.status === 'fulfilled' && r.value) {
      channels.push({ channel: name, ok: r.value.ok, status: r.value.status });
    }
  });

  return { sent: channels.length > 0, channels };
}

export function getNotificationStatus() {
  return {
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    discord: Boolean(process.env.DISCORD_WEBHOOK_URL),
    generic: Boolean(process.env.GENERIC_WEBHOOK_URL)
  };
}
