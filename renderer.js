// 🍎 FalcoraOS - Apple-Quality Split Screen System
// Features: FLIP animations, Smooth resize, Snap-to-grid, Hardware acceleration

const { animate, spring, tween, easing } = window.popmotion || popmotion;

// ==================== TAB SYSTEM ====================

class TabSystem {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
    }

    createTab() {
        const tabId = 'tab-' + Date.now() + '-' + ++this.tabCounter;

        const newTab = {
            id: tabId,
            splitState: new SplitState(),
            webviewCache: new WebviewCache()
        };

        // Add initial view
        newTab.splitState.addView();

        this.tabs.push(newTab);
        this.activeTabId = tabId;

        return newTab;
    }

    switchTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return null;

        this.activeTabId = tabId;
        return tab;
    }

    closeTab(tabId) {
        const index = this.tabs.findIndex(t => t.id === tabId);
        if (index === -1 || this.tabs.length <= 1) return false;

        // Cleanup webviews
        this.tabs[index].webviewCache.clear();

        this.tabs.splice(index, 1);

        // Switch to another tab
        if (this.activeTabId === tabId) {
            const newIndex = Math.min(index, this.tabs.length - 1);
            this.activeTabId = this.tabs[newIndex].id;
        }

        return true;
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }

    getActiveSplitState() {
        const tab = this.getActiveTab();
        return tab ? tab.splitState : null;
    }

    getActiveWebviewCache() {
        const tab = this.getActiveTab();
        return tab ? tab.webviewCache : null;
    }
}

// ==================== SPLIT STATE MANAGEMENT ====================

class SplitState {
    constructor() {
        this.views = []; // Max 4 views
        this.activeViewId = null;
        this.viewCounter = 0;
    }

    addView(url = null) {
        if (this.views.length >= 4) return null;

        const newView = {
            id: `view-${++this.viewCounter}`,
            url: url,
            title: url ? 'Loading...' : 'New Tab',
            flexBasis: this.calculateNewFlexBasis()
        };

        this.views.push(newView);
        this.rebalanceFlexBasis();

        if (!this.activeViewId) {
            this.activeViewId = newView.id;
        }

        return newView;
    }

    removeView(viewId) {
        const index = this.views.findIndex(v => v.id === viewId);
        if (index === -1 || this.views.length <= 1) return false;

        this.views.splice(index, 1);
        this.rebalanceFlexBasis();

        // Update active view
        if (this.activeViewId === viewId) {
            const newIndex = Math.min(index, this.views.length - 1);
            this.activeViewId = this.views[newIndex]?.id || null;
        }

        return true;
    }

    resizeView(viewId, newFlexBasis) {
        const view = this.views.find(v => v.id === viewId);
        if (!view) return false;

        view.flexBasis = Math.max(10, Math.min(80, newFlexBasis));
        return true;
    }

    setActiveView(viewId) {
        if (this.views.find(v => v.id === viewId)) {
            this.activeViewId = viewId;
            return true;
        }
        return false;
    }

    calculateNewFlexBasis() {
        const count = this.views.length + 1;
        return 100 / count;
    }

    rebalanceFlexBasis() {
        const count = this.views.length;
        if (count === 0) return;

        const equalBasis = 100 / count;
        this.views.forEach(view => {
            view.flexBasis = equalBasis;
        });
    }

    getSnapPoints() {
        const count = this.views.length;
        switch (count) {
            case 2: return [50];
            case 3: return [33.33, 66.66];
            case 4: return [25, 50, 75];
            default: return [];
        }
    }

    getViewIndex(viewId) {
        return this.views.findIndex(v => v.id === viewId);
    }
}

// ==================== WEBVIEW CACHE ====================

class WebviewCache {
    constructor(maxSize = 8) {
        this.cache = new Map();
        this.maxSize = maxSize; // Maximum cached webviews
        this.accessOrder = []; // LRU tracking
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            created: 0
        };

