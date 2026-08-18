precision mediump float;

uniform float uTime;
uniform float uProgress;
uniform float uLoadingReveal;
uniform float uAspect;
uniform sampler2D uDistantTexture;
uniform vec2 uDistantTexel;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.54;
  mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);

  for (int i = 0; i < 4; i += 1) {
    value += valueNoise(p) * amplitude;
    p = turn * p * 1.92 + 5.17;
    amplitude *= 0.49;
  }

  return value;
}

float planktonLayer(vec2 uv, float scale, float threshold, float timeOffset) {
  vec2 grid = uv * scale + vec2(timeOffset * 0.07, -timeOffset * 0.11);
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float seed = hash21(cell + scale);
  vec2 offset = vec2(
    hash21(cell + 9.31),
    hash21(cell + 21.73)
  ) - 0.5;
  float distanceToParticle = length(local - offset * 0.68);
  float particle = 1.0 - smoothstep(0.018, 0.095, distanceToParticle);
  float alive = smoothstep(threshold, 1.0, seed);
  float twinkle = 0.5 + 0.5 * sin(
    uTime * (0.42 + seed * 0.46) + seed * 31.0
  );
  return particle * alive * max(0.08, twinkle);
}

vec3 blurredDistantCreatures(vec2 uv) {
  vec2 radius = uDistantTexel * 2.6;
  vec3 color = texture2D(uDistantTexture, uv).rgb * 0.2;
  color += texture2D(uDistantTexture, uv + vec2(radius.x, 0.0)).rgb * 0.12;
  color += texture2D(uDistantTexture, uv - vec2(radius.x, 0.0)).rgb * 0.12;
  color += texture2D(uDistantTexture, uv + vec2(0.0, radius.y)).rgb * 0.12;
  color += texture2D(uDistantTexture, uv - vec2(0.0, radius.y)).rgb * 0.12;
  color += texture2D(uDistantTexture, uv + radius).rgb * 0.08;
  color += texture2D(uDistantTexture, uv - radius).rgb * 0.08;
  color += texture2D(uDistantTexture, uv + vec2(radius.x, -radius.y)).rgb * 0.08;
  color += texture2D(uDistantTexture, uv + vec2(-radius.x, radius.y)).rgb * 0.08;
  return color;
}

float lightShaft(
  vec2 uv,
  float origin,
  float lean,
  float width,
  float phase
) {
  float depth = 1.0 - uv.y;
  float center = origin
    + lean * depth
    + sin(uTime * 0.075 + phase + depth * 2.4) * 0.028;
  float spread = width + depth * 0.055;
  float beam = 1.0 - smoothstep(spread * 0.18, spread, abs(uv.x - center));
  float waterFade = mix(0.18, 1.0, pow(uv.y, 0.72));
  float shimmer = 0.74
    + sin(uTime * 0.16 + phase * 3.7 + depth * 8.0) * 0.11;
  return beam * waterFade * shimmer;
}

