// 🍎 Apple-Quality Animation Utilities
// FLIP Animation System for Smooth Split Operations

/**
 * Capture current positions and sizes of all elements
 * @param {NodeList|Array} elements - Elements to capture
 * @returns {Map} Map of element -> DOMRect
 */
function captureRects(elements) {
    const rects = new Map();
    elements.forEach((el, index) => {
        if (el && el.getBoundingClientRect) {
            rects.set(index, el.getBoundingClientRect());
        }
    });
    return rects;
}

/**
 * FLIP Animation (First, Last, Invert, Play)
 * Animates element from firstRect to lastRect smoothly
 * 
 * @param {HTMLElement} element - Element to animate
 * @param {DOMRect} firstRect - Initial position/size
 * @param {DOMRect} lastRect - Final position/size  
 * @param {Object} options - Animation options
 * @returns {Promise} Resolves when animation completes
 */
function flipAnimate(element, firstRect, lastRect, options = {}) {
    return new Promise((resolve) => {
        const {
            duration = 300,
            easing = 'cubic-bezier(0.2, 0, 0.2, 1)', // Apple-style easing
            onComplete = null
        } = options;

        // Calculate deltas
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;
        const scaleX = firstRect.width / lastRect.width;
        const scaleY = firstRect.height / lastRect.height;

        // Prepare for animation
        element.style.willChange = 'transform';
        element.style.transformOrigin = 'center center';
        
        // Apply inverted transform (First state)
        element.style.transition = 'none';
        element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;

        // Force reflow
        element.offsetHeight;

        // Animate to final state (Play)
        element.style.transition = `transform ${duration}ms ${easing}`;
        element.style.transform = 'none';

        // Cleanup after animation
        const cleanup = () => {
            element.style.willChange = 'auto';
            element.style.transition = '';
            element.style.transform = '';
            element.style.transformOrigin = '';
            if (onComplete) onComplete();
            resolve();
        };

        setTimeout(cleanup, duration);
    });
}

/**
 * Batch FLIP animation for multiple elements
 * @param {Array} elements - Array of {element, firstRect, lastRect}
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
function flipAnimateBatch(elements, options = {}) {
    const promises = elements.map(({ element, firstRect, lastRect }) => 
        flipAnimate(element, firstRect, lastRect, options)
    );
    return Promise.all(promises);
}

/**
 * Smooth fade animation
 * @param {HTMLElement} element 
 * @param {string} direction - 'in' or 'out'
 * @param {Object} options
 */
function fadeAnimate(element, direction = 'in', options = {}) {
    return new Promise((resolve) => {
        const {
            duration = 200,
            easing = 'ease-out'
        } = options;

        const startOpacity = direction === 'in' ? 0 : 1;
        const endOpacity = direction === 'in' ? 1 : 0;
        const startScale = direction === 'in' ? 0.95 : 1;
        const endScale = direction === 'in' ? 1 : 0.95;

        element.style.opacity = startOpacity;
        element.style.transform = `scale(${startScale})`;
        element.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;

        requestAnimationFrame(() => {
            element.style.opacity = endOpacity;
            element.style.transform = `scale(${endScale})`;
        });

        setTimeout(() => {
            element.style.transition = '';
            element.style.transform = '';
            if (direction === 'out') {
                element.style.opacity = '0';
            }
            resolve();
        }, duration);
    });
}

/**
 * Smooth resize animation using CSS transitions
 * @param {HTMLElement} element
 * @param {string} newFlex - New flex value
 * @param {Object} options
 */
function resizeAnimate(element, newFlex, options = {}) {
    return new Promise((resolve) => {
        const { duration = 300 } = options;
        
        element.style.willChange = 'flex';
        element.style.transition = `flex ${duration}ms cubic-bezier(0.2, 0, 0.2, 1)`;
        element.style.flex = newFlex;

        setTimeout(() => {
            element.style.willChange = 'auto';
            element.style.transition = '';
            resolve();
        }, duration);
    });
}

/**
 * Throttle function for performance
 * @param {Function} func
 * @param {number} limit
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * RAF throttle untuk smooth animations
 * @param {Function} callback
 */
function rafThrottle(callback) {
    let ticking = false;
    return function(...args) {
        if (!ticking) {
            requestAnimationFrame(() => {
                callback.apply(this, args);
                ticking = false;
            });
            ticking = true;
        }
    };
}

// Export untuk module atau global
typeof module !== 'undefined' && module.exports ? module.exports = {
    captureRects,
    flipAnimate,
    flipAnimateBatch,
    fadeAnimate,
    resizeAnimate,
    throttle,
    rafThrottle
} : Object.assign(window, {
    captureRects,
    flipAnimate,
    flipAnimateBatch,
    fadeAnimate,
    resizeAnimate,
    throttle,
    rafThrottle
});
