import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import particleVertexShader from './shaders/particles.vert.glsl?raw';
import particleFragmentShader from './shaders/particles.frag.glsl?raw';
import {
  disposeFlowerModel,
  loadFlowerModel,
  prepareFlowerModel,
  setFlowerOpacity,
} from './lib/model.js';
import { buildParticleGeometry } from './lib/particleCloud.js';
import { createPhotoFlower } from './lib/photoFlower.js';
import { JellyfishParticleSystem } from './JellyfishParticleSystem.js';
import { BioluminescentBackground } from './BioluminescentBackground.js';
import { ForegroundBlurredJellyfish } from './ForegroundBlurredJellyfish.js';
import { ParticleTitleSystem } from './ParticleTitleSystem.js';
import { attachAboutParticleTargets } from './lib/aboutParticleTargets.js';
import { AboutCanvasSelection } from './AboutCanvasSelection.js';
import { SpiralVideoGallery } from './SpiralVideoGallery.js';
import { ContactFluidReveal } from './ContactFluidReveal.js';
import { GravityTransitionEffect } from './GravityTransitionEffect.js';
import { LoadingTransitionOverlay } from './LoadingTransitionOverlay.js';

gsap.registerPlugin(ScrollTrigger);

const SCENE_PROGRESS_MAX = 1.9;

export class FlowerParticleExperience {
  constructor({
    canvas,
    stage,
    fallback = null,
    label = null,
    foregroundJellyfishCanvas = null,
    titleElement = null,
    conceptCopy = null,
    stageBrand = null,
    fluidWorksTitle = null,
    headerBrand = null,
    aboutSolid = null,
    aboutArtworkCanvas = null,
    capabilitiesSection = null,
    contactSection = null,
    modelUrl = '',
    photoUrl = '',
  }) {
    this.canvas = canvas;
    this.stage = stage;
    this.fallback = fallback;
    this.label = label;
    this.foregroundJellyfishCanvas = foregroundJellyfishCanvas;
    this.titleElement = titleElement;
    this.conceptCopy = conceptCopy;
    this.stageBrand = stageBrand;
    this.fluidWorksTitle = fluidWorksTitle;
    this.headerBrand = headerBrand;
    this.aboutSolid = aboutSolid;
    this.aboutArtworkCanvas = aboutArtworkCanvas;
    this.capabilitiesSection = capabilitiesSection;
    this.contactSection = contactSection;
    this.modelUrl = modelUrl;
    this.photoUrl = photoUrl;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.background = null;
    this.foregroundJellyfish = null;
    this.particleTitle = null;
    this.aboutViewHeight = 1;
    this.aboutCanvasSelection = null;
    this.spiralVideoGallery = null;
    this.contactFluid = null;
    this.gravityEffect = null;
    this.flower = null;
    this.particles = null;
    this.particleMaterial = null;
    this.jellyfishSystem = null;
    this.scrollTrigger = null;
    this.navigationLinks = [];
    this.navigationTween = null;
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.frameId = 0;
    this.inViewport = false;
    this.elapsedTime = 0;
    this.goldenPulsePhase = -1;
    this.goldenPulseDelay = randomGoldenPulseDelay();
    this.goldenPulseEnabled = false;
    this.lastFrameTime = 0;

    this.progress = 0;
    this.targetProgress = 0;
    this.targetVelocity = 0;
    this.smoothedVelocity = 0;
    this.destroyed = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.loadingFlowerHeld = true;
    this.flowerMotionStartedAt = 0;
    this.loadingPresentation = false;
    this.loadingScene = new THREE.Scene();
    this.loadingScene.background = new THREE.Color(0x000000);
    this.kvRevealStartedAt = -1;
    this.kvRevealAmount = 1;
    this.loadingTransitionOverlay = null;

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleParticleNavigation = this.handleParticleNavigation.bind(this);
    this.render = this.render.bind(this);
  }

