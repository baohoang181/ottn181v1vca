/** * DIAMOND AI CORE v5.0
 * Nhiệm vụ: Ưu tiên dữ liệu file, Tự sửa lỗi JSON
 */
const AI_ENGINE = {
    KEY: "AIzaSyDuSu1OQGeJhryW5HTGG46pNPCBUigjVJ8",
    MODEL: "gemini-1.5-flash",

    async analyze(cfg) {
        const { text, count, mode, userPrompt } = cfg;
        
        // System Prompt tối ưu để AI không trả về dữ liệu giả
        const system = `Bạn là Senior Khảo thí. NHIỆM VỤ: Dựa vào văn bản nguồn bên dưới, tạo ra ${count} câu hỏi trắc nghiệm.
        CẤP ĐỘ: ${mode}. YÊU CẦU: ${userPrompt}.
        BẮT BUỘC: Chỉ trả về mảng JSON thuần túy, không Markdown. 
        MẪU: [{"question":"...","options":["A","B","C","D"],"correct":0}]`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${this.KEY}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${system}\n\nVĂN BẢN NGUỒN:\n${text}` }] }]
                })
            });

            const data = await response.json();
            const raw = data.candidates[0].content.parts[0].text;

            // JSON GUARDIAN: Tự động trích xuất JSON trong đống văn bản hỗn độn
            const cleanData = this.jsonGuardian(raw);
            return this.validate(cleanData, count);
        } catch (e) {
            console.error("Lỗi AI Core:", e);
            return null;
        }
    },

    jsonGuardian(str) {
        try {
            const start = str.indexOf('[');
            const end = str.lastIndexOf(']');
            if (start === -1 || end === -1) return [];
            return JSON.parse(str.substring(start, end + 1));
        } catch (e) { return []; }
    },

    validate(data, count) {
        if (!Array.isArray(data) || data.length === 0) return null;
        return data.slice(0, count).map(q => ({
            question: q.question || "Câu hỏi không xác định",
            options: (q.options && q.options.length === 4) ? q.options : ["A", "B", "C", "D"],
            correct: (typeof q.correct === 'number' && q.correct < 4) ? q.correct : 0
        }));
    },

    async parseFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        try {
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
                    text += content.items.map(s => s.str).join(" ") + " ";
                }
                return text;
            }
        } catch (e) { return ""; }
    }
};
