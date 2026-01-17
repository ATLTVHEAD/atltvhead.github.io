# Three.js 3D Model Viewer Portfolio

An interactive 3D portfolio website built with Three.js, featuring a dedicated 3D model viewer and portfolio page.

## 🌟 Features

- **Interactive 3D Model Viewer**: Load and explore OBJ 3D models with orbit controls
- **Dual-Page Design**: Separate 3D viewer and portfolio pages
- **Orbit Controls**: Rotate, pan, and zoom the 3D model with mouse/touch
- **OBJ Model Support**: Ready to load custom `.obj` files
- **Responsive Design**: Fully responsive layout that works on all devices
- **Modern Dark Theme**: Sleek dark design with cyan and pink accents
- **No Build Required**: Static site ready for GitHub Pages deployment
- **NPM Compatible**: Includes npm scripts for local development

## 📁 Project Structure

```
atltvhead.github.io/
├── index.html              # 3D Model Viewer page
├── portfolio.html          # Portfolio/About page
├── styles.css              # All styles for both pages
├── js/
│   └── viewer.js           # 3D viewer logic and controls
├── lib/                    # Three.js library files (local)
│   ├── three.min.js        # Three.js core
│   ├── OrbitControls.js    # Camera controls
│   └── OBJLoader.js        # OBJ model loader
├── package.json            # NPM configuration
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js and npm (for local development server)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/ATLTVHEAD/atltvhead.github.io.git
cd atltvhead.github.io
```

2. Install dependencies (optional, only for npm http-server):
```bash
npm install
```

3. Start a local web server:

**Using NPM (recommended):**
```bash
npm run dev
```

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

4. Open your browser and navigate to:
```
http://localhost:8000
```

## 🎨 Adding Your Own 3D Model

1. Place your `atltvhead.obj` file in the project root directory
2. The viewer will automatically attempt to load it
3. If no model is found, a default placeholder geometry will be displayed

### OBJ File Requirements

- File format: Wavefront OBJ (`.obj`)
- Recommended: Keep polygon count under 100k for smooth performance
- The model will be automatically centered and scaled to fit the viewport

## 🎮 Controls

- **Left Mouse Button**: Rotate the model
- **Right Mouse Button**: Pan the camera
- **Mouse Wheel**: Zoom in/out
- **Touch**: Works on mobile devices with touch gestures

## 📄 Pages

### 3D Viewer (`index.html`)
The main page featuring the interactive 3D model viewer with orbit controls.

### Portfolio (`portfolio.html`)
A professional portfolio page showcasing projects, skills, and contact information.

## 🛠️ Technologies Used

- **Three.js** (r128) - 3D graphics library
- **Vanilla JavaScript** - No framework dependencies
- **CSS3** - Modern styling with gradients and animations
- **HTML5** - Semantic markup

## 📦 NPM Scripts

```bash
npm run dev      # Start development server
npm run serve    # Alias for dev
npm run build    # No build needed (static site)
npm run deploy   # Info about GitHub Pages deployment
```

## 🚀 Deployment

This site is designed for GitHub Pages deployment:

1. Push changes to the `main` branch
2. GitHub Pages automatically deploys the site
3. Your site will be live at `https://yourusername.github.io`

No build step is required - it's a static site that works directly in the browser!

## 📱 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Opera

## 💡 Tips

1. **Performance**: The default geometry is lightweight and renders smoothly
2. **File Size**: Keep OBJ models optimized for web (compress textures if included)
3. **Testing**: Test on multiple devices and browsers
4. **Customization**: Edit colors in `styles.css` CSS variables

## 🐛 Troubleshooting

**Model not loading?**
- Ensure `atltvhead.obj` is in the project root directory
- Check browser console for errors
- Verify you're using a local web server (not `file://`)

**Performance issues?**
- Reduce model polygon count
- Ensure you're using a modern browser
- Check for JavaScript console errors

**Blank screen?**
- Check browser console for errors
- Verify all files are loaded correctly
- Ensure Three.js library files are in `lib/` directory

## 📄 License

MIT License - feel free to use this for your own portfolio!

## ✨ Credits

Built with ❤️ using Three.js

---

**Live Site**: [atltvhead.xyz](https://atltvhead.xyz) or [atltvhead.github.io](https://atltvhead.github.io)
