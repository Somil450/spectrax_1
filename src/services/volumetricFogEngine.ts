/**
 * volumetricFogEngine.ts
 * Real-time volumetric atmospheric fog system with ray-marching
 * Provides dynamic cyberpunk atmosphere responding to lighting
 */

import * as THREE from "three";
import {
  volumetricFogFragmentShader,
  volumetricFogVertexShader,
  screenSpaceFogFragmentShader,
} from "./volumetricFogShaders";

export interface VolumetricFogConfig {
  density: number; // 0.0 - 1.0, default 0.3
  intensity: number; // 0.0 - 2.0, default 0.8
  enabled: boolean;
  useScreenSpace: boolean; // Performance option: false = full ray-march, true = screen-space
}

export class VolumetricFogEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private material: THREE.ShaderMaterial | null = null;
  private quadMesh: THREE.Mesh | null = null;
  private renderTarget: THREE.WebGLRenderTarget | null = null;

  private config: VolumetricFogConfig = {
    density: 0.3,
    intensity: 0.8,
    enabled: true,
    useScreenSpace: true,
  };

  private lights: THREE.Light[] = [];
  private time: number = 0;

  /**
   * Initialize volumetric fog engine
   */
  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    config?: Partial<VolumetricFogConfig>,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Collect lights from scene
    this.updateLights();

    // Initialize post-processing
    this.initializePostProcessing();
  }

  /**
   * Update lights array from scene
   */
  private updateLights() {
    this.lights = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Light) {
        this.lights.push(obj);
      }
    });
  }

  /**
   * Initialize post-processing pass for volumetric fog
   */
  private initializePostProcessing() {
    if (!this.config.enabled) return;

    // Create render target for post-processing
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    // Create shader material for volumetric fog
    const fragmentShader = this.config.useScreenSpace
      ? screenSpaceFogFragmentShader
      : volumetricFogFragmentShader;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        lightPosition: { value: new THREE.Vector3(0, 4, 3) },
        lightColor: { value: new THREE.Color(0x00ffff) },
        fogDensity: { value: this.config.density },
        fogIntensity: { value: this.config.intensity },
        time: { value: 0 },
        cameraPos: { value: this.camera.position },
        inverseProjection: { value: new THREE.Matrix4() },
        inverseView: { value: new THREE.Matrix4() },
        lightDir: { value: new THREE.Vector3(0, 1, 1).normalize() },
      },
      vertexShader: volumetricFogVertexShader,
      fragmentShader: fragmentShader,
    });

    // Create full-screen quad for post-processing
    const quadGeometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array([
      -1, 1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0,
    ]);
    const uvArray = new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]);

    quadGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positionArray, 3),
    );
    quadGeometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));
    quadGeometry.setIndex([0, 1, 2, 1, 3, 2]);

    this.quadMesh = new THREE.Mesh(quadGeometry, this.material);
  }

  /**
   * Update volumetric fog each frame
   * Should be called in animation loop
   */
  public update(deltaTime: number = 0.016) {
    if (!this.config.enabled || !this.material) return;

    this.time += deltaTime;

    // Update light uniforms from scene lights
    this.updateLightUniforms();

    // Update material uniforms
    this.material.uniforms.fogDensity.value = this.config.density;
    this.material.uniforms.fogIntensity.value = this.config.intensity;
    this.material.uniforms.time.value = this.time;
    this.material.uniforms.cameraPos.value = this.camera.position.clone();

    // Update inverse matrices for ray reconstruction
    this.material.uniforms.inverseProjection.value.copy(
      this.camera.projectionMatrixInverse,
    );
    this.material.uniforms.inverseView.value.copy(this.camera.matrixWorld);
  }

  /**
   * Update light uniforms from scene
   */
  private updateLightUniforms() {
    if (!this.material) return;

    // Find the primary directional light (key light)
    let primaryLight: THREE.Light | null = null;
    for (const light of this.lights) {
      if (light instanceof THREE.DirectionalLight) {
        primaryLight = light;
        break;
      }
    }

    // Update primary light position and color
    if (primaryLight) {
      if (primaryLight instanceof THREE.DirectionalLight) {
        const direction = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(primaryLight.quaternion)
          .normalize();
        const lightPos = this.camera.position
          .clone()
          .add(direction.multiplyScalar(10));

        this.material.uniforms.lightPosition.value = lightPos;
        this.material.uniforms.lightDir.value = direction;
      } else if (primaryLight instanceof THREE.PointLight) {
        this.material.uniforms.lightPosition.value =
          primaryLight.position.clone();
      }

      this.material.uniforms.lightColor.value = primaryLight.color.clone();
    }
  }

  /**
   * Apply volumetric fog post-processing
   * Should be called after scene render
   */
  public applyPostProcessing(sourceTexture: THREE.Texture) {
    if (!this.config.enabled || !this.material) return;

    // Update source texture
    this.material.uniforms.tDiffuse.value = sourceTexture;

    // Render to target
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);

    if (this.quadMesh) {
      const postProcessScene = new THREE.Scene();
      postProcessScene.add(this.quadMesh);
      this.renderer.render(postProcessScene, this.camera);
    }

    this.renderer.setRenderTarget(previousTarget);
  }

  /**
   * Get render target texture for compositing
   */
  public getRenderTarget(): THREE.WebGLRenderTarget | null {
    return this.renderTarget;
  }

  /**
   * Enable/disable volumetric fog
   */
  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    if (enabled && !this.material) {
      this.initializePostProcessing();
    }
  }

  /**
   * Set fog density (0-1)
   */
  public setDensity(density: number) {
    this.config.density = THREE.MathUtils.clamp(density, 0, 1);
    if (this.material) {
      this.material.uniforms.fogDensity.value = this.config.density;
    }
  }

  /**
   * Set fog intensity (0-2)
   */
  public setIntensity(intensity: number) {
    this.config.intensity = THREE.MathUtils.clamp(intensity, 0, 2);
    if (this.material) {
      this.material.uniforms.fogIntensity.value = this.config.intensity;
    }
  }

  /**
   * Set fog color
   */
  public setFogColor(color: THREE.Color | string) {
    const fogColor = new THREE.Color(color);
    if (this.material) {
      this.material.uniforms.lightColor.value = fogColor;
    }
  }

  /**
   * Toggle between screen-space and full ray-march modes
   */
  public setScreenSpaceMode(useScreenSpace: boolean) {
    this.config.useScreenSpace = useScreenSpace;
    this.initializePostProcessing();
  }

  /**
   * Get current configuration
   */
  public getConfig(): VolumetricFogConfig {
    return { ...this.config };
  }

  /**
   * Resize render targets
   */
  public resize(width: number, height: number) {
    if (this.renderTarget) {
      this.renderTarget.setSize(width, height);
    }
  }

  /**
   * Dispose and cleanup
   */
  public dispose() {
    if (this.renderTarget) {
      this.renderTarget.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.quadMesh) {
      this.quadMesh.geometry.dispose();
    }
  }
}

/**
 * Create default volumetric fog engine optimized for performance
 */
export function createDefaultVolumetricFog(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): VolumetricFogEngine {
  return new VolumetricFogEngine(scene, camera, renderer, {
    density: 0.3,
    intensity: 0.8,
    enabled: true,
    useScreenSpace: true, // Optimized for 60 FPS on most hardware
  });
}
