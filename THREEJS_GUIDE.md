# Three.js Integration Guide

## Overview

This portfolio website uses Three.js to create an immersive 3D background that responds to user interaction. This guide explains how the Three.js integration works and how to customize it.

## Architecture

The Three.js implementation is split into three main modules:

### 1. Scene Setup (`js/scene.js`)

**Responsibilities:**
- Initialize Three.js scene, camera, and renderer
- Create and manage lighting
- Generate particle system background
- Handle mouse parallax effects
- Manage the animation loop

**Key Components:**

```javascript
// Scene
this.scene = new THREE.Scene();
this.scene.fog = new THREE.FogExp2(0x0a0a0a, 0.002);

// Camera (Perspective)
this.camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);

// Renderer (WebGL)
this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

// Particle System (5000 particles)
this.particles = new THREE.Points(geometry, material);
```

### 2. Model Management (`js/modelLoader.js`)

**Responsibilities:**
- Load GLTF/GLB 3D models
- Track loading progress
- Create fallback geometric shapes
- Manage model animations
- Provide model management API

**Key Features:**

```javascript
// Load a 3D model
modelLoader.loadModel('path/to/model.glb', 'modelName', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 }
});

// Create a geometric shape (fallback)
modelLoader.createGeometry('torus', 'myTorus', {
    color: 0x00ff88,
    metalness: 0.8,
    roughness: 0.2
});

// Get a model
const model = modelLoader.getModel('modelName');

// Remove a model
modelLoader.removeModel('modelName');
```

### 3. Animation Control (`js/animations.js`)

**Responsibilities:**
- Create custom animations (floating, rotation)
- Handle section-based transitions
- Manage scroll-triggered animations
- Provide interactive effects

**Key Features:**

```javascript
// Floating animation
animationController.createFloatingAnimation('modelName', {
    amplitude: 0.2,  // How high it floats
    speed: 0.8       // How fast it oscillates
});

// Rotation animation
animationController.createRotationAnimation('modelName', {
    speed: { x: 0.002, y: 0.005, z: 0.001 }
});

// Custom tween animation
animationController.animateModelTo(model, {
    position: { x: 2, y: 1, z: -1 },
    rotation: { x: 0, y: Math.PI, z: 0 },
    scale: 1.5,
    duration: 1000  // milliseconds
});
```

## Particle System

The background features 5000 animated particles that create a dynamic, space-like atmosphere.

### Customizing Particles

**In `js/scene.js`, modify:**

```javascript
// Change particle count
const particleCount = 5000; // Reduce for better performance

// Change colors
const color1 = new THREE.Color(0x00ff88); // Primary
const color2 = new THREE.Color(0x0088ff); // Secondary

// Change particle size
const material = new THREE.PointsMaterial({
    size: 0.1,  // Adjust size
    opacity: 0.8  // Adjust transparency
});

// Change distribution
positions[i * 3] = (Math.random() - 0.5) * 100; // Spread
```

### Performance Optimization

```javascript
// Reduce particles for mobile
const isMobile = window.innerWidth < 768;
const particleCount = isMobile ? 2000 : 5000;

// Lower pixel ratio
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

## Lighting Setup

The scene includes four types of lights for realistic rendering:

```javascript
// 1. Ambient Light - Overall illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

// 2. Directional Light - Main light source
const directionalLight = new THREE.DirectionalLight(0x00ff88, 1);
directionalLight.position.set(5, 5, 5);

// 3. Point Light - Accent lighting
const pointLight = new THREE.PointLight(0x0088ff, 1, 100);
pointLight.position.set(-5, 5, -5);

// 4. Hemisphere Light - Sky/ground lighting
const hemisphereLight = new THREE.HemisphereLight(0x00ff88, 0x0088ff, 0.3);
```

**To adjust lighting:**
- Change intensity (second parameter)
- Change color (first parameter - hex code)
- Change position (.position.set(x, y, z))

## Adding 3D Models

### Step 1: Prepare Your Model

**Requirements:**
- Format: GLTF (.gltf) or GLB (.glb) recommended
- Size: Under 5MB for web performance
- Triangles: Under 100,000 for smooth performance
- Textures: Max 2048x2048 resolution

**Tools for creating/editing:**
- Blender (free, open-source)
- Maya, 3ds Max (professional)
- SketchUp (beginner-friendly)

### Step 2: Export to GLTF/GLB

**In Blender:**
1. File → Export → glTF 2.0
2. Choose GLB format (single file)
3. Check "Apply Modifiers"
4. Export

### Step 3: Add to Project

```javascript
// In js/modelLoader.js, after initialization:

// Example 1: Simple model
modelLoader.loadModel('models/robot.glb', 'robot', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1
});

