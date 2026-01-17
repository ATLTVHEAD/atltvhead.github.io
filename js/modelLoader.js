/**
 * ModelLoader.js - 3D Model Loading and Management
 * Handles loading GLTF/GLB models and managing them in the scene
 */

class ModelLoader {
    constructor(scene) {
        this.scene = scene;
        this.loader = null;
        this.models = {};
        this.loadingManager = new THREE.LoadingManager();
        
        this.setupLoadingManager();
        this.initLoader();
    }

    setupLoadingManager() {
        const progressBar = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const loadingScreen = document.getElementById('loading-screen');

        let itemsLoaded = 0;
        let itemsTotal = 0;

        this.loadingManager.onStart = (url, loaded, total) => {
            itemsTotal = total;
            console.log(`Started loading: ${url}`);
        };

        this.loadingManager.onProgress = (url, loaded, total) => {
            itemsLoaded = loaded;
            const progress = (loaded / total) * 100;
            
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
            if (progressText) {
                progressText.textContent = Math.round(progress) + '%';
            }
            
            console.log(`Loading: ${Math.round(progress)}%`);
        };

        this.loadingManager.onLoad = () => {
            console.log('All assets loaded');
            
            // Hide loading screen after a short delay
            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.classList.add('fade-out');
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }
            }, 500);
        };

        this.loadingManager.onError = (url) => {
            console.error(`Error loading: ${url}`);
        };
    }

    initLoader() {
        // Initialize GLTF Loader if available
        if (typeof THREE.GLTFLoader !== 'undefined') {
            this.loader = new THREE.GLTFLoader(this.loadingManager);
        } else {
            console.warn('GLTFLoader not available. Make sure to include it in your HTML.');
            // Hide loading screen if no models to load
            this.loadingManager.onLoad();
        }
    }

    /**
     * Load a GLTF/GLB model
     * @param {string} path - Path to the model file
     * @param {string} name - Name to reference the model
     * @param {Object} options - Optional configuration (position, scale, rotation)
     */
    loadModel(path, name, options = {}) {
        if (!this.loader) {
            console.error('GLTF Loader not initialized');
            return Promise.reject('GLTF Loader not available');
        }

        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Apply options
                    if (options.position) {
                        model.position.set(
                            options.position.x || 0,
                            options.position.y || 0,
                            options.position.z || 0
                        );
                    }
                    
                    if (options.scale) {
                        const scale = options.scale;
                        model.scale.set(scale, scale, scale);
                    }
                    
                    if (options.rotation) {
                        model.rotation.set(
                            options.rotation.x || 0,
                            options.rotation.y || 0,
                            options.rotation.z || 0
                        );
                    }

                    // Add to scene
                    this.scene.addObject(model);
                    
                    // Store reference
                    this.models[name] = {
                        object: model,
                        animations: gltf.animations,
                        mixer: null
                    };

                    // Setup animations if available
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.models[name].mixer = new THREE.AnimationMixer(model);
                        gltf.animations.forEach((clip) => {
                            this.models[name].mixer.clipAction(clip).play();
                        });
                    }

                    console.log(`Model "${name}" loaded successfully`);
                    resolve(model);
                },
                (progress) => {
                    const percentComplete = (progress.loaded / progress.total) * 100;
                    console.log(`${name}: ${Math.round(percentComplete)}%`);
                },
                (error) => {
                    console.error(`Error loading model "${name}":`, error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Create a simple geometric object (fallback when no models available)
     * @param {string} type - Type of geometry (box, sphere, torus, etc.)
     * @param {string} name - Name to reference the object
     * @param {Object} options - Configuration options
     */
    createGeometry(type, name, options = {}) {
        let geometry;
        
        switch(type) {
            case 'box':
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(1, 32, 32);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(1, 2, 32);
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        const material = new THREE.MeshStandardMaterial({
            color: options.color || 0x00ff88,
            metalness: options.metalness || 0.7,
            roughness: options.roughness || 0.2,
            wireframe: options.wireframe || false
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Apply options
        if (options.position) {
            mesh.position.set(
                options.position.x || 0,
                options.position.y || 0,
                options.position.z || 0
            );
        }

        if (options.scale) {
            mesh.scale.set(options.scale, options.scale, options.scale);
        }

        if (options.rotation) {
            mesh.rotation.set(
                options.rotation.x || 0,
                options.rotation.y || 0,
                options.rotation.z || 0
            );
        }

        this.scene.addObject(mesh);
        this.models[name] = { object: mesh };

        return mesh;
    }

    /**
     * Get a loaded model by name
     * @param {string} name - Name of the model
     */
    getModel(name) {
        return this.models[name] || null;
    }

    /**
     * Remove a model from the scene
     * @param {string} name - Name of the model to remove
     */
    removeModel(name) {
        if (this.models[name]) {
            this.scene.removeObject(this.models[name].object);
            delete this.models[name];
        }
    }

    /**
     * Update animations (call in animation loop)
     * @param {number} deltaTime - Time since last frame
     */
    updateAnimations(deltaTime) {
        Object.values(this.models).forEach(model => {
            if (model.mixer) {
                model.mixer.update(deltaTime);
            }
        });
    }
}

// Example usage:
// When scene is ready, create model loader
let modelLoader;
if (typeof threeScene !== 'undefined') {
    modelLoader = new ModelLoader(threeScene);
    
    // Example: Create some geometric objects as placeholders
    // These can be replaced with actual 3D models later
    modelLoader.createGeometry('torus', 'mainTorus', {
        position: { x: 0, y: 0, z: 0 },
        scale: 1.5,
        color: 0x00ff88,
        metalness: 0.8,
        roughness: 0.2
    });

    // You can load GLTF models like this:
    // modelLoader.loadModel('models/mymodel.glb', 'myModel', {
    //     position: { x: 0, y: 0, z: 0 },
    //     scale: 1
    // });
}