  async init() {
    this.createRenderer();
    this.loadingTransitionOverlay = new LoadingTransitionOverlay(this.renderer);
    this.createScene();
    this.background = new BioluminescentBackground(this.scene);
    this.createCamera();
    this.createLights();

    const particleCount = chooseParticleCount();
    let geometry;
    let source;

    if (this.photoUrl) {
      const photoFlower = await createPhotoFlower(this.photoUrl, particleCount);
      this.flower = photoFlower.root;
      geometry = photoFlower.geometry;
      source = photoFlower.source;
    } else {
      const loaded = await loadFlowerModel(this.modelUrl);
      const prepared = prepareFlowerModel(loaded.root);
      this.flower = prepared.pivot;
      geometry = buildParticleGeometry(this.flower, particleCount).geometry;
      source = loaded.source;
    }
    this.scene.add(this.flower);
    const aboutResult = await attachAboutParticleTargets(geometry, {
      silhouetteUrl: '/images/face.png',
      artworkCanvas: this.aboutArtworkCanvas,
    });
    const aboutParticleCount = aboutResult.count;
    if (aboutResult.selectionData?.canvas instanceof HTMLCanvasElement) {
      this.aboutCanvasSelection = new AboutCanvasSelection(aboutResult.selectionData);
    }

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uGoldenPhase: { value: -1 },
        uSpiralOffset: { value: 0.07 },
        uSpiralRadius: { value: 1.71 },
        uWorksBandHeight: { value: 1.2 },
        uWorksBandY: { value: 1.8 },
        uProgress: { value: 0 },
        uVelocity: { value: 0 },
        uPixelRatio: { value: this.getPixelRatio() },
        uPointSize: { value: isCompactViewport() ? 25 : 29 },
        uFlowerSway: { value: 0 },
        uBaseY: { value: -1.62 },
        uAboutScale: { value: 1 },
        uAboutY: { value: 2.4 },
        uAboutZ: { value: 1.2 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);

    if (this.titleElement instanceof HTMLElement) {
      this.particleTitle = new ParticleTitleSystem({
        scene: this.scene,
        titleElement: this.titleElement,
        pixelRatio: this.getPixelRatio(),
      });
    }
    this.jellyfishSystem = new JellyfishParticleSystem({
      scene: this.scene,
      distantScene: this.background.distantScene,
      pixelRatio: this.getPixelRatio(),
    });
    if (this.foregroundJellyfishCanvas instanceof HTMLCanvasElement) {
      this.foregroundJellyfish = new ForegroundBlurredJellyfish(
        this.foregroundJellyfishCanvas,
      );
    }
    this.spiralVideoGallery = new SpiralVideoGallery({
      scene: this.scene,
      camera: this.camera,
      domElement: this.canvas,
      showTitle: true,
    });
    const contactFluidCanvas = this.contactSection?.querySelector('[data-contact-fluid]');
    if (contactFluidCanvas instanceof HTMLCanvasElement) {
      this.contactFluid = new ContactFluidReveal(contactFluidCanvas, this.canvas);
    }
    this.gravityEffect = new GravityTransitionEffect(
      this.renderer,
      this.scene,
      this.camera,
      this.reducedMotion,
    );

    this.setupScroll();
    this.setupParticleNavigation();
    this.setupResizeObserver();
    this.setupIntersectionObserver();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.handleResize();
    this.syncRenderState();

    console.info(
      `[flower-particle-scroll] Ready: ${source} flower, ${particleCount.toLocaleString()} particles; ${aboutParticleCount.toLocaleString()} move into About.`,
    );
  }

