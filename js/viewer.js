/**
 * viewer.js - Three.js 3D Model Viewer
 * Handles scene setup, model loading, and user controls
 */

class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.lights = {};
        
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
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;
        
        // Main directional light - white light for brilliance
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
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
        
        // Fill light - cyan tone for iridescent color play
        const fillLight = new THREE.DirectionalLight(0x44ffff, 0.6);
        fillLight.position.set(-5, 3, -5);
        this.scene.add(fillLight);
        this.lights.fill = fillLight;
        
        // Back light - magenta for iridescent contrast
        const backLight = new THREE.DirectionalLight(0xff44ff, 0.5);
        backLight.position.set(0, -5, -5);
        this.scene.add(backLight);
        this.lights.back = backLight;
        
        // Hemisphere light for natural lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(hemiLight);
        this.lights.hemisphere = hemiLight;
        
        // Additional accent light for gemstone sparkle
        const accentLight = new THREE.PointLight(0xffaaff, 0.8, 50);
        accentLight.position.set(3, 0, 3);
        this.scene.add(accentLight);
        this.lights.accent = accentLight;
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
                
                // Apply iridescent gemstone materials to the model
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = new THREE.MeshPhysicalMaterial({
                            color: 0xffeeff,           // Very light pink-white base for maximum visibility
                            metalness: 0.4,            // Moderate metalness for reflective gemstone quality
                            roughness: 0.2,            // Low roughness for brilliant reflections
                            clearcoat: 1.0,            // Strong clearcoat for gem-like finish with brilliance
                            clearcoatRoughness: 0.15,  // Smooth clearcoat for shine
                            reflectivity: 1.0,         // Maximum reflectivity
                            envMapIntensity: 1.5,      // Environment reflections
                            emissive: 0x8844ff,        // Vibrant purple glow for iridescent effect
                            emissiveIntensity: 0.25    // Noticeable emission for gemstone glow
                        });
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.scene.add(object);
                
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
        
        // Create a stylized cube with edges
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffeeff,           // Very light pink-white base for maximum visibility
            metalness: 0.4,            // Moderate metalness for reflective gemstone quality
            roughness: 0.2,            // Low roughness for brilliant reflections
            clearcoat: 1.0,            // Strong clearcoat for gem-like finish with brilliance
            clearcoatRoughness: 0.15,  // Smooth clearcoat for shine
            reflectivity: 1.0,         // Maximum reflectivity
            envMapIntensity: 1.5,      // Environment reflections
            emissive: 0x8844ff,        // Vibrant purple glow for iridescent effect
            emissiveIntensity: 0.25    // Noticeable emission for gemstone glow
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = true;
        group.add(cube);
        
        // Add edges for better visibility with iridescent colors
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xcc99ff, linewidth: 2 });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        group.add(wireframe);
        
        // Add some smaller cubes around it
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const radius = 3;
            const smallGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const smallCube = new THREE.Mesh(smallGeo, material);
            smallCube.position.x = Math.cos(angle) * radius;
            smallCube.position.z = Math.sin(angle) * radius;
            smallCube.castShadow = true;
            group.add(smallCube);
            
            const smallEdges = new THREE.EdgesGeometry(smallGeo);
            const smallWireframe = new THREE.LineSegments(smallEdges, lineMaterial);
            smallWireframe.position.copy(smallCube.position);
            group.add(smallWireframe);
        }
        
        this.model = group;
        this.scene.add(group);
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
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