        // Memory pressure handling
        this.setupMemoryPressureHandler();
    }

    get(viewId, url) {
        let entry = this.cache.get(viewId);

        if (entry) {
            // Cache hit - update access order
            this.updateAccessOrder(viewId);
            this.stats.hits++;
            console.log(`Cache HIT for ${viewId} (hits: ${this.stats.hits}, misses: ${this.stats.misses})`);
        } else if (url) {
            // Cache miss - create new
            this.stats.misses++;
            console.log(`Cache MISS for ${viewId} - creating new webview`);

            // Evict oldest if at capacity
            if (this.cache.size >= this.maxSize) {
                this.evictLRU();
            }

            entry = this.createWebview(url, viewId);
            this.cache.set(viewId, entry);
            this.accessOrder.push(viewId);
            this.stats.created++;
        }

        return entry;
    }

    updateAccessOrder(viewId) {
        const index = this.accessOrder.indexOf(viewId);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(viewId);
    }

    evictLRU() {
        if (this.accessOrder.length === 0) return;

        const oldestViewId = this.accessOrder.shift();
        const webview = this.cache.get(oldestViewId);

        if (webview) {
            console.log(`Evicting LRU webview: ${oldestViewId}`);

            // Only evict if not currently visible
            if (!webview.parentElement) {
                this.performCleanup(oldestViewId, webview);
                this.stats.evictions++;
            } else {
                // Put it back if still in use
                this.accessOrder.push(oldestViewId);
            }
        }
    }

    performCleanup(viewId, webview) {
        try {
            // Only stop if webview is attached to DOM and ready
            if (webview.stop && webview.parentElement) {
                try {
                    webview.stop();
                } catch (stopError) {
                    // Ignore stop errors - webview might not be ready
                    console.log(`Could not stop webview ${viewId}:`, stopError.message);
                }
            }

            // Clear src to release resources (safe operation)
            try {
                webview.src = 'about:blank';
            } catch (srcError) {
                console.log(`Could not clear src for webview ${viewId}:`, srcError.message);
            }

            // Remove from cache
            this.cache.delete(viewId);

            // Remove from DOM if still attached
            if (webview.parentElement) {
                try {
                    webview.parentElement.removeChild(webview);
                } catch (domError) {
                    console.log(`Could not remove webview ${viewId} from DOM:`, domError.message);
                }
            }

            console.log(`Cleaned up webview: ${viewId}`);
        } catch (e) {
            console.error(`Error cleaning up webview ${viewId}:`, e);
        }
    }

    setupMemoryPressureHandler() {
        // Listen for memory pressure events if available
        if (typeof process !== 'undefined' && process.memoryUsage) {
            setInterval(() => {
                const usage = process.memoryUsage();
                const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
                const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

                console.log(`Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (RSS: ${Math.round(usage.rss / 1024 / 1024)}MB)`);

                // Aggressive cleanup if memory usage is high (>500MB)
                if (heapUsedMB > 500) {
                    console.warn('High memory usage detected - performing aggressive cleanup');
                    this.aggressiveCleanup();
                }
            }, 30000); // Check every 30 seconds
        }
    }

    aggressiveCleanup() {
        // Keep only visible webviews
        const visibleViewIds = [];

        this.cache.forEach((webview, viewId) => {
            if (webview.parentElement) {
                visibleViewIds.push(viewId);
            }
        });

        console.log(`Aggressive cleanup: keeping ${visibleViewIds.length} visible webviews`);

        // Remove all non-visible webviews
        this.cache.forEach((webview, viewId) => {
            if (!visibleViewIds.includes(viewId)) {
                this.performCleanup(viewId, webview);
                this.stats.evictions++;
            }
        });

        // Update access order
        this.accessOrder = visibleViewIds;

        // Trigger garbage collection hint
        if (global.gc) {
            console.log('Triggering garbage collection');
            global.gc();
        }
    }

    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }

    createWebview(url, viewId) {
        console.log('Creating webview for:', url, 'viewId:', viewId);

        const wv = document.createElement('webview');

        // 1. Set ID and Styles
        wv.dataset.viewId = viewId;
        // Set dark background to prevent white flash
        wv.style.cssText = 'width: 100%; height: 100%; border: none; background: #0B0B12 !important;';

        // 2. Set Attributes (Must be BEFORE navigation)
        // Enable node integration if needed
        wv.setAttribute('nodeintegration', 'false');
        wv.setAttribute('webpreferences', 'contextIsolation=false, allowRunningInsecureContent=yes');
        wv.setAttribute('allowfullscreen', 'true'); // Required for API presence, which we override

        // 3. Set Preload (Manual Injection Strategy)
        // We do NOT use setAttribute('preload') because it is proving flaky with local paths.
        // Instead, we inject the content directly on load.

        // 4. Attach Listeners
        // Set background color before page loads
        wv.addEventListener('did-start-loading', () => {
            console.log('did-start-loading for:', viewId);
            wv.style.background = '#0B0B12';
        });

        wv.addEventListener('dom-ready', () => {
            console.log('Webview dom-ready for:', viewId);

            // Inject Shim Content
            if (window.electronAPI && window.electronAPI.shimContent) {
                console.log('Injecting Shim Content...');
                wv.executeJavaScript(window.electronAPI.shimContent)
                    .then(() => console.log('Shim Injected Successfully'))
                    .catch(e => console.error('Shim Injection Failed:', e));
            } else {
                console.error('CRITICAL: Shim content missing');
            }
        });

        // Forward console logs from guest to host for debugging
        wv.addEventListener('console-message', (e) => {
            console.log(`[Guest ${viewId}]:`, e.message);
        });

        wv.addEventListener('did-stop-loading', () => {
            console.log('did-stop-loading for:', viewId);
            wv.style.background = 'transparent';
        });

        // 5. Trigger Navigation (LAST)
        wv.src = url;

        // Inject custom scrollbar
        const scrollbarCSS = `
            ::-webkit-scrollbar { width: 3px !important; height: 3px !important; }
            ::-webkit-scrollbar-track { background: transparent !important; }
            ::-webkit-scrollbar-thumb { background: #000 !important; border-radius: 0 !important; }
            * { scrollbar-width: thin !important; scrollbar-color: #000 transparent !important; }
        `;

        wv.addEventListener('dom-ready', () => {
            console.log('Webview dom-ready for:', viewId);
            try {
                wv.insertCSS(scrollbarCSS);
            } catch (e) {
                console.error('Error inserting CSS:', e);
            }
        });

        wv.addEventListener('did-navigate', (e) => {
            console.log('Webview navigated to:', e.url);
            const tab = tabSystem.getActiveTab();
            if (tab) {
                const view = tab.splitState.views.find(v => v.id === viewId);
                if (view) {
                    view.url = e.url;
                    if (tab.splitState.activeViewId === viewId) {
                        const urlInput = document.getElementById('url-input');
                        if (urlInput) urlInput.value = e.url;
                    }
                }
                // Update tab icon
                updateTabIcon(tab.id, e.url);
            }
            setTimeout(() => {
                try { wv.insertCSS(scrollbarCSS); } catch (e) { }
            }, 100);
        });

        wv.addEventListener('did-fail-load', (e) => {
            console.error('Webview failed to load:', e);

            // Only handle main frame errors, not sub-resources
            if (e.isMainFrame) {
                const errorMessages = {
                    '-2': 'Internet connection error. Please check your connection.',
                    '-3': 'The website could not be found.',
                    '-6': 'Connection was reset. Please try again.',
                    '-7': 'Connection timed out. The site is taking too long to respond.',
                    '-8': 'Connection was closed unexpectedly.',
                    '-9': 'Could not connect to the server.',
                    '-10': 'The server refused the connection.',
                    '-11': 'Server address could not be resolved.',
                    '-12': 'Invalid server address.',
                    '-13': 'Too many redirects.',
                    '-14': 'SSL protocol error. Secure connection failed.',
                    '-15': 'SSL handshake failed. The site\'s certificate is not trusted.',
                    '-21': 'The connection was blocked by a network firewall.',
                    '-23': 'This website requires authentication.',
                    '-24': 'Could not retrieve proxy settings.',
                    '-25': 'Proxy connection failed.',
                    '-26': 'Proxy authorization required.',
                    '-27': 'Content was blocked by your security settings.',
                    '-28': 'SSL client authentication required.',
                    '-29': 'The server responded with invalid content.',
                    '-30': 'The server responded unexpectedly.',
                    '-31': 'The request was blocked by security policy.',
                    '-100': 'The page could not be loaded. Please check your connection.'
                };

                const errorCode = e.errorCode || -100;
                const errorMessage = errorMessages[errorCode] || `Failed to load page (Error ${errorCode})`;

                // Show notification
                showNotification('Failed to load page: ' + errorMessage);

                // Show error overlay in the webview
                const errorScript = `
                    (function() {
                        const errorDiv = document.createElement('div');
                        errorDiv.id = 'falcora-error-page';
                        errorDiv.innerHTML = '<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0B0B12; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: sans-serif; z-index: 999999; padding: 20px; box-sizing: border-box;">' +
                            '<div style="width: 60px; height: 60px; border: 3px solid rgba(168, 85, 247, 0.2); border-top-color: #A855F7; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>' +
                            '<h2 style="color: #fff; font-size: 24px; margin: 0 0 10px 0; font-weight: 500;">Failed to Load</h2>' +
                            '<p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 30px 0; text-align: center; max-width: 400px; line-height: 1.5;">' + ${JSON.stringify(errorMessage)} + '</p>' +
                            '<div style="display: flex; gap: 10px;">' +
                                '<button id="falcora-retry-btn" style="padding: 10px 24px; background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); color: #A855F7; border-radius: 8px; cursor: pointer; font-size: 14px;">Retry</button>' +
                                '<button id="falcora-back-btn" style="padding: 10px 24px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); border-radius: 8px; cursor: pointer; font-size: 14px;">Go Back</button>' +
                            '</div>' +
                        '</div>' +
                        '<style>@keyframes spin { to { transform: rotate(360deg); } }</style>';
                        
                        document.body.innerHTML = '';
                        document.body.appendChild(errorDiv);
                        
                        document.getElementById('falcora-retry-btn').onclick = function() {
                            window.location.reload();
                        };
                        
                        document.getElementById('falcora-back-btn').onclick = function() {
                            if (window.history.length > 1) {
                                window.history.back();
                            } else {
                                window.location.href = 'about:blank';
                            }
                        };
                    })();
                `;

                wv.executeJavaScript(errorScript).catch(err => {
                    console.error('Error showing error page:', err);
                });
            }
        });

        wv.addEventListener('console-message', (e) => {
            console.log('Webview console:', e.message);
        });

        // Keyboard Shortcuts for Webview
        wv.addEventListener('before-input-event', (event, input) => {
            if (input.type !== 'keyDown') return;

            console.log('Webview Key Event:', input.key, 'Alt:', input.alt, 'Ctrl:', input.control);

            // Back: Alt + Left
            if (input.key === 'ArrowLeft' && input.alt) {
                console.log('Shortcut Triggered: Back');
                if (wv.canGoBack()) {
                    wv.goBack();
                    event.preventDefault();
                } else {
                    console.log('Cannot go back');
                }
            }
            // Forward: Alt + Right
            else if (input.key === 'ArrowRight' && input.alt) {
                console.log('Shortcut Triggered: Forward');
                if (wv.canGoForward()) {
                    wv.goForward();
                    event.preventDefault();
                } else {
                    console.log('Cannot go forward');
                }
            }
            // Quit: Ctrl + Q
            else if ((input.key === 'q' || input.key === 'Q') && input.control) {
                console.log('Shortcut Triggered: Quit');
                window.electronAPI.quitApp();
                event.preventDefault();
            }
        });

        return wv;
    }

    remove(viewId) {
        const entry = this.cache.get(viewId);
        if (entry) {
            this.performCleanup(viewId, entry);

            // Remove from access order
            const index = this.accessOrder.indexOf(viewId);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }
    }

    clear() {
        console.log('Clearing all webviews from cache');
        // Create a copy of keys to avoid modification during iteration
        const viewIds = Array.from(this.cache.keys());
        viewIds.forEach(id => this.remove(id));
        this.accessOrder = [];
    }
}

