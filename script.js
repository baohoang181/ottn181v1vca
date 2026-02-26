/** OMNI SUPREME LOGIC - BY HUY */
const app = {
    rawQuiz: [],      // Kho dữ liệu gốc
    displayQuiz: [],  // Kho dữ liệu đang thi (đã xáo trộn)
    history: {},      // Lưu trạng thái cài đặt
    timer: null,
    progVal: 0,
    progTimer: null,
    editIdx: null,

    init() {
        this.runNanoBackground();
        this.loadAutoSave();
        this.saveCurrentSettings();
        document.getElementById('btn-run').onclick = () => this.startAISystem();
        document.getElementById('btn-submit').onclick = () => this.submitQuiz();
    },

    // 1. VÁ LỖ HỔNG: TỰ ĐỘNG LƯU & KHÔI PHỤC (Auto-Save)
    autoSave() {
        const answers = {};
        this.displayQuiz.forEach((_, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            if(sel) answers[i] = sel.value;
        });
        const packet = {
            quiz: this.displayQuiz,
            ans: answers,
            title: document.getElementById('quiz-title').value,
            time: document.getElementById('q-time').value
        };
        localStorage.setItem('ottn181_session', JSON.stringify(packet));
    },

    loadAutoSave() {
        const saved = localStorage.getItem('ottn181_session');
        if(!saved) return;
        if(confirm("Phát hiện bài làm chưa hoàn thành. Huy có muốn khôi phục không?")) {
            const data = JSON.parse(saved);
            this.displayQuiz = data.quiz;
            ui.hide('control-panel'); ui.show('workspace');
            this.renderQuizUI();
            for(let i in data.ans) {
                const rb = document.querySelector(`input[name="q${i}"][value="${data.ans[i]}"]`);
                if(rb) rb.checked = true;
            }
            this.startTimerLogic(data.time * 60);
        }
    },

    // 2. LIÊN KẾT: HỆ THỐNG AI & THANH TIẾN ĐỘ
    async startAISystem() {
        const file = document.getElementById('file-upload').files[0];
        const prompt = document.getElementById('ai-prompt').value.trim();

        if (!file && !prompt) {
            const b1 = document.getElementById('box-file'), b2 = document.getElementById('box-prompt');
            b1.classList.add('blink-warning'); b2.classList.add('blink-warning');
            setTimeout(() => { b1.classList.remove('blink-warning'); b2.classList.remove('blink-warning'); }, 3000);
            return;
        }

        ui.show('pop-loading');
        this.runProgressBar();

        try {
            let context = file ? await QuizAI.extractText(file) : "Chế độ nhập tay.";
            this.rawQuiz = await QuizAI.generate({
                text: context,
                prompt,
                count: document.getElementById('q-count').value,
                mode: document.getElementById('quiz-mode').value
            });
        } catch (e) {
            this.abortProcess();
            alert("Lỗi AI: Vui lòng kiểm tra lại nội dung hoặc API Key!");
        }
    },

    runProgressBar() {
        this.progVal = 0;
        clearInterval(this.progTimer);
        this.progTimer = setInterval(() => {
            this.progVal += 1;
            document.getElementById('bar-fill').style.width = this.progVal + "%";
            if(this.progVal >= 100) {
                clearInterval(this.progTimer);
                ui.hide('pop-loading');
                ui.show('pop-congrats');
            }
        }, 70); // 7 giây chuẩn cho trải nghiệm mượt
    },

    // 3. LIÊN KẾT: TRÌNH CHỈNH SỬA (NÚT X TRÁI)
    checkEditCondition() {
        if(this.rawQuiz.length === 0) return alert("Huy ơi, hãy tạo đề trước khi sửa!");
        this.renderEditorList();
        ui.show('pop-editor');
    },

    renderEditorList() {
        document.getElementById('edit-header').innerText = "Danh sách câu hỏi";
        document.getElementById('btn-save-edit').classList.add('hidden');
        const area = document.getElementById('edit-main-content');
        area.innerHTML = this.rawQuiz.map((q, i) => `
            <div class="edit-choice-card" onclick="app.openQuestionGate(${i})">
                <b>${i+1}.</b> ${q.question.substring(0, 65)}...
            </div>
        `).join('');
    },

    openQuestionGate(idx) {
        this.editIdx = idx;
        document.getElementById('edit-header').innerText = `Chỉnh sửa Câu ${idx+1}`;
        document.getElementById('edit-main-content').innerHTML = `
            <button class="edit-choice-card" onclick="app.renderEditForm('ans')">1. Chỉnh sửa Đáp án đúng (Giữ nguyên nội dung)</button>
            <button class="edit-choice-card" onclick="app.renderEditForm('all')">2. Chỉnh sửa Nội dung (Câu hỏi & 4 Đáp án)</button>
        `;
    },

    renderEditForm(type) {
        const q = this.rawQuiz[this.editIdx];
        const area = document.getElementById('edit-main-content');
        const saveBtn = document.getElementById('btn-save-edit');
        saveBtn.classList.remove('hidden');

        if(type === 'ans') {
            area.innerHTML = `<p style="margin-bottom:15px; font-size:14px; color:#666">Chọn đáp án đúng mới:</p>` + 
                q.options.map((o, i) => `<label style="display:block; margin:12px 0; font-weight:600"><input type="radio" name="ed-correct" value="${i}" ${i===q.correct?'checked':''}> ${o}</label>`).join('');
            saveBtn.onclick = () => {
                this.rawQuiz[this.editIdx].correct = parseInt(document.querySelector('input[name="ed-correct"]:checked').value);
                this.renderEditorList();
            };
        } else {
            area.innerHTML = `
                <div style="text-align:left">
                    <label style="font-size:12px; font-weight:800">CÂU HỎI:</label>
                    <textarea id="ed-q" style="width:100%; height:70px; padding:10px; border-radius:10px; border:1px solid #ddd; margin:8px 0">${q.question}</textarea>
                    <label style="font-size:12px; font-weight:800">4 ĐÁP ÁN:</label>
                    ${q.options.map((o, i) => `<input id="ed-o${i}" value="${o}" style="width:100%; padding:10px; border-radius:10px; border:1px solid #ddd; margin:5px 0">`).join('')}
                </div>
            `;
            saveBtn.onclick = () => {
                this.rawQuiz[this.editIdx].question = document.getElementById('ed-q').value;
                this.rawQuiz[this.editIdx].options = [0,1,2,3].map(i => document.getElementById(`ed-o${i}`).value);
                this.renderEditorList();
            };
        }
    },

    editorBack() {
        if(document.getElementById('edit-header').innerText === "Danh sách câu hỏi") ui.hide('pop-editor');
        else this.renderEditorList();
    },

    // 4. LIÊN KẾT: WORKSPACE & BẢNG XẾP HẠNG
    openNamePopup() { ui.hide('pop-congrats'); ui.show('pop-name'); },

    enterWorkspace() {
        const pass = document.getElementById('quiz-pass').value;
        if(pass && prompt("Mật khẩu đề thi:") !== pass) return alert("Sai mật khẩu!");

        ui.hide('pop-name'); ui.hide('control-panel'); ui.show('workspace');
        
        // Deep clone và xáo trộn
        this.displayQuiz = JSON.parse(JSON.stringify(this.rawQuiz));
        if(document.getElementById('mix-q').checked) this.displayQuiz.sort(() => Math.random() - 0.5);
        if(document.getElementById('mix-a').checked) {
            this.displayQuiz.forEach(q => {
                let correctText = q.options[q.correct];
                q.options.sort(() => Math.random() - 0.5);
                q.correct = q.options.indexOf(correctText);
            });
        }

        this.renderQuizUI();
        this.startTimerLogic(document.getElementById('q-time').value * 60);
        document.addEventListener('change', () => this.autoSave());
    },

    renderQuizUI() {
        document.getElementById('display-title').innerText = document.getElementById('quiz-title').value || "Bài thi OTTN181";
        document.getElementById('quiz-render-area').innerHTML = this.displayQuiz.map((q, i) => `
            <div class="q-card" style="background:white; padding:25px; border-radius:20px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03)">
                <h4 style="margin-bottom:15px; color:#334155">Câu ${i+1}: ${q.question}</h4>
                ${q.options.map((o, j) => `
                    <label style="display:block; margin:12px 0; cursor:pointer; font-size:14px">
                        <input type="radio" name="q${i}" value="${j}"> <span>${o}</span>
                    </label>
                `).join('')}
            </div>
        `).join('');
    },

    startTimerLogic(sec) {
        clearInterval(this.timer);
        this.timer = setInterval(() => {
            sec--;
            let m = Math.floor(sec/60), s = sec%60;
            document.getElementById('display-timer').innerText = `${m}:${s<10?'0':''}${s}`;
            if(sec <= 0) this.submitQuiz();
        }, 1000);
    },

    submitQuiz() {
        clearInterval(this.timer);
        localStorage.removeItem('ottn181_session'); // Xóa bài lưu tạm
        let score = 0;
        this.displayQuiz.forEach((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            if(sel && parseInt(sel.value) === q.correct) score++;
        });

        this.updateLeaderboard(score);
        this.exportToPDF(score);
        alert(`Hoàn thành! Huy đạt ${score}/${this.displayQuiz.length} điểm.`);
        location.reload();
    },

    updateLeaderboard(score) {
        let lb = JSON.parse(localStorage.getItem('ottn181_lb') || '[]');
        lb.push({
            name: document.getElementById('user-name').value || "Ẩn danh",
            score: score,
            total: this.displayQuiz.length,
            date: new Date().toLocaleDateString('vi-VN')
        });
        lb.sort((a, b) => b.score - a.score);
        localStorage.setItem('ottn181_lb', JSON.stringify(lb.slice(0, 10)));
    },

    showLeaderboard() {
        const lb = JSON.parse(localStorage.getItem('ottn181_lb') || '[]');
        document.getElementById('lb-body').innerHTML = lb.map((it, i) => `
            <tr><td>${i+1}</td><td>${it.name}</td><td>${it.score}/${it.total}</td><td>${it.date}</td></tr>
        `).join('');
        ui.hide('control-panel'); ui.show('leaderboard-section');
    },

    // 5. TIỆN ÍCH HỆ THỐNG (PDF & NANO)
    exportToPDF(score) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("KET QUA TRAC NGHIEM OTTN181", 105, 15, { align: "center" });
        const rows = this.displayQuiz.map((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            return [i+1, q.question.substring(0, 50), q.options[q.correct], sel ? q.options[sel.value] : "N/A"];
        });
        doc.autoTable({ startY: 25, head: [['STT', 'Cau hoi', 'Dap an dung', 'Ban chon']], body: rows });
        doc.save(`KetQua_${document.getElementById('user-name').value}.pdf`);
    },

    runNanoBackground() {
        const c = document.getElementById('nano-canvas'), ctx = c.getContext('2d');
        let ps = [];
        const res = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
        window.onresize = res; res();
        for(let i=0; i<60; i++) ps.push({x:Math.random()*c.width, y:Math.random()*c.height, v:Math.random()*0.4+0.1});
        const draw = () => {
            ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle = "rgba(26,115,232,0.1)";
            ps.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, 7); ctx.fill(); p.y += p.v; if(p.y>c.height) p.y=-5; });
            requestAnimationFrame(draw);
        };
        draw();
    },

    goHome() { ui.hide('leaderboard-section'); ui.show('control-panel'); },
    abortProcess() { clearInterval(this.progTimer); ui.hide('pop-loading'); },
    saveCurrentSettings() {
        this.history = { t: document.getElementById('quiz-title').value, c: document.getElementById('q-count').value, tm: document.getElementById('q-time').value, m: document.getElementById('quiz-mode').value, pr: document.getElementById('ai-prompt').value };
    },
    restoreSettings() {
        document.getElementById('quiz-title').value = this.history.t || "";
        document.getElementById('q-count').value = this.history.c || 10;
        document.getElementById('q-time').value = this.history.tm || 15;
        document.getElementById('quiz-mode').value = this.history.m || "content";
        document.getElementById('ai-prompt').value = this.history.pr || "";
    }
};

const ui = {
    show(id) { document.getElementById(id).classList.remove('hidden'); },
    hide(id) { document.getElementById(id).classList.add('hidden'); }
};

app.init();
