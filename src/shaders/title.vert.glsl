uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uPointSize;
uniform float uSpiralRadius;
uniform float uWorksBandHeight;
uniform float uWorksBandY;

attribute float aSeed;
attribute float aSize;
attribute vec3 aBandTarget;

varying float vGlow;
varying float vRelease;
varying float vSeed;
varying float vWorksFade;
varying float vParticleReveal;

const float TAU = 6.283185307179586;

void main() {
  vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  float releaseStart = 0.1 + aSeed * 0.16;
  float release = smoothstep(releaseStart, releaseStart + 0.34, uProgress);
  vec3 releaseDirection = normalize(vec3(
    sin(aSeed * 47.3 + position.x * 13.0),
    0.18 + aSeed * 0.74,
    cos(aSeed * 31.7 + position.y * 19.0)
  ));
  float releaseDistance = release * release * (0.55 + aSeed * 2.2);
  worldPosition += releaseDirection * releaseDistance;
  worldPosition.x += sin(aSeed * 61.0 + uTime * 0.54) * release * 0.17;
  worldPosition.z += cos(aSeed * 43.0 - uTime * 0.46) * release * 0.22;

  float spiralProgress = smoothstep(0.56, 0.72, uProgress);
  float spiralBaseT = fract(aSeed + 0.83);
  float spiralScroll = max(0.0, uProgress - 0.72) * 0.3;
  float spiralT = fract(spiralBaseT - spiralScroll);
  float noiseA = fract(sin(aSeed * 127.13 + 19.7) * 43758.54);
  float noiseB = fract(sin(aSeed * 311.91 + 41.2) * 24634.63);
  float spiralAngle = spiralT * TAU * 6.0 + (noiseA - 0.5) * 0.34;
  float spiralRadius = uSpiralRadius
    + (noiseB - 0.5) * uSpiralRadius * 0.34;
  vec3 spiralPosition = vec3(
    cos(spiralAngle) * spiralRadius,
    2.75 - spiralT * 7.5 + (noiseA - 0.5) * 0.26,
    sin(spiralAngle) * spiralRadius
  );
  vec3 looseScatter = vec3(
    fract(sin(aSeed * 173.31 + 2.7) * 43758.54),
    fract(sin(aSeed * 239.17 + 8.4) * 24634.63),
    fract(sin(aSeed * 307.73 + 5.1) * 19341.37)
  ) - 0.5;
  spiralPosition += looseScatter * 0.24;
  worldPosition = mix(worldPosition, spiralPosition, spiralProgress);

  float worksBandProgress = smoothstep(1.075, 1.155, uProgress);
  vec3 worksBandPosition = vec3(
    aBandTarget.x * uSpiralRadius * 1.04,
    uWorksBandY + aBandTarget.y * uWorksBandHeight * 0.5,
    aBandTarget.z * 0.725
  );
  worksBandPosition.x += sin(uTime * 0.16 + aSeed * TAU) * 0.18;
  worksBandPosition.y += sin(uTime * 0.22 + aSeed * 37.0) * 0.035;
  worldPosition = mix(worldPosition, worksBandPosition, worksBandProgress);

  vec4 viewPosition = viewMatrix * vec4(worldPosition, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  float shimmer = sin(uTime * (1.4 + aSeed * 2.3) + aSeed * 83.0) * 0.5 + 0.5;
  float sparkle = smoothstep(0.78 - release * 0.18, 1.0, shimmer);
  float perspective = 1.0 / max(0.8, -viewPosition.z);
  gl_PointSize = clamp(
    uPointSize
      * aSize
      * uPixelRatio
      * perspective
      * (1.0 + sparkle * (1.7 + release * 1.3)),
    1.0,
    11.0 * uPixelRatio
  );

  vGlow = 0.48 + sparkle * (0.82 + release * 0.56);
  vRelease = release;
  vSeed = aSeed;
  vWorksFade = 1.0 - smoothstep(1.085, 1.127, uProgress);
  vParticleReveal = smoothstep(0.035, 0.205, uProgress);
}