// ==================== FLIP ANIMATOR ====================

class FLIPAnimator {
    static captureRects(elements) {
        return Array.from(elements).map(el => ({
            element: el,
            rect: el.getBoundingClientRect()
        }));
    }

    static animateEntry(element, duration = 400) {
        if (!easing || !easing.easeOut) {
            console.warn('Easing not available, using fallback');
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
            return;
        }
        return animate({
            from: { opacity: 0, scale: 0.9 },
            to: { opacity: 1, scale: 1 },
            duration,
            ease: easing.easeOut
        }).start(v => {
            element.style.opacity = v.opacity;
            element.style.transform = `scale(${v.scale})`;
        });
    }

    static animateExit(element, onComplete, duration = 300) {
        if (!easing || !easing.easeIn) {
            console.warn('Easing not available for exit animation, using fallback');
            element.style.opacity = '0';
            element.style.transform = 'scale(0.9)';
            if (onComplete) onComplete();
            return;
        }
        return animate({
            from: { opacity: 1, scale: 1 },
            to: { opacity: 0, scale: 0.9 },
            duration,
            ease: easing.easeIn
        }).start({
            update: v => {
                element.style.opacity = v.opacity;
                element.style.transform = `scale(${v.scale})`;
            },
            complete: onComplete
        });
    }

