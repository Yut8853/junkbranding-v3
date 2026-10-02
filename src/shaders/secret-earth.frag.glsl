precision highp float;

uniform float uTime;
uniform float uAspect;
uniform vec2 uPointer;

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
  float amplitude = 0.52;
  mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 5; i += 1) {
    value += valueNoise(p) * amplitude;
    p = rotation * p * 1.96 + 7.31;
    amplitude *= 0.5;
  }
  return value;
}

vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  vec2 screen = vUv;
  vec2 p = screen - 0.5;
  p.x *= uAspect;

  vec3 sky = vec3(0.0002, 0.0005, 0.0025);

  float nebula = fbm(p * 0.72 + vec2(uTime * 0.004, -uTime * 0.003));
  sky += mix(vec3(0.002, 0.008, 0.025), vec3(0.028, 0.004, 0.038), screen.y)
    * smoothstep(0.47, 0.88, nebula) * 0.42;

  vec2 pointerOffset = (uPointer - 0.5) * vec2(0.09, 0.045);
  vec2 earthCenter = vec2(pointerOffset.x, -1.28 + pointerOffset.y);
  float earthRadius = 1.19;
  vec2 local = p - earthCenter;
  float radialDistance = length(local);
  float sphereMask = 1.0 - smoothstep(earthRadius - 0.002, earthRadius + 0.002, radialDistance);
  float z = sqrt(max(0.0, earthRadius * earthRadius - dot(local, local))) / earthRadius;
  vec3 normal = normalize(vec3(local / earthRadius, z));
  normal = rotateY(normal, uTime * 0.012 + (uPointer.x - 0.5) * 0.16);

  vec2 terrainUv = vec2(
    atan(normal.x, normal.z) / 6.2831853 + 0.5,
    asin(clamp(normal.y, -1.0, 1.0)) / 3.1415926 + 0.5
  );
  terrainUv.x += uTime * 0.0014;
  float continentNoise = fbm(terrainUv * vec2(5.2, 3.4));
  continentNoise += fbm(terrainUv * vec2(12.0, 7.0) + 9.3) * 0.23;
  float landMask = smoothstep(0.59, 0.68, continentNoise);

  float latitude = abs(normal.y);
  vec3 deepOcean = vec3(0.002, 0.035, 0.11);
  vec3 shallowOcean = vec3(0.0, 0.22, 0.31);
  float oceanVariation = fbm(terrainUv * 18.0 + 3.0);
  vec3 ocean = mix(deepOcean, shallowOcean, oceanVariation * 0.48 + (1.0 - z) * 0.18);
  vec3 lowLand = vec3(0.035, 0.25, 0.105);
  vec3 highLand = vec3(0.38, 0.3, 0.14);
  vec3 land = mix(lowLand, highLand, smoothstep(0.64, 0.86, continentNoise));
  land = mix(land, vec3(0.82, 0.88, 0.78), smoothstep(0.72, 0.94, latitude));

  vec3 surface = mix(ocean, land, landMask);
  vec3 lightDirection = normalize(vec3(-0.48, 0.46, 0.82));
  float diffuse = max(0.0, dot(normal, lightDirection));
  float night = smoothstep(-0.18, 0.18, dot(normal, lightDirection));
  surface *= 0.08 + diffuse * 1.12;

  float cityNoise = fbm(terrainUv * vec2(42.0, 24.0) + 17.0);
  float cityLights = smoothstep(0.78, 0.92, cityNoise)
    * landMask * (1.0 - night) * smoothstep(0.08, 0.42, z);
  surface += vec3(1.0, 0.56, 0.12) * cityLights * 1.5;

  vec2 cloudUv = terrainUv * vec2(9.0, 5.0) + vec2(uTime * 0.008, 0.0);
  float cloudNoise = fbm(cloudUv + fbm(cloudUv * 0.62) * 1.4);
  float clouds = smoothstep(0.64, 0.8, cloudNoise) * smoothstep(0.05, 0.42, z);
  surface = mix(surface, vec3(0.82, 0.92, 1.0) * (0.32 + diffuse), clouds * 0.74);

  float fresnel = pow(1.0 - max(0.0, z), 3.2);
  surface += vec3(0.02, 0.32, 0.9) * fresnel * (0.45 + diffuse * 1.35);

  float atmosphereOutside = exp(-abs(radialDistance - earthRadius) * 48.0)
    * smoothstep(earthRadius, earthRadius + 0.075, radialDistance);
  vec3 color = mix(sky, surface, sphereMask);
  color += vec3(0.04, 0.34, 1.0) * atmosphereOutside * 0.78;

  float cinematicVignette = 1.0 - smoothstep(0.35, 1.1, length(p * vec2(0.72, 0.9)));
  color *= mix(0.58, 1.0, cinematicVignette);
  // The upper part overlaps CONTACT. Keep it genuinely transparent, then
  // increase opacity gradually so no rectangular section edge is visible.
  float sectionAlpha = 1.0 - smoothstep(0.54, 1.0, screen.y);
  gl_FragColor = vec4(color, sectionAlpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
