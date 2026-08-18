import * as THREE from 'three';

const TAU = Math.PI * 2;
const VIDEO_ITEMS = [
  { src: '/videos/junk.mp4', label: 'JUNK', href: 'https://funky.junkbranding.com/' },
  { src: '/videos/toplace.mp4', label: 'TOPLACE', href: 'https://to-place.co.jp/' },
  { src: '/videos/iwakiki.mp4', label: 'IWAKIKI', href: 'https://d2crmzpw5das9r.cloudfront.net/' },
  { src: '/videos/next.mp4', label: 'NEXT', href: 'https://next-inc.group/' },
  { src: '/videos/trans.mp4', label: 'TRANS', href: 'https://trans-b.vercel.app/' },
  { src: '/videos/luzreal.mp4', label: 'LUZREAL', href: 'https://luz-real.com/' },
];

export class SpiralVideoGallery {
  constructor({ scene, camera, domElement = null, showTitle = true }) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.group = new THREE.Group();
    this.group.name = 'counter-rotating-video-spiral';
    this.items = [];
    this.progress = 0;
    this.spiralRadius = 2.4;
    this.isPlaying = false;
    this.frameGeometry = null;
    this.borderGeometry = null;
    this.titleGroup = null;
    this.titleGeometry = null;
    this.titleLetters = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.detailOpen = false;
    this.activeDetailItem = null;
    this.detailWheelAccumulator = 0;
    this.detailWheelLockedUntil = 0;
    this.activeDetailPhysicalIndex = 1;
    this.detailPointerId = null;
    this.detailPointerStart = new THREE.Vector2();
    this.previousFocus = null;
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleDetailWheel = this.handleDetailWheel.bind(this);
    this.handleDetailResize = this.handleDetailResize.bind(this);
    this.handleDetailTransitionEnd = this.handleDetailTransitionEnd.bind(this);
    this.handleDetailPointerDown = this.handleDetailPointerDown.bind(this);
    this.handleDetailPointerUp = this.handleDetailPointerUp.bind(this);
    this.handleDetailKeyDown = this.handleDetailKeyDown.bind(this);
    this.closeDetail = this.closeDetail.bind(this);

