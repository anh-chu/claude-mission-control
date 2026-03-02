import * as THREE from "three";

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    75, // FOV
    window.innerWidth / window.innerHeight,
    0.1, // near
    200 // far — matches view distance
  );

  // Start position: slightly elevated, looking at origin
  camera.position.set(3, 3, 3);
  camera.lookAt(0, 0, 0);

  return camera;
}
