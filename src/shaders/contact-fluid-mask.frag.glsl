precision highp float;

uniform sampler2D uMask;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform vec2 uPointer;
uniform vec2 uPointerPrevious;
uniform float uPointerEnergy;
uniform float uDelta;
uniform float uAspect;

varying vec2 vUv;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  vec2 backUv = clamp(vUv - velocity * uDelta * 0.5, uTexel, 1.0 - uTexel);
  float retained = texture2D(uMask, vUv).r;
  float center = texture2D(uMask, backUv).r;
  float neighbors = (
    texture2D(uMask, backUv + vec2(uTexel.x, 0.0)).r
    + texture2D(uMask, backUv - vec2(uTexel.x, 0.0)).r
    + texture2D(uMask, backUv + vec2(0.0, uTexel.y)).r
    + texture2D(uMask, backUv - vec2(0.0, uTexel.y)).r
  ) * 0.25;
  // Preserve every revealed area. The advected sample keeps the fluid motion,
  // while the original sample prevents the mask from healing over time.
  float mask = max(retained, mix(center, neighbors, 0.15));

  vec2 aspectScale = vec2(uAspect, 1.0);
  float trailDistance = segmentDistance(
    vUv * aspectScale,
    uPointerPrevious * aspectScale,
    uPointer * aspectScale
  );
  float splat = exp(-trailDistance * trailDistance * 38.0) * uPointerEnergy;
  mask = max(mask, splat);

  gl_FragColor = vec4(mask, mask, mask, 1.0);
}
