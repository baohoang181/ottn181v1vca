/** * DIAMOND AI CORE v6.0
 * Đặc tính: Chống ảo giác (Anti-Hallucination), JSON Guardian, AI Insight
 */
const AI_ENGINE = {
    KEY: "AIzaSyDuSu1OQGeJhryW5HTGG46pNPCBUigjVJ8",
    MODEL: "gemini-1.5-flash",

    async generate(config) {
        const { text, count, mode, prompt } = config;
        const system = `BẠN LÀ AI DIAMOND ARCHITECT. 
        NHIỆM VỤ: Dựa TUYỆT ĐỐI vào văn bản nguồn để tạo ${count} câu hỏi trắc nghiệm.
        CHẾ ĐỘ: ${mode}. YÊU CẦU RIÊNG: ${prompt}.
        CẤU TRÚC: Trả về JSON Array: [{"question":"","options":["","","",""],"correct":0}].
        CẤM: Không trả về câu hỏi "Mô phỏng", chỉ lấy từ nội dung nguồn.`;

        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${this.KEY}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\nNGUỒN:\n${text}` }] }] })
            });
            const data = await res.json();
            const raw = data.candidates[0].content.parts[0].text;
            return this.guardian(raw, count);
        } catch (e) { return null; }
    },

    // JSON Guardian: Trích xuất và sửa lỗi dữ liệu
    guardian(str, count) {
        try {
            const match = str.match(/\[[\s\S]*\]/);
            if (!match) return null;
            let data = JSON.parse(match[0]);
            return data.slice(0, count).map(q => ({
                question: q.question || "Lỗi trích xuất câu hỏi",
                options: q.options.length === 4 ? q.options : ["A","B","C","D"],
                correct: Number.isInteger(q.correct) ? q.correct : 0
            }));
        } catch (e) { return null; }
    },

    // MỚI: AI Insight - Phân tích lý do Huy sai
    async getInsight(results, source) {
        const prompt = `Dựa vào kết quả thi: ${JSON.stringify(results)} và văn bản nguồn. 
        Hãy đưa ra 2 câu nhận xét ngắn gọn về điểm mạnh và điểm cần cải thiện của người học.`;
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${this.KEY}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        } catch (e) { return "AI không thể phân tích lúc này."; }
    },

    async read(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'txt') return await file.text();
        if (ext === 'docx') return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
        if (ext === 'pdf') {
            const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
            let t = "";
            for (let i = 1; i <= pdf.numPages; i++) t += (await (await pdf.getPage(i)).getTextContent()).items.map(s => s.str).join(" ");
            return t;
        }
    }
};