void main() {
  vec2 screen = vUv;
  vec2 p = screen - 0.5;
  p.x *= clamp(uAspect, 0.72, 2.1);

  float time = uTime * 0.11;
  float breath = 0.94 + sin(uTime * 0.22) * 0.06;
  // Once the helix finishes, return the water volume to its KV composition
  // while allowing its time-based motion to continue uninterrupted.
  float returnToKv = smoothstep(1.127, 1.19, uProgress);
  float visualProgress = mix(uProgress, 0.0, returnToKv);
  float scrollArc = (visualProgress - 0.5) * 0.34;
  mat2 scrollRotation = mat2(
    cos(scrollArc), -sin(scrollArc),
    sin(scrollArc), cos(scrollArc)
  );
  vec2 organicP = scrollRotation * p;
  organicP += vec2(
    sin(uTime * 0.13) * 0.075,
    cos(uTime * 0.11 + 1.7) * 0.06
  );

  vec2 warp = vec2(
    fbm(organicP * 0.92 + vec2(time * 0.25, -time * 0.16)),
    fbm(organicP * 0.84 + vec2(4.7 - time * 0.18, 8.2 + time * 0.12))
  ) - 0.5;

  float pinkField = fbm(
    organicP * 1.62
      + warp * 1.85
      + vec2(-0.38 + visualProgress * 0.12, 0.08 + time * 0.2)
  );
  float greenField = fbm(
    organicP * 1.48
      - warp.yx * 1.72
      + vec2(3.9 - visualProgress * 0.15, -2.1 - time * 0.17)
  );

  float upperBias = smoothstep(0.18, 0.88, screen.y);
  float lowerBias = 1.0 - smoothstep(0.12, 0.82, screen.y);
  float pinkFog = smoothstep(0.42, 0.8, pinkField) * mix(0.25, 1.0, upperBias);
  float greenFog = smoothstep(0.43, 0.79, greenField) * mix(0.22, 1.0, lowerBias);

  float membrane = abs(sin(
    organicP.x * 2.4
      + organicP.y * 1.25
      + warp.x * 5.2
      - time * 0.44
  ));
  membrane = pow(1.0 - membrane, 7.0);
  membrane *= 0.35 + fbm(organicP * 2.1 - time * 0.13) * 0.65;

  vec3 lowerWater = vec3(0.0007, 0.002, 0.008);
  vec3 upperWater = vec3(0.002, 0.014, 0.047);
  vec3 blackWater = mix(
    lowerWater,
    upperWater,
    smoothstep(0.0, 1.0, screen.y)
  );
  vec3 deepPink = vec3(0.58, 0.004, 0.19);
  vec3 deepGreen = vec3(0.002, 0.4, 0.125);
  vec3 color = blackWater;

  // Uneven light entering from a distant surface is the strongest visual cue
  // that this space is underwater. The shafts widen and lose energy as they
  // descend through the water column.
  float shafts = 0.0;
  shafts += lightShaft(screen, 0.08, 0.13, 0.055, 0.4) * 0.58;
  shafts += lightShaft(screen, 0.27, -0.09, 0.037, 2.1) * 0.72;
  shafts += lightShaft(screen, 0.48, 0.055, 0.052, 4.8) * 0.48;
  shafts += lightShaft(screen, 0.69, -0.12, 0.042, 6.3) * 0.66;
  shafts += lightShaft(screen, 0.91, -0.17, 0.06, 8.7) * 0.42;
  shafts *= 0.58 + warp.x * 0.42;
  vec3 shaftColor = mix(
    vec3(0.035, 0.18, 0.24),
    vec3(0.12, 0.055, 0.18),
    smoothstep(0.58, 1.0, screen.y)
  );
  color += shaftColor * shafts * 0.31;

  float surfaceGlow = pow(screen.y, 3.2);
  color += vec3(0.018, 0.07, 0.095) * surfaceGlow * (0.72 + warp.y * 0.28);

  // A broad, slow far volume moves much less than the mid-depth color fog.
  // A nearer dark veil crosses faster in the opposite direction. This
  // difference in scale and parallax establishes depth even before particles
  // are visible.
  float farVolume = smoothstep(
    0.46,
    0.8,
    fbm(p * 0.58 + vec2(visualProgress * 0.045, time * 0.07))
  );
  color += vec3(0.012, 0.055, 0.07) * farVolume * 0.9;

  // Three deliberately separated parallax planes. The far plane barely
  // moves, the colored middle plane follows scroll, and the large foreground
  // veil crosses in the opposite direction to make the water feel deep.
  float farDepth = smoothstep(
    0.4,
    0.82,
    fbm(p * 0.34 + vec2(time * 0.025, -visualProgress * 0.025))
  );
  float middleDepth = smoothstep(
    0.38,
    0.76,
    fbm(p * 1.05 + vec2(visualProgress * 0.22, -time * 0.12 + 3.4))
  );
  float nearDepth = smoothstep(
    0.46,
    0.7,
    fbm(p * 2.25 + vec2(-visualProgress * 0.72, time * 0.34 + 7.8))
  );
  vec3 middleDepthColor = mix(
    vec3(0.0, 0.18, 0.12),
    vec3(0.28, 0.008, 0.15),
    smoothstep(0.18, 0.88, screen.y + warp.x * 0.14)
  );
  color += vec3(0.006, 0.035, 0.085) * farDepth * 0.92;
  color += middleDepthColor * middleDepth * 0.22;
  color *= mix(0.56, 1.0, nearDepth);

  // Large, defocused gas volumes close to the lens. Their low-frequency
  // fields and broad masks keep the edges soft instead of particle-like.
  vec2 foregroundDrift = vec2(
    -visualProgress * 0.92 + sin(uTime * 0.08) * 0.12,
    time * 0.46
  );
  float foregroundPinkGas = smoothstep(
    0.34,
    0.76,
    fbm(p * 0.7 + foregroundDrift + vec2(-2.8, 4.1))
  );
  float foregroundGreenGas = smoothstep(
    0.35,
    0.77,
    fbm(p * 0.64 - foregroundDrift * 0.82 + vec2(5.7, -3.2))
  );
  float foregroundEdge = smoothstep(0.12, 0.62, length(p * vec2(0.82, 1.05)));
  foregroundPinkGas *= foregroundEdge * (0.58 + upperBias * 0.42);
  foregroundGreenGas *= foregroundEdge * (0.64 + lowerBias * 0.36);
  color += vec3(0.72, 0.006, 0.25) * foregroundPinkGas * 0.18;
  color += vec3(0.002, 0.55, 0.19) * foregroundGreenGas * 0.16;

  float depthHaze = pow(screen.y, 1.7)
    * (0.58 + 0.42 * fbm(p * 0.46 + vec2(time * 0.035, 1.6)));
  color += vec3(0.012, 0.052, 0.078) * depthHaze * 0.72;
  color += deepPink * pinkFog * 0.42 * breath;
  color += deepGreen * greenFog * 0.38 * (1.84 - breath);
  color += mix(deepGreen, deepPink, upperBias)
    * membrane
    * (0.035 + (pinkFog + greenFog) * 0.045);

  // These are the same particle jellyfish as the foreground, rendered into a
  // smaller buffer, softly blurred, then seen through the colored water.
  vec3 distantCreatures = blurredDistantCreatures(screen);
  float fogOcclusion = 1.0 - clamp((pinkFog + greenFog) * 0.52, 0.0, 0.68);
  color += distantCreatures * fogOcclusion * 0.72;

  // Long, interrupted ribbons make the movement read as an underwater
  // current rather than as a generic animated noise field.
  float currentCoordinate = organicP.y * 4.8
    + organicP.x * 0.72
    + fbm(vec2(organicP.x * 1.18, organicP.y * 0.58) + time * 0.18) * 3.3
    - time * 0.52;
  float currentLines = pow(1.0 - abs(sin(currentCoordinate)), 15.0);
  float currentBreakup = smoothstep(
    0.38,
    0.76,
    fbm(organicP * vec2(1.0, 0.62) - vec2(time * 0.15, 0.0))
  );
  currentLines *= currentBreakup;
  vec3 currentColor = mix(
    vec3(0.02, 0.28, 0.16),
    vec3(0.42, 0.035, 0.22),
    upperBias
  );
  color += currentColor * currentLines * 0.13;

  float nearVeil = smoothstep(
    0.43,
    0.78,
    fbm(p * 0.82 + vec2(-visualProgress * 0.38, time * 0.19 + 6.2))
  );
  color *= mix(0.7, 1.0, nearVeil);

  float farDust = planktonLayer(
    screen + warp * 0.035,
    27.0,
    0.9,
    uTime * 0.035 + visualProgress * 2.1
  );
  float nearDust = planktonLayer(
    screen - warp * 0.025,
    43.0,
    0.955,
    -uTime * 0.052 - visualProgress * 3.4
  );
  float foregroundBokeh = planktonLayer(
    screen - warp * 0.055,
    12.0,
    0.972,
    -uTime * 0.082 - visualProgress * 5.2
  );
  float deepDust = planktonLayer(
    screen + warp * 0.012,
    68.0,
    0.93,
    uTime * 0.014 + visualProgress * 0.7
  );
  vec3 planktonColor = mix(
    vec3(0.08, 0.85, 0.36),
    vec3(1.0, 0.16, 0.57),
    upperBias
  );
  color += planktonColor * (
    deepDust * 0.03
      + farDust * 0.075
      + nearDust * 0.13
      + foregroundBokeh * 0.11
  );

  // Preserve a quiet, dark pocket behind the flower and the title.
  float centerDistance = length(p * vec2(0.82, 1.0));
  float centerOpening = smoothstep(0.08, 0.58, centerDistance);
  color *= mix(0.38, 1.0, centerOpening);

  // A soft luminous rim around the central darkness makes it feel like a
  // receding volume instead of a flat black vignette.
  float abyssRim = smoothstep(0.12, 0.34, centerDistance)
    * (1.0 - smoothstep(0.34, 0.72, centerDistance));
  color += mix(
    vec3(0.0, 0.06, 0.045),
    vec3(0.085, 0.005, 0.055),
    upperBias
  ) * abyssRim * 0.12;

  float vignette = 1.0 - smoothstep(0.2, 0.9, length(p * vec2(0.72, 0.92)));
  color *= mix(0.5, 1.0, vignette);

  // Let the bioluminescent water disappear just before every particle joins
  // the cylindrical helix, leaving a clean black field for the final motion.
  float fadeToBlack = smoothstep(0.48, 0.55, uProgress)
    * (1.0 - returnToKv);
  color *= 1.0 - fadeToBlack;

  gl_FragColor = vec4(color * uLoadingReveal, 1.0);
}
