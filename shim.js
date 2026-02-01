// Fullscreen Shim for FalcoraOS
// This script runs BEFORE any page content loads in the Webview.

console.log('Falcora Shim: Loaded');

// 1. Inject CSS for fake fullscreen
const css = `
.falcora-fixed-fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: black !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
}
`;

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

// 2. Override Fullscreen API
function overrideFullscreen() {
    console.log('Falcora Shim: Overriding API');

    let currentFullscreenElement = null;

    // Mock document.fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', {
        get: () => currentFullscreenElement,
        configurable: true
    });

    // Also mock webkitFullscreenElement
    Object.defineProperty(document, 'webkitFullscreenElement', {
        get: () => currentFullscreenElement,
        configurable: true
    });

    // Mock requestFullscreen
    const requestFullscreenMock = function () {
        console.log('Falcora Shim: Request Fullscreen Intercepted on', this);
        this.classList.add('falcora-fixed-fullscreen');
        currentFullscreenElement = this;

        // Dispatch events to trick YouTube
        document.dispatchEvent(new Event('fullscreenchange'));
        document.dispatchEvent(new Event('webkitfullscreenchange'));

        // Trigger generic resize event to force player layout update
        window.dispatchEvent(new Event('resize'));

        return Promise.resolve();
    };

    try {
        Object.defineProperty(Element.prototype, 'requestFullscreen', {
            value: requestFullscreenMock,
            writable: false,
            configurable: false
        });
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', {
            value: requestFullscreenMock,
            writable: false,
            configurable: false
        });
    } catch (err) {
        console.error('Falcora Shim: Failed to lock API', err);
        Element.prototype.requestFullscreen = requestFullscreenMock;
    }

    // Mock exitFullscreen
    document.exitFullscreen = function () {
        console.log('Falcora Shim: Exit Fullscreen Intercepted');
        if (currentFullscreenElement) {
            currentFullscreenElement.classList.remove('falcora-fixed-fullscreen');
            currentFullscreenElement = null;
        }

        document.dispatchEvent(new Event('fullscreenchange'));
        document.dispatchEvent(new Event('webkitfullscreenchange'));
        window.dispatchEvent(new Event('resize'));

        return Promise.resolve();
    };

    // Aliases
    document.webkitExitFullscreen = document.exitFullscreen;
    // Element.prototype.webkitRequestFullscreen handled above via defineProperty

    // Flag for YouTube detection
    // Some players check if fullscreen is enabled
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, writable: false });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: true, writable: false });
}

// Execute immediately
try {
    overrideFullscreen();
    // Inject styles immediately if head exists, otherwise wait
    if (document.head) {
        injectStyles();
    } else {
        const observer = new MutationObserver(() => {
            if (document.head) {
                injectStyles();
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }
} catch (e) {
    console.error('Falcora Shim Error:', e);
}
