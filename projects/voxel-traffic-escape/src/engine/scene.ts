import * as THREE from "three";

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  // Atlanta late-afternoon sky color
  scene.background = new THREE.Color(0x87ceeb);

  // Warm atmospheric fog — extended range for better cityscape visibility
  scene.fog = new THREE.Fog(0x87ceeb, 100, 180);

  return scene;
}

export function createLighting(scene: THREE.Scene): void {
  // Hemisphere light: warm sky + warm ground bounce
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x5a4a3a, 0.6);
  scene.add(hemiLight);

  // Directional sun: late afternoon Atlanta, ~30° from west
  const sunLight = new THREE.DirectionalLight(0xfff0d8, 2.5);
  sunLight.position.set(-50, 30, -20);
  sunLight.castShadow = true;

  // Shadow map config — 2048 for crisp voxel shadows
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -64;
  sunLight.shadow.camera.right = 64;
  sunLight.shadow.camera.top = 64;
  sunLight.shadow.camera.bottom = -64;
  sunLight.shadow.bias = -0.0005;

  scene.add(sunLight);
}
