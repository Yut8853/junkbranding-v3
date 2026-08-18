varying float vGlow;
varying float vSeed;
varying float vRelease;
varying float vVertical;
varying float vGoldenPulse;

uniform float uOpacity;
uniform float uWorksFade;

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(p);
  float disc = 1.0 - smoothstep(0.18, 0.5, distanceToCenter);
  float core = 1.0 - smoothstep(0.0, 0.1, distanceToCenter);
  float rayX = (1.0 - smoothstep(0.0, 0.026, abs(p.y)))
    * (1.0 - smoothstep(0.06, 0.48, abs(p.x)));
  float rayY = (1.0 - smoothstep(0.0, 0.026, abs(p.x)))
    * (1.0 - smoothstep(0.06, 0.48, abs(p.y)));
  vec2 diagonal = vec2((p.x + p.y) * 0.7071, (p.y - p.x) * 0.7071);
  float rayD1 = (1.0 - smoothstep(0.0, 0.018, abs(diagonal.y)))
    * (1.0 - smoothstep(0.08, 0.48, abs(diagonal.x)));
  float rayD2 = (1.0 - smoothstep(0.0, 0.018, abs(diagonal.x)))
    * (1.0 - smoothstep(0.08, 0.48, abs(diagonal.y)));
  float starShape = max(max(rayX, rayY), max(rayD1, rayD2) * (0.45 + vRelease * 0.5));
  float star = max(core, starShape) * vGlow;
  float halo = (1.0 - smoothstep(0.05, 0.5, distanceToCenter)) * vRelease * 0.8;
  float goldenHalo = (1.0 - smoothstep(0.015, 0.5, distanceToCenter)) * vGoldenPulse;
  float alpha = max(max(max(disc * (0.25 + vGlow * 0.45), star), halo), goldenHalo);

  if (alpha < 0.015) discard;

  vec3 lowerGreen = vec3(0.03, 1.0, 0.2);
  vec3 upperPink = vec3(1.0, 0.04, 0.46);
  vec3 regionColor = mix(lowerGreen, upperPink, smoothstep(0.22, 0.76, vVertical));
  float pearlVariation = sin(vSeed * 47.0) * 0.5 + 0.5;
  vec3 pearl = mix(regionColor * 0.96, regionColor * 1.22, pearlVariation);
  pearl *= 1.0 + vRelease * 0.38;
  float whiteCore = clamp(core * 0.58 + starShape * vGlow * 0.08, 0.0, 0.5);
  whiteCore *= 1.0 - vRelease * 0.62;
  vec3 color = mix(pearl, vec3(1.0, 0.99, 0.96), whiteCore);
  vec3 goldenColor = vec3(1.0, 0.7, 0.025);
  color = mix(color, goldenColor * 2.45, vGoldenPulse * 0.97);
  float brightness = 0.82 + min(vGlow, 1.0) * 1.08 + vRelease * 0.16;
  gl_FragColor = vec4(color * brightness, alpha * uOpacity * uWorksFade);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
