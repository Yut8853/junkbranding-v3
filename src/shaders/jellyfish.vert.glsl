uniform float uTime;
uniform float uGoldenPhase;
uniform float uSpiralOffset;
uniform float uSpiralRadius;
uniform float uWorksBandHeight;
uniform float uWorksBandY;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uPointScale;
uniform float uPulsePhase;
uniform float uContraction;
uniform float uContractionVelocity;
uniform float uTentacleStiffness;
uniform float uTentacleDamping;
uniform float uTentacleSwayStrength;
uniform float uCurrentStrength;
uniform float uPhaseVariation;
uniform float uBellDepth;
uniform vec3 uBodyVelocityLocal;
uniform vec3 uBodyAccelerationLocal;

attribute float aU;
attribute float aV;
attribute float aKind;
attribute float aStrand;
attribute float aSeed;
attribute float aSize;
attribute vec3 aBandTarget;

varying float vGlow;
varying float vSeed;
varying float vRelease;
varying float vVertical;
varying float vGoldenPulse;

const float TAU = 6.283185307179586;

vec3 limitedVector(vec3 value, float limit) {
  float magnitude = length(value);
  return magnitude > limit ? value * (limit / magnitude) : value;
}

float strandNoise(float strand, float salt) {
  return fract(sin((strand + salt) * 127.13) * 43758.5453);
}

float bellContraction(float radius01, float theta) {
  float radialDelay = radius01 * uPhaseVariation;
  float angularDelay = sin(theta * 2.0) * uPhaseVariation * 0.07;
  float start = max(0.0, radialDelay + angularDelay);
  return smoothstep(start, min(1.0, start + 0.74), uContraction);
}

