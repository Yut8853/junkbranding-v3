precision highp float;

varying vec3 vNormalView;
varying vec3 vViewDirection;

void main() {
  float facing = max(0.0, dot(normalize(vNormalView), normalize(vViewDirection)));
  float rim = pow(1.0 - facing, 2.65);
  // The Fresnel term peaks at the exact silhouette. Fade it back to zero at
  // the mesh boundary so the atmosphere cannot form a hard circular line.
  float outerEdgeFade = smoothstep(0.0, 0.16, facing);
  float alpha = rim * outerEdgeFade * 0.68;
  vec3 atmosphere = mix(
    vec3(0.03, 0.18, 0.95),
    vec3(0.13, 0.62, 1.0),
    rim
  );
  gl_FragColor = vec4(atmosphere * (0.55 + rim * 1.1), alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
