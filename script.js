/** * DIAMOND ORCHESTRATOR v5.0
 * Quản lý: Trạng thái, Lưu trữ, 3 Danh mục
 */
const app = {
    coreQuiz: [],     // Dữ liệu AI trả về
    activeQuiz: [],   // Dữ liệu dùng để thi (đã xáo trộn/sửa)
    timer: null,
    startTime: null,

    init() {
        this.renderParticles();
        this.updateDataViews();
        // Storage Guardian: Tự khôi phục nếu dữ liệu hỏng
        if (!localStorage.getItem('d_history')) localStorage.setItem('d_history', '[]');
    },

    // 1. LUỒNG TẠO ĐỀ AI
    async generateAI() {
        const file = document.getElementById('cfg-file').files[0];
        const prompt = document.getElementById('cfg-prompt').value;
        if (!file && !prompt) return ui.alert("LỖI", "Huy cần cung cấp file hoặc yêu cầu.");

        ui.show('pop-loading');
        ui.progress(0, 95, 4000);

        const sourceText = file ? await AI_ENGINE.parseFile(file) : prompt;
        const result = await AI_ENGINE.analyze({
            text: sourceText,
            count: document.getElementById('cfg-count').value,
            mode: document.getElementById('cfg-mode').value,
            userPrompt: prompt
        });

        if (result && result.length > 0) {
            this.coreQuiz = result;
            this.activeQuiz = JSON.parse(JSON.stringify(result)); // Deep Clone
            ui.progress(95, 100, 500, () => {
                ui.hide('pop-loading');
                ui.show('pop-pre-exam'); // Hiện bảng 3 nút
            });
        } else {
            ui.hide('pop-loading');
            ui.alert("LỖI AI", "AI không trích xuất được câu trả lời từ file. Huy hãy kiểm tra lại file nhé!");
        }
    },

    // 2. CHỨC NĂNG PRE-EXAM (XÁO TRỘN & SỬA)
    shuffle(mode) {
        if (mode === 'Q') {
            this.activeQuiz.sort(() => Math.random() - 0.5);
            ui.alert("THÀNH CÔNG", "Đã xáo trộn thứ tự câu hỏi.");
        } else {
            this.activeQuiz.forEach(q => {
                const correctText = q.options[q.correct];
                q.options.sort(() => Math.random() - 0.5);
                q.correct = q.options.indexOf(correctText);
            });
            ui.alert("THÀNH CÔNG", "Đã xáo trộn các đáp án.");
        }
    },

    openEditor() {
        const view = document.getElementById('editor-view');
        view.innerHTML = this.activeQuiz.map((q, i) => `
            <div class="edit-card" onclick="app.loadToEdit(${i})">
                <b>Câu ${i+1}:</b> ${q.question.substring(0, 60)}...
            </div>
        `).join('');
        ui.show('pop-editor');
    },

    loadToEdit(idx) {
        const q = this.activeQuiz[idx];
        const view = document.getElementById('editor-view');
        document.getElementById('save-edit-btn').classList.remove('hidden');
        view.innerHTML = `
            <div class="edit-form">
                <textarea id="temp-q">${q.question}</textarea>
                ${q.options.map((o, i) => `
                    <div class="opt-row">
                        <input type="radio" name="temp-c" value="${i}" ${i === q.correct ? 'checked' : ''}>
                        <input type="text" id="temp-o${i}" value="${o}">
                    </div>
                `).join('')}
                <button class="btn-primary-diamond" onclick="app.saveEdit(${idx})">LƯU CÂU HỎI NÀY</button>
            </div>
        `;
    },

    saveEdit(idx) {
        this.activeQuiz[idx].question = document.getElementById('temp-q').value;
        this.activeQuiz[idx].options = [0,1,2,3].map(i => document.getElementById(`temp-o${i}`).value);
        this.activeQuiz[idx].correct = parseInt(document.querySelector('input[name="temp-c"]:checked').value);
        this.openEditor();
    },

    // 3. KHÔNG GIAN LÀM BÀI (WORKSPACE)
    launchWorkspace() {
        const name = document.getElementById('user-name').value;
        if (!name) return ui.alert("THIẾU TÊN", "Huy nhập tên để hệ thống ghi nhận kết quả nhé.");

        this.userName = name;
        this.startTime = new Date();
        ui.hide('pop-pre-exam');
        ui.show('pop-workspace');
        document.getElementById('ws-display-title').innerText = document.getElementById('cfg-title').value || "Bài thi Diamond";
        
        this.renderExam();
        this.startTimer(document.getElementById('cfg-time').value * 60);
    },

    renderExam() {
        const container = document.getElementById('ws-content');
        container.innerHTML = this.activeQuiz.map((q, i) => `
            <div class="q-wrap ani-item">
                <h4>Câu ${i+1}: ${q.question}</h4>
                <div class="opts">
                    ${q.options.map((o, j) => `
                        <label><input type="radio" name="q${i}" value="${j}"> ${o}</label>
                    `).join('')}
                </div>
            </div>
        `).join('');
        gsap.from('.ani-item', { opacity: 0, x: 20, stagger: 0.1 });
    },

    triggerExit() {
        ui.confirm("THOÁT BÀI THI?", "Mọi tiến trình làm bài của Huy sẽ bị hủy. Huy có chắc không?", () => {
            clearInterval(this.timer);
            ui.hide('pop-workspace');
        });
    },

    submitQuiz() {
        clearInterval(this.timer);
        let score = 0;
        this.activeQuiz.forEach((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            if (sel && parseInt(sel.value) === q.correct) score++;
        });

        this.recordResult(score);
        ui.alert("HOÀN THÀNH", `Huy đạt ${score}/${this.activeQuiz.length} điểm. Kết quả đã được lưu!`, () => location.reload());
    },

    // 4. QUẢN LÝ 3 DANH MỤC & STORAGE
    recordResult(score) {
        const now = new Date();
        const diff = Math.floor((now - this.startTime) / 1000);
        const result = {
            name: this.userName,
            title: document.getElementById('cfg-title').value || "Chưa đặt tên",
            score: score,
            total: this.activeQuiz.length,
            timeStr: `${Math.floor(diff/60)}p ${diff%60}s`,
            durationSec: diff,
            startTime: this.startTime.toLocaleTimeString(),
            fullDate: now.toLocaleString()
        };

        const history = JSON.parse(localStorage.getItem('d_history'));
        history.unshift(result);
        localStorage.setItem('d_history', JSON.stringify(history.slice(0, 50)));
        this.updateDataViews();
    },

    updateDataViews() {
        const history = JSON.parse(localStorage.getItem('d_history') || '[]');
        
        // BXH: Ưu tiên điểm cao, sau đó là thời gian làm nhanh nhất
        const sorted = [...history].sort((a,b) => b.score - a.score || a.durationSec - b.durationSec);
        document.getElementById('render-leaderboard').innerHTML = `
            <div class="list-head item-grid"><span>#</span><span>Tên</span><span>Điểm</span><span>Thời gian</span><span>Bắt đầu</span></div>
            ${sorted.map((it, i) => `
                <div class="list-item item-grid">
                    <b>${i+1}</b><span>${it.name}</span><b>${it.score}/${it.total}</b><span>${it.timeStr}</span><span>${it.startTime}</span>
                </div>
            `).join('')}
        `;

        // Lịch sử: Hiện toàn bộ chi tiết
        document.getElementById('render-history').innerHTML = history.map(it => `
            <div class="list-item history-grid">
                <span>${it.fullDate}</span><b>${it.title}</b><span>${it.name}</span><b>${it.score}/${it.total}</b>
            </div>
        `).join('');
    },

    // TIỆN ÍCH
    startTimer(sec) {
        const el = document.getElementById('ws-timer');
        this.timer = setInterval(() => {
            sec--;
            let m = Math.floor(sec/60), s = sec%60;
            el.innerText = `${m}:${s<10?'0':''}${s}`;
            if (sec < 60) el.style.color = '#ff4757';
            if (sec <= 0) this.submitQuiz();
        }, 1000);
    },

    renderParticles() {
        const c = document.getElementById('diamond-bg'), ctx = c.getContext('2d');
        const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
        window.onresize = resize; resize();
        let pts = Array.from({length: 40}, () => ({x: Math.random()*c.width, y: Math.random()*c.height, v: Math.random()*0.5 + 0.2, r: Math.random()*2}));
        const anim = () => {
            ctx.clearRect(0,0,c.width,c.height);
            ctx.fillStyle = "rgba(30, 136, 229, 0.2)";
            pts.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
                p.y -= p.v; if(p.y < 0) p.y = c.height;
            });
            requestAnimationFrame(anim);
        };
        anim();
    }
};

