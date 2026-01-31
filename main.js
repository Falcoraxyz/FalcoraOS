const { app, BrowserWindow } = require('electron');
const path = require('path');

// 1. Performance flags
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-translate');

const { ipcMain } = require('electron');
const aiCore = require('./ai/aiCore');
const aiVision = require('./ai/aiVision');

// IPC Handlers
ipcMain.handle('ai-message', async (event, text, profile) => {
    return await aiCore.handleMessage(text, profile);
});

ipcMain.handle('ai-vision', async () => {
    return await aiVision.captureScreen();
});

let mainWindow;

function createWindow() {
    // 2. Browser Window Configuration (User Request: show: false + ready-to-show)
    mainWindow = new BrowserWindow({
        show: false,
        frame: false,
        fullscreen: true,
        backgroundColor: '#0B0B12',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webviewTag: true
        }
    });

    mainWindow.loadFile('index.html');

    // Prevent white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
