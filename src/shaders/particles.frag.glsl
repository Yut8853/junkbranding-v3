varying vec3 vColor;
varying float vAlpha;
varying float vSparkle;
varying float vSeed;
varying float vGoldenPulse;
varying float vAboutFormation;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(centered);
  float circle = 1.0 - smoothstep(0.32, 0.5, distanceFromCenter);
  float core = 1.0 - smoothstep(0.0, 0.16, distanceFromCenter);
  float horizontalRay = (1.0 - smoothstep(0.0, 0.035, abs(centered.y)))
    * (1.0 - smoothstep(0.08, 0.48, abs(centered.x)));
  float verticalRay = (1.0 - smoothstep(0.0, 0.035, abs(centered.x)))
    * (1.0 - smoothstep(0.08, 0.48, abs(centered.y)));
  vec2 diagonalCoord = vec2(
    (centered.x + centered.y) * 0.7071,
    (centered.y - centered.x) * 0.7071
  );
  float diagonalRayA = (1.0 - smoothstep(0.0, 0.022, abs(diagonalCoord.y)))
    * (1.0 - smoothstep(0.12, 0.45, abs(diagonalCoord.x)));
  float diagonalRayB = (1.0 - smoothstep(0.0, 0.022, abs(diagonalCoord.x)))
    * (1.0 - smoothstep(0.12, 0.45, abs(diagonalCoord.y)));
  float star = max(core, max(max(horizontalRay, verticalRay), max(diagonalRayA, diagonalRayB) * 0.62)) * vSparkle;
  float halo = (1.0 - smoothstep(0.05, 0.5, distanceFromCenter)) * (0.22 + vSparkle * 0.62);
  float goldenHalo = (1.0 - smoothstep(0.015, 0.5, distanceFromCenter)) * vGoldenPulse;
  float particleAlpha = max(max(max(circle * 0.78, halo), star), goldenHalo);
  // Once the About composition is formed, use a hard-edged dot instead of
  // the soft particle halo so the portrait pixels and letterforms stay crisp.
  float crispAboutCircle = 1.0 - smoothstep(0.43, 0.495, distanceFromCenter);
  float aboutAlpha = crispAboutCircle;
  float alpha = mix(particleAlpha, aboutAlpha, vAboutFormation) * vAlpha;

  if (alpha < 0.01) discard;

  float luminance = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
  vec3 saturatedColor = mix(vec3(luminance), vColor, 1.52);
  vec3 sparkleColor = mix(
    saturatedColor * 2.05,
    vec3(1.0),
    core * 0.22
  );
  vec3 finalColor = saturatedColor * (0.72 + halo * 0.75);
  finalColor = mix(finalColor, sparkleColor, clamp(star * 1.25 + halo * vSparkle, 0.0, 1.0));
  vec3 goldenColor = vec3(1.0, 0.72, 0.035);
  finalColor = mix(finalColor, goldenColor * 2.35, vGoldenPulse * 0.96);
  finalColor = mix(finalColor, vColor * 1.18, vAboutFormation);
  gl_FragColor = vec4(finalColor, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
