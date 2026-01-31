// 🧠 AI Memory System
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const memoryPath = path.join(path.dirname(__dirname), 'memory.json');

exports.loadMemory = () => {
    try {
        if (!fs.existsSync(memoryPath)) return [];
        return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    } catch (e) {
        console.error("Memory Load Error:", e);
        return [];
    }
};

exports.saveMemory = (data) => {
    fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
};

exports.addMemory = (text) => {
    const mem = exports.loadMemory();
    mem.push({
        id: Date.now().toString(),
        content: text,
        timestamp: Date.now()
    });
    exports.saveMemory(mem);
    return "Memory stored.";
};

exports.removeMemory = (id) => {
    let mem = exports.loadMemory();
    mem = mem.filter(m => m.id !== id);
    exports.saveMemory(mem);
    return "Memory deleted.";
};

exports.clearMemory = () => {
    exports.saveMemory([]);
    return "All memories cleared.";
};