  createRenderer() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      this.fallback?.removeAttribute('hidden');
      throw error;
    }

    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  createScene() {
    this.scene = new THREE.Scene();
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    this.camera.position.set(0, 0.05, 6.35);
    this.camera.lookAt(0, 0.05, 0);
  }

  createLights() {
    const ambient = new THREE.HemisphereLight(0xffffff, 0x7c746b, 2.15);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(-3.4, 4.8, 5.5);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xffd7c7, 2.0);
    rim.position.set(4.5, 1.6, -2.5);
    this.scene.add(rim);
  }

  setupScroll() {
    if (this.reducedMotion) {
      this.applyProgress(0);
      return;
    }

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.stage,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        this.targetProgress = THREE.MathUtils.clamp(
          self.progress * SCENE_PROGRESS_MAX,
          0,
          SCENE_PROGRESS_MAX,
        );
        this.targetVelocity = self.getVelocity();
      },
    });

    const initialProgress = (this.scrollTrigger.progress || 0) * SCENE_PROGRESS_MAX;
    this.targetProgress = initialProgress;
    this.applyProgress(initialProgress);
  }

  setupParticleNavigation() {
    this.navigationLinks = Array.from(document.querySelectorAll('[data-particle-nav]'));
    this.navigationLinks.forEach((link) => {
      link.addEventListener('click', this.handleParticleNavigation);
    });
  }

  handleParticleNavigation(event) {
    const link = event.currentTarget;
    if (!(link instanceof HTMLAnchorElement)) return;
    const destinations = {
      about: 0.93,
      works: 1.16,
      contact: 1.86,
    };
    const section = link.dataset.particleNav;
    const destination = destinations[section];
    if (!Number.isFinite(destination)) return;
    event.preventDefault();
    this.navigateWithParticles(destination, link.hash, link);
  }

  navigateWithParticles(targetProgress, hash, activeLink = null) {
    const destination = THREE.MathUtils.clamp(
      targetProgress,
      0,
      SCENE_PROGRESS_MAX,
    );
    this.navigationTween?.kill();

    if (this.scrollTrigger) {
      const scrollTop = THREE.MathUtils.lerp(
        this.scrollTrigger.start,
        this.scrollTrigger.end,
        destination / SCENE_PROGRESS_MAX,
      );
      // The sticky scene remains visually fixed while its actual scroll state
      // jumps into place. Only the particle transformation is animated.
      window.scrollTo({ top: scrollTop, left: window.scrollX, behavior: 'auto' });
    }
    this.targetProgress = destination;
    this.targetVelocity = 0;

    if (this.reducedMotion) {
      this.applyProgress(destination);
      this.updateNavigationState(activeLink);
      if (hash) history.replaceState(null, '', hash);
      return;
    }

    const transition = { progress: this.progress };
    this.navigationTween = gsap.to(transition, {
      progress: destination,
      duration: 2.35,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => this.applyProgress(transition.progress),
      onComplete: () => {
        this.navigationTween = null;
        this.targetProgress = destination;
        this.applyProgress(destination);
        this.updateNavigationState(activeLink);
        if (hash) history.replaceState(null, '', hash);
      },
      onInterrupt: () => {
        this.navigationTween = null;
      },
    });
  }

  updateNavigationState(activeLink) {
    this.navigationLinks.forEach((link) => {
      if (link === activeLink) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  applyProgress(progress) {
    this.progress = THREE.MathUtils.clamp(progress, 0, SCENE_PROGRESS_MAX);
    this.stage?.style.setProperty(
      '--foreground-gas-opacity',
      1 - smoothstep(0.18, 0.52, this.progress),
    );

    if (this.particleMaterial) {
      this.particleMaterial.uniforms.uProgress.value = this.progress;
    }
    this.jellyfishSystem?.setProgress(this.progress);
    this.foregroundJellyfish?.setProgress(this.progress);
    this.particleTitle?.setProgress(this.progress);
    this.spiralVideoGallery?.setProgress(this.progress);
    this.contactFluid?.setProgress(this.progress);
    if (this.conceptCopy instanceof HTMLElement) {
      const opacity = 1 - smoothstep(0.08, 0.34, this.progress);
      this.conceptCopy.style.setProperty('--concept-copy-opacity', opacity);
    }
    if (this.stageBrand instanceof HTMLElement) {
      const openingOpacity = 1 - smoothstep(0.08, 0.34, this.progress);
      // Reveal the complete placeholder first, then replace each X in a
      // separate, clearly readable sequence as Contact settles into place.
      const contactVisibility = smoothstep(1.72, 1.77, this.progress);
      const brandTransformation = smoothstep(1.77, 1.855, this.progress);
      const resolvedCharacters = this.progress >= SCENE_PROGRESS_MAX
        ? 12
        : Math.floor(brandTransformation * 12);
      const target = 'JUNKBRANDING';
      const stageBrandText = target.slice(0, resolvedCharacters)
        + 'X'.repeat(12 - resolvedCharacters);
      if (this.stageBrand.textContent !== stageBrandText) {
        this.stageBrand.textContent = stageBrandText;
      }
      this.stageBrand.style.setProperty(
        '--stage-brand-opacity',
        Math.max(openingOpacity, contactVisibility),
      );
      if (this.headerBrand instanceof HTMLElement) {
        const headerBrandText = `${stageBrandText} DESIGN STUDIO`;
        if (this.headerBrand.textContent !== headerBrandText) {
          this.headerBrand.textContent = headerBrandText;
        }
      }
    }
    if (this.fluidWorksTitle instanceof HTMLElement) {
      const worksReveal = smoothstep(1.04, 1.11, this.progress);
      const worksDeparture = smoothstep(1.27, 1.36, this.progress);
      const worksTravel = smoothstep(1.04, 1.27, this.progress);
      this.fluidWorksTitle.style.setProperty(
        '--fluid-works-opacity',
        worksReveal * (1 - worksDeparture),
      );
      this.fluidWorksTitle.style.setProperty(
        '--fluid-works-y',
        `${THREE.MathUtils.lerp(82, 25, worksTravel)}svh`,
      );
    }
    this.updateCapabilitiesSection();
    this.updateContactSection();
    this.updateGravityTransition();
    let aboutWorldY = 0;
    if (this.particleMaterial) {
      aboutWorldY = calculateAboutY(this.progress, this.aboutViewHeight);
      this.particleMaterial.uniforms.uAboutY.value = aboutWorldY;
    }
    if (this.aboutSolid instanceof HTMLElement) {
      // Reverse the opening flower transition: particles resolve into a fully
      // solid photograph and HTML copy, then disappear beneath that result.
      const aboutSolidReveal = smoothstep(0.865, 0.93, this.progress);
      this.aboutSolid.style.setProperty('--about-solid-reveal', aboutSolidReveal);
      this.aboutSolid.toggleAttribute('data-visible', aboutSolidReveal > 0.001);
      this.syncAboutSolidProjection(aboutWorldY);
    }

    if (this.flower) {
      const fade = 1 - smoothstep(0.1, 0.38, this.progress);
      setFlowerOpacity(this.flower, fade);
      this.flower.visible = fade > 0.002;
    }

    if (this.label) {
      this.label.textContent = getStageLabel(this.progress);
    }
  }

  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.canvas);
      return;
    }

    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) {
      this.inViewport = true;
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.inViewport = Boolean(entry?.isIntersecting);
        this.syncRenderState();
      },
      { rootMargin: '200px 0px 200px 0px' },
    );

    this.intersectionObserver.observe(this.stage);
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;

    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelRatio = this.getPixelRatio();

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    this.camera.aspect = width / height;
    this.camera.position.z = isCompactViewport() ? 6.75 : 6.35;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    const spiralRadius = calculateResponsiveSpiralRadius(this.camera);
    const worksBandHeight = calculateWorksBandHeight(this.camera, height);
    const worksBandY = calculateWorksBandY(this.camera, worksBandHeight);
    this.aboutViewHeight = 2
      * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
      * (this.camera.position.z - 1.2);
    const aboutViewWidth = this.aboutViewHeight * this.camera.aspect;
    const aboutTargetWidth = Math.min(
      aboutViewWidth * (isCompactViewport() ? 0.88 : 0.74),
      4.6,
    );

    if (this.particleMaterial) {
      this.particleMaterial.uniforms.uPixelRatio.value = pixelRatio;
      this.particleMaterial.uniforms.uPointSize.value = isCompactViewport() ? 25 : 29;
      this.particleMaterial.uniforms.uSpiralRadius.value = spiralRadius;
      this.particleMaterial.uniforms.uWorksBandHeight.value = worksBandHeight;
      this.particleMaterial.uniforms.uWorksBandY.value = worksBandY;
      this.particleMaterial.uniforms.uAboutScale.value = aboutTargetWidth / 2.4;
      this.particleMaterial.uniforms.uAboutY.value = calculateAboutY(
        this.progress,
        this.aboutViewHeight,
      );
    }
    this.syncAboutSolidProjection(
      calculateAboutY(this.progress, this.aboutViewHeight),
    );
    this.jellyfishSystem?.setPixelRatio(pixelRatio);
    this.jellyfishSystem?.setSpiralRadius(spiralRadius);
    this.jellyfishSystem?.setWorksBandHeight(worksBandHeight);
    this.jellyfishSystem?.setWorksBandY(worksBandY);
    this.spiralVideoGallery?.setSpiralRadius(spiralRadius);
    this.contactFluid?.resize(width, height, pixelRatio);
    this.background?.resize(width, height, pixelRatio);
    this.gravityEffect?.resize(width, height, pixelRatio);
    this.loadingTransitionOverlay?.resize(width, height, pixelRatio);
    this.foregroundJellyfish?.resize(width, height, pixelRatio, spiralRadius);
    this.particleTitle?.resize(
      this.camera,
      pixelRatio,
      isCompactViewport(),
      spiralRadius,
      worksBandHeight,
      worksBandY,
    );

    this.scrollTrigger?.refresh();
  }

  syncAboutSolidProjection(worldY) {
    if (
      !(this.aboutSolid instanceof HTMLElement)
      || !this.camera
      || !this.particleMaterial
    ) return;

    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const scale = this.particleMaterial.uniforms.uAboutScale.value;
    const depth = this.particleMaterial.uniforms.uAboutZ.value;
    const bounds = [
      new THREE.Vector3(-1.2 * scale, worldY + 0.59 * scale, depth),
      new THREE.Vector3(1.2 * scale, worldY + 0.59 * scale, depth),
      new THREE.Vector3(-1.2 * scale, worldY - 0.59 * scale, depth),
      new THREE.Vector3(1.2 * scale, worldY - 0.59 * scale, depth),
    ];

    this.camera.updateMatrixWorld(true);
    const projected = bounds.map((point) => point.project(this.camera));
    const screenX = projected.map((point) => (point.x * 0.5 + 0.5) * width);
    const screenY = projected.map((point) => (-point.y * 0.5 + 0.5) * height);
    const left = Math.min(...screenX);
    const right = Math.max(...screenX);
    const top = Math.min(...screenY);
    const bottom = Math.max(...screenY);

    this.aboutSolid.style.left = `${left}px`;
    this.aboutSolid.style.top = `${top}px`;
    this.aboutSolid.style.width = `${right - left}px`;
    this.aboutSolid.style.height = `${bottom - top}px`;
  }

  updateContactSection() {
    if (!(this.contactSection instanceof HTMLElement)) return;

    const travel = smoothstep(1.73, 1.86, this.progress);
    const offset = THREE.MathUtils.lerp(115, 0, travel);
    const visible = this.progress >= 1.81;

    this.contactSection.style.setProperty('--contact-offset', `${offset}svh`);
    this.contactSection.toggleAttribute('data-visible', visible);
    this.contactSection.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  updateGravityTransition() {
    this.gravityEffect?.setProgress(
      this.progress,
      this.smoothedVelocity < 0 ? -1 : 1,
    );
    if (
      this.reducedMotion
      ||
      !(this.capabilitiesSection instanceof HTMLElement)
      || !(this.contactSection instanceof HTMLElement)
    ) return;

    const transition = smoothstep(1.66, 1.82, this.progress);
    const gravity = Math.sin(transition * Math.PI);
    const tension = Math.pow(Math.max(0, gravity), 1.6);
    const handoff = smoothstep(0.24, 0.78, transition);
    const returnPhase = smoothstep(0.58, 1, transition);
    const elasticReturn = returnPhase
      * Math.sin(returnPhase * Math.PI)
      * window.innerHeight
      * 0.024;
    const pullY = gravity * window.innerHeight * 0.4 - elasticReturn;
    const glitchKick = tension * Math.sin(transition * Math.PI * 9);

    this.capabilitiesSection.style.setProperty('--gravity-y', `${pullY * 0.08}px`);
    this.capabilitiesSection.style.setProperty('--gravity-scale-x', `${1 - tension * 0.035}`);
    this.capabilitiesSection.style.setProperty('--gravity-scale-y', `${1 + tension * 0.18}`);
    this.capabilitiesSection.style.setProperty('--gravity-skew', `${-gravity * 0.3 + glitchKick * 0.16}deg`);

    const capabilitiesList = this.capabilitiesSection.querySelector('.capabilities-section__list');
    if (capabilitiesList instanceof HTMLElement) {
      capabilitiesList.style.transform = `translate3d(${glitchKick * 3}px, ${pullY * 0.24}px, 0) scaleY(${1 + tension * 1.35})`;
      capabilitiesList.style.transformOrigin = '50% 72%';
      capabilitiesList.style.filter = `blur(${tension * 0.62}px) saturate(${1 + tension * 0.42})`;
    }

    this.contactSection.style.setProperty('--gravity-y', `${-pullY * 0.12}px`);
    this.contactSection.style.setProperty('--gravity-scale-x', `${1 - tension * 0.02}`);
    this.contactSection.style.setProperty('--gravity-scale-y', `${1 + tension * 0.16}`);

    const contactShell = this.contactSection.querySelector('.contact-form-shell');
    if (contactShell instanceof HTMLElement) {
      contactShell.style.transform = `translate3d(${glitchKick * -2.4}px, ${(1 - handoff) * 42 - pullY * 0.2}px, 0) scaleX(${1 - tension * 0.02}) scaleY(${1 + tension * 0.56}) skewY(${gravity * (transition < 0.5 ? 0.28 : -0.28)}deg)`;
      contactShell.style.transformOrigin = '50% 22%';
      contactShell.style.filter = `blur(${tension * 0.26}px) saturate(${1 + tension * 0.22})`;
      contactShell.style.setProperty(
        '--gravity-chroma-shadow',
        `${-7 * tension}px ${2 * tension}px 0 rgb(255 22 132 / ${Math.min(0.3, tension * 0.3)}), ${8 * tension}px ${-2 * tension}px 0 rgb(0 231 242 / ${Math.min(0.24, tension * 0.24)})`,
      );
    }
  }

  updateCapabilitiesSection() {
    if (!(this.capabilitiesSection instanceof HTMLElement)) return;

    // Hold the J-side in place while the B-side travels up to meet it. Once
    // every pair is aligned, move the complete composition out together.
    const entrance = smoothstep(1.365, 1.4, this.progress);
    const bTravel = smoothstep(1.38, 1.56, this.progress);
    const exitTravel = smoothstep(1.58, 1.71, this.progress);
    const marqueeTravel = smoothstep(1.54, 1.7, this.progress);
    const offset = THREE.MathUtils.lerp(0, -115, exitTravel);
    const bOffset = THREE.MathUtils.lerp(115, 0, bTravel);
    const opacity = entrance * (1 - smoothstep(1.69, 1.71, this.progress));
    const marqueeOpacity = smoothstep(1.54, 1.57, this.progress)
      * (1 - smoothstep(1.67, 1.71, this.progress));
    const marqueeOffset = THREE.MathUtils.lerp(28, -48, marqueeTravel);
    const visible = opacity > 0.001;

    this.capabilitiesSection.style.setProperty('--capabilities-offset', `${offset}svh`);
    this.capabilitiesSection.style.setProperty('--capabilities-b-offset', `${bOffset}svh`);
    this.capabilitiesSection.style.setProperty('--capabilities-opacity', opacity);
    this.capabilitiesSection.style.setProperty('--capabilities-marquee-opacity', marqueeOpacity);
    this.capabilitiesSection.style.setProperty('--capabilities-marquee-offset', `${marqueeOffset}vw`);
    this.capabilitiesSection.toggleAttribute('data-visible', visible);
    this.capabilitiesSection.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  handleVisibilityChange() {
    this.syncRenderState();
  }

  syncRenderState() {
    const shouldRender = !this.destroyed && !document.hidden && this.inViewport;

    if (shouldRender && !this.frameId) {
      this.lastFrameTime = performance.now();
      this.frameId = requestAnimationFrame(this.render);
      return;
    }

    if (!shouldRender && this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.lastFrameTime = 0;
    }
  }

  render() {
    if (this.destroyed || !this.renderer || !this.scene || !this.camera) return;

    const now = performance.now();
    const delta = this.lastFrameTime > 0
      ? Math.min((now - this.lastFrameTime) / 1000, 0.05)
      : 0;
    this.lastFrameTime = now;
    this.elapsedTime += delta;
    const elapsed = this.elapsedTime;
    this.updateGoldenPulse(delta);

    // ScrollTrigger supplies the destination while the scene catches up with
    // exponential damping. This gives every scroll-driven system the same
    // inertial start and settle without hijacking native page scrolling.
    if (!this.navigationTween) {
      const progressDamping = 1 - Math.pow(0.055, delta);
      const inertialProgress = THREE.MathUtils.lerp(
        this.progress,
        this.targetProgress,
        progressDamping,
      );
      this.applyProgress(
        Math.abs(this.targetProgress - inertialProgress) < 0.00005
          ? this.targetProgress
          : inertialProgress,
      );
    }

    this.targetVelocity *= Math.pow(0.015, delta);
    this.smoothedVelocity = THREE.MathUtils.lerp(
      this.smoothedVelocity,
      this.targetVelocity,
      1 - Math.pow(0.001, delta),
    );

    const flowerAnimationTime = this.loadingFlowerHeld
      ? 0
      : Math.max(0, elapsed - this.flowerMotionStartedAt);

    if (this.particleMaterial) {
      this.particleMaterial.uniforms.uTime.value = flowerAnimationTime;
      this.particleMaterial.uniforms.uGoldenPhase.value = this.goldenPulsePhase;
      this.particleMaterial.uniforms.uVelocity.value = this.smoothedVelocity;
    }
    this.jellyfishSystem?.update(elapsed, delta, this.goldenPulsePhase);
    this.particleTitle?.update(elapsed);
    this.spiralVideoGallery?.update(elapsed);

    const photoWinds = this.flower?.userData?.windUniforms ?? [];
    photoWinds.forEach((photoWind) => {
      photoWind.uTime.value = flowerAnimationTime;
      photoWind.uProgress.value = this.progress;
    });

    if (this.kvRevealStartedAt >= 0) {
      const reveal = smoothstep(0, 1.08, elapsed - this.kvRevealStartedAt);
      this.kvRevealAmount = reveal;
      if (reveal >= 1) this.kvRevealStartedAt = -1;
    }

    if (this.flower?.visible) {
      const intact = 1 - smoothstep(0.1, 0.38, this.progress);
      const sway = photoWinds.length
        ? 0
        : Math.sin(elapsed * 0.82) * 0.035 + Math.sin(elapsed * 1.47 + 1.2) * 0.012;
      const flowerSway = sway * intact;
      this.flower.rotation.z = flowerSway;
      this.particleMaterial.uniforms.uFlowerSway.value = flowerSway;
    }

    if (this.loadingPresentation) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.loadingScene, this.camera);
    } else {
      this.background?.update(elapsed, this.progress, delta);
      this.background?.render(this.renderer, this.camera);
      if (this.gravityEffect) this.gravityEffect.render(elapsed);
      else this.renderer.render(this.scene, this.camera);
      this.loadingTransitionOverlay?.render(1 - this.kvRevealAmount);
    }
    // Capture the completed shared scene after the main WebGL renderer has
    // drawn it, then use that exact frame as Contact's unrevealed foreground.
    this.contactFluid?.update(elapsed, delta);
    this.foregroundJellyfish?.update(elapsed, delta);

    if (!this.destroyed && !document.hidden && this.inViewport) {
      this.frameId = requestAnimationFrame(this.render);
    } else {
      this.frameId = 0;
    }
  }

  getPixelRatio() {
    const maxDpr = isCompactViewport() ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, maxDpr);
  }

  releaseLoadingFlower() {
    if (!this.loadingFlowerHeld) return;
    this.loadingFlowerHeld = false;
    this.flowerMotionStartedAt = this.elapsedTime;
  }

  beginLoadingPresentation() {
    if (!this.flower || !this.scene || this.loadingPresentation) return;
    this.scene.remove(this.flower);
    this.loadingScene.add(this.flower);
    this.flower.children.forEach((child, index) => {
      child.visible = index === 1;
    });
    this.loadingPresentation = true;
    this.background?.setLoadingReveal(0);
  }

  endLoadingPresentation() {
    if (!this.flower || !this.scene || !this.loadingPresentation) return;
    this.loadingTransitionOverlay?.capture(this.loadingScene, this.camera);
    this.loadingScene.remove(this.flower);
    this.scene.add(this.flower);
    this.flower.children.forEach((child) => {
      child.visible = true;
    });
    this.background?.setLoadingReveal(1);
    this.loadingPresentation = false;
    this.kvRevealStartedAt = this.elapsedTime;
    this.kvRevealAmount = 0;
  }

  getKvFlowerProjection() {
    const flower = this.flower?.children?.[1];
    if (!(flower instanceof THREE.Mesh) || !this.camera || !this.canvas) return null;
    const geometryWidth = flower.geometry?.parameters?.width;
    const geometryHeight = flower.geometry?.parameters?.height;
    if (!Number.isFinite(geometryWidth) || !Number.isFinite(geometryHeight)) return null;

    flower.updateWorldMatrix(true, false);
    this.camera.updateMatrixWorld(true);
    const center = flower.localToWorld(new THREE.Vector3(0, 0, 0)).project(this.camera);
    const right = flower.localToWorld(
      new THREE.Vector3(geometryWidth * 0.5, 0, 0),
    ).project(this.camera);
    const top = flower.localToWorld(
      new THREE.Vector3(0, geometryHeight * 0.5, 0),
    ).project(this.camera);
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const toScreen = (point) => new THREE.Vector2(
      (point.x * 0.5 + 0.5) * width,
      (-point.y * 0.5 + 0.5) * height,
    );
    const centerScreen = toScreen(center);
    const rightScreen = toScreen(right);
    const topScreen = toScreen(top);
    const rightVector = rightScreen.clone().sub(centerScreen);
    return {
      centerX: centerScreen.x,
      centerY: centerScreen.y,
      width: rightVector.length() * 2,
      height: topScreen.distanceTo(centerScreen) * 2,
      rotation: Math.atan2(rightVector.y, rightVector.x),
    };
  }

  updateGoldenPulse(delta) {
    if (this.progress < 0.52) {
      if (this.goldenPulseEnabled) {
        this.goldenPulseEnabled = false;
        this.goldenPulsePhase = -1;
        this.goldenPulseDelay = randomGoldenPulseDelay();
      }
      return;
    }

    this.goldenPulseEnabled = true;

    if (this.goldenPulsePhase >= 0) {
      this.goldenPulsePhase += delta / 2.2;
      if (this.goldenPulsePhase >= 1) {
        this.goldenPulsePhase = -1;
        this.goldenPulseDelay = randomGoldenPulseDelay();
      }
      return;
    }

    this.goldenPulseDelay -= delta;
    if (this.goldenPulseDelay <= 0) this.goldenPulsePhase = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    cancelAnimationFrame(this.frameId);
    this.frameId = 0;

    this.scrollTrigger?.kill();
    this.scrollTrigger = null;
    this.navigationTween?.kill();
    this.navigationTween = null;
    this.navigationLinks.forEach((link) => {
      link.removeEventListener('click', this.handleParticleNavigation);
    });
    this.navigationLinks = [];

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.aboutCanvasSelection?.dispose();
    this.aboutCanvasSelection = null;

    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.scene?.remove(this.particles);
      this.particles = null;
    }

    this.jellyfishSystem?.dispose();
    this.jellyfishSystem = null;

    this.background?.dispose();
    this.background = null;

    this.foregroundJellyfish?.dispose();
    this.foregroundJellyfish = null;

    this.particleTitle?.dispose();
    this.particleTitle = null;

    this.spiralVideoGallery?.dispose();
    this.spiralVideoGallery = null;


    this.contactFluid?.dispose();
    this.contactFluid = null;
    this.gravityEffect?.dispose();
    this.gravityEffect = null;
    this.loadingTransitionOverlay?.dispose();
    this.loadingTransitionOverlay = null;

    if (this.flower) {
      disposeFlowerModel(this.flower);
      this.scene?.remove(this.flower);
      this.flower = null;
    }

    this.renderer?.dispose();
    this.renderer = null;
  }
}

