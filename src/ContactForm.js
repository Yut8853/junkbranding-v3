export class ContactForm {
  constructor(form) {
    this.form = form;
    this.status = form.querySelector('[data-contact-form-status]');
    this.matchTarget = form.querySelector('[data-match-target]');
    this.matchStatus = form.querySelector('[data-match-status]');
    this.matchChoices = [...form.querySelectorAll('[data-match-choice]')];
    this.submitButton = form.querySelector('button[type="submit"]');
    this.honeypot = form.elements.namedItem('company_website');
    this.matchItems = {
      flower: {
        src: '/images/contact-match-flower.svg',
        alt: 'Flower symbol target',
      },
      wave: {
        src: '/images/contact-match-wave.svg',
        alt: 'Wave symbol target',
      },
      spark: {
        src: '/images/contact-match-spark.svg',
        alt: 'Spark symbol target',
      },
    };
    const matchKeys = Object.keys(this.matchItems);
    this.matchAnswer = matchKeys[Math.floor(Math.random() * matchKeys.length)];
    this.matchSolved = false;
    this.matchRound = 0;
    this.wrongAttempts = 0;
    this.challengeStartedAt = performance.now();
    this.formStartedAt = performance.now();
    this.lastValidSubmitAt = -Infinity;
    this.unlockTimeout = 0;
    this.isSubmitting = false;
    this.fields = {
      name: form.elements.namedItem('name'),
      email: form.elements.namedItem('email'),
      message: form.elements.namedItem('message'),
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleMatchClick = this.handleMatchClick.bind(this);
    this.form.addEventListener('submit', this.handleSubmit);
    this.form.addEventListener('input', this.handleInput);
    this.form.addEventListener('focusout', this.handleBlur);
    this.form.addEventListener('click', this.handleMatchClick);
    this.setupMatchChallenge();
  }

  setupMatchChallenge() {
    const target = this.matchItems[this.matchAnswer];
    if (this.matchTarget instanceof HTMLImageElement && target) {
      this.matchTarget.src = target.src;
      this.matchTarget.alt = target.alt;
    }
    if (this.submitButton instanceof HTMLButtonElement) {
      this.submitButton.disabled = true;
    }
    for (const choice of this.matchChoices) {
      choice.disabled = false;
      choice.removeAttribute('data-state');
      choice.setAttribute('aria-pressed', 'false');
    }
    const choiceContainer = this.matchChoices[0]?.parentElement;
    if (choiceContainer) {
      [...this.matchChoices]
        .sort(() => Math.random() - 0.5)
        .forEach((choice) => choiceContainer.append(choice));
    }
  }

  resetMatchChallenge(message = '') {
    const previousAnswer = this.matchAnswer;
    const alternatives = Object.keys(this.matchItems).filter((key) => key !== previousAnswer);
    this.matchAnswer = alternatives[Math.floor(Math.random() * alternatives.length)];
    this.matchSolved = false;
    this.matchRound = 0;
    this.wrongAttempts = 0;
    this.challengeStartedAt = performance.now();
    this.setupMatchChallenge();
    if (this.matchStatus instanceof HTMLElement) this.matchStatus.textContent = message;
  }

  getError(fieldName) {
    const field = this.fields[fieldName];
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
      return '';
    }

    const value = field.value.normalize('NFKC').trim();
    if (!value) {
      if (fieldName === 'name') return 'お名前を入力してください。';
      if (fieldName === 'email') return 'メールアドレスを入力してください。';
      return 'メッセージを入力してください。';
    }
    if (fieldName === 'name') {
      if (value.length < 2) return 'お名前は2文字以上で入力してください。';
      if (value.length > 60) return 'お名前は60文字以内で入力してください。';
      if (!/^[\p{L}\p{M}][\p{L}\p{M}\p{N} .,'’\-]{1,59}$/u.test(value)) {
        return 'お名前に使用できない文字が含まれています。';
      }
    }
    if (fieldName === 'email') {
      const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
      if (value.length > 254) return 'メールアドレスは254文字以内で入力してください。';
      if (!emailPattern.test(value)) return 'メールアドレスの形式が正しくありません。';
      if (value.split('@')[0].length > 64) return 'メールアドレスのローカル部分が長すぎます。';
    }
    if (fieldName === 'message') {
      if (value.length < 20) return 'メッセージは20文字以上で入力してください。';
      if (value.length > 1200) return 'メッセージは1,200文字以内で入力してください。';
      if (/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) {
        return 'メッセージに使用できない文字が含まれています。';
      }
      if (/(javascript\s*:|data\s*:\s*text\/html|<\/?script)/iu.test(value)) {
        return 'メッセージに禁止パターンが含まれています。';
      }
      const urlCount = value.match(/(?:https?:\/\/|www\.)/giu)?.length ?? 0;
      if (urlCount > 1) return 'URLは1つまでにしてください。';
      if (/(\S)\1{24,}/u.test(value)) return '文字が連続しすぎています。';
    }
    return '';
  }

  validateField(fieldName) {
    const field = this.fields[fieldName];
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
      return false;
    }
    const error = this.getError(fieldName);
    const errorElement = this.form.querySelector(`[data-error-for="${fieldName}"]`);
    field.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (!error) field.value = field.value.normalize('NFKC').trim();
    if (errorElement instanceof HTMLElement) errorElement.textContent = error;
    return !error;
  }

  updateSubmitButtonState() {
    if (!(this.submitButton instanceof HTMLButtonElement)) return;

    const nameValid = this.validateField('name');
    const emailValid = this.validateField('email');
    const messageValid = this.validateField('message');
    const isReady = this.matchSolved && nameValid && emailValid && messageValid;

    this.submitButton.disabled = !isReady || this.isSubmitting;
  }

  async submitForm() {
    if (!(this.submitButton instanceof HTMLButtonElement)) return;
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.submitButton.disabled = true;
    if (this.status instanceof HTMLElement) this.status.textContent = 'SENDING...';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.fields.name?.value.trim(),
          email: this.fields.email?.value.trim(),
          message: this.fields.message?.value.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to send message.');
      }

      this.form.reset();
      if (this.status instanceof HTMLElement) {
        this.status.textContent = 'MESSAGE SENT — THANK YOU.';
      }
      this.form.dispatchEvent(new CustomEvent('junkbranding:reveal-earth', {
        bubbles: true,
      }));
      this.lastValidSubmitAt = performance.now();
      this.matchSolved = false;
      this.resetMatchChallenge('SECURITY CHECK RESET — PLEASE TRY AGAIN IF NEEDED.');
      this.submitButton.disabled = true;
    } catch (error) {
      if (this.status instanceof HTMLElement) {
        this.status.textContent = error instanceof Error
          ? error.message
          : 'FAILED TO SEND MESSAGE.';
      }
      this.submitButton.disabled = false;
    } finally {
      this.isSubmitting = false;
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    const now = performance.now();
    if (this.honeypot instanceof HTMLInputElement && this.honeypot.value.trim()) {
      if (this.status instanceof HTMLElement) this.status.textContent = 'SECURITY CHECK FAILED.';
      return;
    }
    if (this.isSubmitting) {
      if (this.status instanceof HTMLElement) this.status.textContent = 'SENDING IN PROGRESS.';
      return;
    }
    if (now - this.formStartedAt < 2500) {
      if (this.status instanceof HTMLElement) this.status.textContent = 'PLEASE WAIT BEFORE SUBMITTING.';
      return;
    }
    if (now - this.lastValidSubmitAt < 10000) {
      if (this.status instanceof HTMLElement) this.status.textContent = 'PLEASE WAIT BEFORE TRYING AGAIN.';
      return;
    }
    if (now - this.challengeStartedAt > 120000) {
      this.resetMatchChallenge('SECURITY CHECK EXPIRED — START AGAIN.');
      if (this.status instanceof HTMLElement) this.status.textContent = 'PLEASE COMPLETE THE NEW SECURITY CHECK.';
      return;
    }
    const nameValid = this.validateField('name');
    const emailValid = this.validateField('email');
    const messageValid = this.validateField('message');
    if (this.status instanceof HTMLElement) {
      if (!this.matchSolved) {
        this.status.textContent = 'PLEASE MATCH THE IMAGE FIRST.';
      } else {
        this.status.textContent = nameValid && emailValid && messageValid
          ? 'SECURITY CHECK PASSED — MESSAGE IS READY.'
          : 'PLEASE CHECK THE FIELDS ABOVE.';
      }
    }
    if (nameValid && emailValid && messageValid && this.matchSolved) {
      this.submitForm();
    }
    if (!nameValid) this.fields.name?.focus();
    else if (!emailValid) this.fields.email?.focus();
    else if (!messageValid) this.fields.message?.focus();
    else if (!this.matchSolved) this.matchChoices[0]?.focus();
  }

  handleMatchClick(event) {
    if (!(event.target instanceof Element)) return;
    const choice = event.target.closest('[data-match-choice]');
    if (!(choice instanceof HTMLButtonElement) || this.matchSolved) return;

    if (performance.now() - this.challengeStartedAt > 120000) {
      this.resetMatchChallenge('SECURITY CHECK EXPIRED — START AGAIN.');
      return;
    }

    for (const item of this.matchChoices) {
      item.removeAttribute('data-state');
      item.setAttribute('aria-pressed', 'false');
    }

    if (choice.dataset.matchChoice === this.matchAnswer) {
      choice.dataset.state = 'match';
      choice.setAttribute('aria-pressed', 'true');
      this.matchRound += 1;
      this.wrongAttempts = 0;

      if (this.matchRound < 2) {
        const previousAnswer = this.matchAnswer;
        const alternatives = Object.keys(this.matchItems).filter((key) => key !== previousAnswer);
        this.matchAnswer = alternatives[Math.floor(Math.random() * alternatives.length)];
        const target = this.matchItems[this.matchAnswer];
        if (this.matchTarget instanceof HTMLImageElement && target) {
          this.matchTarget.src = target.src;
          this.matchTarget.alt = target.alt;
        }
        for (const item of this.matchChoices) {
          item.removeAttribute('data-state');
          item.setAttribute('aria-pressed', 'false');
        }
        if (this.matchStatus instanceof HTMLElement) {
          this.matchStatus.textContent = '1 OF 2 MATCHED — MATCH THE NEW IMAGE.';
        }
      } else {
        this.matchSolved = true;
        if (this.matchStatus instanceof HTMLElement) {
          this.matchStatus.textContent = '2 OF 2 MATCHED — MESSAGE UNLOCKED.';
        }
        this.updateSubmitButtonState();
      }
      return;
    }

    choice.dataset.state = 'wrong';
    this.wrongAttempts += 1;
    if (this.matchStatus instanceof HTMLElement) {
      this.matchStatus.textContent = this.wrongAttempts >= 3
        ? 'TOO MANY FAILED MATCHES — LOCKED FOR 8 SECONDS.'
        : 'THE IMAGES DO NOT MATCH. TRY AGAIN.';
    }
    if (this.wrongAttempts >= 3) {
      for (const item of this.matchChoices) item.disabled = true;
      window.clearTimeout(this.unlockTimeout);
      this.unlockTimeout = window.setTimeout(() => {
        this.wrongAttempts = 0;
        for (const item of this.matchChoices) item.disabled = false;
        if (this.matchStatus instanceof HTMLElement) {
          this.matchStatus.textContent = 'SECURITY CHECK UNLOCKED — TRY AGAIN.';
        }
      }, 8000);
    }
  }

  handleInput(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    if (field.getAttribute('aria-invalid') === 'true') this.validateField(field.name);
    this.updateSubmitButtonState();
    if (this.status instanceof HTMLElement) this.status.textContent = '';
  }

  handleBlur(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    if (field.name === 'name' || field.name === 'email' || field.name === 'message') this.validateField(field.name);
    this.updateSubmitButtonState();
  }

  dispose() {
    window.clearTimeout(this.unlockTimeout);
    this.form.removeEventListener('submit', this.handleSubmit);
    this.form.removeEventListener('input', this.handleInput);
    this.form.removeEventListener('focusout', this.handleBlur);
    this.form.removeEventListener('click', this.handleMatchClick);
  }
}