    static animateLayoutChange(views, firstRects, duration = 400) {
        if (!easing || !easing.easeOut) {
            console.warn('Easing not available for layout change, skipping animation');
            return;
        }

        const lastRects = this.captureRects(views.map(v => v.element));

        views.forEach((view, i) => {
            const first = firstRects.find(r => r.element === view.element);
            const last = lastRects[i];

            if (first && last) {
                const deltaX = first.rect.left - last.rect.left;
                const deltaY = first.rect.top - last.rect.top;
                const deltaW = first.rect.width / last.rect.width;
                const deltaH = first.rect.height / last.rect.height;

                view.element.style.transformOrigin = 'center center';
                view.element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
                view.element.style.transition = 'none';

                // Force reflow
                view.element.offsetHeight;

                // Animate
                animate({
                    from: { x: deltaX, y: deltaY, sx: deltaW, sy: deltaH },
                    to: { x: 0, y: 0, sx: 1, sy: 1 },
                    duration,
                    ease: easing.easeOut
                }).start(v => {
                    view.element.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.sx}, ${v.sy})`;
                });
            }
        });
    }
}

// ==================== RESIZE MANAGER ====================

class ResizeManager {
    constructor() {
        this.isResizing = false;
        this.currentDivider = null;
        this.startX = 0;
        this.startFlexBasis = [];
        this.snapIndicators = [];
    }

    createDivider(index) {
        const divider = document.createElement('div');
        divider.className = 'split-divider';
        divider.dataset.index = index;

        divider.addEventListener('mousedown', (e) => this.startResize(e, index));

        return divider;
    }

    startResize(e, index) {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.currentDivider = index;
        this.startX = e.clientX;

        const tab = tabSystem.getActiveTab();
        if (!tab) return;

        // Simpan flexBasis dari state
        this.startFlexBasis = tab.splitState.views.map(v => v.flexBasis);

        // Tampilkan snap indicators
        this.showSnapIndicators();

        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove = (e) => {
        if (!this.isResizing) return;

        const container = document.getElementById('split-root');
        const containerWidth = container.offsetWidth;
        const delta = e.clientX - this.startX;
        const deltaPercent = (delta / containerWidth) * 100;

        const leftBasis = this.startFlexBasis[this.currentDivider] + deltaPercent;
        const rightBasis = this.startFlexBasis[this.currentDivider + 1] - deltaPercent;

        // Snap detection
        const tab = tabSystem.getActiveTab();
        if (!tab) return;

        const snapPoints = tab.splitState.getSnapPoints();
        let snappedLeft = leftBasis;
        let snappedRight = rightBasis;

        snapPoints.forEach(point => {
            const cumulativeWidth = this.startFlexBasis.slice(0, this.currentDivider + 1).reduce((a, b) => a + b, 0);
            const currentPos = cumulativeWidth + deltaPercent;

            if (Math.abs(currentPos - point) < 3) {
                const adjustment = point - cumulativeWidth;
                snappedLeft = this.startFlexBasis[this.currentDivider] + adjustment;
                snappedRight = this.startFlexBasis[this.currentDivider + 1] - adjustment;
                this.highlightSnapIndicator(point);
            }
        });

        // Apply dengan minimum 10%
        if (snappedLeft >= 10 && snappedRight >= 10) {
            const views = container.querySelectorAll('.split-view');
            views[this.currentDivider].style.flex = `0 0 ${snappedLeft}%`;
            views[this.currentDivider + 1].style.flex = `0 0 ${snappedRight}%`;

            // Update state juga
            tab.splitState.views[this.currentDivider].flexBasis = snappedLeft;
            tab.splitState.views[this.currentDivider + 1].flexBasis = snappedRight;
        }
    }

    onMouseUp = () => {
        this.isResizing = false;
        this.currentDivider = null;
        document.body.style.cursor = '';
        this.hideSnapIndicators();
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    showSnapIndicators() {
        const container = document.getElementById('split-root');
        const tab = tabSystem.getActiveTab();
        if (!tab) return;

        const snapPoints = tab.splitState.getSnapPoints();

        snapPoints.forEach(point => {
            const indicator = document.createElement('div');
            indicator.className = 'snap-indicator';
            indicator.style.left = point + '%';
            container.appendChild(indicator);
            this.snapIndicators.push(indicator);
        });
    }

    hideSnapIndicators() {
        this.snapIndicators.forEach(indicator => indicator.remove());
        this.snapIndicators = [];
    }

    highlightSnapIndicator(point) {
        this.snapIndicators.forEach(indicator => {
            const indicatorPoint = parseFloat(indicator.style.left);
            if (Math.abs(indicatorPoint - point) < 1) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }
}

// ==================== GLOBAL INSTANCES ====================

const tabSystem = new TabSystem();
const resizeManager = new ResizeManager();
let isAiSidebarOpen = false;

// Global Shortcuts (when focus is on UI, not Webview)
document.addEventListener('keydown', (e) => {
    console.log('Global Key Event:', e.key, 'Alt:', e.altKey, 'Ctrl:', e.ctrlKey);

    // Back: Alt + Left
    if (e.key === 'ArrowLeft' && e.altKey) {
        console.log('Global Shortcut: Back');
        const tab = tabSystem.getActiveTab();
        if (tab) {
            const activeView = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
            if (activeView && activeView.url) {
                const wv = tab.webviewCache.get(activeView.id);
                if (wv && wv.canGoBack()) {
                    wv.goBack();
                } else {
                    console.log('Global: Webview cannot go back or not found');
                }
            }
        }
    }
    // Forward: Alt + Right
    else if (e.key === 'ArrowRight' && e.altKey) {
        console.log('Global Shortcut: Forward');
        const tab = tabSystem.getActiveTab();
        if (tab) {
            const activeView = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
            if (activeView && activeView.url) {
                const wv = tab.webviewCache.get(activeView.id);
                if (wv && wv.canGoForward()) {
                    wv.goForward();
                } else {
                    console.log('Global: Webview cannot go forward or not found');
                }
            }
        }
    }
    // Quit: Ctrl + Q
    else if ((e.key === 'q' || e.key === 'Q') && e.ctrlKey) {
        console.log('Global Shortcut: Quit');
        window.electronAPI.quitApp();
    }
});

// IPC Navigation Listeners (Native Menu)
window.electronAPI.onNavBack(() => {
    console.log('IPC Nav Back received');
    const tab = tabSystem.getActiveTab();
    if (tab) {
        const activeView = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
        if (activeView && activeView.url) {
            const wv = tab.webviewCache.get(activeView.id);
            if (wv && wv.canGoBack()) {
                wv.goBack();
            }
        }
    }
});

window.electronAPI.onNavForward(() => {
    console.log('IPC Nav Forward received');
    const tab = tabSystem.getActiveTab();
    if (tab) {
        const activeView = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
        if (activeView && activeView.url) {
            const wv = tab.webviewCache.get(activeView.id);
            if (wv && wv.canGoForward()) {
                wv.goForward();
            }
        }
    }
});

window.electronAPI.onNavReload(() => {
    console.log('IPC Nav Reload received');
    const tab = tabSystem.getActiveTab();
    if (tab) {
        const activeView = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
        if (activeView && activeView.url) {
            const wv = tab.webviewCache.get(activeView.id);
            if (wv) {
                wv.reload();
            }
        }
    }
});

// ==================== RENDER FUNCTIONS ====================

// Store tab containers to avoid recreation
const tabContainers = new Map();

function renderSplits() {
    const container = document.getElementById('split-root');
    const tab = tabSystem.getActiveTab();
    if (!tab) return;

    // Hide all existing tab containers
    tabContainers.forEach((wrapper, tabId) => {
        wrapper.style.display = 'none';
    });

    // Check if we already have a container for this tab
    let wrapper = tabContainers.get(tab.id);

    if (!wrapper) {
        // Create new container for this tab
        wrapper = document.createElement('div');
        wrapper.className = 'splits-wrapper';
        wrapper.dataset.tabId = tab.id;

        tab.splitState.views.forEach((view, index) => {
            // Create view element
            const viewEl = createViewElement(view, tab);
            wrapper.appendChild(viewEl);

            // Create divider (kecuali untuk view terakhir)
            if (index < tab.splitState.views.length - 1) {
                const divider = resizeManager.createDivider(index);
                wrapper.appendChild(divider);
            }
        });

        container.appendChild(wrapper);
        tabContainers.set(tab.id, wrapper);
    }

    // Show the current tab's container
    wrapper.style.display = 'flex';
}

function createViewElement(view, tab) {
    const el = document.createElement('div');
    el.className = 'split-view' + (view.id === tab.splitState.activeViewId ? ' active' : '');
    el.dataset.viewId = view.id;
    el.style.flex = `0 0 ${view.flexBasis}%`;

    const content = document.createElement('div');
    content.className = 'webview-wrapper';

    if (!view.url) {
        // Placeholder
        content.innerHTML = `
            <div class="placeholder-view">
                <h2>FALCORA OS</h2>
                <p>Click to focus</p>
            </div>
        `;
        content.querySelector('.placeholder-view').addEventListener('click', () => {
            activateView(view.id);
            document.getElementById('url-input').focus();
        });
    } else {
        // Webview
        const wv = tab.webviewCache.get(view.id, view.url);

        // Add loading indicator
        const loadingId = 'loading-' + view.id;
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = loadingId;
        loadingIndicator.className = 'webview-loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
        `;
        content.appendChild(loadingIndicator);

        // Remove loading when page finishes
        const removeLoading = () => {
            const loader = document.getElementById(loadingId);
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 300);
            }
        };

        wv.addEventListener('did-stop-loading', removeLoading, { once: true });
        wv.addEventListener('did-fail-load', removeLoading, { once: true });
        setTimeout(removeLoading, 10000); // 10s fallback

        content.appendChild(wv);

        // Click overlay
        const overlay = document.createElement('div');
        overlay.className = 'view-click-overlay';
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            activateView(view.id);
        });
        content.appendChild(overlay);
    }

    el.appendChild(content);

    // Hover effects
    el.addEventListener('mouseenter', () => {
        if (view.id !== tab.splitState.activeViewId) el.classList.add('hover');
    });
    el.addEventListener('mouseleave', () => el.classList.remove('hover'));

    return el;
}