function chooseParticleCount() {
  const override = Number(new URLSearchParams(window.location.search).get('particles'));
  if (Number.isFinite(override) && override > 0) {
    return Math.round(THREE.MathUtils.clamp(override, 5000, 100000));
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;

  if (isCompactViewport() || cores <= 4 || memory <= 4) return 24000;
  if (cores >= 8 && memory >= 8) return 52000;
  return 40000;
}

function isCompactViewport() {
  return window.matchMedia('(max-width: 720px)').matches || navigator.maxTouchPoints > 1;
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function getStageLabel(progress) {
  if (progress < 0.16) return 'FLOWER';
  if (progress < 0.46) return 'DISSOLVE';
  if (progress < 0.78) return 'PARTICLES';
  return 'AIR';
}

function randomGoldenPulseDelay() {
  return THREE.MathUtils.randFloat(2.4, 6.8);
}

function calculateResponsiveSpiralRadius(camera) {
  const distance = camera.position.z;
  const viewHeight = 2
    * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    * distance;
  const viewWidth = viewHeight * camera.aspect;
  return Math.min(viewWidth * 0.51, 5.2);
}

function calculateWorksBandHeight(camera, viewportHeight) {
  const distance = camera.position.z;
  const viewHeight = 2
    * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    * distance;
  const targetPixels = Math.min(300, viewportHeight * 0.55);
  return viewHeight * (targetPixels / Math.max(1, viewportHeight));
}

function calculateWorksBandY(camera, bandHeight) {
  const distance = camera.position.z;
  const viewHeight = 2
    * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    * distance;
  return 0.05 + viewHeight * 0.5 - bandHeight * 0.5;
}

function calculateAboutY(progress, viewHeight) {
  // Arrive from below, hold exactly in the viewport center while particles
  // resolve into the shared artwork, then continue upward after completion.
  if (progress < 0.84) {
    const arrival = smoothstep(0.72, 0.84, progress);
    return 0.05 + THREE.MathUtils.lerp(-0.72, 0, arrival) * viewHeight;
  }
  if (progress <= 0.94) return 0.05;
  if (progress <= 1) {
    const departure = smoothstep(0.94, 1, progress);
    return 0.05 + departure * 0.72 * viewHeight;
  }
  // Keep moving upward throughout the following Works section instead of
  // parking the completed About panel just above the viewport.
  const continuedDeparture = 0.72 + (progress - 1) * 2.4;
  return 0.05 + continuedDeparture * viewHeight;
}