    this.createItems();
    if (showTitle) this.createTitle();
    this.createDetailOverlay();
    this.domElement?.addEventListener('click', this.handleCanvasClick);
    this.domElement?.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    document.addEventListener('keydown', this.handleDetailKeyDown);
    this.scene.add(this.group);
  }

  createItems() {
    const frameGeometry = new THREE.PlaneGeometry(2.35, 1.322);
    const borderGeometry = new THREE.EdgesGeometry(frameGeometry);
    this.frameGeometry = frameGeometry;
    this.borderGeometry = borderGeometry;

    for (let index = 0; index < 10; index += 1) {
      const isVideo = index < VIDEO_ITEMS.length;
      const source = isVideo ? VIDEO_ITEMS[index] : null;
      const video = isVideo ? createVideo(source.src) : null;
      const texture = video
        ? createVideoTexture(video)
        : createSecretTexture(index + 1);
      const material = video
        ? createCinematicVideoMaterial(texture, index)
        : new THREE.MeshBasicMaterial({
          map: texture,
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          side: THREE.FrontSide,
          depthTest: true,
          depthWrite: true,
          toneMapped: false,
        });
      const mesh = new THREE.Mesh(frameGeometry, material);
      mesh.userData.galleryItemIndex = index;
      const backTexture = createBackTexture(index + 1, source?.label ?? 'SECRET');
      const backMaterial = new THREE.MeshBasicMaterial({
        map: backTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: true,
        toneMapped: false,
      });
      const back = new THREE.Mesh(frameGeometry, backMaterial);
      back.userData.galleryItemIndex = index;
      back.position.z = -0.009;
      back.rotation.y = Math.PI;
      mesh.add(back);
      const borderMaterial = new THREE.LineBasicMaterial({
        color: isVideo ? 0xff1684 : 0x49b9ff,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      const border = new THREE.LineSegments(borderGeometry, borderMaterial);
      border.userData.galleryItemIndex = index;
      border.position.z = 0.008;
      mesh.add(border);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.items.push({
        index,
        mesh,
        video,
        texture,
        material,
        cinematic: Boolean(video),
        backTexture,
        backMaterial,
        borderMaterial,
      });
    }

  }

  setProgress(progress) {
    this.progress = THREE.MathUtils.clamp(progress, 0, 1.65);
    const shouldPlay = this.progress > 1.03 && this.progress < 1.5;
    if (shouldPlay !== this.isPlaying) {
      this.isPlaying = shouldPlay;
      for (const item of this.items) {
        if (!item.video) continue;
        if (shouldPlay) item.video.play().catch(() => {});
        else item.video.pause();
      }
    }
  }

  createTitle() {
    this.titleGroup = new THREE.Group();
    this.titleGroup.position.z = 0.2;
    this.titleGeometry = new THREE.PlaneGeometry(1.4, 1.4);
    Array.from('WORKS').forEach((letter, index) => {
      const texture = createWorksLetterTexture(letter, index);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.94,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(this.titleGeometry, material);
      mesh.position.y = 2.08 - index * 1.04;
      mesh.rotation.z = -Math.PI * 0.5;
      mesh.renderOrder = 1;
      this.titleGroup.add(mesh);
      this.titleLetters.push({ mesh, material, texture, index });
    });
    this.group.add(this.titleGroup);
  }

  setSpiralRadius(radius) {
    this.spiralRadius = Math.max(1.2, radius);
  }

  createDetailOverlay() {
    const root = document.createElement('section');
    root.className = 'works-detail';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'works-detail-heading');
    root.innerHTML = `
      <h2 id="works-detail-heading" class="visually-hidden">WORKS DETAILS</h2>
      <div class="works-detail__text-wall" data-works-detail-wall aria-hidden="true"></div>
      <button class="works-detail__close" type="button" data-works-detail-close aria-label="Close project details">CLOSE</button>
      <div class="works-detail__viewport" data-works-detail-viewport>
        <div class="works-detail__track" data-works-detail-track></div>
      </div>
      <p class="works-detail__hint" aria-hidden="true">SCROLL / DRAG TO EXPLORE</p>
    `;
    document.body.append(root);
    this.detailRoot = root;
    this.detailWall = root.querySelector('[data-works-detail-wall]');
    this.detailViewport = root.querySelector('[data-works-detail-viewport]');
    this.detailTrack = root.querySelector('[data-works-detail-track]');
    this.detailClose = root.querySelector('[data-works-detail-close]');
    const carouselItems = [
      this.items[this.items.length - 1],
      ...this.items,
      this.items[0],
    ];
    this.detailSlides = carouselItems.map((item) => this.createDetailSlide(item));
    this.detailTrack?.append(...this.detailSlides.map((slide) => slide.root));
    this.detailClose?.addEventListener('click', this.closeDetail);
    this.detailViewport?.addEventListener('wheel', this.handleDetailWheel, { passive: false });
    this.detailViewport?.addEventListener('pointerdown', this.handleDetailPointerDown);
    this.detailViewport?.addEventListener('pointerup', this.handleDetailPointerUp);
    this.detailViewport?.addEventListener('pointercancel', this.handleDetailPointerUp);
    this.detailTrack?.addEventListener('transitionend', this.handleDetailTransitionEnd);
    window.addEventListener('resize', this.handleDetailResize, { passive: true });
  }

  createDetailSlide(item) {
    const source = VIDEO_ITEMS[item.index] ?? null;
    const label = source?.label ?? `SECRET ${String(item.index + 1).padStart(2, '0')}`;
    const slide = document.createElement('div');
    slide.className = 'works-detail__slide';
    slide.setAttribute('aria-label', `${label}, project ${item.index + 1} of ${this.items.length}`);
    slide.innerHTML = `
      <article class="works-detail__content">
        <p class="works-detail__index">PROJECT ${String(item.index + 1).padStart(2, '0')} / ${String(this.items.length).padStart(2, '0')}</p>
        <h3>${label}</h3>
        <div class="works-detail__media"></div>
        <div class="works-detail__meta">
          <p>CREATIVE DIRECTION / DESIGN / DEVELOPMENT</p>
          <p data-works-detail-action></p>
        </div>
      </article>
    `;
    const media = slide.querySelector('.works-detail__media');
    const action = slide.querySelector('[data-works-detail-action]');
    let video = null;
    if (source) {
      video = createVideo(source.src);
      video.preload = 'metadata';
      media.append(video);
      const link = document.createElement('a');
      link.href = source.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'サイトを見る ↗';
      action.append(link);
    } else {
      const secret = document.createElement('div');
      secret.className = 'works-detail__secret';
      secret.textContent = 'SECRET PROJECT';
      media.append(secret);
      action.textContent = 'SELECTED WORK / JUNKBRANDING DESIGN STUDIO';
    }
    return { root: slide, video, label, index: item.index };
  }

  handleCanvasClick(event) {
    const item = this.pickItem(event);
    if (item) this.openDetail(item);
  }

  handlePointerMove(event) {
    if (!this.domElement || this.detailOpen) return;
    this.domElement.style.cursor = this.pickItem(event) ? 'pointer' : '';
  }

  pickItem(event) {
    if (
      !this.domElement
      || this.detailOpen
      || this.progress < 1.045
      || this.progress > 1.36
    ) return null;

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.camera.updateMatrixWorld(true);
    this.group.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(
      this.items.map((item) => item.mesh),
      true,
    );
    for (const intersection of intersections) {
      if (!intersection.object.isMesh) continue;
      let object = intersection.object;
      while (
        object
        && !Number.isInteger(object.userData.galleryItemIndex)
        && object.parent !== this.group
      ) object = object.parent;
      const itemIndex = object?.userData?.galleryItemIndex;
      const item = Number.isInteger(itemIndex) ? this.items[itemIndex] : null;
      if (!item || !item.mesh.visible) continue;
      const opacity = item.cinematic
        ? item.material.uniforms.uOpacity.value
        : item.material.opacity;
      if (opacity > 0.08) return item;
    }
    return null;
  }

  openDetail(item) {
    if (!this.detailRoot || this.detailOpen) return;
    this.detailOpen = true;
    this.activeDetailItem = item;
    this.detailWheelAccumulator = 0;
    this.detailWheelLockedUntil = 0;
    this.previousFocus = document.activeElement;
    document.body.classList.add('works-detail-open');
    this.detailRoot.setAttribute('data-open', '');
    this.detailRoot.setAttribute('aria-hidden', 'false');
    this.domElement.style.cursor = '';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.positionDetailAt(item.index);
      this.detailClose?.focus({ preventScroll: true });
    }));
  }

  positionDetailAt(logicalIndex) {
    if (!this.detailViewport || !this.detailTrack) return;
    const physicalIndex = logicalIndex + 1;
    this.syncDetailSlide(logicalIndex, physicalIndex);
    this.setDetailTrackPosition(physicalIndex, false);
  }

  closeDetail() {
    if (!this.detailRoot || !this.detailOpen) return;
    this.detailOpen = false;
    this.activeDetailItem = null;
    this.detailSlides.forEach((slide) => slide.video?.pause());
    document.body.classList.remove('works-detail-open');
    this.detailRoot.removeAttribute('data-open');
    this.detailRoot.setAttribute('aria-hidden', 'true');
    if (this.previousFocus instanceof HTMLElement) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
  }

  handleDetailKeyDown(event) {
    if (!this.detailOpen) return;
    if (event.key === 'Escape') {
      this.closeDetail();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goToDetailSlide((this.activeDetailItem?.index ?? 0) + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goToDetailSlide((this.activeDetailItem?.index ?? 0) - 1);
    }
  }

  handleDetailWheel(event) {
    if (!this.detailOpen || !this.detailViewport) return;
    event.preventDefault();
    const now = performance.now();
    if (now < this.detailWheelLockedUntil) return;
    const movement = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;
    this.detailWheelAccumulator += movement;
    if (Math.abs(this.detailWheelAccumulator) < 18) return;

    const direction = Math.sign(this.detailWheelAccumulator);
    this.detailWheelAccumulator = 0;
    this.detailWheelLockedUntil = now + 820;
    this.goToDetailSlide((this.activeDetailItem?.index ?? 0) + direction);
  }

  handleDetailResize() {
    if (!this.detailOpen) return;
    this.setDetailTrackPosition(this.activeDetailPhysicalIndex, false);
  }

  goToDetailSlide(index) {
    if (!this.detailViewport || !this.detailTrack) return;
    const count = this.items.length;
    const logicalIndex = ((index % count) + count) % count;
    let physicalIndex = logicalIndex + 1;
    if (index >= count) physicalIndex = count + 1;
    else if (index < 0) physicalIndex = 0;
    this.syncDetailSlide(logicalIndex, physicalIndex);
    this.setDetailTrackPosition(physicalIndex, true);
  }

  setDetailTrackPosition(physicalIndex, animate) {
    if (!this.detailTrack || !this.detailViewport) return;
    const width = this.detailViewport.clientWidth || window.innerWidth;
    this.detailTrack.toggleAttribute('data-instant', !animate);
    this.detailTrack.style.transform = `translate3d(${-physicalIndex * width}px, 0, 0)`;
    if (!animate) {
      this.detailTrack.getBoundingClientRect();
      requestAnimationFrame(() => this.detailTrack?.removeAttribute('data-instant'));
    }
  }

  handleDetailTransitionEnd(event) {
    if (event.target !== this.detailTrack || event.propertyName !== 'transform') return;
    this.normalizeDetailLoop();
  }

  normalizeDetailLoop() {
    if (!this.detailOpen || !this.detailTrack) return;
    const count = this.items.length;
    const physicalIndex = this.activeDetailPhysicalIndex;
    let normalizedPhysicalIndex = physicalIndex;
    if (physicalIndex === 0) normalizedPhysicalIndex = count;
    else if (physicalIndex === count + 1) normalizedPhysicalIndex = 1;
    if (normalizedPhysicalIndex === physicalIndex) return;
    const logicalIndex = this.detailSlides[normalizedPhysicalIndex]?.index ?? 0;
    this.syncDetailSlide(logicalIndex, normalizedPhysicalIndex);
    this.setDetailTrackPosition(normalizedPhysicalIndex, false);
  }

  handleDetailPointerDown(event) {
    if (!this.detailOpen || !event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest('a, button')) {
      this.detailPointerId = null;
      return;
    }
    this.detailPointerId = event.pointerId;
    this.detailPointerStart.set(event.clientX, event.clientY);
  }

  handleDetailPointerUp(event) {
    if (event.pointerId !== this.detailPointerId) return;
    const distanceX = event.clientX - this.detailPointerStart.x;
    const distanceY = event.clientY - this.detailPointerStart.y;
    this.detailPointerId = null;
    if (Math.abs(distanceX) < 42 || Math.abs(distanceX) < Math.abs(distanceY)) return;
    const direction = distanceX < 0 ? 1 : -1;
    this.goToDetailSlide((this.activeDetailItem?.index ?? 0) + direction);
  }

  syncDetailSlide(index, physicalIndex = index + 1) {
    const slide = this.detailSlides[physicalIndex];
    if (
      !slide
      || this.activeDetailItem?.index === index
        && this.activeDetailPhysicalIndex === physicalIndex
        && this.detailWall?.dataset.label === slide.label
    ) return;
    const previousSlide = this.detailSlides[this.activeDetailPhysicalIndex];
    const labelChanged = this.detailWall?.dataset.label !== slide.label;
    this.activeDetailItem = this.items[index];
    this.activeDetailPhysicalIndex = physicalIndex;
    if (labelChanged) {
      this.detailWall.dataset.label = slide.label;
      this.detailWall.replaceChildren(...createTextWallRows(slide.label));
    }
    if (previousSlide?.index === index && previousSlide.video && slide.video) {
      slide.video.currentTime = previousSlide.video.currentTime;
    }
    this.detailSlides.forEach((candidate, candidateIndex) => {
      candidate.root.toggleAttribute('data-active', candidateIndex === physicalIndex);
      if (!candidate.video) return;
      if (candidateIndex === physicalIndex) candidate.video.play().catch(() => {});
      else candidate.video.pause();
    });
  }

  update(elapsed) {
    // This gallery is the section after About. About has fully exited above
    // the viewport before the first frame begins to appear.
    const reveal = smoothstep(1.04, 1.11, this.progress);
    const travel = THREE.MathUtils.clamp((this.progress - 1.04) / 0.31, 0, 1);
    const innerRadius = this.spiralRadius * 0.62;
    const worksDeparture = Math.max(0, this.progress - 1.27) * 30;

    if (this.titleGroup) {
      const titleTravel = THREE.MathUtils.clamp((this.progress - 0.98) / 0.37, 0, 1);
      this.titleGroup.visible = true;
      this.titleGroup.position.x = 0;
      this.titleGroup.position.y = THREE.MathUtils.lerp(-5.0, 2.5, titleTravel)
        + worksDeparture;
      this.titleGroup.rotation.set(0, 0, 0);
      this.titleGroup.scale.setScalar(1);

      for (const letter of this.titleLetters) {
        letter.mesh.visible = true;
        letter.mesh.position.x = 0;
        letter.mesh.position.y = 2.08 - letter.index * 1.04;
      }
    }

    for (const item of this.items) {
      // Increasing phase moves upward and turns in the direction opposite to
      // the outer particle helix's negative scroll rotation.
      const slot = item.index / Math.max(1, this.items.length - 1);
      // Rotate far enough during each card's visible ascent that every front
      // face passes the camera at least once before leaving the viewport.
      const angle = slot * TAU * 2.15 + travel * TAU * 2.25;
      const radiusBreath = 1 + Math.sin(elapsed * 0.28 + item.index * 1.7) * 0.035;
      const radius = innerRadius * radiusBreath;
      // Begin with the complete ten-frame helix below the viewport, then lift
      // the whole sequence upward as the Works section is entered.
      const y = -9.0 + slot * 5.0 + travel * 9.8 + worksDeparture;
      const edgeFade = smoothstep(-3.9, -2.75, y)
        * (1 - smoothstep(2.8, 4.0, y));
      const opacity = reveal * edgeFade;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.72 + 0.52;
      item.mesh.position.set(x, y, z);
      // Face radially outward from the helix. Unlike a billboard, this lets
      // the dedicated rear face become visible when the card travels behind.
      item.mesh.rotation.set(
        0,
        Math.PI * 0.5 - angle,
        0,
      );
      const depthScale = THREE.MathUtils.mapLinear(
        item.mesh.position.z,
        -innerRadius * 0.72,
        innerRadius * 0.72 + 0.52,
        0.78,
        1.08,
      );
      item.mesh.scale.setScalar(depthScale);
      if (item.cinematic) {
        item.material.uniforms.uTime.value = elapsed;
        item.material.uniforms.uOpacity.value = opacity;
      } else {
        item.material.opacity = opacity;
      }
      item.backMaterial.opacity = opacity;
      item.borderMaterial.opacity = opacity * 0.92;
      item.mesh.visible = opacity > 0.002;
    }
  }

  dispose() {
    this.closeDetail();
    this.domElement?.removeEventListener('click', this.handleCanvasClick);
    this.domElement?.removeEventListener('pointermove', this.handlePointerMove);
    if (this.domElement) this.domElement.style.cursor = '';
    document.removeEventListener('keydown', this.handleDetailKeyDown);
    this.detailClose?.removeEventListener('click', this.closeDetail);
    this.detailViewport?.removeEventListener('wheel', this.handleDetailWheel);
    this.detailViewport?.removeEventListener('pointerdown', this.handleDetailPointerDown);
    this.detailViewport?.removeEventListener('pointerup', this.handleDetailPointerUp);
    this.detailViewport?.removeEventListener('pointercancel', this.handleDetailPointerUp);
    this.detailTrack?.removeEventListener('transitionend', this.handleDetailTransitionEnd);
    window.removeEventListener('resize', this.handleDetailResize);
    this.detailSlides?.forEach((slide) => {
      slide.video?.pause();
      slide.video?.removeAttribute('src');
      slide.video?.load();
    });
    this.detailRoot?.remove();
    this.scene.remove(this.group);
    for (const item of this.items) {
      item.video?.pause();
      if (item.video) {
        item.video.removeAttribute('src');
        item.video.load();
      }
      item.material.dispose();
      item.backMaterial.dispose();
      item.borderMaterial.dispose();
      item.texture.dispose();
      item.backTexture.dispose();
    }
    this.frameGeometry?.dispose();
    this.borderGeometry?.dispose();
    for (const letter of this.titleLetters) {
      letter.material.dispose();
      letter.texture.dispose();
    }
    this.titleLetters.length = 0;
    this.titleGeometry?.dispose();
    this.titleGeometry = null;
    this.titleGroup = null;
    this.frameGeometry = null;
    this.borderGeometry = null;
    this.items.length = 0;
  }
}