// ==================== SPLIT OPERATIONS ====================

async function addSplit(direction) {
    const tab = tabSystem.getActiveTab();
    if (!tab) return;

    if (tab.splitState.views.length >= 4) {
        showNotification('Maximum 4 panels');
        return;
    }

    // Capture current state untuk FLIP
    const container = document.getElementById('split-root');
    const oldViews = Array.from(container.querySelectorAll('.split-view'));
    const firstRects = FLIPAnimator.captureRects(oldViews);

    // Add new view
    const newView = tab.splitState.addView();
    if (!newView) return;

    // Instead of re-rendering everything, just add the new view
    const wrapper = container.querySelector('.splits-wrapper');
    if (!wrapper) {
        // Fallback if no wrapper exists
        renderSplits();
        return;
    }

    // Update flex basis for existing views
    tab.splitState.views.forEach((view, index) => {
        const viewEl = wrapper.querySelector(`[data-view-id="${view.id}"]`);
        if (viewEl && view.id !== newView.id) {
            viewEl.style.flex = `0 0 ${view.flexBasis}%`;
        }
    });

    // Create and append the new view
    const newViewEl = createViewElement(newView, tab);

    // Add divider before the new view (if there are other views)
    if (tab.splitState.views.length > 1) {
        const divider = resizeManager.createDivider(tab.splitState.views.length - 2);
        wrapper.appendChild(divider);
    }

    wrapper.appendChild(newViewEl);

    // FLIP animation for new view
    FLIPAnimator.animateEntry(newViewEl);

    // Animate layout change untuk views yang ada
    const updatedViews = tab.splitState.views.filter(v => v.id !== newView.id).map(v => ({
        element: wrapper.querySelector(`[data-view-id="${v.id}"]`),
        id: v.id
    })).filter(v => v.element);

    FLIPAnimator.animateLayoutChange(updatedViews, firstRects);

    // Activate new view
    activateView(newView.id);
}

