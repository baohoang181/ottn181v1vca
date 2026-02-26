const AI_CONFIG = {
    API_KEY: "AIzaSyDuSu1OQGeJhryW5HTGG46pNPCBUigjVJ8",
    MODEL: "gemini-1.5-flash"
};

const QuizAI = {
    async extractText(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'txt') return await file.text();
        if (ext === 'docx') {
            const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return res.value;
        }
        if (ext === 'pdf') {
            const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(s => s.str).join(" ");
            }
            return text;
        }
        return "";
    },

    async generate(config) {
        const sys = `Role: Quiz Master. Output: JSON Array. Task: Create ${config.count} MCQs. Difficulty: ${config.mode}. Prompt: ${config.prompt}. Structure: [{"question":"", "options":["","","",""], "correct":0}]`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.MODEL}:generateContent?key=${AI_CONFIG.API_KEY}`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: `${sys}\nContext: ${config.text.substring(0, 20000)}` }] }] })
        });
        const data = await response.json();
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanJson);
    }
};
