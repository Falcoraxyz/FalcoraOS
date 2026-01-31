// 🧠 AI Core System
// Handles interaction with LLM (Mocked for now)
const aiMemory = require('./aiMemory');

const PROFILES = {
    "Work": "You are a productivity expert. Be concise and professional.",
    "Study": "You are a tutor. Explain concepts clearly and patiently.",
    "Shopping": "You are a shopping assistant. Find best deals and compare.",
    "Crypto": "You are a crypto analyst. Focus on market trends and risk.",
    "Research": "You are a researcher. Provide citations and deep analysis.",
    "Academic": "You are an academic assistant. Use formal language.",
    "Personal": "You are a friendly assistant. Be casual."
};

exports.handleMessage = async (text, profile = "Personal") => {
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const systemPrompt = PROFILES[profile] || PROFILES["Personal"];
    console.log(`[AI] Profile: ${profile}`);

    // Simple analysis
    const lower = text.toLowerCase();

    if (lower.includes('open google')) {
        return {
            text: "Opening Google for you.",
            actions: [
                { type: 'open_tab', url: 'https://google.com' }
            ]
        };
    }

    if (lower.startsWith('/agent') || lower.startsWith('research')) {
        return {
            text: "Initializing Autopilot Agent... (Simulation)",
            actions: [
                { type: 'autopilot_start', task: text }
            ]
        };
    }

    if (lower.startsWith('remember ')) {
        const content = text.slice(9);
        aiMemory.addMemory(content);
        return { text: `Encrypted memory stored: "${content}"`, actions: [] };
    }

    if (lower.includes('show memory') || lower.includes('memory dashboard')) {
        const memories = aiMemory.loadMemory();
        return {
            text: "Opening Memory Dashboard...",
            actions: [
                { type: 'show_memory', data: memories }
            ]
        };
    }

    if (lower.includes('close tab')) {
        return {
            text: "Closing current tab.",
            actions: [
                { type: 'close_tab' }
            ]
        };
    }

    return {
        text: `Falcora AI received: "${text}". I am currently in Build Mode. Real AI integration will follow.`,
        actions: []
    };
};
