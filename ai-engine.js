/** * OTTN181 v1 - AI ENGINE (GOLDEN) */
const AI_CONFIG = {
    API_KEY: "AIzaSyDuSu1OQGeJhryW5HTGG46pNPCBUigjVJ8", // Huy thay bằng Key của mình
    MODEL: "gemini-1.5-flash"
};

const QuizAI = {
    async extractText(file) {
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'txt') return await file.text();
            if (ext === 'docx') {
                const buffer = await file.arrayBuffer();
                const res = await mammoth.extractRawText({ arrayBuffer: buffer });
                return res.value;
            }
            if (ext === 'pdf') {
                const buffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
                let text = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(s => s.str).join(" ");
                }
                return text;
            }
            return "";
        } catch (e) { throw new Error("Không thể đọc file: " + e.message); }
    },

    async generate(options) {
        const { text, prompt, count, mode } = options;
        const systemMsg = `Bạn là chuyên gia khảo thí OTTN181. Tạo bộ đề ${count} câu. 
        Chế độ: ${mode}. Yêu cầu: ${prompt}. 
        ĐỊNH DẠNG: Chỉ trả về mảng JSON thuần: [{"question":"...", "options":["A","B","C","D"], "correct":0}] 
        Lưu ý: "correct" là index (0-3) của đáp án đúng.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.MODEL}:generateContent?key=${AI_CONFIG.API_KEY}`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: `Tài liệu: ${text}\n\n${systemMsg}` }] }] })
        });

        const data = await response.json();
        if (!data.candidates) throw new Error("AI đang bận, Huy hãy thử lại sau nhé!");
        const raw = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        return JSON.parse(raw);
    }
};

