import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  buildCyberpunkGymScenery,
  buildSkyboxEnvironment,
  buildRippleGridPlane,
  buildJointMeshes,
  buildSkeletonLines,
  buildAxesHelpers,
  buildStressVectors,
} from "../sceneBuilders";

function createScene(): THREE.Scene {
  return new THREE.Scene();
}

describe("buildCyberpunkGymScenery", () => {
  it("creates a gym group with children", () => {
    const scene = createScene();
    const assets = buildCyberpunkGymScenery(scene);
    expect(assets.gymGroup).toBeInstanceOf(THREE.Group);
    expect(assets.gymGroup.children.length).toBeGreaterThan(0);
    expect(scene.children).toContain(assets.gymGroup);
  });

  it("creates neon light meshes", () => {
    const scene = createScene();
    const assets = buildCyberpunkGymScenery(scene);
    expect(assets.neonLights.length).toBe(4);
    assets.neonLights.forEach((light) => {
      expect(light.type).toBe("Mesh");
    });
  });

  it("creates equipment group with children", () => {
    const scene = createScene();
    const assets = buildCyberpunkGymScenery(scene);
    expect(assets.equipment.children.length).toBeGreaterThan(0);
  });

  it("creates wall panel meshes", () => {
    const scene = createScene();
    const assets = buildCyberpunkGymScenery(scene);
    expect(assets.wallPanels.length).toBe(3);
  });

  it("sets exponential fog on the scene", () => {
    const scene = createScene();
    buildCyberpunkGymScenery(scene);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
  });
});

describe("buildSkyboxEnvironment", () => {
  it("creates all skybox assets", () => {
    const scene = createScene();
    const assets = buildSkyboxEnvironment(scene);
    expect(assets.grid).toBeInstanceOf(THREE.GridHelper);
    expect(assets.floor).toBeInstanceOf(THREE.Mesh);
    expect(assets.ambientLight).toBeInstanceOf(THREE.AmbientLight);
    expect(assets.keyLight).toBeInstanceOf(THREE.DirectionalLight);
    expect(assets.fillLight).toBeInstanceOf(THREE.DirectionalLight);
    expect(assets.rimLight).toBeInstanceOf(THREE.PointLight);
  });

  it("sets floor to receive shadows", () => {
    const scene = createScene();
    const { floor } = buildSkyboxEnvironment(scene);
    expect(floor.receiveShadow).toBe(true);
  });

  it("places grid below the floor plane", () => {
    const scene = createScene();
    const { grid, floor } = buildSkyboxEnvironment(scene);
    expect(grid.position.y).toBeLessThan(floor.position.y);
  });
});

describe("buildRippleGridPlane", () => {
  it("creates a plane with a shader material", () => {
    const scene = createScene();
    const ripple = buildRippleGridPlane(scene);
    expect(ripple.plane).toBeInstanceOf(THREE.Mesh);
    expect(ripple.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(ripple.material.uniforms.uTime).toBeDefined();
    expect(ripple.material.uniforms.uGridColor).toBeDefined();
  });
});

describe("buildJointMeshes", () => {
  it("creates 33 joint spheres", () => {
    const scene = createScene();
    const joints = buildJointMeshes(scene);
    expect(joints).toHaveLength(33);
    joints.forEach((joint) => {
      expect(joint.type).toBe("Mesh");
      expect(joint.castShadow).toBe(true);
    });
  });
});

describe("buildSkeletonLines", () => {
  it("creates bones for each connection pair", () => {
    const scene = createScene();
    const bones = buildSkeletonLines(scene);
    expect(bones.length).toBeGreaterThan(0);
    bones.forEach((b) => {
      expect(b.line).toBeInstanceOf(THREE.Line);
    });
  });
});

describe("buildAxesHelpers", () => {
  it("creates 33 hidden axes helpers", () => {
    const scene = createScene();
    const helpers = buildAxesHelpers(scene);
    expect(helpers).toHaveLength(33);
    helpers.forEach((h) => {
      expect(h.visible).toBe(false);
    });
  });
});

describe("buildStressVectors", () => {
  it("creates stress vector rigs for each attachment", () => {
    const scene = createScene();
    const rigs = buildStressVectors(scene);
    expect(rigs.length).toBeGreaterThan(0);
    rigs.forEach((r) => {
      expect(r.mesh).toBeInstanceOf(THREE.Mesh);
      expect(r.material).toBeInstanceOf(THREE.ShaderMaterial);
    });
  });
});
