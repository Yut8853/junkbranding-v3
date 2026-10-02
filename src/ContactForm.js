import { check, clean, messageFor, LIMITS } from './shared/contactRules.js';

// Validates on leaving a field and on submit (not on every keystroke),
// explains each mistake in plain words, keeps honeypot / timing / cool-down
// guards, and maps the server's answers to messages. The server applies the
// same rules again (src/shared/contactRules.js) and never trusts this file.
const COOLDOWN_KEY = 'jb-contact-sent-at';

export class ContactForm {
  constructor(form) {
    this.form = form;
    this.status = form.querySelector('[data-contact-form-status]');
    this.submit = form.querySelector('[data-submit]');
    this.honeypot = form.elements.namedItem('company_website');
    this.fields = {
      name: form.elements.namedItem('name'),
      email: form.elements.namedItem('email'),
      message: form.elements.namedItem('message'),
    };
    this.startedAt = performance.now();
    this.sending = false;
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleInput = this.handleInput.bind(this);
    form.addEventListener('submit', this.handleSubmit);
    form.addEventListener('focusout', this.handleBlur);
    form.addEventListener('input', this.handleInput);
  }

  validate(name) {
    const field = this.fields[name];
    const error = messageFor(name, check(name, field?.value));
    this.show(name, error);
    return !error;
  }

  show(name, error) {
    const field = this.fields[name];
    field?.setAttribute('aria-invalid', error ? 'true' : 'false');
    const output = this.form.querySelector(`[data-error-for="${name}"]`);
    if (output) output.textContent = error;
  }

  handleBlur(event) {
    const name = event.target?.name;
    if (name in this.fields && event.target.value) this.validate(name);
  }

  handleInput(event) {
    const name = event.target?.name;
    if (name in this.fields && event.target.getAttribute('aria-invalid') === 'true') this.validate(name);
    if (this.status && !this.sending) this.status.textContent = '';
  }

  say(text) {
    if (this.status) this.status.textContent = text;
  }

  sentRecently() {
    try {
      return Date.now() - Number(sessionStorage.getItem(COOLDOWN_KEY) || 0) < 60_000;
    } catch {
      return false;
    }
  }

  async handleSubmit(event) {
    event.preventDefault();
    if (this.sending) return;
    const invalid = Object.keys(this.fields).filter((name) => !this.validate(name));
    if (invalid.length) {
      this.fields[invalid[0]]?.focus();
      this.say(invalid.length === 1 ? '入力内容に1件、確認が必要な項目があります。' : `入力内容に${invalid.length}件、確認が必要な項目があります。`);
      return;
    }
    const elapsed = Math.round(performance.now() - this.startedAt);
    if (elapsed < LIMITS.minFillMs || this.sentRecently()) {
      this.say('少し時間をおいてから、もう一度お試しください。');
      return;
    }

    this.sending = true;
    if (this.submit) this.submit.disabled = true;
    this.form.setAttribute('aria-busy', 'true');
    this.say('送信しています…');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          name: clean(this.fields.name.value),
          email: clean(this.fields.email.value),
          message: clean(this.fields.message.value),
          company_website: this.honeypot instanceof HTMLInputElement ? this.honeypot.value : '',
          elapsed,
        }),
      });
      clearTimeout(timer);
      const data = await response.json().catch(() => ({}));
      if (response.status === 400 && data?.errors) {
        // the server found something the browser did not: show it per field
        const names = Object.keys(data.errors).filter((name) => name in this.fields);
        names.forEach((name) => this.show(name, messageFor(name, data.errors[name])));
        if (names.length) this.fields[names[0]]?.focus();
        this.say('入力内容をご確認ください。');
        return;
      }
      if (response.status === 429) {
        this.say('送信が続いたため、一時的に受付を止めています。しばらくしてからお試しください。');
        return;
      }
      if (!response.ok) throw new Error('send-failed');
      try { sessionStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch { /* private mode */ }
      this.form.reset();
      Object.values(this.fields).forEach((field) => field?.removeAttribute('aria-invalid'));
      this.say('送信しました。ありがとうございます。');
      const rect = this.submit?.getBoundingClientRect();
      this.form.dispatchEvent(new CustomEvent('junkbranding:reveal-earth', {
        bubbles: true,
        detail: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null,
      }));
    } catch {
      this.say('送信できませんでした。通信状況をご確認のうえ、時間をおいて再度お試しください。');
    } finally {
      this.sending = false;
      this.form.removeAttribute('aria-busy');
      if (this.submit) this.submit.disabled = false;
    }
  }

  dispose() {
    this.form.removeEventListener('submit', this.handleSubmit);
    this.form.removeEventListener('focusout', this.handleBlur);
    this.form.removeEventListener('input', this.handleInput);
  }
}
