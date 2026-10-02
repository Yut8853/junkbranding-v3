import { gsap } from 'gsap';

// Text in the deep sea does not pop in: it is light emerging from dark water.
//
//  chars  (headings)   each character rises a little, blurred, glowing a cold
//                      bioluminescent blue-green; it sharpens, the glow fades
//                      and it settles into the paper colour, one after another
//  sweep  (paragraphs) light sinks through the text from top to bottom while
//                      it comes into focus out of the murk
//  rise   (lists)      rows rise from below one by one, like bubbles
//  label               the season's kanji lights like a lamp; its line draws
//
// Leaving a scene the text drifts up, blurs and dissolves back into the
// water; arriving again replays it. Headings keep their full text for
// screen readers; with reduced motion everything is simply shown.

const GLOW = 'rgba(160, 238, 255, 0.95)';

function splitChars(element) {
  if (element.dataset.split === 'done') return Array.from(element.querySelectorAll('.ch'));
  const label = element.textContent.replace(/\s+/g, ' ').trim();
  const chars = [];
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        Array.from(child.textContent).forEach((char) => {
          if (/\s/.test(char)) { fragment.append(char); return; }
          const span = document.createElement('span');
          span.className = 'ch';
          span.textContent = char;
          fragment.append(span);
          chars.push(span);
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('visually-hidden') && child.tagName !== 'BR') {
        walk(child);
      }
    });
  };
  walk(element);
  // the heading is read as one phrase; the split letters are presentation
  element.setAttribute('aria-label', label);
  chars.forEach((span) => span.setAttribute('aria-hidden', 'true'));
  element.dataset.split = 'done';
  return chars;
}

export class TextReveal {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.state = new Map();
    if (!reducedMotion) document.documentElement.classList.add('reveal-ready');
  }

  // Everything in a panel that takes part, by kind.
  parts(panel) {
    return {
      labels: Array.from(panel.querySelectorAll('.label')),
      chars: Array.from(panel.querySelectorAll('[data-reveal="chars"]')),
      sweep: Array.from(panel.querySelectorAll('[data-reveal="sweep"]')),
      rise: Array.from(panel.querySelectorAll('[data-reveal="rise"] > *')),
    };
  }

  hideNow(panel) {
    const { labels, chars, sweep, rise } = this.parts(panel);
    chars.forEach((heading) => gsap.set(splitChars(heading), { opacity: 0, top: '0.45em', filter: 'blur(8px)', color: GLOW, textShadow: `0 0 18px ${GLOW}` }));
    gsap.set(sweep, { '--reveal': 0, filter: 'blur(5px)' });
    gsap.set(rise, { opacity: 0, y: 18, filter: 'blur(0px)' });
    gsap.set(labels, { '--line': 0 });
    labels.forEach((label) => gsap.set(label.querySelector('.label__season'), { opacity: 0.2, textShadow: '0 0 0 rgba(0,0,0,0)' }));
  }

  show(panel) {
    const { labels, chars, sweep, rise } = this.parts(panel);
    const tl = gsap.timeline();
    labels.forEach((label) => {
      const lamp = label.querySelector('.label__season');
      if (lamp) {
        tl.to(lamp, { opacity: 1, textShadow: `0 0 16px ${GLOW}`, duration: 0.5, ease: 'power2.out' }, 0)
          .to(lamp, { textShadow: '0 0 0px rgba(160, 238, 255, 0)', duration: 1.2, ease: 'power1.inOut' }, 0.5);
      }
      tl.to(label, { '--line': 1, duration: 0.9, ease: 'expo.out' }, 0.1);
    });
    chars.forEach((heading, index) => {
      const letters = splitChars(heading);
      // settle into the heading's own colour (a real colour, so it can be tweened)
      const paper = getComputedStyle(heading).color;
      const latin = heading.lang === 'en' || /^[\x00-\x7F\s]+$/.test(heading.getAttribute('aria-label') || '');
      const step = Math.min(latin ? 0.035 : 0.028, 0.9 / Math.max(1, letters.length));
      const start = 0.15 + index * 0.2;
      tl.to(letters, { opacity: 1, top: '0em', filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: step }, start)
        .to(letters, { color: paper, textShadow: '0 0 0px rgba(160, 238, 255, 0)', duration: 1.1, ease: 'power1.inOut', stagger: step }, start + 0.35);
    });
    tl.to(sweep, { '--reveal': 1, filter: 'blur(0px)', duration: 1.3, ease: 'power2.out', stagger: 0.14 }, 0.45);
    tl.to(rise, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, 0.55);
    // once settled, leave no inline glow colour behind
    tl.call(() => chars.forEach((heading) => gsap.set(splitChars(heading), { clearProps: 'color,textShadow' })));
    return tl;
  }

  dissolve(panel) {
    const { chars, sweep, rise } = this.parts(panel);
    const letters = chars.flatMap((heading) => splitChars(heading));
    const tl = gsap.timeline();
    tl.to(letters, { opacity: 0, top: '-0.3em', filter: 'blur(6px)', duration: 0.45, ease: 'power2.in', stagger: { each: 0.008, from: 'random' } }, 0);
    tl.to(sweep, { opacity: 0, filter: 'blur(4px)', duration: 0.4, ease: 'power2.in' }, 0);
    tl.to(rise, { opacity: 0, y: -12, filter: 'blur(4px)', duration: 0.4, ease: 'power2.in' }, 0);
    return tl;
  }

  // Called every frame with how present the panel is (0..1).
  track(panel, weight) {
    if (this.reducedMotion) return;
    let state = this.state.get(panel);
    if (!state) {
      state = { phase: 'hidden', tl: null };
      this.state.set(panel, state);
      this.hideNow(panel);
    }
    if (state.phase === 'hidden' && weight > 0.6) {
      state.tl?.kill();
      gsap.set(this.parts(panel).sweep.concat(this.parts(panel).rise), { opacity: 1 });
      this.hideNow(panel);
      state.tl = this.show(panel);
      state.phase = 'shown';
    } else if (state.phase === 'shown' && weight < 0.45) {
      state.tl?.kill();
      state.tl = this.dissolve(panel);
      state.phase = 'leaving';
    } else if (state.phase === 'leaving' && weight < 0.03) {
      state.tl?.kill();
      this.hideNow(panel);
      gsap.set(this.parts(panel).sweep.concat(this.parts(panel).rise), { opacity: 1 });
      state.phase = 'hidden';
    } else if (state.phase === 'leaving' && weight > 0.6) {
      state.phase = 'hidden';
    }
  }

  isShown(panel) {
    return this.state.get(panel)?.phase === 'shown';
  }

  // Works: the title and description changed in place — light them again.
  replay(container) {
    if (this.reducedMotion) return null;
    container.querySelectorAll('[data-reveal="chars"]').forEach((heading) => { heading.dataset.split = ''; });
    this.hideNow(container);
    gsap.set(this.parts(container).sweep.concat(this.parts(container).rise), { opacity: 1 });
    return this.show(container);
  }
}