async function closeSplit() {
    console.log('=== closeSplit called ===');
    const tab = tabSystem.getActiveTab();
    if (!tab) {
        console.log('No active tab');
        return;
    }

    console.log('Views count:', tab.splitState.views.length);
    if (tab.splitState.views.length <= 1) {
        showNotification('Cannot close last panel');
        return;
    }

    const viewToClose = tab.splitState.activeViewId;
    console.log('Closing view:', viewToClose);
    const viewEl = document.querySelector(`[data-view-id="${viewToClose}"]`);

    if (!viewEl) {
        console.log('View element not found in DOM');
        return;
    }

    // Get the container
    const container = document.getElementById('split-root');
    const wrapper = container.querySelector('.splits-wrapper');
    if (!wrapper) {
        console.log('Wrapper not found');
        return;
    }

    // Capture current state before any changes
    const oldViews = Array.from(wrapper.querySelectorAll('.split-view'));
    console.log('Old views count:', oldViews.length);
    const firstRects = FLIPAnimator.captureRects(oldViews);

    // Find all dividers
    const dividers = Array.from(wrapper.querySelectorAll('.split-divider'));
    const viewIndex = tab.splitState.getViewIndex(viewToClose);
    console.log('View index:', viewIndex, 'Dividers count:', dividers.length);

    // Store previous view ID before any changes
    const views = tab.splitState.views;
    const previousViewId = views[Math.max(0, viewIndex - 1)]?.id;
    console.log('Previous view ID:', previousViewId);

    // Animate exit
    viewEl.style.opacity = '0';
    viewEl.style.transform = 'scale(0.9)';
    viewEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    // Use setTimeout to let the exit animation play
    setTimeout(() => {
        console.log('Removing view element...');
        viewEl.remove();

        // Remove the appropriate divider
        if (viewIndex > 0 && viewIndex - 1 < dividers.length) {
            console.log('Removing divider at index:', viewIndex - 1);
            dividers[viewIndex - 1]?.remove();
        } else if (dividers.length > 0) {
            console.log('Removing last divider');
            dividers[dividers.length - 1]?.remove();
        }

        // Remove webview from cache
        tab.webviewCache.remove(viewToClose);

        // Remove from state
        tab.splitState.removeView(viewToClose);
        console.log('Views after remove:', tab.splitState.views.length);

        // Update flex basis for remaining views - CSS transition handles animation
        tab.splitState.views.forEach(view => {
            const el = wrapper.querySelector(`[data-view-id="${view.id}"]`);
            if (el) {
                el.style.flex = `0 0 ${view.flexBasis}%`;
            }
        });

        // Activate previous view
        if (previousViewId) {
            activateView(previousViewId);
        }

        console.log('=== Split closed successfully ===');
    }, 300);
}

function activateView(viewId) {
    const tab = tabSystem.getActiveTab();
    if (!tab) return;

    if (!tab.splitState.setActiveView(viewId)) return;

    document.querySelectorAll('.split-view').forEach(el => {
        el.classList.toggle('active', el.dataset.viewId === viewId);
    });

    const view = tab.splitState.views.find(v => v.id === viewId);
    if (view) {
        document.getElementById('url-input').value = view.url || '';
    }
}

