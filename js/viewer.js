/**
 * viewer.js - Three.js 3D Model Viewer
 * Handles scene setup, model loading, and user controls
 * Features gemstone material effect with scroll-based hue shifting
 */

class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.lights = {};
        this.gemMaterials = []; // Store references to gem materials for hue shifting
        this.scrollProgress = 0; // 0 = crystal, 0.5 = ruby, 1 = sapphire
        
        this.init();
        this.setupLights();
        this.loadModel();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Get canvas element
        const canvas = document.getElementById('three-canvas');
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 5);
        
        // Create renderer with enhanced settings for gem effects
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        // Create orbit controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI;
    }

    setupLights() {
        // Ambient light - increased for better gemstone visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;
        
        // Main directional light - white light for brilliance
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -10;
        mainLight.shadow.camera.right = 10;
        mainLight.shadow.camera.top = 10;
        mainLight.shadow.camera.bottom = -10;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);
        this.lights.main = mainLight;
        
        // Fill light - for better visibility from the side
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, 3, -5);
        this.scene.add(fillLight);
        this.lights.fill = fillLight;
        
        // Back light - for rim lighting effect
        const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
        backLight.position.set(0, -5, -5);
        this.scene.add(backLight);
        this.lights.back = backLight;
        
        // Hemisphere light for natural lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        this.scene.add(hemiLight);
        this.lights.hemisphere = hemiLight;
        
        // Additional accent lights for gemstone sparkle
        const accentLight1 = new THREE.PointLight(0xffffff, 1.0, 50);
        accentLight1.position.set(3, 0, 3);
        this.scene.add(accentLight1);
        this.lights.accent1 = accentLight1;
        
        const accentLight2 = new THREE.PointLight(0xffffff, 0.8, 50);
        accentLight2.position.set(-3, 2, -3);
        this.scene.add(accentLight2);
        this.lights.accent2 = accentLight2;
    }

    /**
     * Create a gemstone material with the given hue
     * @param {number} hue - Hue value (0-1)
     * @returns {THREE.MeshPhysicalMaterial}
     */
    createGemMaterial(hue = 0) {
        // Calculate color based on hue
        // 0 = crystal (white/clear), 0.5 = ruby (red), 1.0 = sapphire (blue)
        const color = this.getGemColor(hue);
        
        const material = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.0,              // Gems are not metallic
            roughness: 0.05,             // Very smooth for brilliance
            clearcoat: 1.0,              // Strong clearcoat for gem-like finish
            clearcoatRoughness: 0.05,    // Very smooth clearcoat
            ior: 2.4,                    // High index of refraction (diamond-like)
            transmission: 0.95,          // High transmission for transparent gem look
            thickness: 2.0,              // Thickness for refraction effect
            reflectivity: 1.0,           // High reflectivity
            sheen: 0.5,                  // Subtle sheen
            sheenRoughness: 0.25,
            sheenColor: new THREE.Color(0xffffff),
            envMapIntensity: 2.5,        // Strong environment reflections
            transparent: true,
            opacity: 0.95
        });
        
        // Store reference for hue shifting
        this.gemMaterials.push(material);
        
        return material;
    }

    /**
     * Get gem color based on scroll progress
     * @param {number} progress - Progress value (0-1)
     * @returns {THREE.Color}
     */
    getGemColor(progress) {
        // Define colors for each state
        const crystalColor = new THREE.Color(0xffffff);  // White/clear crystal
        const rubyColor = new THREE.Color(0xff1744);     // Deep red ruby
        const sapphireColor = new THREE.Color(0x2979ff); // Deep blue sapphire
        
        let color = new THREE.Color();
        
        if (progress <= 0.5) {
            // Interpolate from crystal to ruby
            const t = progress * 2; // 0 to 1 over first half
            color.copy(crystalColor).lerp(rubyColor, t);
        } else {
            // Interpolate from ruby to sapphire
            const t = (progress - 0.5) * 2; // 0 to 1 over second half
            color.copy(rubyColor).lerp(sapphireColor, t);
        }
        
        return color;
    }

    /**
     * Update all gem materials with new hue based on scroll
     * @param {number} progress - Scroll progress (0-1)
     */
    updateGemHue(progress) {
        const color = this.getGemColor(progress);
        
        this.gemMaterials.forEach(material => {
            material.color.copy(color);
            material.needsUpdate = true;
        });
        
        // Update color indicator
        this.updateColorIndicator(progress);
    }

    /**
     * Update the color indicator UI
     * @param {number} progress - Scroll progress (0-1)
     */
    updateColorIndicator(progress) {
        const indicator = document.getElementById('gem-state-indicator');
        if (indicator) {
            let stateName;
            if (progress < 0.25) {
                stateName = 'Crystal';
            } else if (progress < 0.75) {
                stateName = 'Ruby';
            } else {
                stateName = 'Sapphire';
            }
            indicator.textContent = stateName;
            
            // Update indicator color
            const color = this.getGemColor(progress);
            indicator.style.color = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
        }
    }


    loadModel() {
        const loader = new THREE.OBJLoader();
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = document.getElementById('loading-text');
        const progressBar = document.getElementById('progress-bar-fill');
        
        // Try to load the custom model
        loader.load(
            'atltvhead.obj',
            // Success callback
            (object) => {
                this.model = object;
                
                // Center the model
                const box = new THREE.Box3().setFromObject(object);
                const center = box.getCenter(new THREE.Vector3());
                object.position.sub(center);
                
                // Scale the model to fit in view
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 3 / maxDim;
                object.scale.setScalar(scale);
                
                // Apply gemstone material to all meshes
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = this.createGemMaterial(this.scrollProgress);
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.scene.add(object);
                
                // Initialize with current scroll progress
                this.updateGemHue(this.scrollProgress);
                
                // Hide loading screen
                loadingText.textContent = 'Model Loaded!';
                progressBar.style.width = '100%';
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                }, 500);
            },
            // Progress callback
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                progressBar.style.width = percentComplete + '%';
                loadingText.textContent = `Loading... ${Math.round(percentComplete)}%`;
            },
            // Error callback - load a fallback cube
            (error) => {
                console.log('Custom model not found, loading default geometry');
                loadingText.textContent = 'Loading default geometry...';
                this.loadDefaultGeometry();
                
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                }, 1000);
            }
        );
    }

    loadDefaultGeometry() {
        // Create a default geometry if model file is not found
        const group = new THREE.Group();
        
        // Create a stylized gem-like icosahedron
        const geometry = new THREE.IcosahedronGeometry(1.5, 0);
        const material = this.createGemMaterial(this.scrollProgress);
        const gem = new THREE.Mesh(geometry, material);
        gem.castShadow = true;
        gem.receiveShadow = true;
        group.add(gem);
        
        // Add some smaller gems around it
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const radius = 3;
            const smallGeo = new THREE.OctahedronGeometry(0.4, 0);
            const smallGem = new THREE.Mesh(smallGeo, this.createGemMaterial(this.scrollProgress));
            smallGem.position.x = Math.cos(angle) * radius;
            smallGem.position.z = Math.sin(angle) * radius;
            smallGem.castShadow = true;
            group.add(smallGem);
        }
        
        this.model = group;
        this.scene.add(group);
        
        // Initialize with current scroll progress
        this.updateGemHue(this.scrollProgress);
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Handle scroll/wheel for hue shifting
        // Using wheel event on the canvas container for better control
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.addEventListener('wheel', (e) => {
                // Only change hue when Shift key is held
                if (e.shiftKey) {
                    e.preventDefault();
                    
                    // Calculate scroll delta (normalized)
                    const delta = e.deltaY > 0 ? 0.02 : -0.02;
                    
                    // Update scroll progress (clamped between 0 and 1)
                    this.scrollProgress = Math.max(0, Math.min(1, this.scrollProgress + delta));
                    
                    // Update gem colors
                    this.updateGemHue(this.scrollProgress);
                }
            }, { passive: false });
        }
        
        // Handle info panel collapse
        const collapseBtn = document.getElementById('collapse-info-btn');
        const infoPanel = document.querySelector('.info-panel');
        
        if (collapseBtn && infoPanel) {
            collapseBtn.addEventListener('click', () => {
                infoPanel.classList.toggle('collapsed');
                // Change button text based on state
                collapseBtn.textContent = infoPanel.classList.contains('collapsed') ? '+' : '−';
            });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        this.controls.update();
        
        // Auto-rotate the model slightly
        if (this.model) {
            this.model.rotation.y += 0.001;
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if Three.js is loaded
    if (typeof THREE !== 'undefined') {
        const viewer = new ModelViewer();
    } else {
        console.error('Three.js library not loaded!');
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = 'Error: Three.js library not loaded';
            loadingText.style.color = '#ff006e';
        }
    }
});
