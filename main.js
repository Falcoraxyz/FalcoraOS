const { app, BrowserWindow, Menu } = require('electron');
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

ipcMain.on('app-quit', () => {
    app.quit();
});

let mainWindow;

function createWindow() {
    // 2. Browser Window Configuration (User Request: show: false + ready-to-show)
    mainWindow = new BrowserWindow({
        show: false,
        frame: false,
        fullscreen: true,
        backgroundColor: '#0B0B12',
        disableHtmlFullscreenWindowResize: true, // Native fix for embedded fullscreen
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Disabled to allow require('path') in preload for shim resolution
            webviewTag: true
        }
    });

    mainWindow.loadFile('index.html');

    // Open DevTools for debugging (disabled for production)
    // mainWindow.webContents.openDevTools();

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

    // 3. User Requested Shortcuts via Native Menu
    const menuTemplate = [
        {
            label: 'Navigation',
            submenu: [
                {
                    label: 'Back',
                    accelerator: 'Alt+Left',
                    click: () => { if (mainWindow) mainWindow.webContents.send('nav-back'); }
                },
                {
                    label: 'Forward',
                    accelerator: 'Alt+Right',
                    click: () => { if (mainWindow) mainWindow.webContents.send('nav-forward'); }
                },
                {
                    label: 'Reload',
                    accelerator: 'Ctrl+R',
                    click: () => { if (mainWindow) mainWindow.webContents.send('nav-reload'); }
                },
                {
                    label: 'Toggle Full Screen',
                    accelerator: 'F11',
                    click: () => {
                        if (mainWindow) {
                            const isFullScreen = mainWindow.isFullScreen();
                            mainWindow.setFullScreen(!isFullScreen);
                        }
                    }
                },
                {
                    label: 'Quit',
                    accelerator: 'Ctrl+Q',
                    click: () => { app.quit(); }
                }
            ]
        },
        // Add Edit menu to enable Cut/Copy/Paste
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