// Example 2: Positioned model
modelLoader.loadModel('models/logo.glb', 'logo', {
    position: { x: -2, y: 1, z: -1 },
    scale: 0.5,
    rotation: { x: 0, y: Math.PI / 4, z: 0 }
});

// Example 3: Animated model
modelLoader.loadModel('models/character.glb', 'character', {
    position: { x: 2, y: 0, z: -2 },
    scale: 1
}).then((model) => {
    console.log('Character loaded with animations');
});
```

### Step 4: Animate Your Model

```javascript
// In js/animations.js:

// Add floating effect
animationController.createFloatingAnimation('robot', {
    amplitude: 0.3,
    speed: 1
});

// Add rotation
animationController.createRotationAnimation('logo', {
    speed: { x: 0, y: 0.01, z: 0 }
});
```

## Section-Based Transitions

Models automatically transition when scrolling between sections:

```javascript
// In js/animations.js

animateHome() {
    // Model position for Home section
    this.animateModelTo(model, {
        position: { x: 0, y: 0, z: 0 },
        scale: 1.5
    });
}

animateAbout() {
    // Model moves to the side for About section
    this.animateModelTo(model, {
        position: { x: 2, y: 0, z: -2 },
        scale: 1
    });
}
```

**To customize:**
1. Edit position/rotation/scale in each section method
2. Adjust duration for faster/slower transitions
3. Add new models for specific sections

## Mouse Interaction

The scene responds to mouse movement:

```javascript
// Parallax effect (automatic)
window.addEventListener('mousemove', (event) => {
    this.targetMouse.x = (event.clientX / width) * 2 - 1;
    this.targetMouse.y = -(event.clientY / height) * 2 + 1;
});

// Smooth following
this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
```

**To adjust sensitivity:**
- Change the multiplier (0.05) - higher = faster response
- Change rotation influence in particles section

## Camera Controls

OrbitControls are included for optional camera interaction:

```javascript
// In js/scene.js
this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
this.controls.enableDamping = true;
this.controls.dampingFactor = 0.05;
this.controls.enableZoom = false;      // Disable zoom
this.controls.enablePan = false;       // Disable pan
this.controls.autoRotate = true;       // Auto rotation
this.controls.autoRotateSpeed = 0.5;   // Rotation speed
```

## Performance Tips

### 1. Optimize Particle Count
```javascript
// Adjust based on device
const particleCount = window.innerWidth > 1920 ? 5000 : 3000;
```

### 2. Reduce Pixel Ratio
```javascript
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

### 3. Optimize Model Geometry
- Use Blender's "Decimate" modifier
- Reduce polygon count
- Combine meshes

### 4. Compress Textures
- Use JPG for color maps
- Use PNG for transparency
- Resize to power of 2 (512, 1024, 2048)

### 5. Limit Draw Calls
- Merge similar objects
- Use instanced meshes for repeated objects

## Debugging

### Enable Stats Panel
```javascript
// Add FPS counter (useful for debugging)
const stats = new Stats();
document.body.appendChild(stats.dom);

// In animation loop
stats.update();
```

### Console Logging
```javascript
// Check if Three.js is loaded
console.log('THREE version:', THREE.REVISION);

// Check scene objects
console.log('Scene children:', this.scene.children);

// Check model loading
modelLoader.loadModel(...).then(() => {
    console.log('Model loaded successfully');
});
```

### Common Issues

**Models not appearing:**
- Check camera position and distance
- Verify model scale (might be too small/large)
- Check material properties
- Ensure lights are added to scene

**Poor performance:**
- Reduce particle count
- Lower renderer pixel ratio
- Optimize model polygon count
- Check for memory leaks in animation loop

**Black screen:**
- Verify Three.js is loaded from CDN
- Check browser console for errors
- Ensure renderer is attached to canvas
- Verify camera is positioned correctly

## Advanced Customization

### Add Shadows
```javascript
this.renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;
model.castShadow = true;
model.receiveShadow = true;
```

### Add Post-Processing Effects
```javascript
// Requires additional imports
const composer = new THREE.EffectComposer(renderer);
const bloomPass = new THREE.UnrealBloomPass();
composer.addPass(bloomPass);
```

### Add Custom Shaders
```javascript
const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `...`,
    fragmentShader: `...`
});
```

## Resources

- **Three.js Docs**: https://threejs.org/docs/
- **Examples**: https://threejs.org/examples/
- **Editor**: https://threejs.org/editor/
- **Blender**: https://www.blender.org/
- **Free Models**: https://polypizza.com/
- **Community**: https://discourse.threejs.org/

---

Happy coding! 🚀
