precision highp float;

uniform float uTime;

varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vObjectNormal;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
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
  mat2 rotation = mat2(0.84, -0.54, 0.54, 0.84);
  for (int i = 0; i < 5; i += 1) {
    value += noise(p) * amplitude;
    p = rotation * p * 1.94 + 5.7;
    amplitude *= 0.49;
  }
  return value;
}

void main() {
  // Triplanar noise follows the sphere normal and has no longitude UV seam.
  vec3 sphereNormal = normalize(vObjectNormal);
  vec3 weights = pow(abs(sphereNormal), vec3(4.0));
  weights /= max(0.0001, weights.x + weights.y + weights.z);
  vec2 driftA = vec2(uTime * 0.006, -uTime * 0.0015);
  vec2 driftB = vec2(-uTime * 0.003, uTime * 0.004);
  float cloudX = fbm(sphereNormal.yz * 4.8 + driftA);
  float cloudY = fbm(sphereNormal.xz * 4.8 + driftB + 7.3);
  float cloudZ = fbm(sphereNormal.xy * 4.8 + driftA.yx + 13.7);
  float largeCloud = cloudX * weights.x + cloudY * weights.y + cloudZ * weights.z;
  float detailX = fbm(sphereNormal.yz * 11.5 + driftB + 3.4);
  float detailY = fbm(sphereNormal.xz * 11.5 + driftA + 9.1);
  float detailZ = fbm(sphereNormal.xy * 11.5 - driftB + 16.2);
  float detail = detailX * weights.x + detailY * weights.y + detailZ * weights.z;
  float cloud = smoothstep(0.62, 0.8, largeCloud + detail * 0.16);
  float light = 0.38 + max(0.0, dot(normalize(vNormalView), normalize(vec3(-0.45, 0.48, 0.78)))) * 0.78;
  float silhouetteFade = smoothstep(0.0, 0.13, max(0.0, vNormalView.z));
  float alpha = cloud * silhouetteFade * 0.72;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vec3(0.82, 0.91, 1.0) * light, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
