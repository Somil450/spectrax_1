import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLRenderTarget } from "three";

interface TexturedMaterial extends THREE.Material {
  map?: THREE.Texture;
  lightMap?: THREE.Texture;
  bumpMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  specularMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  alphaMap?: THREE.Texture;
  envMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
  gradientMap?: THREE.Texture;
  thicknessMap?: THREE.Texture;
  sheenColorMap?: THREE.Texture;
  iridescenceMap?: THREE.Texture;
  transmissionMap?: THREE.Texture;
}

function disposeMaterial(material: THREE.Material | null | undefined): void {
  if (!material) return;

  // ShaderMaterial / RawShaderMaterial hold textures in `uniforms` which
  // are NOT freed by material.dispose() — release them explicitly first.
  const uniforms = (material as THREE.ShaderMaterial).uniforms;
  if (uniforms) {
    Object.values(uniforms).forEach((uniform) => {
      const value = (uniform as { value?: unknown }).value;
      if (value instanceof THREE.Texture) value.dispose();
      else if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry instanceof THREE.Texture) entry.dispose();
        });
      }
    });
  }

  const textured = material as TexturedMaterial;
  if (textured.map) textured.map.dispose();
  if (textured.lightMap) textured.lightMap.dispose();
  if (textured.bumpMap) textured.bumpMap.dispose();
  if (textured.normalMap) textured.normalMap.dispose();
  if (textured.specularMap) textured.specularMap.dispose();
  if (textured.roughnessMap) textured.roughnessMap.dispose();
  if (textured.metalnessMap) textured.metalnessMap.dispose();
  if (textured.aoMap) textured.aoMap.dispose();
  if (textured.emissiveMap) textured.emissiveMap.dispose();
  if (textured.alphaMap) textured.alphaMap.dispose();
  if (textured.envMap) textured.envMap.dispose();
  if (textured.displacementMap) textured.displacementMap.dispose();
  if (textured.gradientMap) textured.gradientMap.dispose();
  if (textured.thicknessMap) textured.thicknessMap.dispose();
  if (textured.sheenColorMap) textured.sheenColorMap.dispose();
  if (textured.iridescenceMap) textured.iridescenceMap.dispose();
  if (textured.transmissionMap) textured.transmissionMap.dispose();

  material.dispose();
}

function disposeNode(node: THREE.Object3D): void {
  const mesh = node as THREE.Mesh;
  if (mesh.isMesh) {
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(disposeMaterial);
  }
}

/**
 * Recursively dispose every mesh's geometry and material (including textures
 * held on material maps and in ShaderMaterial uniforms). Safe to call multiple
 * times on the same graph.
 */
export function disposeScene(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  root.traverse((child) => disposeNode(child));
  const scene = root as THREE.Scene;
  if (scene.clear) scene.clear();
}

/**
 * Dispose a WebGL renderer: release GPU resources, force context loss and
 * detach its canvas from the DOM. Safe to call when the renderer may have
 * already been disposed.
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer | null | undefined): void {
  if (!renderer) return;
  renderer.dispose();
  if (renderer.domElement && renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  renderer.forceContextLoss();
}

/**
 * Dispose OrbitControls: release internal event listeners and references so
 * the camera / DOM element can be garbage collected.
 */
export function disposeControls(controls: OrbitControls | null | undefined): void {
  if (!controls) return;
  controls.dispose();
}

/**
 * Dispose a render target and its depth texture.
 */
export function disposeRenderTarget(target: WebGLRenderTarget | null | undefined): void {
  if (!target) return;
  target.depthTexture?.dispose();
  target.dispose();
}