const ui = {
    show(id) { document.getElementById(id).classList.remove('hidden'); gsap.from(`#${id} .pop-card`, { scale: 0.8, opacity: 0, duration: 0.4 }); },
    hide(id) { document.getElementById(id).classList.add('hidden'); },
    tab(id) {
        document.querySelectorAll('.nav-btn, .tab-panel').forEach(el => el.classList.remove('active'));
        document.querySelector(`[onclick="ui.tab('${id}')"]`).classList.add('active');
        document.getElementById(`tab-${id}`).classList.add('active');
    },
    alert(title, body, cb) {
        this.show('pop-msg');
        document.getElementById('msg-title').innerText = title;
        document.getElementById('msg-body').innerText = body;
        document.getElementById('msg-cancel-btn').classList.add('hidden');
        document.getElementById('msg-ok-btn').onclick = () => { this.hide('pop-msg'); if(cb) cb(); };
    },
    confirm(title, body, cb) {
        this.show('pop-msg');
        document.getElementById('msg-title').innerText = title;
        document.getElementById('msg-body').innerText = body;
        document.getElementById('msg-cancel-btn').classList.remove('hidden');
        document.getElementById('msg-cancel-btn').onclick = () => this.hide('pop-msg');
        document.getElementById('msg-ok-btn').onclick = () => { this.hide('pop-msg'); cb(); };
    },
    progress(from, to, dur, cb) {
        gsap.to('#load-progress', { width: to + "%", duration: dur/1000, onComplete: cb });
    }
};

app.init();
