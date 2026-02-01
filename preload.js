const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We will add safe APIs here later
    ping: () => 'pong',
    getVersions: () => process.versions,
    sendMessage: (text, profile) => ipcRenderer.invoke('ai-message', text, profile),
    captureScreen: () => ipcRenderer.invoke('ai-vision'),
    quitApp: () => ipcRenderer.send('app-quit'),
    onNavBack: (callback) => ipcRenderer.on('nav-back', callback),
    onNavForward: (callback) => ipcRenderer.on('nav-forward', callback),
    onNavReload: (callback) => ipcRenderer.on('nav-reload', callback),
    // Read shim content directly to avoid path/protocol issues
    shimContent: require('fs').readFileSync(require('path').join(__dirname, 'shim.js'), 'utf-8')
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});