function loadUrl(url) {
    console.log('Loading URL:', url);

    const tab = tabSystem.getActiveTab();
    if (!tab) {
        console.error('No active tab');
        return;
    }

    const view = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
    if (!view) {
        console.error('No active view');
        return;
    }

    view.url = url;

    try {
        // Get the correct container for current tab
        const wrapper = tabContainers.get(tab.id);
        if (!wrapper) {
            console.error('No container found for tab:', tab.id);
            return;
        }

        // Find view element within this tab's container
        const viewEl = wrapper.querySelector(`[data-view-id="${view.id}"]`);
        if (!viewEl) {
            console.error('View element not found in tab container');
            return;
        }

        const content = viewEl.querySelector('.webview-wrapper');
        content.innerHTML = '';

        // Create loading indicator with unique ID
        const loadingId = 'loading-' + view.id;
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = loadingId;
        loadingIndicator.className = 'webview-loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
        `;
        content.appendChild(loadingIndicator);

        // Create and attach webview
        const wv = tab.webviewCache.get(view.id, url);

        // Add event to remove loading when done
        const removeLoading = () => {
            const loader = document.getElementById(loadingId);
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 300);
            }
        };

        wv.addEventListener('did-stop-loading', removeLoading, { once: true });
        wv.addEventListener('did-fail-load', removeLoading, { once: true });

        // Timeout fallback 10 seconds
        setTimeout(removeLoading, 10000);

        content.appendChild(wv);

        // Now load URL after attached to DOM
        console.log('Webview attached, loading URL:', url);
        setTimeout(() => {
            try {
                wv.loadURL(url);
                console.log('URL loaded successfully');
            } catch (e) {
                console.error('Error in loadURL:', e);
                removeLoading();
            }
        }, 100);

        const overlay = document.createElement('div');
        overlay.className = 'view-click-overlay';
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            activateView(view.id);
        });
        content.appendChild(overlay);

        console.log('View updated successfully');
    } catch (error) {
        console.error('Error loading URL:', error);
        showNotification('Error loading page: ' + error.message);
    }
}

// ==================== TAB OPERATIONS ====================

function createInitialTab() {
    const newTab = tabSystem.createTab();
    createTabButton(newTab.id);
    renderSplits();
}

function createTabButton(tabId) {
    const btn = document.createElement('div');
    btn.className = 'tab' + (tabId === tabSystem.activeTabId ? ' active' : '');
    btn.dataset.tabId = tabId;

    // Tab icon based on URL
    const tabIcon = document.createElement('img');
    tabIcon.className = 'tab-icon';
    tabIcon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    tabIcon.alt = 'Tab';
    btn.appendChild(tabIcon);

    // Click to switch tab
    btn.addEventListener('click', () => switchTab(tabId));

    const tabBar = document.getElementById('tab-bar');
    const addBtn = tabBar.querySelector('.add-tab-btn');
    tabBar.insertBefore(btn, addBtn);

    // Update active class on all tabs
    updateTabButtons();
}

function updateTabButtons() {
    document.querySelectorAll('.tab').forEach(btn => {
        if (btn.classList.contains('add-tab-btn')) return;
        btn.classList.toggle('active', btn.dataset.tabId === tabSystem.activeTabId);
    });
}

function switchTab(tabId) {
    const tab = tabSystem.switchTab(tabId);
    if (!tab) return;

    updateTabButtons();
    renderSplits();

    // Update URL input
    const view = tab.splitState.views.find(v => v.id === tab.splitState.activeViewId);
    if (view) {
        document.getElementById('url-input').value = view.url || '';
    }
}

function addNewTab() {
    const newTab = tabSystem.createTab();
    createTabButton(newTab.id);
    switchTab(newTab.id);
    renderSplits();

    // Focus URL input for new tab
    setTimeout(() => {
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.value = '';
            urlInput.focus();
        }
    }, 100);
}

function closeTab(tabId) {
    const tabToClose = tabId || tabSystem.activeTabId;

    // Don't close if it's the last tab
    if (tabSystem.tabs.length <= 1) {
        showNotification('Cannot close last tab');
        return;
    }

    // Find the tab to close
    const tabIndex = tabSystem.tabs.findIndex(t => t.id === tabToClose);
    if (tabIndex === -1) return;

    // Determine which tab to activate next
    const nextTabIndex = tabIndex > 0 ? tabIndex - 1 : 0;
    const nextTabId = tabSystem.tabs[nextTabIndex]?.id;

    // Remove tab container from DOM
    const container = tabContainers.get(tabToClose);
    if (container) {
        container.remove();
        tabContainers.delete(tabToClose);
    }

    // Remove tab from system
    tabSystem.tabs.splice(tabIndex, 1);

    // Remove tab button
    const btn = document.querySelector(`.tab[data-tab-id="${tabToClose}"]`);
    if (btn) btn.remove();

    // If we closed the active tab, switch to the next one
    if (tabToClose === tabSystem.activeTabId && nextTabId) {
        tabSystem.activeTabId = nextTabId;
        switchTab(nextTabId);
    } else {
        // Just update the UI
        updateTabButtons();
        renderSplits();
    }

    console.log(`Closed tab: ${tabToClose}`);
}

function closeCurrentTab() {
    closeTab(tabSystem.activeTabId);
}

function updateTabIcon(tabId, url) {
    const tabBtn = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (!tabBtn) return;

    const tabIcon = tabBtn.querySelector('.tab-icon');
    if (!tabIcon) return;

    // Get favicon from URL
    try {
        const urlObj = new URL(url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
        tabIcon.src = faviconUrl;
        tabIcon.alt = urlObj.hostname;
    } catch (e) {
        // Fallback to default icon
        tabIcon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    }
}

// ==================== UI HELPERS ====================

function showNotification(text) {
    const n = document.createElement('div');
    n.textContent = text;
    n.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: rgba(168,85,247,0.95); color: white; padding: 10px 20px; border-radius: 8px; z-index: 10100; font-size: 13px; opacity: 0;';
    document.body.appendChild(n);

    // Simple CSS animation fallback
    n.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    // Trigger animation
    requestAnimationFrame(() => {
        n.style.opacity = '1';
        n.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        n.style.opacity = '0';
        setTimeout(() => n.remove(), 300);
    }, 2000);
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
    // Check if popmotion is available
    if (typeof popmotion === 'undefined') {
        console.error('Popmotion library not loaded!');
        document.body.style.opacity = '1';
    } else {
        console.log('Popmotion loaded successfully');
    }

    createInitialTab();
    setupEventListeners();
    setupSensorLogic();
    createParticles();

    // Animate body fade in
    if (animate && typeof animate === 'function') {
        try {
            const animation = animate({
                from: 0,
                to: 1,
                duration: 500
            });

            if (animation && typeof animation.start === 'function') {
                animation.start(v => {
                    document.body.style.opacity = v;
                });
            } else {
                // Fallback if animate doesn't return a start method
                document.body.style.opacity = '1';
            }
        } catch (e) {
            console.warn('Animation failed, using fallback:', e);
            document.body.style.opacity = '1';
        }
    } else {
        // Fallback if animate is not available
        document.body.style.opacity = '1';
    }
});

function setupEventListeners() {
    const urlInput = document.getElementById('url-input');

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            let url = urlInput.value.trim();
            if (!url) return;

            console.log('URL Input:', url);

            // Better URL detection
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                // Check if it's a domain (contains dot and no spaces)
                const isDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(url);

                if (isDomain || url.includes('.') && !url.includes(' ')) {
                    url = 'https://' + url;
                    console.log('Detected as domain, adding https:', url);
                } else {
                    url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
                    console.log('Detected as search query:', url);
                }
            }

            console.log('Final URL:', url);
            loadUrl(url);
            urlInput.blur();
        }
    });

    document.getElementById('split-v')?.addEventListener('click', () => addSplit('vertical'));

    // Close split button - with explicit check
    const closeBtn = document.getElementById('split-close');
    if (closeBtn) {
        console.log('Close split button found, attaching listener');
        closeBtn.addEventListener('click', (e) => {
            console.log('Close split button clicked!');
            e.preventDefault();
            e.stopPropagation();
            closeSplit();
        });
    } else {
        console.error('Close split button NOT found!');
    }
    document.querySelector('.add-tab-btn')?.addEventListener('click', addNewTab);

    document.getElementById('ai-toggle-btn')?.addEventListener('click', () => {
        const sb = document.getElementById('ai-sidebar');
        isAiSidebarOpen = !isAiSidebarOpen;
        sb.classList.toggle('open', isAiSidebarOpen);
        document.body.classList.toggle('sidebar-open', isAiSidebarOpen);
    });

    // Settings panel toggle
    const settingsTrigger = document.getElementById('settings-trigger');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettings = document.getElementById('close-settings');

    if (settingsTrigger && settingsPanel) {
        settingsTrigger.addEventListener('click', () => {
            settingsPanel.classList.toggle('open');
        });
    }

    if (closeSettings && settingsPanel) {
        closeSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('open');
        });
    }

    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;

        if (ctrl && e.key === 't') {
            e.preventDefault();
            addNewTab();
        } else if (ctrl && e.key === 'w') {
            e.preventDefault();
            // Close split if multiple, else close tab
            const tab = tabSystem.getActiveTab();
            if (tab && tab.splitState.views.length > 1) {
                closeSplit();
            } else {
                closeCurrentTab();
            }
        } else if (ctrl && e.key === 'x') {
            e.preventDefault();
            // Close current tab
            closeCurrentTab();
        } else if (ctrl && e.key === 'ArrowRight') {
            e.preventDefault();
            // Switch to next tab
            const tabs = tabSystem.tabs;
            const currentIndex = tabs.findIndex(t => t.id === tabSystem.activeTabId);
            const nextIndex = (currentIndex + 1) % tabs.length;
            if (tabs[nextIndex]) {
                switchTab(tabs[nextIndex].id);
            }
        } else if (ctrl && e.key === 'ArrowLeft') {
            e.preventDefault();
            // Switch to previous tab
            const tabs = tabSystem.tabs;
            const currentIndex = tabs.findIndex(t => t.id === tabSystem.activeTabId);
            const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
            if (tabs[prevIndex]) {
                switchTab(tabs[prevIndex].id);
            }
        } else if (ctrl && e.key === 'l') {
            e.preventDefault();
            // Show top bar if hidden
            const topZone = document.getElementById('top-zone');
            const topSensor = document.getElementById('top-sensor');
            if (topZone) {
                topZone.classList.add('visible');
                topZone.style.opacity = '1';
                topZone.style.pointerEvents = 'auto';
                topZone.style.transform = 'translateX(-50%) translateY(0)';
            }
            if (topSensor) {
                topSensor.classList.add('active');
            }
            // Focus URL input after a short delay to ensure visibility
            setTimeout(() => {
                urlInput.focus();
                urlInput.select();
            }, 100);
        } else if (ctrl && e.key === 'b') {
            e.preventDefault();
            document.getElementById('ai-toggle-btn')?.click();
        } else if (ctrl && e.key === '\\') {
            e.preventDefault();
            addSplit('vertical');
        }
    });
}

function setupSensorLogic() {
    const topSensor = document.getElementById('top-sensor');
    const topZone = document.getElementById('top-zone');
    let topTimer;

    console.log('Setting up sensor logic...');
    console.log('Top sensor found:', !!topSensor);
    console.log('Top zone found:', !!topZone);
    console.log('Bottom sensor found:', !!document.getElementById('bottom-sensor'));
    console.log('Bottom zone found:', !!document.getElementById('bottom-zone'));

    topSensor?.addEventListener('mouseenter', (e) => {
        console.log('Top sensor mouseenter triggered');
        if (topSensor) topSensor.classList.add('active');
        if (topZone) {
            topZone.classList.add('visible');
            topZone.style.opacity = '1';
            topZone.style.pointerEvents = 'auto';
            topZone.style.transform = 'translateX(-50%) translateY(0)';
        }
        clearTimeout(topTimer);
    });

    topSensor?.addEventListener('mouseleave', () => {
        console.log('Top sensor mouseleave triggered');
        topTimer = setTimeout(() => {
            if (topZone && !topZone.matches(':hover')) {
                console.log('Hiding top zone');
                topZone.classList.remove('visible');
                topZone.style.opacity = '0';
                topZone.style.pointerEvents = 'none';
                topZone.style.transform = 'translateX(-50%) translateY(-120px)';
                if (topSensor) topSensor.classList.remove('active');
            }
        }, 300);
    });

    topZone?.addEventListener('mouseenter', () => {
        console.log('Top zone mouseenter triggered');
        clearTimeout(topTimer);
    });

    topZone?.addEventListener('mouseleave', () => {
        console.log('Top zone mouseleave triggered');
        if (document.activeElement === document.getElementById('url-input')) return;
        topTimer = setTimeout(() => {
            if (topZone) {
                topZone.classList.remove('visible');
                topZone.style.opacity = '0';
                topZone.style.pointerEvents = 'none';
                topZone.style.transform = 'translateX(-50%) translateY(-120px)';
            }
            if (topSensor) topSensor.classList.remove('active');
        }, 500);
    });

    // Bottom sensor logic
    const bottomSensor = document.getElementById('bottom-sensor');
    const bottomZone = document.getElementById('bottom-zone');
    let bottomTimer;

    bottomSensor?.addEventListener('mouseenter', () => {
        console.log('Bottom sensor mouseenter triggered');
        if (bottomSensor) bottomSensor.classList.add('active');
        if (bottomZone) {
            bottomZone.classList.add('visible');
            bottomZone.style.opacity = '1';
            bottomZone.style.pointerEvents = 'auto';
            bottomZone.style.transform = 'translateX(-50%) translateY(0)';
        }
        clearTimeout(bottomTimer);
    });

    bottomSensor?.addEventListener('mouseleave', () => {
        console.log('Bottom sensor mouseleave triggered');
        bottomTimer = setTimeout(() => {
            if (bottomZone && !bottomZone.matches(':hover')) {
                console.log('Hiding bottom zone');
                bottomZone.classList.remove('visible');
                bottomZone.style.opacity = '0';
                bottomZone.style.pointerEvents = 'none';
                bottomZone.style.transform = 'translateX(-50%) translateY(150px)';
                if (bottomSensor) bottomSensor.classList.remove('active');
            }
        }, 300);
    });

    bottomZone?.addEventListener('mouseenter', () => {
        console.log('Bottom zone mouseenter triggered');
        clearTimeout(bottomTimer);
    });

    bottomZone?.addEventListener('mouseleave', () => {
        console.log('Bottom zone mouseleave triggered');
        bottomTimer = setTimeout(() => {
            if (bottomZone) {
                bottomZone.classList.remove('visible');
                bottomZone.style.opacity = '0';
                bottomZone.style.pointerEvents = 'none';
                bottomZone.style.transform = 'translateX(-50%) translateY(150px)';
            }
            if (bottomSensor) bottomSensor.classList.remove('active');
        }, 500);
    });
}

function createParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    for (let i = 0; i < 24; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 5}s;
        `;
        container.appendChild(p);
    }
}

// ==================== MEMORY MANAGEMENT UTILS ====================

function logCacheStats() {
    const stats = tabSystem.getActiveTab()?.webviewCache?.getStats();
    if (stats) {
        console.log('=== Webview Cache Stats ===');
        console.log(`Size: ${stats.size}/${stats.maxSize}`);
        console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
        console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);
        console.log(`Created: ${stats.created}, Evictions: ${stats.evictions}`);
        console.log('==========================');
        showNotification(`Cache: ${stats.size}/${stats.maxSize} | Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    }
}

function forceGarbageCollection() {
    console.log('Forcing garbage collection...');
    tabSystem.getActiveTab()?.webviewCache?.aggressiveCleanup();
    if (global.gc) {
        global.gc();
        showNotification('Garbage collection triggered');
    } else {
        showNotification('GC not available - run with --expose-gc flag');
    }
}

// Log stats every 2 minutes
setInterval(logCacheStats, 120000);

// Add keyboard shortcuts for debugging
document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+Shift+M: Show memory stats
    if (ctrl && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        logCacheStats();
    }

    // Ctrl+Shift+G: Force garbage collection
    if (ctrl && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        forceGarbageCollection();
    }
});