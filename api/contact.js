import { checkAll, clean, LIMITS } from '../src/shared/contactRules.js';

// Contact endpoint (Vercel serverless). Defence in depth: only our own
// origin, only JSON, a size cap, the same validation rules as the browser,
// honeypot and fill-time checks, a per-IP rate limit, escaped email
// content, and no internal details in responses.
//
// Environment:
//   RESEND_API_KEY, CONTACT_TO_EMAIL (required), EMAIL_FROM (optional)
//   ALLOWED_ORIGINS  comma separated (default: the production site)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  shared rate limit (optional)

const DEFAULT_ORIGINS = ['https://www.junkbranding.com', 'https://junkbranding.com'];
const RATE = { limit: 3, windowSeconds: 600 };
const MAX_BODY = 6000;
const memory = new Map();

const escapeHtml = (text) => String(text).replace(/[&<>"'`=\/]/g, (c) => `&#${c.charCodeAt(0)};`);
const oneLine = (text, max) => String(text).replace(/[\r\n\t\u0000-\u001F\u007F]+/g, ' ').slice(0, max);

function allowedOrigins() {
  const list = (process.env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

// Fixed-window limit: shared across instances with Upstash Redis when it is
// configured, otherwise per instance in memory (best effort).
async function rateLimited(ip) {
  const key = `contact:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const response = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(RATE.windowSeconds), 'NX']]),
      });
      const result = await response.json();
      return Number(result?.[0]?.result ?? 0) > RATE.limit;
    } catch {
      // fall through to the in-memory limit
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || now - entry.start > RATE.windowSeconds * 1000) {
    memory.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE.limit;
}

function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { message: 'Method not allowed.' });
  }

  // Same-origin only: browsers always send Origin on a POST fetch.
  const origin = String(req.headers.origin || '');
  if (!allowedOrigins().includes(origin)) return send(res, 403, { message: 'Forbidden.' });

  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return send(res, 415, { message: 'Unsupported media type.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body || JSON.stringify(body).length > MAX_BODY) return send(res, 413, { message: 'Payload too large.' });

  if (await rateLimited(clientIp(req))) {
    res.setHeader('Retry-After', String(RATE.windowSeconds));
    return send(res, 429, { message: 'Too many requests.' });
  }

  // Bots: filled the hidden field, or submitted faster than a person can.
  // Answer as if accepted so they learn nothing.
  if (String(body.company_website || '').trim() || Number(body.elapsed) < LIMITS.minFillMs) {
    return send(res, 200, { success: true });
  }

  const input = { name: clean(body.name), email: clean(body.email), message: clean(body.message) };
  const errors = checkAll(input);
  if (Object.keys(errors).length) return send(res, 400, { message: 'Invalid input.', errors });

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.EMAIL_FROM || 'hello@junkbranding.com';
  if (!apiKey || !toEmail) {
    console.error('Contact form is not configured: RESEND_API_KEY / CONTACT_TO_EMAIL missing.');
    return send(res, 503, { message: 'Temporarily unavailable.' });
  }

  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const message = escapeHtml(input.message).replace(/\n/g, '<br>');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: input.email,
        subject: oneLine(`お問い合わせ：${input.name}`, 80),
        text: `お名前: ${input.name}\nメール: ${input.email}\n\n${input.message}\n`,
        html: `<h2>お問い合わせ</h2><p><strong>お名前:</strong> ${name}</p><p><strong>メール:</strong> ${email}</p><p><strong>内容:</strong></p><p>${message}</p>`,
      }),
    });
    if (!response.ok) {
      console.error('Resend rejected the message:', response.status, await response.text().catch(() => ''));
      return send(res, 502, { message: 'Could not send.' });
    }
    return send(res, 200, { success: true });
  } catch (error) {
    console.error('Contact form submission failed:', error);
    return send(res, 502, { message: 'Could not send.' });
  }
}
