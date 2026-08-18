precision highp float;

uniform sampler2D uMask;
uniform sampler2D uVelocity;
uniform sampler2D uTitle;
uniform sampler2D uScene;
uniform float uTime;
uniform float uOpacity;
uniform float uAspect;
uniform float uSectionOffset;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  float mask = texture2D(uMask, vUv).r;
  vec2 distortedUv = clamp(vUv + velocity * 0.055, 0.0, 1.0);

  // The unrevealed layer is the exact completed Three.js frame behind this
  // canvas. It fully hides the form without introducing another background.
  vec3 foreground = texture2D(uScene, vUv).rgb;

  vec2 titleUv = distortedUv - vec2(0.0, uSectionOffset);
  float titleInside = step(0.0, titleUv.y) * step(titleUv.y, 1.0);
  vec4 title = texture2D(uTitle, clamp(titleUv, 0.0, 1.0)) * titleInside;
  foreground = mix(foreground, vec3(1.0), title.a);

  float edge = smoothstep(0.12, 0.4, mask) * (1.0 - smoothstep(0.4, 0.76, mask));
  foreground += mix(vec3(0.04, 1.0, 0.55), vec3(1.0, 0.05, 0.5), vUv.y)
    * edge * 0.48;
  float foregroundAlpha = 1.0 - smoothstep(0.12, 0.68, mask);
  gl_FragColor = vec4(foreground, foregroundAlpha * uOpacity);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
