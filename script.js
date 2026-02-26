/** OTTN181 v1 - ETERNAL DIAMOND SCRIPT */
const app = {
    rawQuiz: [],      // Dữ liệu gốc
    displayQuiz: [],  // Dữ liệu hiển thị (sau xáo trộn/chỉnh sửa)
    history: {},      // Lưu cài đặt trước đó
    currIdx: null,    // Index câu đang sửa
    timer: null,
    prog: 0,

    init() {
        this.runNano();
        this.loadAutoSave(); // Tự động khôi phục nếu lỡ F5
        this.saveCurrentState();
        document.getElementById('btn-run').onclick = () => this.handleAI();
        // Lắng nghe thay đổi radio để Auto-save tiến độ làm bài
        document.addEventListener('change', (e) => { if(e.target.name?.startsWith('q')) this.autoSaveProgress(); });
    },

    // --- TÍNH NĂNG: AUTO SAVE ---
    autoSaveProgress() {
        const answers = {};
        this.displayQuiz.forEach((_, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            if(sel) answers[i] = sel.value;
        });
        localStorage.setItem('ottn181_save', JSON.stringify({
            quiz: this.displayQuiz,
            ans: answers,
            title: document.getElementById('quiz-title').value,
            time: document.getElementById('q-time').value
        }));
    },

    loadAutoSave() {
        const saved = localStorage.getItem('ottn181_save');
        if(!saved) return;
        if(confirm("Huy ơi, hệ thống tìm thấy bài làm đang dở. Khôi phục lại nhé?")) {
            const data = JSON.parse(saved);
            this.displayQuiz = data.quiz;
            ui.hide('control-panel'); ui.show('workspace');
            this.renderQuiz();
            for(let i in data.ans) {
                const rb = document.querySelector(`input[name="q${i}"][value="${data.ans[i]}"]`);
                if(rb) rb.checked = true;
            }
            this.startTimer(data.time * 60);
        }
    },

    // --- TÍNH NĂNG: CHỈNH SỬA NÂNG CAO (EDITOR) ---
    checkEditCondition() {
        if(this.rawQuiz.length === 0) {
            ui.show('pop-loading'); // Giả lập để nhắc nhở
            setTimeout(() => { ui.hide('pop-loading'); alert("Huy cần tạo đề trước khi chỉnh sửa!"); }, 500);
            return;
        }
        this.currIdx = null;
        this.renderEditorList();
        ui.show('pop-editor-advanced');
    },

    renderEditorList() {
        document.getElementById('edit-header').innerText = "Danh sách câu hỏi";
        document.getElementById('btn-save-edit').classList.add('hidden');
        const area = document.getElementById('editor-content-area');
        area.innerHTML = this.rawQuiz.map((q, i) => `
            <div class="edit-btn-gate" onclick="app.openQuestionGate(${i})">
                <b>${i+1}.</b> ${q.question.substring(0, 60)}...
            </div>
        `).join('');
    },

    openQuestionGate(idx) {
        this.currIdx = idx;
        document.getElementById('edit-header').innerText = `Chỉnh sửa Câu ${idx+1}`;
        const area = document.getElementById('editor-content-area');
        area.innerHTML = `
            <button class="edit-btn-gate" onclick="app.renderEditForm('ans')">1. Chỉnh sửa Đáp án đúng</button>
            <button class="edit-btn-gate" onclick="app.renderEditForm('all')">2. Chỉnh sửa Nội dung (Câu hỏi & 4 Đáp án)</button>
        `;
    },

    renderEditForm(type) {
        const q = this.rawQuiz[this.currIdx];
        const area = document.getElementById('editor-content-area');
        const btnSave = document.getElementById('btn-save-edit');
        btnSave.classList.remove('hidden');

        if(type === 'ans') {
            area.innerHTML = `<p style="margin-bottom:15px">Chọn lại đáp án đúng:</p>` + 
                q.options.map((o, i) => `<label style="display:block; margin:10px 0"><input type="radio" name="edit-correct" value="${i}" ${i===q.correct?'checked':''}> ${o}</label>`).join('');
            btnSave.onclick = () => {
                this.rawQuiz[this.currIdx].correct = parseInt(document.querySelector('input[name="edit-correct"]:checked').value);
                this.renderEditorList();
            };
        } else {
            area.innerHTML = `
                <div style="text-align:left">
                    <label>Câu hỏi:</label><textarea id="ed-q" style="width:100%; height:80px; margin-bottom:15px">${q.question}</textarea>
                    ${q.options.map((o, i) => `<label>Đáp án ${i+1}:</label><input id="ed-o${i}" value="${o}" style="width:100%; margin-bottom:10px">`).join('')}
                </div>
            `;
            btnSave.onclick = () => {
                this.rawQuiz[this.currIdx].question = document.getElementById('ed-q').value;
                this.rawQuiz[this.currIdx].options = [0,1,2,3].map(i => document.getElementById(`ed-o${i}`).value);
                this.renderEditorList();
            };
        }
    },

    editorBack() {
        if(document.getElementById('edit-header').innerText === "Danh sách câu hỏi") ui.close('pop-editor-advanced');
        else this.renderEditorList();
    },

    // --- TÍNH NĂNG: XUẤT PDF ---
    exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const title = document.getElementById('quiz-title').value || "Ket qua OTTN181";
        doc.text("KET QUA BAI LAM - OTTN181", 105, 20, { align: "center" });
        const rows = this.displayQuiz.map((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            const uAns = sel ? q.options[sel.value] : "N/A";
            return [i+1, q.question.substring(0, 50), q.options[q.correct], uAns, (sel && parseInt(sel.value)===q.correct?"DUNG":"SAI")];
        });
        doc.autoTable({ startY: 30, head: [['STT', 'Cau hoi', 'Dap an dung', 'Ban chon', 'Ket qua']], body: rows });
        doc.save(`${title}.pdf`);
    },

    // --- LOGIC CỐT LÕI ---
    async handleAI() {
        const file = document.getElementById('file-upload').files[0];
        const prompt = document.getElementById('ai-prompt').value.trim();
        if(!file && !prompt) {
            ui.show('pop-loading'); // Alert trá hình
            const f = document.getElementById('wrap-file'), p = document.getElementById('wrap-prompt');
            f.classList.add('blink-active'); p.classList.add('blink-active');
            setTimeout(() => { ui.hide('pop-loading'); f.classList.remove('blink-active'); p.classList.remove('blink-active'); }, 3000);
            return;
        }
        this.saveCurrentState();
        ui.show('pop-loading');
        this.runBar();
        try {
            let txt = file ? await QuizAI.extractText(file) : "Manual Mode";
            this.rawQuiz = await QuizAI.generate({ text: txt, prompt, count: document.getElementById('q-count').value, mode: document.getElementById('quiz-mode').value });
        } catch (e) { this.abortProcess(); alert("AI Busy!"); }
    },

    runBar() {
        this.prog = 0;
        const itv = setInterval(() => {
            this.prog++;
            document.getElementById('bar-fill').style.width = this.prog + "%";
            if(this.prog >= 100) { clearInterval(itv); ui.hide('pop-loading'); ui.show('pop-congrats'); }
        }, 70);
    },

    startQuiz() {
        const p = document.getElementById('quiz-pass').value;
        if(p && prompt("Mật khẩu đề thi:") !== p) return;
        ui.hide('pop-name'); ui.hide('control-panel'); ui.show('workspace');
        this.displayQuiz = JSON.parse(JSON.stringify(this.rawQuiz));
        if(document.getElementById('mix-q').checked) this.displayQuiz.sort(() => Math.random() - 0.5);
        this.renderQuiz();
        this.startTimer(document.getElementById('q-time').value * 60);
    },

    renderQuiz() {
        document.getElementById('display-title').innerText = document.getElementById('quiz-title').value || "Bài làm OTTN181";
        document.getElementById('quiz-render').innerHTML = this.displayQuiz.map((q, i) => `
            <div class="q-card" style="background:white; padding:20px; border-radius:20px; margin-bottom:15px">
                <h4>Câu ${i+1}: ${q.question}</h4>
                ${q.options.map((o, j) => `<label style="display:block; margin-top:10px; cursor:pointer"><input type="radio" name="q${i}" value="${j}"> ${o}</label>`).join('')}
            </div>
        `).join('');
    },

    startTimer(sec) {
        this.timer = setInterval(() => {
            sec--;
            let m = Math.floor(sec/60), s = sec%60;
            document.getElementById('display-timer').innerText = `${m}:${s<10?'0':''}${s}`;
            if(sec <= 0) this.finishQuiz();
        }, 1000);
    },

    finishQuiz() {
        clearInterval(this.timer);
        localStorage.removeItem('ottn181_save');
        let s = 0;
        this.displayQuiz.forEach((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            if(sel && parseInt(sel.value) === q.correct) s++;
        });
        document.getElementById('final-score').innerText = s;
        document.getElementById('result-text').innerText = `Chúc mừng bạn đã hoàn thành đề thi!`;
        ui.show('pop-result');
    },

    saveCurrentState() {
        this.history = { t: document.getElementById('quiz-title').value, c: document.getElementById('q-count').value, tm: document.getElementById('q-time').value, m: document.getElementById('quiz-mode').value, pr: document.getElementById('ai-prompt').value };
    },

    restoreSettings() {
        document.getElementById('quiz-title').value = this.history.t || "";
        document.getElementById('q-count').value = this.history.c || 10;
        document.getElementById('q-time').value = this.history.tm || 15;
        document.getElementById('quiz-mode').value = this.history.m || "normal";
        document.getElementById('ai-prompt').value = this.history.pr || "";
        alert("Đã khôi phục cài đặt trước!");
    },

    runNano() {
        const c = document.getElementById('nano-canvas'), ctx = c.getContext('2d');
        let ps = [];
        const res = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
        window.onresize = res; res();
        for(let i=0; i<70; i++) ps.push({x:Math.random()*c.width, y:Math.random()*c.height, v:Math.random()*0.5+0.1});
        const draw = () => {
            ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle = "rgba(26,115,232,0.12)";
            ps.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, 7); ctx.fill(); p.y += p.v; if(p.y>c.height) p.y=-5; });
            requestAnimationFrame(draw);
        };
        draw();
    },

    abortProcess() { clearInterval(this.prog); ui.hide('pop-loading'); }
};

const ui = {
    show(id) { document.getElementById(id).classList.remove('hidden'); },
    hide(id) { document.getElementById(id).classList.add('hidden'); },
    close(id) { document.getElementById(id).classList.add('hidden'); }
};

app.init();
