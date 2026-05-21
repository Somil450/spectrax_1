/**
 * volumetricFogShaders.ts
 * Ray-marching atmospheric fog shaders for cyberpunk atmosphere
 * Responds dynamically to lighting directions for immersive effects
 */

/**
 * Fragment shader for volumetric fog computation
 * Uses ray-marching through fog layers to create depth-realistic atmospheric scattering
 */
export const volumetricFogFragmentShader = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec3 lightPosition;
  uniform vec3 lightColor;
  uniform float fogDensity;
  uniform float fogIntensity;
  uniform float time;
  
  varying vec2 vUv;
  
  #include <packing>
  
  // Pseudo-random number for noise
  float random(vec3 seed) {
    return fract(sin(dot(seed, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }
  
  // Perlin-like noise
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n000 = random(i + vec3(0.0, 0.0, 0.0));
    float n100 = random(i + vec3(1.0, 0.0, 0.0));
    float n010 = random(i + vec3(0.0, 1.0, 0.0));
    float n110 = random(i + vec3(1.0, 1.0, 0.0));
    float n001 = random(i + vec3(0.0, 0.0, 1.0));
    float n101 = random(i + vec3(1.0, 0.0, 1.0));
    float n011 = random(i + vec3(0.0, 1.0, 1.0));
    float n111 = random(i + vec3(1.0, 1.0, 1.0));
    
    float nx0 = mix(n000, n100, f.x);
    float nx1 = mix(n010, n110, f.x);
    float ny0 = mix(nx0, nx1, f.y);
    
    float nx0z1 = mix(n001, n101, f.x);
    float nx1z1 = mix(n011, n111, f.x);
    float ny1z1 = mix(nx0z1, nx1z1, f.y);
    
    return mix(ny0, ny1z1, f.z);
  }
  
  // Fractal Brownian Motion for natural-looking fog
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    
    return value;
  }
  
  // Volumetric light scattering calculation
  vec3 volumetricLight(vec3 rayOrigin, vec3 rayDir, vec3 lightPos, vec3 lightCol) {
    const int steps = 16;
    const float stepSize = 0.1;
    
    vec3 scattering = vec3(0.0);
    float transmittance = 1.0;
    
    for (int i = 0; i < steps; i++) {
      vec3 pos = rayOrigin + rayDir * stepSize * float(i);
      
      // Dynamic fog density with time-based animation
      float density = fbm(pos + vec3(time * 0.1)) * fogDensity;
      density += fbm(pos * 0.5 + vec3(time * 0.05)) * 0.5;
      
      // Light direction from current position
      vec3 toLightDir = normalize(lightPos - pos);
      
      // Phase function (affects light scattering direction)
      float phase = 0.25 * (1.0 + dot(rayDir, toLightDir));
      
      // Light attenuation with distance
      float lightDist = length(lightPos - pos);
      float lightAtten = 1.0 / (1.0 + lightDist * 0.2);
      
      // Accumulate light contribution
      vec3 lightContrib = lightCol * lightAtten * phase;
      scattering += transmittance * density * lightContrib;
      
      // Update transmittance (beer's law)
      transmittance *= exp(-density * stepSize * 0.5);
    }
    
    return scattering * fogIntensity;
  }
  
  void main() {
    vec4 diffuse = texture2D(tDiffuse, vUv);
    float depth = texture2D(tDepth, vUv).r;
    
    // Unpack depth
    float z = (2.0 * depth - 1.0);
    
    // Reconstruct ray direction (simplified)
    vec3 rayDir = normalize(vec3(vUv * 2.0 - 1.0, 1.0));
    vec3 rayOrigin = vec3(0.0);
    
    // Add volumetric fog on top of scene
    vec3 fogColor = volumetricLight(rayOrigin, rayDir, lightPosition, lightColor);
    
    // Blend fog with scene based on depth
    float fogAmount = min(1.0, (1.0 - depth) * fogIntensity);
    vec3 final = mix(diffuse.rgb, diffuse.rgb + fogColor, fogAmount);
    
    gl_FragColor = vec4(final, diffuse.a);
  }
`;

/**
 * Vertex shader for volumetric fog (passthrough)
 */
export const volumetricFogVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Advanced ray-marching shader for full-screen volumetric effects
 */
export const rayMarchingFragmentShader = `
  #define MAX_STEPS 64
  #define MAX_DIST 100.0
  #define SURF_DIST 0.01
  
  uniform vec3 cameraPos;
  uniform vec3 lightDir;
  uniform vec3 lightColor;
  uniform float time;
  uniform float fogDensity;
  uniform mat4 inverseProjection;
  uniform mat4 inverseView;
  
  varying vec2 vUv;
  
  // Noise functions
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float simplex3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    f = f * f * (3.0 - 2.0 * f);
    
    return mix(
      mix(
        mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x),
        f.y
      ),
      f.z
    );
  }
  
  // Fractal Brownian Motion
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
      value += amplitude * simplex3d(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    
    return value;
  }
  
  // Atmospheric fog volume function
  float atmosphereVolume(vec3 p) {
    // Layered fog with time-based animation
    float fog = fbm(p * 0.5 + vec3(time * 0.02, 0.0, time * 0.01));
    
    // Add height-based fog density (thicker near bottom)
    fog *= exp(-p.y * 0.5);
    
    // Dynamic wind effect
    fog += 0.3 * fbm(p * 0.3 + vec3(time * 0.05, 0.0, 0.0));
    
    return fog * fogDensity;
  }
  
  void main() {
    // Reconstruct a world-space ray by projecting the far plane point.
    vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec4 viewPos = inverseProjection * ndc;
    viewPos /= viewPos.w;
    vec4 worldPos = inverseView * viewPos;
    
    vec3 rayOrigin = cameraPos;
    vec3 rayDir = normalize(worldPos.xyz - rayOrigin);
    
    // Ray marching
    float dist = 0.0;
    vec3 color = vec3(0.0);
    float transmittance = 1.0;
    
    for (int i = 0; i < MAX_STEPS; i++) {
      dist += 0.1;
      if (dist > MAX_DIST) break;
      
      vec3 pos = rayOrigin + rayDir * dist;
      
      // Fog density at this position
      float density = atmosphereVolume(pos);
      
      // Light scattering based on angle to light direction
      float lightScatter = max(0.0, dot(rayDir, -lightDir) * 0.5 + 0.5);
      
      // Add light color to fog
      color += transmittance * density * lightColor * lightScatter;
      
      // Update transmittance (reduce with density)
      transmittance *= exp(-density * 0.1);
    }
    
    gl_FragColor = vec4(color, 1.0 - transmittance);
  }
