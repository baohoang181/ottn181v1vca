/** AI ENGINE DIAMOND EDITION */
const AI_CONFIG = {
    KEY: "AIzaSyDuSu1OQGeJhryW5HTGG46pNPCBUigjVJ8",
    MODEL: "gemini-1.5-flash"
};

const QuizAI = {
    // Trích xuất văn bản đa phương thức
    async extractText(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        try {
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
        } catch (e) { console.error("Lỗi đọc file:", e); return ""; }
    },

    // Hàm tạo câu hỏi với cấu trúc liên kết chặt chẽ
    async generate(config) {
        const { text, prompt, count, mode } = config;
        
        // Tối ưu hóa Instruction để AI không bị sai lệch cấu trúc JSON
        const systemPrompt = `
            Bạn là chuyên gia khảo thí của hệ thống OTTN181. 
            Nhiệm vụ: Tạo ${count} câu hỏi trắc nghiệm từ nội dung được cung cấp.
            Chế độ: ${mode}. (Nếu 'hard': tạo câu hỏi lắt léo, bẫy logic. Nếu 'expand': mở rộng kiến thức liên quan).
            Yêu cầu riêng: ${prompt || 'Tập trung vào ý chính'}.
            Bắt buộc trả về JSON Array thuần, không giải thích.
            Cấu trúc mẫu: [{"question": "A?", "options": ["1", "2", "3", "4"], "correct": 0}]
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.MODEL}:generateContent?key=${AI_CONFIG.KEY}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nNội dung nguồn: ${text.substring(0, 25000)}` }] }],
                    generationConfig: { temperature: mode === 'hard' ? 0.9 : 0.7, topP: 0.95 }
                })
            });

            const data = await response.json();
            if (!data.candidates) throw new Error("AI_LIMIT_OR_BUSY");
            const rawRaw = data.candidates[0].content.parts[0].text;
            const cleanJson = rawRaw.replace(/```json|```/g, "").trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error("Lỗi AI Core:", e);
            throw e;
        }
    }
};
