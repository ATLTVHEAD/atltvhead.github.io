# Three.js Portfolio - Getting Started Guide

## Quick Start

This portfolio website uses Three.js to create an interactive 3D experience. Here's everything you need to know to customize it for your needs.

## File Overview

### HTML (index.html)
The main structure includes:
- Loading screen with progress bar
- Fixed navigation menu
- Four main sections: Home, About, Projects, Contact
- Canvas container for Three.js rendering
- All content is fully customizable

### CSS (styles/main.css)
- Uses CSS custom properties (variables) for easy color customization
- Responsive design with mobile breakpoints
- Glassmorphism effects for modern UI
- Smooth transitions and animations

### JavaScript Files

#### scene.js
Core Three.js setup:
- Creates the 3D scene, camera, and renderer
- Adds lighting (ambient, directional, point, hemisphere)
- Creates a particle system background (5000 particles)
- Handles mouse parallax effects
- Manages the render loop

#### modelLoader.js
3D model management:
- GLTF/GLB model loading with progress tracking
- Fallback geometric shapes (box, sphere, torus, cone)
- Animation mixer for animated models
- Easy API for loading and managing models

#### animations.js
Animation system:
- Section-based transitions
- Floating and rotation animations
- Smooth easing functions
- Interactive hover effects

#### main.js
UI and user interactions:
- Navigation menu (desktop and mobile)
- Smooth scrolling
- Contact form handling
- Scroll-based effects

## Customization Guide

### 1. Change Colors

Edit the CSS variables in `styles/main.css`:

```css
:root {
    --primary-color: #00ff88;      /* Neon green - main accent */
    --secondary-color: #0088ff;    /* Bright blue - secondary accent */
    --bg-color: #0a0a0a;           /* Almost black background */
    --text-color: #ffffff;         /* White text */
    --text-secondary: #a0a0a0;     /* Gray for secondary text */
    --accent-color: #ff0088;       /* Pink accent (optional) */
}
```

### 2. Update Personal Information

In `index.html`, update:

**About Section:**
```html
<section id="about" class="section">
    <div class="content-wrapper">
        <h2>About Me</h2>
        <p>Your description here...</p>
        <ul>
            <li>Your skills...</li>
        </ul>
    </div>
</section>
```

**Contact Section:**
```html
<ul class="social-links">
    <li><a href="https://github.com/yourusername">GitHub</a></li>
    <li><a href="https://linkedin.com/in/yourusername">LinkedIn</a></li>
    <!-- Add more links -->
</ul>
```

### 3. Add Your Own 3D Models

#### Step 1: Get a 3D Model
- Create in Blender (free 3D software)
- Download from sites like Sketchfab, Poly Pizza
- Commission a custom model
- Use AI tools like Meshy.ai

#### Step 2: Convert to GLTF/GLB
- Use Blender: File > Export > glTF 2.0
- Use online converters
- GLB is a single-file version (recommended)

#### Step 3: Add to Project
1. Place your `.glb` or `.gltf` file in the `models/` folder
2. Load it in `js/modelLoader.js`:

```javascript
// Replace the geometric torus with your model
modelLoader.loadModel('models/mymodel.glb', 'mainModel', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 }
});
```

### 4. Adjust 3D Scene Settings

In `js/scene.js`, you can modify:

**Particle Count:**
```javascript
const particleCount = 5000; // Reduce for better performance
```

**Camera Position:**
```javascript
this.camera.position.z = 5; // Move closer/farther
```

**Fog Effect:**
```javascript
this.scene.fog = new THREE.FogExp2(0x0a0a0a, 0.002); // Adjust density
```

### 5. Customize Animations

In `js/animations.js`:

**Floating Animation:**
```javascript
animationController.createFloatingAnimation('modelName', {
    amplitude: 0.2,  // How high it floats
    speed: 0.8       // How fast it floats
});
```

**Rotation Animation:**
```javascript
animationController.createRotationAnimation('modelName', {
    speed: { x: 0.002, y: 0.005, z: 0.001 }
});
```

## Adding New Projects

In `index.html`, add a new project card:

```html
<div class="project-card">
    <div class="project-image">
        <div class="model-preview" data-model="project1"></div>
    </div>
    <h3>Your Project Name</h3>
    <p>Project description here</p>
    <a href="https://project-link.com" class="project-link">View Project →</a>
</div>
```

## Testing Locally

### Option 1: Python Server
```bash
# Python 3
python -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000
```

Then visit: `http://localhost:8000`

### Option 2: Node.js Server
```bash
npx http-server -p 8000
```

### Option 3: VS Code Live Server
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## Performance Tips

1. **Optimize 3D Models:**
   - Keep triangle count under 100,000
   - Use texture compression
   - Reduce texture size (2048x2048 max)

2. **Reduce Particles:**
   - Lower `particleCount` in `scene.js`
   - Adjust based on target device

3. **Disable Features:**
   - Turn off auto-rotate: `controls.autoRotate = false`
   - Reduce shadow quality
   - Lower renderer pixel ratio

## Common Issues

### Models Not Loading
- ✓ Using a local server? (required)
- ✓ Correct file path?
- ✓ File format is .glb or .gltf?
- ✓ Check browser console for errors

### Poor Performance
- Reduce particle count
- Optimize 3D model
- Lower texture resolution
- Test on different browsers

### Layout Issues
- Check CSS media queries
- Test on mobile devices
- Adjust `content-wrapper` padding

## Deployment

### GitHub Pages
1. Push to your repository
2. Go to Settings > Pages
3. Select branch and folder
4. Your site will be live at `username.github.io`

### Custom Domain
1. Add a `CNAME` file with your domain
2. Configure DNS settings with your provider
3. Wait for DNS propagation (up to 24 hours)

## Next Steps

1. Replace placeholder content with your information
2. Add your own 3D models
3. Customize colors to match your brand
4. Add real project links and descriptions
5. Set up a contact form backend (optional)
6. Add Google Analytics (optional)
7. Test on multiple devices
8. Deploy to GitHub Pages

## Resources

- **Three.js Docs:** https://threejs.org/docs/
- **Blender (Free 3D Software):** https://www.blender.org/
- **Free 3D Models:** https://polypizza.com/
- **GLTF Tools:** https://github.com/KhronosGroup/glTF
- **Web Performance:** https://web.dev/performance/

## Need Help?

- Check the browser console for errors
- Read the Three.js documentation
- Join the Three.js Discord community
- Search Stack Overflow

Good luck with your portfolio! 🚀
