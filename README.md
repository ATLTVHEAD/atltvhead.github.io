# Three.js Portfolio Website

An interactive 3D portfolio website built with Three.js, featuring immersive 3D graphics and smooth animations.

## 🌟 Features

- **Interactive 3D Background**: Dynamic particle system with mouse-following parallax effects
- **3D Model Support**: Built-in GLTF/GLB model loader for showcasing 3D work
- **Responsive Design**: Fully responsive layout that works on all devices
- **Smooth Animations**: Scroll-triggered animations and section transitions
- **Modern UI**: Clean, professional design with glassmorphism effects
- **Easy Customization**: Well-structured code with clear separation of concerns

## 📁 Project Structure

```
atltvhead.github.io/
├── index.html              # Main HTML file
├── styles/
│   └── main.css           # All styles and responsive design
├── js/
│   ├── scene.js           # Three.js scene setup and management
│   ├── modelLoader.js     # 3D model loading utilities
│   ├── animations.js      # Animation controllers and effects
│   └── main.js            # UI interactions and navigation
├── models/                # Place your 3D models here (GLTF/GLB)
├── package.json           # Project metadata
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (for loading 3D models)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/ATLTVHEAD/atltvhead.github.io.git
cd atltvhead.github.io
```

2. Start a local web server:

**Using Python 3:**
```bash
python -m http.server 8000
```

**Using Node.js (http-server):**
```bash
npx http-server -p 8000
```

**Using VS Code:**
Install the "Live Server" extension and click "Go Live"

3. Open your browser and navigate to:
```
http://localhost:8000
```

## 🎨 Customization

### Adding Your Own 3D Models

1. Place your GLTF/GLB files in a `models/` directory
2. Load them in `js/modelLoader.js`:

```javascript
modelLoader.loadModel('models/yourmodel.glb', 'modelName', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 }
});
```

### Customizing Colors

Edit the CSS variables in `styles/main.css`:

```css
:root {
    --primary-color: #00ff88;     /* Main accent color */
    --secondary-color: #0088ff;   /* Secondary accent */
    --bg-color: #0a0a0a;          /* Background */
    --text-color: #ffffff;         /* Text color */
}
```

### Modifying Content

- **About Section**: Edit the content in `index.html` under `<section id="about">`
- **Projects**: Update project cards in `<section id="projects">`
- **Contact Info**: Modify social links in `<section id="contact">`

## 🎯 Key Components

### Scene Management (`js/scene.js`)
- Initializes Three.js scene, camera, and renderer
- Creates particle system background
- Handles lighting setup
- Manages render loop

### Model Loading (`js/modelLoader.js`)
- GLTF/GLB model loader with progress tracking
- Geometry creation utilities
- Animation mixer for model animations
- Model management (add/remove/get)

### Animations (`js/animations.js`)
- Section-based model transitions
- Floating and rotation animations
- Smooth easing functions
- Interactive model behaviors

### UI Interactions (`js/main.js`)
- Navigation menu functionality
- Smooth scrolling
- Form handling
- Scroll effects

## 🛠️ Technologies Used

- **Three.js** (r128) - 3D graphics library
- **Vanilla JavaScript** - No framework dependencies
- **CSS3** - Modern styling with animations
- **HTML5** - Semantic markup

## 📱 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Opera

## 🎓 Learning Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [GLTF Format](https://www.khronos.org/gltf/)

## 💡 Tips

1. **Performance**: Keep polygon count reasonable for web (under 100k triangles)
2. **File Size**: Compress textures and models for faster loading
3. **Testing**: Test on multiple devices and browsers
4. **Models**: Use tools like Blender to create/optimize 3D models
5. **Lighting**: Adjust lights in `scene.js` for best model appearance

## 🐛 Troubleshooting

**Models not loading?**
- Ensure you're using a local web server
- Check browser console for errors
- Verify model file paths are correct

**Performance issues?**
- Reduce particle count in `scene.js`
- Optimize 3D model polygon count
- Lower texture resolutions

**Blank screen?**
- Check browser console for errors
- Ensure Three.js CDN is accessible
- Verify all JavaScript files are loaded

## 📄 License

MIT License - feel free to use this for your own portfolio!

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## ✨ Credits

Built with ❤️ using Three.js

---

**Live Demo**: [atltvhead.xyz](https://atltvhead.xyz)
