import * as THREE from 'three';
import { PANEL_WIDTH, PANEL_HEIGHT } from './workLayout.js';

// The works, shown as they are: crisp footage on thin, slightly curved glass
// panels floating around the flower. The one being visited is lit and in
// colour; the others hang back, darker and desaturated, like leaves in the
// water. A fast camera pass bends the image a little and splits its colour.
const VERTEX = /* glsl */ `
  uniform float uBend;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z -= p.x * p.x * 0.06 + uBend * sin(uv.x * 3.14159) * 0.06;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uActive;
  uniform float uSplit;
  uniform float uBlur;
  uniform vec2 uSize;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  float box(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 px = (vUv - 0.5) * uSize;
    float d = box(px, uSize * 0.5, 10.0);
    float mask = 1.0 - smoothstep(-1.2, 0.8, d);
    if (mask < 0.01) discard;
    vec2 shift = vec2(uSplit * 0.006, 0.0);
    vec3 color = vec3(texture2D(uMap, vUv + shift).r, texture2D(uMap, vUv).g, texture2D(uMap, vUv - shift).b);
    // depth of field: works out of focus are soft (a ring of taps)
    if (uBlur > 0.01) {
      vec3 soft = color;
      float r = uBlur * 0.022;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988;
        vec2 o = vec2(cos(a), sin(a) * (uSize.x / uSize.y)) * r;
        soft += texture2D(uMap, vUv + o).rgb + texture2D(uMap, vUv + o * 0.5).rgb;
      }
      color = mix(color, soft / 25.0, smoothstep(0.0, 0.35, uBlur));
    }
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 resting = mix(vec3(luma), color, 0.3) * vec3(0.72, 0.78, 0.86) * 0.5;
    color = mix(resting, color * 0.94, uActive);
    // glass edge: a hairline that catches the season's light
    float edge = 1.0 - smoothstep(0.0, 2.2, abs(d + 1.0));
    color += uAccent * edge * (0.25 + uActive * 0.45);
    float facing = clamp(dot(normalize(vNormalW), normalize(vViewW)), 0.0, 1.0);
    gl_FragColor = vec4(color, mask * uOpacity * mix(mix(0.45, 1.0, facing), 1.0, uActive));
  }
`;

export class WorkPanels {
  constructor(scene, layout) {
    this.group = new THREE.Group();
    this.group.name = 'works';
    const geometry = new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT, 24, 1);
    const blank = new THREE.DataTexture(new Uint8Array([10, 14, 20, 255]), 1, 1);
    blank.needsUpdate = true;
    this.panels = layout.map((slot) => {
      const uniforms = {
        uMap: { value: blank },
        uOpacity: { value: 0 },
        uActive: { value: 0 },
        uSplit: { value: 0 },
        uBlur: { value: 0 },
        uBend: { value: 0 },
        uSize: { value: new THREE.Vector2(960, 424) },
        uAccent: { value: new THREE.Color('#ff8f6b') },
      };
      const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      mesh.position.copy(slot.position);
      mesh.quaternion.copy(slot.quaternion);
      mesh.rotateZ(slot.tilt);
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return { mesh, uniforms, active: 0 };
    });
    scene.add(this.group);
  }

  // weight: how present the works are (0 outside autumn), focus: fractional
  // index of the project being visited, speed: camera travel speed 0..1.
  update({ weight, focus, speed, textures, accent, dt }) {
    this.group.visible = weight > 0.005;
    if (!this.group.visible) return;
    this.panels.forEach((panel, index) => {
      // focus is already smoothed by the scroll's inertia
      panel.active = THREE.MathUtils.smoothstep(1 - Math.abs(focus - index) * 1.7, 0, 1);
      const u = panel.uniforms;
      u.uOpacity.value = weight * (0.38 + panel.active * 0.62);
      u.uActive.value = panel.active;
      u.uSplit.value = speed;
      // rack focus: only the work being visited is sharp; focus leaves it
      // as the camera departs and lands on the next as it arrives
      u.uBlur.value = Math.min(1, Math.abs(focus - index)) * (0.6 + speed * 0.4);
      u.uBend.value = speed;
      if (textures[index]) u.uMap.value = textures[index];
      if (accent) u.uAccent.value.copy(accent);
    });
  }
}
