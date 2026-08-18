varying float vGlow;
varying float vRelease;
varying float vSeed;
varying float vWorksFade;
varying float vParticleReveal;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float distanceToCenter = length(p);
  float disc = 1.0 - smoothstep(0.16, 0.5, distanceToCenter);
  float core = 1.0 - smoothstep(0.0, 0.12, distanceToCenter);
  float halo = 1.0 - smoothstep(0.03, 0.5, distanceToCenter);
  float alpha = max(disc * 0.72, core * vGlow);
  alpha = max(alpha, halo * vRelease * 0.3);
  alpha *= vWorksFade * vParticleReveal;
  if (alpha < 0.012) discard;

  float variation = sin(vSeed * 53.0) * 0.5 + 0.5;
  vec3 pink = mix(
    vec3(1.0, 0.0, 0.31),
    vec3(1.0, 0.0, 0.52),
    variation * 0.34
  );
  vec3 color = mix(pink, vec3(1.0, 0.12, 0.48), core * 0.12);
  color *= 1.0 + min(vGlow, 1.3) * 0.62;
  gl_FragColor = vec4(color, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
