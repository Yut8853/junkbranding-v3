import './styles.css';
import { FlowerParticleExperience } from './FlowerParticleExperience.js';
import { ContactForm } from './ContactForm.js';
import { SecretEarthPage } from './SecretEarthPage.js';
import { StainedGlassCursor } from './StainedGlassCursor.js';
import { PointerMusicPlayer } from './PointerMusicPlayer.js';
import { FluidStageBrand } from './FluidStageBrand.js';
import { LoadingScreen } from './LoadingScreen.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let experience = null;

function resetPageState() {
  if (window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.querySelector('[data-contact-form]')?.reset();
  if (experience) {
    experience.navigationTween?.kill();
    experience.navigationTween = null;
    experience.targetProgress = 0;
    experience.targetVelocity = 0;
    experience.smoothedVelocity = 0;
    experience.applyProgress(0);
  }
}

resetPageState();
window.addEventListener('pageshow', resetPageState);
window.addEventListener('beforeunload', resetPageState);

const canvas = document.querySelector('[data-flower-canvas]');
const stage = document.querySelector('[data-flower-stage]');
const fallback = document.querySelector('[data-webgl-fallback]');
const label = document.querySelector('[data-stage-label]');
const title = document.getElementById('intro-title');
const conceptCopy = document.querySelector('[data-concept-copy]');
const stageBrand = document.querySelector('[data-stage-brand]');
const headerBrand = document.querySelector('[data-header-brand]');
const foregroundJellyfishCanvas = document.querySelector('[data-foreground-jellyfish-canvas]');
const aboutSolid = document.querySelector('[data-about-solid]');
const aboutArtworkCanvas = document.querySelector('[data-about-artwork]');
const capabilitiesSection = document.querySelector('[data-capabilities-section]');
const contactSection = document.querySelector('[data-contact-section]');
const contactFormElement = document.querySelector('[data-contact-form]');
const loadingRoot = document.querySelector('[data-loading-screen]');
const loadingScreen = loadingRoot instanceof HTMLElement
  ? new LoadingScreen(
    loadingRoot,
    '/textures/cosmos-photo.png',
    () => experience.releaseLoadingFlower(),
    () => experience.endLoadingPresentation(),
  )
  : null;
const contactForm = contactFormElement instanceof HTMLFormElement
  ? new ContactForm(contactFormElement)
  : null;
const secretEarthRoot = document.querySelector('[data-secret-earth]');
const secretEarth = secretEarthRoot instanceof HTMLElement
  ? new SecretEarthPage(secretEarthRoot)
  : null;
const revealSecretEarth = () => secretEarth?.show();
const stainedGlassCursor = new StainedGlassCursor();
const musicPlayer = new PointerMusicPlayer('/music/Out%20of%20Flux%20-%20Blue%20Race.mp3');
let fluidStageBrand = null;
document.addEventListener('junkbranding:reveal-earth', revealSecretEarth);

if (!(canvas instanceof HTMLCanvasElement) || !(stage instanceof HTMLElement)) {
  throw new Error('Required flower stage elements were not found.');
}

experience = new FlowerParticleExperience({
  canvas,
  stage,
  fallback,
  label,
  foregroundJellyfishCanvas,
  titleElement: title,
  conceptCopy,
  stageBrand,
  headerBrand,
  aboutSolid,
  aboutArtworkCanvas,
  capabilitiesSection,
  contactSection,
  photoUrl: '/textures/cosmos-photo.png',
});

function fitTitleToViewport() {
  if (!(title instanceof HTMLElement)) return;
  title.style.fontSize = '100px';
  const measuredWidth = title.getBoundingClientRect().width;
  if (measuredWidth <= 0) return;
  const viewportWidth = document.documentElement.clientWidth;
  title.style.fontSize = `${(viewportWidth / measuredWidth) * 100}px`;
}

function lockAnimatedBrandWidths() {
  const setWidth = (element, samples) => {
    if (!(element instanceof HTMLElement)) return;
    element.style.width = 'auto';
    const style = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = Number.parseFloat(style.letterSpacing) || 0;
    const width = Math.max(...samples.map((sample) => (
      context.measureText(sample).width + spacing * Math.max(0, sample.length - 1)
    )));
    element.style.width = `${Math.ceil(width + 2)}px`;
  };

  setWidth(stageBrand, ['XXXXXXXXXXXX', 'JUNKBRANDING']);
  setWidth(headerBrand, [
    'XXXXXXXXXXXX DESIGN STUDIO',
    'JUNKBRANDING DESIGN STUDIO',
  ]);
}

fitTitleToViewport();
document.fonts?.ready.then(fitTitleToViewport);
window.addEventListener('resize', fitTitleToViewport, { passive: true });

const syneReady = document.fonts?.load('700 100px Syne') ?? Promise.resolve();
syneReady.then(() => {
  lockAnimatedBrandWidths();
  try {
    const sticky = document.querySelector('.flower-stage__sticky');
    fluidStageBrand = new FluidStageBrand({
      elements: [
        document.querySelector('.flower-stage__source'),
        document.querySelector('.flower-stage__tagline'),
        stageBrand,
        ...document.querySelectorAll('.site-header__nav a'),
        ...document.querySelectorAll('.capabilities-section__list span'),
      ],
      container: sticky,
    });
  } catch (error) {
    console.warn('[flower-particle-scroll] Fluid stage brand unavailable.', error);
  }
  return experience.init();
}).then(() => {
  experience.beginLoadingPresentation();
  loadingScreen?.showKvFlower();
  window.setTimeout(() => loadingScreen?.complete(), 460);
}).catch((error) => {
  console.error('[flower-particle-scroll] Failed to initialize.', error);
  fallback?.removeAttribute('hidden');
  loadingScreen?.complete();
});

window.addEventListener('resize', lockAnimatedBrandWidths, { passive: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('pageshow', resetPageState);
    window.removeEventListener('beforeunload', resetPageState);
    window.removeEventListener('resize', fitTitleToViewport);
    contactForm?.dispose();
    document.removeEventListener('junkbranding:reveal-earth', revealSecretEarth);
    secretEarth?.dispose();
    stainedGlassCursor.dispose();
    musicPlayer.dispose();
    loadingScreen?.dispose();
    fluidStageBrand?.dispose();
    experience.destroy();
  });
}
