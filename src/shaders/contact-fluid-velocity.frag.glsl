precision highp float;

uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform vec2 uPointer;
uniform vec2 uPointerPrevious;
uniform vec2 uPointerDelta;
uniform float uPointerEnergy;
uniform float uDelta;
uniform float uAspect;
uniform float uTime;

varying vec2 vUv;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  vec2 backUv = clamp(vUv - velocity * uDelta * 0.34, uTexel, 1.0 - uTexel);
  velocity = texture2D(uVelocity, backUv).xy * pow(0.992, uDelta * 60.0);
  vec2 velocityLeft = texture2D(uVelocity, backUv - vec2(uTexel.x, 0.0)).xy;
  vec2 velocityRight = texture2D(uVelocity, backUv + vec2(uTexel.x, 0.0)).xy;
  vec2 velocityBottom = texture2D(uVelocity, backUv - vec2(0.0, uTexel.y)).xy;
  vec2 velocityTop = texture2D(uVelocity, backUv + vec2(0.0, uTexel.y)).xy;
  vec2 velocityAverage = (velocityLeft + velocityRight + velocityBottom + velocityTop) * 0.25;
  velocity = mix(velocity, velocityAverage, 0.115);
  float curl = (velocityRight.y - velocityLeft.y)
    - (velocityTop.x - velocityBottom.x);
  velocity += vec2(-velocity.y, velocity.x) * curl * 0.085;

  vec2 aspectScale = vec2(uAspect, 1.0);
  float trailDistance = segmentDistance(
    vUv * aspectScale,
    uPointerPrevious * aspectScale,
    uPointer * aspectScale
  );
  float influence = exp(-trailDistance * trailDistance * 52.0) * uPointerEnergy;
  vec2 swirl = vec2(-uPointerDelta.y, uPointerDelta.x);
  velocity += (uPointerDelta * 1.55 + swirl * 0.72) * influence;

  float ambient = sin((vUv.y + uTime * 0.018) * 19.0)
    * cos((vUv.x - uTime * 0.013) * 15.0);
  velocity += vec2(ambient, -ambient) * 0.000018;

  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
