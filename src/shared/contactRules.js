// One set of rules for the contact form, used by the browser (to explain
// mistakes as you type) and by the server (which never trusts the browser).
// Plain JavaScript, no DOM, so it runs in both places.

export const LIMITS = {
  name: { min: 2, max: 60 },
  email: { max: 254, local: 64 },
  message: { min: 20, max: 1200, urls: 1 },
  minFillMs: 2500,
};

// Invisible or direction-changing characters used to disguise content.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;
// Markup and script vectors. `<` and `>` are refused outright; the rest catch
// attempts that avoid angle brackets (schemes, handlers, encoded brackets).
const ANGLE = /[<>＜＞]/u;
const SCRIPTISH = /(?:javascript|vbscript|livescript)\s*:|data\s*:\s*[a-z]+\/[a-z0-9.+-]+|\bon[a-z]{3,}\s*=|&#x?[0-9a-f]+;?|&(?:lt|gt|quot|apos);|%3c|%3e|\\u00?3c|expression\s*\(/iu;
// a whole URL counts once (https://www.… is one link, not two)
const URL_LIKE = /(?:https?:\/\/|www\.)[^\s]+/giu;
const NAME = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .,'’・ー\-]*$/u;
// RFC 5322 is far wider; this is the practical subset real addresses use,
// and it requires a real top-level domain.
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

export const MESSAGES = {
  name: {
    empty: 'お名前を入力してください。',
    short: 'お名前は2文字以上で入力してください。',
    long: 'お名前は60文字以内で入力してください。',
    markup: 'お名前に記号「< >」やプログラムのような文字列は使えません。',
    control: 'お名前に見えない制御文字が含まれています。コピーではなく直接入力してください。',
    invalid: 'お名前には、文字・数字・スペースと、記号「. , - ・」のみ使えます。',
  },
  email: {
    empty: 'メールアドレスを入力してください。',
    long: 'メールアドレスは254文字以内で入力してください。',
    control: 'メールアドレスに見えない制御文字が含まれています。',
    invalid: 'メールアドレスの形式が正しくありません（例：name@example.com）。',
  },
  message: {
    empty: 'ご相談内容を入力してください。',
    short: 'ご相談内容は20文字以上で入力してください。',
    long: 'ご相談内容は1,200文字以内で入力してください。',
    markup: '記号「< >」や、スクリプト・HTMLのような文字列は送信できません。',
    control: '見えない制御文字が含まれています。コピーではなく直接入力してください。',
    links: 'URLは1つまでにしてください。',
  },
};

// Unicode normalisation folds look-alike forms (full-width letters etc.) so
// the checks cannot be sidestepped with them.
export function clean(value) {
  return String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();
}

export function check(field, raw) {
  const value = clean(raw);
  const text = MESSAGES[field];
  if (!text) return 'invalid';
  if (!value) return 'empty';
  if (CONTROL.test(value)) return 'control';
  if (field === 'name') {
    if (value.length < LIMITS.name.min) return 'short';
    if (value.length > LIMITS.name.max) return 'long';
    if (ANGLE.test(value) || SCRIPTISH.test(value)) return 'markup';
    if (!NAME.test(value)) return 'invalid';
  } else if (field === 'email') {
    if (value.length > LIMITS.email.max) return 'long';
    if (!EMAIL.test(value) || value.split('@')[0].length > LIMITS.email.local || value.includes('..')) return 'invalid';
  } else if (field === 'message') {
    if (value.length < LIMITS.message.min) return 'short';
    if (value.length > LIMITS.message.max) return 'long';
    if (ANGLE.test(value) || SCRIPTISH.test(value)) return 'markup';
    if ((value.match(URL_LIKE)?.length ?? 0) > LIMITS.message.urls) return 'links';
  }
  return '';
}

export function messageFor(field, code) {
  return code ? MESSAGES[field]?.[code] ?? '入力内容をご確認ください。' : '';
}

export function checkAll(input) {
  const errors = {};
  for (const field of ['name', 'email', 'message']) {
    const code = check(field, input?.[field]);
    if (code) errors[field] = code;
  }
  return errors;
}
