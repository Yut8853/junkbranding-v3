import { check } from '../src/shared/contactRules.js';
import handler from '../api/contact.js';

const ok = 'Webサイトのリニューアルについて相談したいです。よろしくお願いします。';
const attacks = {
  'script tag': '<script>alert(1)</script>' + ok,
  'img onerror': '<img src=x onerror=alert(1)>' + ok,
  'full-width brackets': '＜script＞alert(1)＜/script＞' + ok,
  'javascript: scheme': 'javascript:alert(document.cookie) ' + ok,
  'data: html': 'data:text/html;base64,PHNjcmlwdD4= ' + ok,
  'html entities': '&#60;script&#62;alert(1)' + ok,
  'named entities': '&lt;script&gt;alert(1)' + ok,
  'url-encoded': '%3Cscript%3Ealert(1)%3C/script%3E ' + ok,
  'unicode escape': '\\u003cscript ' + ok,
  'event handler': 'onmouseover=alert(1) ' + ok,
  'zero-width': ok + '\u200B',
  'rtl override': ok + '\u202E',
  'two urls': ok + ' https://a.example https://b.example',
};
let pass = 0;
let total = 0;
for (const [label, value] of Object.entries(attacks)) {
  total += 1;
  const code = check('message', value);
  const blocked = Boolean(code);
  if (blocked) pass += 1;
  console.log(blocked ? 'BLOCK' : 'ALLOW!!', label.padEnd(20), code);
}
for (const [label, value] of Object.entries({ 'name CRLF': 'Taro\r\nBcc: x@y.z', 'name script': '<b>Taro</b>', 'name zero-width': 'Ta\u200Bro' })) {
  total += 1; const code = check('name', value); if (code) pass += 1;
  console.log(code ? 'BLOCK' : 'ALLOW!!', label.padEnd(20), code);
}
for (const [label, value] of Object.entries({ 'email no tld': 'a@b', 'email header inj': 'a@b.com\r\nBcc:c@d.com', 'email script': '"<script>"@x.com', 'email double dot': 'a..b@x.com' })) {
  total += 1; const code = check('email', value); if (code) pass += 1;
  console.log(code ? 'BLOCK' : 'ALLOW!!', label.padEnd(20), code);
}
const legit = { name: '山田 太郎', email: 'taro.yamada@example.co.jp', message: ok + ' 参考: https://www.example.com' };
console.log('legit accepted:', !check('name', legit.name) && !check('email', legit.email) && !check('message', legit.message));
console.log(`rules: ${pass}/${total} attacks blocked`);

// ---- the API handler
function call({ method = 'POST', origin = 'https://www.junkbranding.com', type = 'application/json', body = {}, ip = '1.1.1.1' } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { resolve({ code: this.code, data, headers: this.headers }); } };
    handler({ method, headers: { origin, 'content-type': type, 'x-forwarded-for': ip }, body }, res);
  });
}
const good = { ...legit, company_website: '', elapsed: 9000 };
const results = [
  ['GET', await call({ method: 'GET' }), 405],
  ['foreign origin', await call({ origin: 'https://evil.example', body: good }), 403],
  ['no origin', await call({ origin: '', body: good }), 403],
  ['form-encoded', await call({ type: 'application/x-www-form-urlencoded', body: good }), 415],
  ['oversized', await call({ body: { ...good, message: 'x'.repeat(8000) }, ip: '2.2.2.2' }), 413],
  ['script in message', await call({ body: { ...good, message: attacks['script tag'] }, ip: '3.3.3.3' }), 400],
  ['honeypot filled', await call({ body: { ...good, company_website: 'http://spam' }, ip: '4.4.4.4' }), 200],
  ['too fast', await call({ body: { ...good, elapsed: 300 }, ip: '5.5.5.5' }), 200],
  ['valid, no mail config', await call({ body: good, ip: '6.6.6.6' }), 503],
];
for (let i = 0; i < 3; i += 1) await call({ body: good, ip: '7.7.7.7' });
results.push(['4th request in window', await call({ body: good, ip: '7.7.7.7' }), 429]);
let apiPass = 0;
for (const [label, result, expected] of results) {
  const okay = result.code === expected;
  if (okay) apiPass += 1;
  console.log(okay ? 'OK ' : 'NG!', label.padEnd(24), result.code, JSON.stringify(result.data).slice(0, 80));
}
console.log(`api: ${apiPass}/${results.length} as expected`);

// ---- the email that would be sent: escaped
process.env.RESEND_API_KEY = 'test';
process.env.CONTACT_TO_EMAIL = 'to@example.com';
let sent = null;
globalThis.fetch = async (url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({}), text: async () => '' }; };
await call({ body: { ...good, name: "O'Brien", message: ok + ' "quoted" & more' }, ip: '8.8.8.8' });
console.log('subject:', sent.subject);
console.log('html escaped:', !/["'&](?!#)/.test(sent.html.replace(/<\/?(h2|p|strong|br)>/g, '')), sent.html.slice(0, 160));
