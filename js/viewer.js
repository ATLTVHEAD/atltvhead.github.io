/**
 * viewer.js - Three.js 3D Model Viewer
 * Handles scene setup, model loading, and user controls
 * Features thin-film iridescence effect with scroll-based thickness adjustment
 */

class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.lights = {};
        this.iridescenceMaterials = []; // Store references to materials with iridescence
        this.filmThickness = 380; // Default film thickness in nanometers (200-1000)
        
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
     * Create an iridescent material using thin-film interference
     * @param {number} thickness - Film thickness in nanometers
     * @returns {THREE.MeshPhysicalMaterial}
     */
    createIridescenceMaterial(thickness = 380) {
        // Create the thin-film fresnel map
        const fresnelMap = new ThinFilmFresnelMap(thickness, 2.0, 3.0, 64);
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.0
        });
        
        // Store the fresnel map for later updates
        material.userData.fresnelMap = fresnelMap;
        
        // Override the material's onBeforeCompile to inject custom shader code
        material.onBeforeCompile = function(shader) {
            // Add uniform for the fresnel map
            shader.uniforms.thinFilmFresnelMap = { value: fresnelMap };
            
            // Add to fragment shader - define uniform and varying
            shader.fragmentShader = shader.fragmentShader.replace(
                'uniform float roughness;',
                `uniform float roughness;
                uniform sampler2D thinFilmFresnelMap;`
            );
            
            // Apply iridescence effect by modifying the final color
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                `
                // Calculate iridescence based on view angle
                vec3 viewDir = normalize(vViewPosition);
                vec3 worldNormal = normalize(vNormal);
                float cosTheta = max(abs(dot(worldNormal, viewDir)), 0.0);
                vec3 fresnelColor = texture2D(thinFilmFresnelMap, vec2(cosTheta, 0.5)).rgb;
                
                // Gamma correct (texture is in gamma 2.0)
                fresnelColor = fresnelColor * fresnelColor;
                
                // Apply iridescence to the diffuse color
                outgoingLight = outgoingLight * fresnelColor * 2.0;
                
                #include <opaque_fragment>
                `
            );
            
            material.userData.shader = shader;
        };
        
        // Store reference for thickness updates
        this.iridescenceMaterials.push(material);
        
        return material;
    }

    /**
     * Update all iridescent materials with new film thickness
     * @param {number} thickness - Film thickness in nanometers (200-1000)
     */
    updateFilmThickness(thickness) {
        this.filmThickness = thickness;
        
        this.iridescenceMaterials.forEach(material => {
            const fresnelMap = material.userData.fresnelMap;
            if (fresnelMap) {
                fresnelMap.filmThickness = thickness;
            }
        });
        
        // Update thickness indicator
        this.updateThicknessIndicator(thickness);
    }

    /**
     * Update the thickness indicator UI
     * @param {number} thickness - Film thickness in nanometers
     */
    updateThicknessIndicator(thickness) {
        const indicator = document.getElementById('gem-state-indicator');
        if (indicator) {
            indicator.textContent = `${Math.round(thickness)}nm`;
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
                
                // Apply iridescence material to all meshes
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = this.createIridescenceMaterial(this.filmThickness);
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.scene.add(object);
                
                // Initialize thickness indicator
                this.updateThicknessIndicator(this.filmThickness);
                
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
        
        // Create a stylized iridescent icosahedron
        const geometry = new THREE.IcosahedronGeometry(1.5, 0);
        const material = this.createIridescenceMaterial(this.filmThickness);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        
        // Add some smaller iridescent objects around it
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const radius = 3;
            const smallGeo = new THREE.OctahedronGeometry(0.4, 0);
            const smallMesh = new THREE.Mesh(smallGeo, this.createIridescenceMaterial(this.filmThickness));
            smallMesh.position.x = Math.cos(angle) * radius;
            smallMesh.position.z = Math.sin(angle) * radius;
            smallMesh.castShadow = true;
            group.add(smallMesh);
        }
        
        this.model = group;
        this.scene.add(group);
        
        // Initialize thickness indicator
        this.updateThicknessIndicator(this.filmThickness);
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Handle scroll/wheel for film thickness adjustment
        // Using wheel event on the canvas container for better control
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.addEventListener('wheel', (e) => {
                // Only change thickness when Shift key is held
                if (e.shiftKey) {
                    e.preventDefault();
                    
                    // Calculate scroll delta
                    // Film thickness range: 200nm to 1000nm
                    const delta = e.deltaY > 0 ? 20 : -20;
                    
                    // Update film thickness (clamped between 200 and 1000)
                    this.filmThickness = Math.max(200, Math.min(1000, this.filmThickness + delta));
                    
                    // Update materials with new thickness
                    this.updateFilmThickness(this.filmThickness);
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
