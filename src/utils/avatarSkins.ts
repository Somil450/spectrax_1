import * as THREE from "three";

export const AVATAR_SKINS = {
  STANDARD_HUMAN: "Standard Human",
  ROBOT: "Robot",
  CYBERPUNK_NEON: "Cyberpunk Neon",
} as const;

export type AvatarSkinType = typeof AVATAR_SKINS[keyof typeof AVATAR_SKINS];

/**
 * Creates the base material configuration for a specific avatar skin.
 * These base parameters define the aesthetic identity (shininess, metalness, roughness, wireframe, base color).
 */
export const createBaseMaterialForSkin = (skin: string): THREE.MeshStandardMaterial => {
  switch (skin) {
    case AVATAR_SKINS.ROBOT:
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xd0d0d0), // Sleek silver/grey
        roughness: 0.15,                 // Very smooth
        metalness: 0.9,                  // Metallic sheen
        emissive: new THREE.Color(0x111111),
        emissiveIntensity: 0.1,
        wireframe: false,
      });

    case AVATAR_SKINS.CYBERPUNK_NEON:
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x050505), // Pitch dark body
        roughness: 0.5,
        metalness: 0.8,
        emissive: new THREE.Color(0x00ffff), // Neon Cyan wireframe glow
        emissiveIntensity: 1.2,
        wireframe: true,                  // Sci-fi grid mesh look
      });

    case AVATAR_SKINS.STANDARD_HUMAN:
    default:
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xe0a080), // Warm natural skin tone
        roughness: 0.6,                  // Non-reflective skin texture
        metalness: 0.1,                  // Non-metallic organic structure
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
        wireframe: false,
      });
  }
};
