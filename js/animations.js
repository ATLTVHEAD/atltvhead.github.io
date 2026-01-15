/**
 * Animations.js - Animation and Interaction Handlers
 * Handles model animations, transitions, and user interactions
 */

class AnimationController {
    constructor(scene, modelLoader) {
        this.scene = scene;
        this.modelLoader = modelLoader;
        this.clock = new THREE.Clock();
        this.currentSection = 'home';
        this.animations = {};
        
        this.init();
    }

    init() {
        this.setupSectionAnimations();
        this.setupModelInteractions();
        this.startAnimationLoop();
    }

    setupSectionAnimations() {
        // Observe sections for visibility
        const sections = document.querySelectorAll('.section');
        
        const observerOptions = {
            threshold: 0.3,
            rootMargin: '0px'
        };

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.onSectionChange(entry.target.id);
                }
            });
        }, observerOptions);

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    }

    onSectionChange(sectionId) {
        this.currentSection = sectionId;
        console.log('Section changed to:', sectionId);

        // Animate models based on current section
        switch(sectionId) {
            case 'home':
                this.animateHome();
                break;
            case 'about':
                this.animateAbout();
                break;
            case 'projects':
                this.animateProjects();
                break;
            case 'contact':
                this.animateContact();
                break;
        }
    }

    animateHome() {
        // Bring main model to center
        const mainModel = this.modelLoader.getModel('mainTorus');
        if (mainModel) {
            this.animateModelTo(mainModel.object, {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: 1.5,
                duration: 1000
            });
        }
    }

    animateAbout() {
        // Move main model to the side
        const mainModel = this.modelLoader.getModel('mainTorus');
        if (mainModel) {
            this.animateModelTo(mainModel.object, {
                position: { x: 2, y: 0, z: -2 },
                rotation: { x: 0.5, y: 0.5, z: 0 },
                scale: 1,
                duration: 1000
            });
        }
    }

    animateProjects() {
        // Animate main model
        const mainModel = this.modelLoader.getModel('mainTorus');
        if (mainModel) {
            this.animateModelTo(mainModel.object, {
                position: { x: -2, y: 1, z: -1 },
                rotation: { x: 0, y: 1, z: 0 },
                scale: 1,
                duration: 1000
            });
        }
    }

    animateContact() {
        // Move model to background
        const mainModel = this.modelLoader.getModel('mainTorus');
        if (mainModel) {
            this.animateModelTo(mainModel.object, {
                position: { x: 0, y: -1, z: -3 },
                rotation: { x: 0, y: 0, z: 0.5 },
                scale: 0.8,
                duration: 1000
            });
        }
    }

    /**
     * Animate a model to target properties
     * @param {THREE.Object3D} model - The model to animate
     * @param {Object} target - Target properties
     */
    animateModelTo(model, target) {
        if (!model) return;

        const startPos = { ...model.position };
        const startRot = { ...model.rotation };
        const startScale = model.scale.x;
        const startTime = Date.now();
        const duration = target.duration || 1000;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // Animate position
            if (target.position) {
                model.position.x = startPos.x + (target.position.x - startPos.x) * eased;
                model.position.y = startPos.y + (target.position.y - startPos.y) * eased;
                model.position.z = startPos.z + (target.position.z - startPos.z) * eased;
            }

            // Animate rotation
            if (target.rotation) {
                model.rotation.x = startRot.x + (target.rotation.x - startRot.x) * eased;
                model.rotation.y = startRot.y + (target.rotation.y - startRot.y) * eased;
                model.rotation.z = startRot.z + (target.rotation.z - startRot.z) * eased;
            }

            // Animate scale
            if (target.scale) {
                const scale = startScale + (target.scale - startScale) * eased;
                model.scale.set(scale, scale, scale);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    setupModelInteractions() {
        // Add hover effects to models
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        window.addEventListener('mousemove', (event) => {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, this.scene.getCamera());

            // Check for intersections with models
            const models = Object.values(this.modelLoader.models).map(m => m.object);
            const intersects = raycaster.intersectObjects(models, true);

            if (intersects.length > 0) {
                document.body.style.cursor = 'pointer';
            } else {
                document.body.style.cursor = 'default';
            }
        });
    }

    /**
     * Create floating animation for a model
     * @param {string} modelName - Name of the model
     * @param {Object} options - Animation options
     */
    createFloatingAnimation(modelName, options = {}) {
        const model = this.modelLoader.getModel(modelName);
        if (!model) return;

        const amplitude = options.amplitude || 0.3;
        const speed = options.speed || 1;
        const initialY = model.object.position.y;

        this.animations[modelName] = {
            type: 'floating',
            model: model.object,
            update: (time) => {
                model.object.position.y = initialY + Math.sin(time * speed) * amplitude;
            }
        };
    }

    /**
     * Create rotation animation for a model
     * @param {string} modelName - Name of the model
     * @param {Object} options - Animation options
     */
    createRotationAnimation(modelName, options = {}) {
        const model = this.modelLoader.getModel(modelName);
        if (!model) return;

        const speed = options.speed || { x: 0.001, y: 0.002, z: 0 };

        this.animations[modelName] = {
            type: 'rotation',
            model: model.object,
            update: () => {
                model.object.rotation.x += speed.x;
                model.object.rotation.y += speed.y;
                model.object.rotation.z += speed.z;
            }
        };
    }

    startAnimationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);

            const delta = this.clock.getDelta();
            const elapsed = this.clock.getElapsedTime();

            // Update model loader animations
            if (this.modelLoader) {
                this.modelLoader.updateAnimations(delta);
            }

            // Update custom animations
            Object.values(this.animations).forEach(animation => {
                if (animation.update) {
                    animation.update(elapsed);
                }
            });
        };

        animate();
    }

    /**
     * Remove animation from a model
     * @param {string} modelName - Name of the model
     */
    removeAnimation(modelName) {
        delete this.animations[modelName];
    }
}

// Initialize animation controller when models are loaded
let animationController;
if (typeof threeScene !== 'undefined' && typeof modelLoader !== 'undefined') {
    animationController = new AnimationController(threeScene, modelLoader);
    
    // Add some default animations
    animationController.createFloatingAnimation('mainTorus', {
        amplitude: 0.2,
        speed: 0.8
    });
    
    animationController.createRotationAnimation('mainTorus', {
        speed: { x: 0.002, y: 0.005, z: 0.001 }
    });
}
