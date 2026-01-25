/**
 * Progressive Image Loader
 * Implements lazy loading with blur-up effect for portfolio images
 */

class ProgressiveImageLoader {
    constructor() {
        this.images = [];
        this.observer = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupImages());
        } else {
            this.setupImages();
        }
    }

    setupImages() {
        // Find all images with data-src attribute
        this.images = document.querySelectorAll('img[data-src]');
        
        if (this.images.length === 0) {
            return;
        }

        // Use Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.setupIntersectionObserver();
        } else {
            // Fallback for older browsers - load all images
            this.loadAllImages();
        }
    }

    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '50px', // Start loading 50px before image enters viewport
            threshold: 0.01
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, options);

        this.images.forEach(img => this.observer.observe(img));
    }

    loadImage(img) {
        const fullSrc = img.dataset.src;
        
        // Create a new image to preload
        const tempImg = new Image();
        
        tempImg.onload = () => {
            // Once loaded, update the src and remove blur
            img.src = fullSrc;
            img.classList.add('loaded');
            
            // Clean up
            img.removeAttribute('data-src');
        };

        tempImg.onerror = () => {
            // If image fails to load, trigger the onerror handler if it exists
            if (img.onerror) {
                img.onerror();
            }
        };

        // Start loading the full-resolution image
        tempImg.src = fullSrc;
    }

    loadAllImages() {
        // Fallback for browsers without Intersection Observer
        this.images.forEach(img => this.loadImage(img));
    }
}

// Initialize the loader when script loads
new ProgressiveImageLoader();