`;

/**
 * Simple but effective screen-space volumetric fog
 * Optimized for real-time performance
 */
export const screenSpaceFogFragmentShader = `
  #define SAMPLES 8
  
  uniform sampler2D tDiffuse;
  uniform vec3 lightPosition;
  uniform vec3 lightColor;
  uniform float fogIntensity;
  uniform float time;
  
  varying vec2 vUv;
  
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  void main() {
    vec4 baseColor = texture2D(tDiffuse, vUv);
    
    // Screen-space ray from light position
    vec2 lightScreenPos = vec2(0.5, 0.5);
    vec2 rayDir = vUv - lightScreenPos;
    
    vec3 fogColor = vec3(0.0);
    float decay = 0.95;
    float illumination = 0.0;
    
    // Volumetric light rays (god rays)
    for (int i = 0; i < SAMPLES; i++) {
      vec2 sampleUv = vUv + rayDir * float(i) / float(SAMPLES);
      
      // Sample along the ray
      float sample_val = noise(sampleUv * 10.0 + time * 0.1);
      illumination += sample_val * decay;
      decay *= 0.95;
    }
    
    // Create fog effect
    fogColor = lightColor * illumination * fogIntensity;
    
    // Blend with scene
    vec3 final = baseColor.rgb + fogColor;
    
    gl_FragColor = vec4(final, baseColor.a);
  }
`;
