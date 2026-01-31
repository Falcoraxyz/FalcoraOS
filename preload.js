const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We will add safe APIs here later
    ping: () => 'pong',
    getVersions: () => process.versions,
    sendMessage: (text, profile) => ipcRenderer.invoke('ai-message', text, profile),
    captureScreen: () => ipcRenderer.invoke('ai-vision')
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
