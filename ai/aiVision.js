// 👁️ AI Vision System
const { BrowserWindow } = require('electron');

exports.captureScreen = async () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length === 0) return null;

    const win = wins[0];

    // Capture the visible page
    try {
        const image = await win.capturePage();
        return image.toDataURL();
    } catch (e) {
        console.error("Vision Error:", e);
        return null;
    }
};