function createWorksLetterTexture(letter, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 356px "Syne", sans-serif';
    const colors = ['#ff1684', '#ff70b5', '#ffffff', '#aee4ff', '#69c8ff'];
    const gradient = context.createLinearGradient(84, 70, 428, 442);
    gradient.addColorStop(0, colors[index]);
    gradient.addColorStop(1, '#ffffff');
    context.fillStyle = gradient;
    context.shadowColor = 'rgb(255 0 127 / 0.72)';
    context.shadowBlur = 34;
    context.fillText(letter, canvas.width * 0.5, canvas.height * 0.52);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createVideo(src) {
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.playbackRate = 0.88;
  video.crossOrigin = 'anonymous';
  return video;
}

function createCinematicVideoMaterial(texture, index) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSeed: { value: index * 17.31 + 3.7 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uSeed;
      varying vec2 vUv;

      float filmNoise(vec2 coordinate) {
        return fract(sin(dot(coordinate, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
      }

      void main() {
        vec4 source = texture2D(uMap, vUv);
        vec3 color = source.rgb;
        vec2 centered = vUv - 0.5;
        vec2 chromaticOffset = centered * 0.008;
        color.r = texture2D(uMap, vUv + chromaticOffset).r;
        color.b = texture2D(uMap, vUv - chromaticOffset).b;
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));

        // Restrained cinema contrast and saturation keep highlights dense.
        color = (color - 0.5) * 1.28 + 0.5;
        color = mix(vec3(luminance), color, 0.82);

        // Deep teal shadows and restrained magenta highlights connect the
        // footage to the surrounding bioluminescent palette.
        float shadowWeight = 1.0 - smoothstep(0.12, 0.5, luminance);
        float highlightWeight = smoothstep(0.48, 0.92, luminance);
        color += vec3(-0.05, 0.04, 0.105) * shadowWeight;
        color += vec3(0.115, -0.015, 0.06) * highlightWeight;

        float vignette = 1.0 - smoothstep(0.27, 0.72, dot(centered, centered) * 1.65);
        color *= mix(0.42, 1.0, vignette);

        float grain = filmNoise(
          floor(vUv * vec2(960.0, 540.0)) + floor(uTime * 24.0)
        ) - 0.5;
        color += grain * 0.066;
        color *= 0.98 + sin(uTime * 7.0 + uSeed) * 0.014;

        // Approximately 80px of black above and below a 540px thumbnail.
        float lowerGate = smoothstep(0.141, 0.155, vUv.y);
        float upperGate = 1.0 - smoothstep(0.845, 0.859, vUv.y);
        float filmGate = lowerGate * upperGate;
        color = mix(vec3(0.002, 0.001, 0.004), color, filmGate);
        color = clamp(color, 0.0, 1.0);

        gl_FragColor = vec4(color, source.a * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
}

function createVideoTexture(video) {
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createBackTexture(number, label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#050006';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgb(255 0 127 / 0.92)');
    gradient.addColorStop(0.48, 'rgb(255 0 127 / 0.12)');
    gradient.addColorStop(1, 'rgb(0 165 255 / 0.38)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgb(255 255 255 / 0.42)';
    context.lineWidth = 2;
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    context.font = '700 52px "Syne", sans-serif';
    context.fillText(label, canvas.width * 0.5, canvas.height * 0.47);
    context.fillStyle = '#090006';
    context.font = '700 20px "Syne", sans-serif';
    context.fillText(
      `JUNKBRANDING / ${String(number).padStart(2, '0')}`,
      canvas.width * 0.5,
      canvas.height * 0.7,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSecretTexture(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#05030a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createRadialGradient(480, 270, 20, 480, 270, 520);
    gradient.addColorStop(0, 'rgb(255 0 127 / 0.24)');
    gradient.addColorStop(1, 'rgb(0 140 255 / 0.03)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgb(255 255 255 / 0.08)';
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ff1684';
    context.font = '700 82px "Syne", sans-serif';
    context.fillText('SECRET', canvas.width * 0.5, canvas.height * 0.47);
    context.fillStyle = '#76cfff';
    context.font = '500 24px "Syne", sans-serif';
    context.letterSpacing = '0.28em';
    context.fillText(`PROJECT ${String(number).padStart(2, '0')}`, canvas.width * 0.5, canvas.height * 0.63);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTextWallRows(label) {
  return Array.from({ length: 9 }, (_, index) => {
    const row = document.createElement('p');
    row.style.setProperty('--row-index', index);
    row.textContent = `${label}  ${label}  ${label}  ${label}`;
    return row;
  });
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}
