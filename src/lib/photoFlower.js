import * as THREE from 'three';

const DEFAULT_VARIANTS = [
  {
    x: -2.32,
    scale: 1,
    z: -0.06,
    rotation: -0.12,
    flipX: -1,
    windPhase: 1.85,
    tint: 0x238dff,
    tintStrength: 0.72,
  },
  {
    x: 0,
    scale: 1,
    z: 0,
    rotation: 0.025,
    flipX: 1,
    windPhase: 0,
    tint: 0xff3f9f,
    tintStrength: 0.58,
  },
  {
    x: 2.32,
    scale: 1,
    z: -0.06,
    rotation: 0.145,
    flipX: 1,
    windPhase: 3.7,
    tint: 0x29f59f,
    tintStrength: 0.7,
  },
];

export async function createPhotoFlower(
  textureUrl,
  particleCount,
  { height = 3.5, baseY = -1.62, variants = DEFAULT_VARIANTS } = {},
) {
  const texture = await new THREE.TextureLoader().loadAsync(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const image = texture.image;
  const aspect = image.width / image.height;
  const width = height * aspect;
  const centerY = baseY + height * 0.5;

  const root = new THREE.Group();
  root.name = 'photographic-flower-group';
  const windUniforms = [];

  variants.forEach((variant, index) => {
    const uniforms = {
      uMap: { value: texture },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 1 },
      uBaseY: { value: baseY },
      uHeight: { value: height },
      uWindPhase: { value: variant.windPhase },
      uTint: { value: new THREE.Color(variant.tint) },
      uTintStrength: { value: variant.tintStrength },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
      uniform float uTime;
      uniform float uProgress;
      uniform float uBaseY;
      uniform float uHeight;
      uniform float uWindPhase;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 p = position;
        float worldY = p.y + ${centerY.toFixed(6)};
        float stemT = clamp((worldY - uBaseY) / uHeight, 0.0, 1.0);
        float bend = stemT * stemT * (3.0 - 2.0 * stemT);
        float intact = 1.0 - smoothstep(0.12, 0.45, uProgress);
        float breeze = sin(uTime * 0.82 + uWindPhase) * 0.115
          + sin(uTime * 1.47 + 1.2 + uWindPhase * 0.71) * 0.042;
        float gust = sin(uTime * 0.29 + sin(uTime * 0.17 + uWindPhase) * 1.8 + uWindPhase) * 0.035;
        float flutter = sin(uTime * 2.15 + stemT * 4.0 + uWindPhase * 1.37) * 0.012 * stemT;
        p.x += (breeze + gust) * bend * intact + flutter * intact;
        p.y -= abs(breeze + gust) * bend * 0.035 * intact;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
      fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uTint;
      uniform float uTintStrength;
      varying vec2 vUv;

      void main() {
        vec4 photo = texture2D(uMap, vUv);
        if (photo.a < 0.02) discard;
        float luminance = dot(photo.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 colorized = luminance * uTint;
        float yellowMask = smoothstep(
          0.08,
          0.3,
          min(photo.r, photo.g) - photo.b
        ) * smoothstep(0.12, 0.58, photo.r);
        float petalRegion = smoothstep(0.54, 0.63, vUv.y);
        float petalTint = uTintStrength * petalRegion * (1.0 - yellowMask);
        vec3 finalColor = mix(photo.rgb, colorized, petalTint);
        gl_FragColor = vec4(finalColor, photo.a * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    material.userData.baseOpacity = 1;

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height, 32, 64),
      material,
    );
    const halfScaledHeight = height * variant.scale * 0.5;
    mesh.scale.set(
      variant.scale * variant.flipX,
      variant.scale,
      variant.scale,
    );
    mesh.position.set(
      variant.x - Math.sin(variant.rotation) * halfScaledHeight,
      baseY + Math.cos(variant.rotation) * halfScaledHeight,
      variant.z,
    );
    mesh.rotation.z = variant.rotation;
    mesh.name = `photographic-flower-${index}`;
    mesh.userData.windUniforms = uniforms;
    root.add(mesh);
    windUniforms.push(uniforms);
  });
  root.userData.windUniforms = windUniforms;

  return {
    root,
    geometry: buildPhotoParticleGeometry(image, particleCount, {
      width,
      height,
      baseY,
      variants,
    }),
    source: 'photographic texture',
  };
}

function buildPhotoParticleGeometry(image, particleCount, {
  width,
  height,
  baseY,
  variants,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) throw new Error('Could not read the photographic flower texture.');

  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const opaquePixels = [];

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 42) opaquePixels.push(y * canvas.width + x);
    }
  }

  if (!opaquePixels.length) throw new Error('The photographic flower texture has no visible pixels.');

  const positions = new Float32Array(particleCount * 3);
  const normals = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const directions = new Float32Array(particleCount * 3);
  const activations = new Float32Array(particleCount);
  const seeds = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const bandTargets = new Float32Array(particleCount * 3);
  const flowerTransforms = new Float32Array(particleCount * 4);

  for (let i = 0; i < particleCount; i += 1) {
    const pixelIndex = opaquePixels[Math.floor(Math.random() * opaquePixels.length)];
    const pixelX = pixelIndex % canvas.width;
    const pixelY = Math.floor(pixelIndex / canvas.width);
    const rgba = pixelIndex * 4;
    const offset = i * 3;
    const seed = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const variant = variants[i % variants.length];
    const tint = new THREE.Color(variant.tint);
    const red = srgbToLinear(pixels[rgba] / 255);
    const green = srgbToLinear(pixels[rgba + 1] / 255);
    const blue = srgbToLinear(pixels[rgba + 2] / 255);
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const imageV = 1 - pixelY / (canvas.height - 1);
    const yellowMask = smoothstep(0.08, 0.3, Math.min(red, green) - blue)
      * smoothstep(0.12, 0.58, red);
    const petalRegion = smoothstep(0.54, 0.63, imageV);
    const petalTint = variant.tintStrength * petalRegion * (1 - yellowMask);

    const localX = (pixelX / (canvas.width - 1) - 0.5)
      * width
      * variant.scale
      * variant.flipX;
    const localY = (1 - pixelY / (canvas.height - 1)) * height * variant.scale;
    const rotationCos = Math.cos(variant.rotation);
    const rotationSin = Math.sin(variant.rotation);
    positions[offset] = variant.x + localX * rotationCos - localY * rotationSin;
    positions[offset + 1] = baseY + localX * rotationSin + localY * rotationCos;
    positions[offset + 2] = variant.z + (Math.random() - 0.5) * 0.018;
    normals[offset] = 0;
    normals[offset + 1] = 0;
    normals[offset + 2] = 1;
    colors[offset] = THREE.MathUtils.lerp(red, luminance * tint.r, petalTint);
    colors[offset + 1] = THREE.MathUtils.lerp(green, luminance * tint.g, petalTint);
    colors[offset + 2] = THREE.MathUtils.lerp(blue, luminance * tint.b, petalTint);
    directions[offset] = Math.cos(angle) * (0.6 + Math.random() * 0.8);
    directions[offset + 1] = 0.2 + Math.random();
    directions[offset + 2] = Math.sin(angle) * (0.6 + Math.random() * 0.8);
    activations[i] = THREE.MathUtils.clamp(0.12 + (pixelY / canvas.height) * 0.19 + seed * 0.08, 0.08, 0.44);
    seeds[i] = seed;
    sizes[i] = 0.72 + Math.random() * 0.9;
    bandTargets[offset] = Math.random() * 2 - 1;
    bandTargets[offset + 1] = (Math.random() * 2 - 1)
      + (Math.random() * 2 - 1) * 0.34;
    bandTargets[offset + 2] = Math.random() * 2 - 1;
    const flowerOffset = i * 4;
    flowerTransforms[flowerOffset] = variant.x;
    flowerTransforms[flowerOffset + 1] = variant.rotation;
    flowerTransforms[flowerOffset + 2] = variant.windPhase;
    flowerTransforms[flowerOffset + 3] = variant.flipX;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('aActivation', new THREE.BufferAttribute(activations, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aBandTarget', new THREE.BufferAttribute(bandTargets, 3));
  geometry.setAttribute('aFlowerTransform', new THREE.BufferAttribute(flowerTransforms, 4));
  geometry.computeBoundingSphere();
  return geometry;
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}