void main() {
  vec3 p = vec3(0.0);

  if (aKind < 0.5) {
    float theta = aU * TAU;
    float radius01 = pow(aV, 0.72);
    float contraction = bellContraction(radius01, theta);
    float width = radius01 * 0.88 * (1.0 - contraction * 0.18);
    float dome = sqrt(max(0.0, 1.0 - radius01 * radius01));
    float verticalLift = dome * (0.34 + contraction * 0.14);
    float rimCurl = contraction * radius01 * radius01 * 0.12;

    // A coherent membrane wave: adjacent particles share spatial phase.
    float membraneWave = sin(theta * 5.0 - uTime * 0.21 + radius01 * 2.4);
    float secondaryWave = sin(theta * 2.0 + uTime * 0.13 - radius01 * 4.1);
    float rimEnvelope = radius01 * radius01 * (1.0 - smoothstep(0.44, 0.9, uPulsePhase));
    float ripple = (membraneWave * 0.009 + secondaryWave * 0.004) * rimEnvelope;

    p = vec3(
      cos(theta) * (width + ripple),
      0.58 + verticalLift - radius01 * 0.12 - rimCurl,
      sin(theta) * (width + ripple) * uBellDepth
    );
  } else {
    float theta = aStrand * TAU;
    float lengthT = aV;
    vec3 radial = vec3(cos(theta), 0.0, sin(theta));
    vec3 side = vec3(-sin(theta), 0.0, cos(theta));

    // The root is evaluated from the same deformed bell rim field.
    float rootContraction = bellContraction(1.0, theta);
    float rootWidth = 0.88 * (1.0 - rootContraction * 0.18);
    vec3 root = vec3(
      radial.x * rootWidth,
      0.58 - 0.12 - rootContraction * 0.12,
      radial.z * rootWidth * uBellDepth
    );

    float strandLength = 2.58 + sin(theta * 3.0 + 0.8) * 0.22;
    p = root + vec3(0.0, -lengthT * strandLength, 0.0);

    float lagWeight = pow(lengthT, 1.85) * (1.0 - uTentacleStiffness);
    vec3 velocityLag = limitedVector(-uBodyVelocityLocal * lagWeight * 0.13, 0.06);
    vec3 accelerationLag = limitedVector(-uBodyAccelerationLocal * lagWeight * 0.052, 0.028);

    // Each strand owns a continuous travelling wave. All particles belonging
    // to one strand use the same parameters, so its silhouette bends as one
    // soft filament instead of jittering as unrelated points.
    float strandPhase = strandNoise(aStrand, 0.17) * TAU;
    float strandSpeed = mix(0.42, 0.76, strandNoise(aStrand, 1.91));
    float strandWaveLength = mix(5.1, 6.8, strandNoise(aStrand, 4.37));
    float strandAmplitude = mix(0.78, 1.22, strandNoise(aStrand, 7.73));

    // Keep the root locked to the bell. The curve becomes increasingly loose
    // towards the tip, as a real jellyfish tentacle does in water.
    float rootLock = smoothstep(0.035, 0.24, lengthT);
    float waveEnvelope = rootLock * pow(lengthT, 1.16);
    float damping = mix(1.0, 0.68, uTentacleDamping);
    float swayScale = (0.72 + uTentacleSwayStrength * 4.0) * strandAmplitude;
    float travellingPhase = lengthT * strandWaveLength
      - uTime * strandSpeed
      + strandPhase;
    float primaryWave = sin(travellingPhase);
    float fineWave = sin(
      lengthT * (strandWaveLength * 1.72)
        - uTime * (strandSpeed * 0.63)
        + strandPhase * 1.37
    );
    float depthWave = sin(
      lengthT * (strandWaveLength * 0.72)
        - uTime * (strandSpeed * 0.84)
        - strandPhase * 0.81
    );

    vec3 strandWave = side
      * (primaryWave + fineWave * 0.34 * damping)
      * waveEnvelope
      * swayScale
      * 0.205;
    strandWave += radial
      * depthWave
      * waveEnvelope
      * swayScale
      * 0.105;

    // A very slow current offsets every strand differently without changing
    // the travelling-wave continuity along it.
    float currentEnvelope = rootLock * pow(lengthT, 1.42);
    float currentWave = sin(
      lengthT * 2.25
        + uTime * 0.19
        + strandPhase * 0.54
    );
    vec3 currentBend = (side * 0.72 + radial * 0.28)
      * currentWave
      * currentEnvelope
      * uCurrentStrength
      * 1.15;

    float pulseStrength = clamp(max(uContractionVelocity, 0.0) * 0.045, 0.0, 1.0);
    float pulseWave = sin(lengthT * 2.8 - uPulsePhase * TAU + theta);
    vec3 pulseBend = side
      * pulseWave
      * pow(lengthT, 1.9)
      * pulseStrength
      * 0.018;

    p += velocityLag + accelerationLag + currentBend + strandWave + pulseBend;
  }

  // Preserve the original body region so dispersed particles retain the gradient.
  vVertical = smoothstep(-1.65, 0.42, p.y);
  p *= 0.42;

  // Dissolve alongside the photographic flower, with a small per-particle delay.
  float releaseStart = 0.1 + aSeed * 0.18;
  float release = smoothstep(releaseStart, releaseStart + 0.38, uProgress);
  vec3 releaseDirection = normalize(vec3(
    sin(aSeed * 37.0 + aU * 9.0),
    0.24 + aSeed * 0.82,
    cos(aSeed * 29.0 + aStrand * 13.0)
  ));
  float releaseDistance = release * release * (0.75 + aSeed * 2.15);
  p += releaseDirection * releaseDistance;
  p.x += sin(aSeed * 53.0 + uTime * 0.7) * release * 0.16;
  p.z += cos(aSeed * 41.0 - uTime * 0.55) * release * 0.18;

  vec3 baseWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
  float spiralProgress = smoothstep(0.56, 0.72, uProgress);
  float spiralBaseT = fract(aSeed + uSpiralOffset);
  float spiralScroll = max(0.0, uProgress - 0.72) * 0.3;
  float spiralT = fract(spiralBaseT - spiralScroll);
  float spiralNoiseA = fract(sin(aSeed * 127.13 + uSpiralOffset * 71.7) * 43758.54);
  float spiralNoiseB = fract(sin(aSeed * 311.91 + uSpiralOffset * 43.2) * 24634.63);
  float spiralAngle = spiralT * TAU * 6.0
    + (spiralNoiseA - 0.5) * 0.34;
  float spiralRadius = uSpiralRadius
    + (spiralNoiseB - 0.5) * uSpiralRadius * 0.34;
  vec3 spiralPosition = vec3(
    cos(spiralAngle) * spiralRadius,
    2.75 - spiralT * 7.5 + (spiralNoiseA - 0.5) * 0.26,
    sin(spiralAngle) * spiralRadius
  );
  spiralPosition += vec3(
    sin(aSeed * 53.0 + uProgress * 3.14159) * 0.055,
    cos(aSeed * 41.0) * 0.045,
    cos(aSeed * 67.0 - uProgress * 3.14159) * 0.055
  );
  vec3 looseScatter = vec3(
    fract(sin(aSeed * 173.31 + 2.7) * 43758.54),
    fract(sin(aSeed * 239.17 + 8.4) * 24634.63),
    fract(sin(aSeed * 307.73 + 5.1) * 19341.37)
  ) - 0.5;
  spiralPosition += looseScatter * 0.24;
  vec3 finalWorldPosition = mix(baseWorldPosition, spiralPosition, spiralProgress);

  float worksBandProgress = smoothstep(1.075, 1.155, uProgress);
  vec3 worksBandPosition = vec3(
    aBandTarget.x * uSpiralRadius * 1.04,
    uWorksBandY + aBandTarget.y * uWorksBandHeight * 0.5,
    aBandTarget.z * 0.725
  );
  worksBandPosition.x += sin(uTime * 0.16 + aSeed * TAU) * 0.18;
  worksBandPosition.y += sin(uTime * 0.22 + aSeed * 37.0) * 0.035;
  finalWorldPosition = mix(finalWorldPosition, worksBandPosition, worksBandProgress);
  vec4 viewPosition = viewMatrix * vec4(finalWorldPosition, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  vec3 worldPosition = finalWorldPosition;
  float diagonalPosition = clamp((worldPosition.x + worldPosition.y + 5.0) / 10.0, 0.0, 1.0);
  float goldenEnabled = step(0.0, uGoldenPhase) * (1.0 - step(1.0, uGoldenPhase));
  float goldenWavePosition = uGoldenPhase * 1.3 - 0.15;
  float crossPosition = (worldPosition.x - worldPosition.y) / 6.0;
  float goldenCurl = sin(crossPosition * 12.0 + uGoldenPhase * TAU * 1.4) * 0.052;
  goldenCurl += sin(worldPosition.y * 2.6 - uGoldenPhase * TAU) * 0.024;
  float goldenDistance = abs(diagonalPosition - goldenWavePosition - goldenCurl);
  float goldenBand = 1.0 - smoothstep(0.012, 0.068, goldenDistance);
  vGoldenPulse = goldenBand * goldenEnabled * smoothstep(0.65, 1.0, release);

  float shimmer = sin(uTime * (2.0 + aSeed * 3.2) + aSeed * 79.0 + aV * 11.0) * 0.5 + 0.5;
  float contractionGlint = clamp(max(0.0, uContractionVelocity) * 0.08, 0.0, 0.22);
  float flash = smoothstep(0.68 - contractionGlint - release * 0.22, 1.0, shimmer);
  float perspective = 1.0 / max(0.8, -viewPosition.z);
  gl_PointSize = clamp(
    (2.0 + flash * (7.0 + release * 10.0))
      * (1.0 + vGoldenPulse * 1.9)
      * aSize * uPixelRatio * uPointScale * perspective,
    1.0,
    12.0 * uPixelRatio
  );
  vGlow = 0.24 + flash * (0.76 + release * 1.35) + release * 0.28;
  vSeed = aSeed;
  vRelease = release;
}
