import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeControls, disposeRenderTarget, disposeRenderer, disposeScene } from "../threeDisposal";

function trackDispose(obj: { dispose?: (...args: unknown[]) => void }) {
  const dispose = obj.dispose ? obj.dispose.bind(obj) : () => {};
  const spy = vi.fn(() => dispose());
  obj.dispose = spy;
  return spy;
}

describe("disposeScene", () => {
  it("disposes mesh geometry and material recursively", () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    const geometrySpy = trackDispose(geo);
    const materialSpy = trackDispose(mat);
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, mat));
    scene.add(group);

    disposeScene(scene);

    expect(geometrySpy).toHaveBeenCalledOnce();
    expect(materialSpy).toHaveBeenCalledOnce();
    expect(scene.children.length).toBe(0);
  });

  it("disposes textures held on material maps", () => {
    const texture = new THREE.Texture();
    const textureSpy = trackDispose(texture);
    const mat = new THREE.MeshStandardMaterial({ map: texture });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));

    disposeScene(scene);

    expect(textureSpy).toHaveBeenCalledOnce();
  });

  it("disposes textures held inside ShaderMaterial uniforms", () => {
    const uniformTexture = new THREE.Texture();
    const uniformTextureSpy = trackDispose(uniformTexture);
    const uniforms: Record<string, THREE.IUniform> = { uTexture: { value: uniformTexture } };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: "", fragmentShader: "" });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));

    disposeScene(scene);

    expect(uniformTextureSpy).toHaveBeenCalledOnce();
  });

  it("disposes array uniforms that hold textures", () => {
    const a = new THREE.Texture();
    const b = new THREE.Texture();
    const aSpy = trackDispose(a);
    const bSpy = trackDispose(b);
    const uniforms: Record<string, THREE.IUniform> = { uRipples: { value: [a, b] } };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: "", fragmentShader: "" });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));

    disposeScene(scene);

    expect(aSpy).toHaveBeenCalledOnce();
    expect(bSpy).toHaveBeenCalledOnce();
  });

  it("disposes every material in an array material", () => {
    const mats = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    const spies = mats.map(trackDispose);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mats));

    disposeScene(scene);

    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });

  it("is safe on null / empty roots", () => {
    expect(() => disposeScene(null)).not.toThrow();
    expect(() => disposeScene(undefined)).not.toThrow();
    expect(() => disposeScene(new THREE.Scene())).not.toThrow();
  });

  it("handles Light targets gracefully", () => {
    const target = new THREE.Object3D();
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.target = target;
    const scene = new THREE.Scene();
    scene.add(dirLight);

    expect(() => disposeScene(scene)).not.toThrow();
  });
});

describe("disposeRenderer", () => {
  it("disposes, removes canvas from DOM and forces context loss", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    container.appendChild(canvas);

    const disposeSpy = vi.fn();
    const forceContextLossSpy = vi.fn();
    const renderer = {
      dispose: disposeSpy,
      forceContextLoss: forceContextLossSpy,
      domElement: canvas,
    } as unknown as THREE.WebGLRenderer;

    disposeRenderer(renderer);

    expect(disposeSpy).toHaveBeenCalledOnce();
    expect(forceContextLossSpy).toHaveBeenCalledOnce();
    expect(container.contains(canvas)).toBe(false);
  });

  it("is safe on null", () => {
    expect(() => disposeRenderer(null)).not.toThrow();
  });
});

describe("disposeControls", () => {
  it("calls controls.dispose", () => {
    const controls = { dispose: vi.fn() } as unknown as OrbitControls;
    disposeControls(controls);
    expect(controls.dispose).toHaveBeenCalledOnce();
  });

  it("is safe on null", () => {
    expect(() => disposeControls(null)).not.toThrow();
  });
});

describe("disposeRenderTarget", () => {
  it("disposes depth texture and target", () => {
    const target = new THREE.WebGLRenderTarget(64, 64);
    target.depthTexture = new THREE.DepthTexture(64, 64);
    const depthSpy = trackDispose(target.depthTexture);
    const targetSpy = trackDispose(target);

    disposeRenderTarget(target);

    expect(depthSpy).toHaveBeenCalledOnce();
    expect(targetSpy).toHaveBeenCalledOnce();
  });

  it("is safe on null", () => {
    expect(() => disposeRenderTarget(null)).not.toThrow();
  });
});
