uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;

attribute float aSeed;
attribute float aSize;
attribute float aSpeed;

varying float vAlpha;
varying float vGlint;
varying float vSeed;

const float TAU = 6.283185307179586;

void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.055 + aSeed * TAU) * 0.004;
  p.y += cos(uTime * 0.045 + aSeed * 31.0) * 0.003;

  vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  float pulse = sin(uTime * aSpeed + aSeed * TAU * 9.0) * 0.5 + 0.5;
  float secondaryPulse = sin(uTime * aSpeed * 0.37 + aSeed * TAU * 17.0) * 0.5 + 0.5;
  float glint = smoothstep(0.9, 1.0, pulse * 0.82 + secondaryPulse * 0.18);
  float reveal = smoothstep(1.127, 1.17, uProgress);
  float perspective = 1.0 / max(0.8, -viewPosition.z);

  gl_PointSize = clamp(
    aSize * (1.0 + glint * 2.4) * uPixelRatio * perspective,
    1.4,
    20.0 * uPixelRatio
  );

  vAlpha = reveal;
  vGlint = glint;
  vSeed = aSeed;
}
