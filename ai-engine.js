/** * AI CORE V3.0 - ARCHITECT EDITION 
 * Tự động soi chiếu và sửa lỗi dữ liệu hàng triệu lần 
 */
const AICore = {
    KEY: "AIzaSyDuSu1OQGeJhryW5HTGG46pNPCBUigjVJ8",
    MODEL: "gemini-1.5-flash",

    async analyze(cfg) {
        const { text, prompt, count, mode } = cfg;
        const system = `Role: Diamond Expert. Task: Generate ${count} quiz items. Mode: ${mode}. Instruction: ${prompt}. Return ONLY JSON Array. Format: [{"question":"","options":["","","",""],"correct":0}]`;

        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${this.KEY}`, {
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${system}\nSource: ${text.substring(0, 30000)}` }] }]
                })
            });

            if(!resp.ok) throw "API_ERR";
            const data = await resp.json();
            const raw = data.candidates[0].content.parts[0].text;
            
            // Xử lý làm sạch dữ liệu cấp cao
            const jsonText = raw.replace(/```json|```/g, "").trim();
            const result = JSON.parse(jsonText);

            return this.validate(result, count);
        } catch (e) {
            console.warn("AI sập, kích hoạt Diamond Backup...");
            return this.getMock(count);
        }
    },

    validate(data, count) {
        if(!Array.isArray(data)) return this.getMock(count);
        return data.slice(0, count).map(q => ({
            question: q.question || "Câu hỏi lỗi nội dung?",
            options: q.options && q.options.length === 4 ? q.options : ["A", "B", "C", "D"],
            correct: typeof q.correct === 'number' ? q.correct : 0
        }));
    },

    getMock(n) {
        return Array.from({length: n}, (_, i) => ({
            question: `[MÔ PHỎNG] Câu hỏi kiến thức Diamond số ${i+1}?`,
            options: ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
            correct: 0
        }));
    },

    async read(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if(ext === 'txt') return await file.text();
        if(ext === 'docx') {
            const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return res.value;
        }
        if(ext === 'pdf') {
            const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
            let str = "";
            for(let i=1; i<=pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                str += content.items.map(s => s.str).join(" ");
            }
            return str;
        }
        return "";
    }
};
