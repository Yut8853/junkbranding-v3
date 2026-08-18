varying float vAlpha;
varying float vGlint;
varying float vSeed;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float radius = length(p);
  float particle = 1.0 - smoothstep(0.12, 0.31, radius);
  float core = 1.0 - smoothstep(0.0, 0.075, radius);
  float bloom = 1.0 - smoothstep(0.02, 0.5, radius);
  float alpha = max(
    particle * (0.22 + vGlint * 0.38),
    max(core * vGlint, bloom * vGlint * 0.42)
  ) * vAlpha;

  if (alpha < 0.01) discard;

  vec3 coolWhite = vec3(0.72, 0.9, 1.0);
  vec3 pinkWhite = vec3(1.0, 0.72, 0.92);
  vec3 color = mix(coolWhite, pinkWhite, fract(vSeed * 17.31));
  color = mix(color, vec3(1.0), core * 0.78 + vGlint * 0.32);
  gl_FragColor = vec4(color * (0.68 + vGlint * 2.25), alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
