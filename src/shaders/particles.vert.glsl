uniform float uTime;
uniform float uGoldenPhase;
uniform float uSpiralOffset;
uniform float uSpiralRadius;
uniform float uWorksBandHeight;
uniform float uWorksBandY;
uniform float uProgress;
uniform float uVelocity;
uniform float uPixelRatio;
uniform float uPointSize;
uniform float uFlowerSway;
uniform float uBaseY;
uniform float uAboutScale;
uniform float uAboutY;
uniform float uAboutZ;

attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec3 aDirection;
attribute float aActivation;
attribute float aSeed;
attribute float aSize;
attribute vec3 aAboutTarget;
attribute vec3 aAboutColor;
attribute float aAboutStrength;
attribute float aAboutPointScale;
attribute vec3 aBandTarget;
attribute vec4 aFlowerTransform;

varying vec3 vColor;
varying float vAlpha;
varying float vSparkle;
varying float vSeed;
varying float vGoldenPulse;
varying float vAboutFormation;

const float PI = 3.141592653589793;

vec3 flowField(vec3 p, float time, float seed) {
  float s = seed * PI * 2.0;

  vec3 flow = vec3(
    sin(p.y * 1.75 + time * 0.72 + s) + cos(p.z * 1.25 - time * 0.38),
    cos(p.z * 1.45 + time * 0.51 + s * 0.7) * 0.55 + sin(p.x * 1.15 + time * 0.24) * 0.25,
    sin(p.x * 1.55 - time * 0.44 + s * 1.3) + cos(p.y * 1.05 + time * 0.31)
  );

  return normalize(flow + vec3(0.0001));
}

vec2 photographicWind(float stemT, float time, float progress, float phase) {
  float bend = stemT * stemT * (3.0 - 2.0 * stemT);
  float intact = 1.0 - smoothstep(0.12, 0.45, progress);
  float breeze = sin(time * 0.82 + phase) * 0.115
    + sin(time * 1.47 + 1.2 + phase * 0.71) * 0.042;
  float gust = sin(time * 0.29 + sin(time * 0.17 + phase) * 1.8 + phase) * 0.035;
  float flutter = sin(time * 2.15 + stemT * 4.0 + phase * 1.37) * 0.012 * stemT;
  float wind = breeze + gust;
  return vec2((wind * bend + flutter) * intact, -abs(wind) * bend * 0.035 * intact);
}

