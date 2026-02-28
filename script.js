/** * DIAMOND ORCHESTRATOR v6.0
 * Quản lý: 3 Danh mục, 100% Tính năng cũ, 3 Tính năng mới
 */
const app = {
    quiz: [], activeQuiz: [], timer: null, startT: null, userName: "",

    init() {
        this.renderBg();
        this.loadData();
        setInterval(() => document.getElementById('system-clock').innerText = new Date().toLocaleTimeString(), 1000);
        // Recovery System: Khôi phục nếu đang thi mà bị reload
        const saved = localStorage.getItem('d_session');
        if (saved) ui.confirm("KHÔI PHỤC", "Huy có muốn làm tiếp bài thi đang dở không?", () => this.resume(JSON.parse(saved)));
    },

    // 1. LUỒNG CHÍNH
    async generateFlow() {
        const file = document.getElementById('in-file').files[0];
        const prompt = document.getElementById('in-prompt').value;
        if (!file && !prompt) return ui.alert("THIẾU DỮ LIỆU", "Huy hãy cung cấp file hoặc văn bản nhé.");

        ui.show('layer-load');
        ui.progress(0, 90, 4000);

        const text = file ? await AI_ENGINE.read(file) : prompt;
        this.sourceText = text; // Lưu lại để AI Insight dùng
        const res = await AI_ENGINE.generate({
            text, count: document.getElementById('in-count').value,
            mode: document.getElementById('in-mode').value, prompt
        });

        if (res) {
            this.quiz = res; this.activeQuiz = JSON.parse(JSON.stringify(res));
            ui.progress(90, 100, 500, () => { ui.hide('layer-load'); ui.show('layer-pre'); });
        } else {
            ui.hide('layer-load'); ui.alert("LỖI AI", "AI gặp khó khăn khi đọc file. Huy thử lại nhé.");
        }
    },

    // 2. PRE-EXAM & EDITOR (Xáo trộn, Sửa)
    shuffleQ() { this.activeQuiz.sort(() => Math.random() - 0.5); ui.alert("DIAMOND", "Đã xáo trộn câu hỏi."); },
    shuffleA() {
        this.activeQuiz.forEach(q => {
            const correctText = q.options[q.correct];
            q.options.sort(() => Math.random() - 0.5);
            q.correct = q.options.indexOf(correctText);
        });
        ui.alert("DIAMOND", "Đã xáo trộn đáp án.");
    },
    openEditor() {
        const body = document.getElementById('ed-body');
        body.innerHTML = this.activeQuiz.map((q, i) => `
            <div class="ed-card" style="margin-bottom:20px; padding:15px; border:1px solid #eee; border-radius:15px">
                <textarea onchange="app.activeQuiz[${i}].question=this.value" style="width:100%">${q.question}</textarea>
                ${q.options.map((o, j) => `<input type="text" onchange="app.activeQuiz[${i}].options[${j}]=this.value" value="${o}" style="display:block; margin:5px 0; width:100%">`).join('')}
            </div>
        `).join('');
        ui.show('layer-editor');
    },

    // 3. WORKSPACE (Không gian làm bài)
    startExam() {
        this.userName = document.getElementById('user-name').value;
        if (!this.userName) return ui.alert("LỖI", "Huy nhập tên để ghi danh nhé.");
        ui.hide('layer-pre'); ui.show('layer-work');
        this.startT = new Date();
        document.getElementById('ws-title').innerText = document.getElementById('in-title').value || "Kỳ thi Diamond";
        this.renderWS();
        this.startClock(document.getElementById('in-time').value * 60);
    },

    renderWS() {
        const b = document.getElementById('ws-body');
        b.innerHTML = this.activeQuiz.map((q, i) => `
            <div class="q-card-ws ani-slide-up" style="padding:30px; border-bottom:1px solid #f0f0f0">
                <h3>Câu ${i+1}: ${q.question}</h3>
                <div class="opts-ws" style="margin-top:20px">
                    ${q.options.map((o, j) => `<label style="display:block; margin:15px 0; cursor:pointer"><input type="radio" name="q${i}" value="${j}" onchange="app.saveSession()"> ${o}</label>`).join('')}
                </div>
            </div>
        `).join('');
    },

    saveSession() {
        const answers = this.activeQuiz.map((_, i) => {
            const r = document.querySelector(`input[name="q${i}"]:checked`);
            return r ? r.value : null;
        });
        localStorage.setItem('d_session', JSON.stringify({ name: this.userName, answers, quiz: this.activeQuiz, title: document.getElementById('ws-title').innerText }));
    },

    async submitExam() {
        clearInterval(this.timer);
        localStorage.removeItem('d_session');
        let score = 0;
        const userResults = this.activeQuiz.map((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            const isCorrect = sel && parseInt(sel.value) === q.correct;
            if (isCorrect) score++;
            return { q: q.question, correct: isCorrect };
        });

        ui.show('layer-load');
        document.getElementById('load-text').innerText = "AI đang phân tích kết quả...";
        const insight = await AI_ENGINE.getInsight(userResults, this.sourceText);
        
        ui.hide('layer-load');
        this.showResult(score, insight);
        this.recordData(score);
    },

    showResult(score, insight) {
        ui.show('layer-result');
        document.getElementById('res-score').innerText = `${score}/${this.activeQuiz.length}`;
        document.getElementById('res-name').innerText = this.userName;
        document.getElementById('res-insight').innerText = insight;
    },

    confirmExit() {
        ui.confirm("THOÁT BÀI THI?", "Dữ liệu chưa nộp sẽ bị mất. Huy có chắc không?", () => {
            clearInterval(this.timer); localStorage.removeItem('d_session'); location.reload();
        });
    },

    // 4. STORAGE & TABS
    recordData(score) {
        const now = new Date();
        const duration = Math.floor((now - this.startT) / 1000);
        const log = {
            name: this.userName, title: document.getElementById('ws-title').innerText,
            score, total: this.activeQuiz.length,
            time: `${Math.floor(duration/60)}p ${duration%60}s`,
            rawSec: duration, date: now.toLocaleString(), startAt: this.startT.toLocaleTimeString()
        };
        let h = JSON.parse(localStorage.getItem('d_history') || '[]');
        h.unshift(log);
        localStorage.setItem('d_history', JSON.stringify(h.slice(0, 50)));
        this.loadData();
    },

    loadData() {
        const h = JSON.parse(localStorage.getItem('d_history') || '[]');
        const rank = [...h].sort((a,b) => b.score - a.score || a.rawSec - b.rawSec);
        
        document.getElementById('rank-render').innerHTML = `
            <div class="rank-item" style="font-weight:900; color:#1e88e5"><span>#</span><span>TÊN</span><span>ĐIỂM</span><span>THỜI GIAN</span><span>BẮT ĐẦU</span></div>
            ${rank.map((it, i) => `<div class="rank-item"><span>${i+1}</span><b>${it.name}</b><span>${it.score}/${it.total}</span><span>${it.time}</span><span>${it.startAt}</span></div>`).join('')}
        `;
        document.getElementById('logs-render').innerHTML = h.map(it => `<div class="rank-item"><span>${it.date}</span><b>${it.title}</b><span>${it.name}</span><b>${it.score}/${it.total}</b><span>${it.time}</span></div>`).join('');
    },

    // UTILS
    startClock(s) {
        const el = document.getElementById('ws-clock');
        this.timer = setInterval(() => {
            s--;
            let m = Math.floor(s/60), sec = s%60;
            el.innerText = `${m}:${sec < 10 ? '0' : ''}${sec}`;
            if (s <= 0) this.submitExam();
        }, 1000);
    },

    exportCert() {
        html2canvas(document.getElementById('certificate-area')).then(canvas => {
            const link = document.createElement('a');
            link.download = `Diamond_Result_${this.userName}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    },

    renderBg() {
        const c = document.getElementById('diamond-bg'), ctx = c.getContext('2d');
        const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
        window.onresize = resize; resize();
        let pts = Array.from({length: 30}, () => ({x: Math.random()*c.width, y: Math.random()*c.height, v: Math.random()*0.4 + 0.1}));
        const draw = () => {
            ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle = "rgba(30,136,229,0.15)";
            pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill(); p.y -= p.v; if(p.y < 0) p.y = c.height; });
            requestAnimationFrame(draw);
        }; draw();
    }
};

const ui = {
    show(id) { document.getElementById(id).classList.remove('hidden'); },
    hide(id) { document.getElementById(id).classList.add('hidden'); },
    switchTab(tab) {
        document.querySelectorAll('.t-btn, .tab-content').forEach(e => e.classList.remove('active'));
        document.querySelector(`[onclick="ui.switchTab('${tab}')"]`).classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
    },
    alert(t, m) { this.show('layer-alert'); document.getElementById('alt-title').innerText = t; document.getElementById('alt-msg').innerText = m; document.getElementById('alt-cancel').classList.add('hidden'); document.getElementById('alt-ok').onclick = () => this.hide('layer-alert'); },
    confirm(t, m, cb) { this.show('layer-alert'); document.getElementById('alt-title').innerText = t; document.getElementById('alt-msg').innerText = m; document.getElementById('alt-cancel').classList.remove('hidden'); document.getElementById('alt-cancel').onclick = () => this.hide('layer-alert'); document.getElementById('alt-ok').onclick = () => { this.hide('layer-alert'); cb(); }; },
    progress(f, t, d, cb) { gsap.to('#prog-fill', { width: t + "%", duration: d/1000, onComplete: cb }); }
};

app.init();