void main() {
  float particleProgress = smoothstep(
    aActivation,
    min(aActivation + 0.44, 0.98),
    uProgress
  );

  float settledProgress = smoothstep(0.0, 1.0, particleProgress);
  float velocityBoost = clamp(abs(uVelocity) / 2400.0, 0.0, 1.0);
  float time = uTime * (0.65 + velocityBoost * 0.18);

  vec3 p = position;

  // Reconstruct each flower's local coordinates so tilted and mirrored copies
  // receive the exact same wind transform as their photographic plane.
  float flowerOrigin = aFlowerTransform.x;
  float flowerRotation = aFlowerTransform.y;
  float flowerPhase = aFlowerTransform.z;
  float flowerFlip = aFlowerTransform.w;
  float flowerCos = cos(flowerRotation);
  float flowerSin = sin(flowerRotation);
  vec2 fromFlowerBase = p.xy - vec2(flowerOrigin, uBaseY);
  vec2 scaledLocal = mat2(
    flowerCos,
    -flowerSin,
    flowerSin,
    flowerCos
  ) * fromFlowerBase;
  float localStemT = clamp(
    scaledLocal.y / 3.5,
    0.0,
    1.0
  );
  vec2 localWind = photographicWind(
    localStemT,
    uTime,
    uProgress,
    flowerPhase
  );
  vec2 scaledWind = vec2(
    localWind.x * flowerFlip,
    localWind.y
  );
  p.xy += mat2(
    flowerCos,
    flowerSin,
    -flowerSin,
    flowerCos
  ) * scaledWind;

  // Match the visible flower's root sway exactly before the particles separate.
  float swayAngle = uFlowerSway * (1.0 - settledProgress);
  float swayCos = cos(swayAngle);
  float swaySin = sin(swayAngle);
  vec2 fromBase = p.xy - vec2(0.0, uBaseY);
  fromBase = mat2(swayCos, -swaySin, swaySin, swayCos) * fromBase;
  p.xy = fromBase + vec2(0.0, uBaseY);

  // Directional separation gives the initial break-apart motion.
  float eased = settledProgress * settledProgress * (3.0 - 2.0 * settledProgress);
  float scatterDistance = eased * (1.25 + eased * 3.4) * (1.0 + velocityBoost * 0.42);
  p += normalize(aDirection) * scatterDistance;

  // Cheap continuous 3D flow field. This intentionally avoids CPU particle updates.
  vec3 flow = flowField(position * 0.78 + aNormal * 0.14, time, aSeed);
  p += flow * eased * (0.28 + eased * 1.35);

  // Lift and a slight spiral keep the cloud organic instead of looking like an explosion.
  p.y += eased * (0.28 + aSeed * 0.72);
  p.x += sin(aSeed * PI * 8.0 + eased * PI * 2.2) * eased * 0.16;
  p.z += cos(aSeed * PI * 7.0 + eased * PI * 2.0) * eased * 0.2;

  vec3 baseWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
  float spiralProgress = smoothstep(0.56, 0.72, uProgress);
  float spiralBaseT = fract(aSeed + uSpiralOffset);
  float spiralScroll = max(0.0, uProgress - 0.72) * 0.3;
  float spiralT = fract(spiralBaseT - spiralScroll);
  float spiralNoiseA = fract(sin(aSeed * 127.13 + uSpiralOffset * 71.7) * 43758.54);
  float spiralNoiseB = fract(sin(aSeed * 311.91 + uSpiralOffset * 43.2) * 24634.63);
  float spiralAngle = spiralT * PI * 12.0
    + (spiralNoiseA - 0.5) * 0.34;
  float spiralRadius = uSpiralRadius
    + (spiralNoiseB - 0.5) * uSpiralRadius * 0.34;
  vec3 spiralPosition = vec3(
    cos(spiralAngle) * spiralRadius,
    2.75 - spiralT * 7.5 + (spiralNoiseA - 0.5) * 0.26,
    sin(spiralAngle) * spiralRadius
  );
  spiralPosition += vec3(
    sin(aSeed * 53.0 + uProgress * PI) * 0.055,
    cos(aSeed * 41.0) * 0.045,
    cos(aSeed * 67.0 - uProgress * PI) * 0.055
  );
  vec3 looseScatter = vec3(
    fract(sin(aSeed * 173.31 + 2.7) * 43758.54),
    fract(sin(aSeed * 239.17 + 8.4) * 24634.63),
    fract(sin(aSeed * 307.73 + 5.1) * 19341.37)
  ) - 0.5;
  spiralPosition += looseScatter * 0.24;
  vec3 helixWorldPosition = mix(baseWorldPosition, spiralPosition, spiralProgress);
  float aboutStart = 0.72 + aSeed * 0.045;
  float aboutFormation = aAboutStrength
    * smoothstep(aboutStart, aboutStart + 0.105, uProgress);
  vec3 aboutWorldPosition = vec3(
    aAboutTarget.x * uAboutScale,
    aAboutTarget.y * uAboutScale + uAboutY,
    aAboutTarget.z + uAboutZ
  );
  vec3 finalWorldPosition = mix(
    helixWorldPosition,
    aboutWorldPosition,
    aboutFormation
  );

  // As the opening WORKS letters enter, release the outer helix into a
  // full-width horizontal cloud. Keep the particles assigned to ABOUT on
  // their own route so they do not jump back into the background.
  float worksBandProgress = smoothstep(1.075, 1.155, uProgress)
    * (1.0 - aAboutStrength);
  vec3 worksBandPosition = vec3(
    aBandTarget.x * uSpiralRadius * 1.04,
    uWorksBandY + aBandTarget.y * uWorksBandHeight * 0.5,
    aBandTarget.z * 0.725
  );
  worksBandPosition.x += sin(uTime * 0.16 + aSeed * PI * 2.0) * 0.18;
  worksBandPosition.y += sin(uTime * 0.22 + aSeed * 37.0) * 0.035;
  finalWorldPosition = mix(finalWorldPosition, worksBandPosition, worksBandProgress);
  vec4 viewPosition = viewMatrix * vec4(finalWorldPosition, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  float twinkle = sin(uTime * (2.4 + aSeed * 4.8) + aSeed * PI * 37.0) * 0.5 + 0.5;
  float fastTwinkle = sin(uTime * (5.2 + aSeed * 3.1) + aSeed * PI * 71.0) * 0.5 + 0.5;
  float pulse = smoothstep(0.6, 1.0, max(twinkle, fastTwinkle * 0.88));
  float sparkleChance = step(0.43, fract(aSeed * 19.731));
  float sparkle = pulse * sparkleChance * smoothstep(0.06, 0.42, uProgress);

  vec3 worldPosition = finalWorldPosition;
  float diagonalPosition = clamp((worldPosition.x + worldPosition.y + 5.0) / 10.0, 0.0, 1.0);
  float goldenEnabled = step(0.0, uGoldenPhase) * (1.0 - step(1.0, uGoldenPhase));
  float goldenWavePosition = uGoldenPhase * 1.3 - 0.15;
  float crossPosition = (worldPosition.x - worldPosition.y) / 6.0;
  float goldenCurl = sin(crossPosition * 12.0 + uGoldenPhase * PI * 2.8) * 0.052;
  goldenCurl += sin(worldPosition.y * 2.6 - uGoldenPhase * PI * 2.0) * 0.024;
  float goldenDistance = abs(diagonalPosition - goldenWavePosition - goldenCurl);
  float goldenBand = 1.0 - smoothstep(0.012, 0.068, goldenDistance);
  float goldenPulse = goldenBand * goldenEnabled * smoothstep(0.52, 0.68, uProgress);

  float perspective = 1.0 / max(0.8, -viewPosition.z);
  float greenParticle = step(aColor.r * 1.16, aColor.g)
    * step(aColor.b * 1.04, aColor.g)
    * (1.0 - aboutFormation);
  float resolvedPointSize = mix(uPointSize, 50.0, greenParticle);
  float resolvedMaxSize = mix(15.0, 25.0, greenParticle);
  gl_PointSize = clamp(
    resolvedPointSize
      * aSize
      * mix(1.0, aAboutPointScale, aboutFormation)
      * (1.0 + sparkle * 1.15 * (1.0 - aboutFormation) + goldenPulse * 1.7)
      * uPixelRatio
      * perspective,
    1.0,
    resolvedMaxSize * uPixelRatio
  );

  float appear = smoothstep(aActivation - 0.13, aActivation + 0.025, uProgress);
  float endFade = 1.0 - smoothstep(0.92, 1.0, uProgress) * (0.2 + aSeed * 0.35);
  float aboutSolidReveal = smoothstep(0.865, 0.93, uProgress);
  float worksParticleFade = 1.0 - smoothstep(1.085, 1.127, uProgress);

  vColor = mix(aColor, aAboutColor, aboutFormation);
  vAlpha = appear
    * mix(endFade, 1.0, aboutFormation)
    * (1.0 - aboutFormation * aboutSolidReveal)
    * worksParticleFade;

  // Sparse, asynchronous glints become more visible as the flower disperses.
  vSparkle = sparkle;
  vSeed = aSeed;

  vGoldenPulse = goldenPulse;
  vAboutFormation = aboutFormation;
}
