/** * OMNI SCRIPT v3.0 - BY HUY
 * Toàn bộ logic được nâng cấp lên Expert Level 
 */
const app = {
    data: [],
    display: [],
    editIdx: null,
    timer: null,

    init() {
        this.drawNano();
        this.renderHistory();
        document.getElementById('btn-run').onclick = () => this.runAI();
        // Sửa lỗi phím Enter
        document.addEventListener('keydown', e => { if(e.key === 'Enter' && !ui.isVisible('pop-auth')) return; });
    },

    // 1. CHỨC NĂNG AI & LOADING
    async runAI() {
        const file = document.getElementById('f-upload').files[0];
        const prompt = document.getElementById('q-prompt').value.trim();

        if(!file && !prompt) return ui.alert("LỖI", "Huy cần nhập dữ liệu hoặc tải file nhé!");

        ui.show('pop-loading');
        ui.progress(0, 90, 3000);

        const text = file ? await AICore.read(file) : "Manual Input";
        const result = await AICore.analyze({
            text, prompt, 
            count: document.getElementById('q-count').value,
            mode: document.getElementById('q-mode').value
        });

        if(result) {
            this.data = result;
            ui.progress(90, 100, 500, () => {
                ui.hide('pop-loading');
                ui.show('pop-auth');
            });
        }
    },

    verifyAndStart() {
        const name = document.getElementById('u-name').value;
        if(!name) return ui.alert("THIẾU TÊN", "Vui lòng nhập tên để lưu BXH!");
        ui.hide('pop-auth');
        this.startWorkspace();
    },

    // 2. WORKSPACE POPUP
    startWorkspace() {
        ui.show('pop-workspace');
        document.getElementById('ws-title').innerText = document.getElementById('q-title').value;
        
        this.display = JSON.parse(JSON.stringify(this.data));
        // Xáo trộn chuyên nghiệp
        this.display.sort(() => Math.random() - 0.5);
        
        this.renderExam();
        this.startTimer(document.getElementById('q-time').value * 60);
    },

    renderExam() {
        const body = document.getElementById('ws-body');
        body.innerHTML = this.display.map((q, i) => `
            <div class="q-card" style="padding:25px; background:white; border-radius:25px; margin-bottom:15px; border:1px solid #eee">
                <h4 style="margin-bottom:15px">Câu ${i+1}: ${q.question}</h4>
                ${q.options.map((o, j) => `
                    <label style="display:block; margin:10px 0; cursor:pointer">
                        <input type="radio" name="q${i}" value="${j}"> ${o}
                    </label>
                `).join('')}
            </div>
        `).join('');
        gsap.from('.q-card', { opacity: 0, y: 20, stagger: 0.1 });
    },

    submit() {
        clearInterval(this.timer);
        let score = 0;
        this.display.forEach((q, i) => {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            if(sel && parseInt(sel.value) === q.correct) score++;
        });

        this.saveResult(score);
        this.exportPDF(score);
        ui.alert("HOÀN THÀNH", `Huy đạt ${score}/${this.display.length} điểm. Kết quả đã lưu vào lịch sử!`, () => location.reload());
    },

    // 3. HISTORY & BXH SPACE
    saveResult(s) {
        let history = JSON.parse(localStorage.getItem('d_history') || '[]');
        history.unshift({
            name: document.getElementById('u-name').value,
            title: document.getElementById('q-title').value,
            score: s,
            total: this.display.length,
            time: new Date().toLocaleString()
        });
        localStorage.setItem('d_history', JSON.stringify(history.slice(0, 50)));
    },

    renderHistory() {
        const h = JSON.parse(localStorage.getItem('d_history') || '[]');
        const area = document.getElementById('history-list');
        if(h.length === 0) {
            area.innerHTML = "<p style='text-align:center; color:#999; margin-top:50px'>Chưa có lịch sử làm bài.</p>";
            return;
        }
        area.innerHTML = `
            <table style="width:100%; border-collapse:collapse">
                <tr style="text-align:left; color:#777; font-size:12px"><th>THỜI GIAN</th><th>TÊN</th><th>BÀI THI</th><th>ĐIỂM</th></tr>
                ${h.map(it => `
                    <tr style="border-bottom:1px solid #eee">
                        <td style="padding:15px 0; font-size:11px">${it.time}</td>
                        <td><b>${it.name}</b></td>
                        <td>${it.title}</td>
                        <td><span style="color:var(--primary); font-weight:800">${it.score}/${it.total}</span></td>
                    </tr>
                `).join('')}
            </table>
        `;
    },

    // 4. EDITOR TRÁI (GIỮ NGUYÊN & NÂNG CẤP)
    openEditor() {
        if(this.data.length === 0) return ui.alert("TRỐNG", "Huy cần tạo đề trước!");
        this.renderEditList();
        ui.show('pop-editor');
    },

    renderEditList() {
        const area = document.getElementById('edit-area');
        document.getElementById('btn-save-edit').classList.add('hidden');
        area.innerHTML = this.data.map((q, i) => `
            <div onclick="app.gateEdit(${i})" style="padding:15px; background:#f9f9f9; border-radius:15px; margin-bottom:10px; cursor:pointer">
                <b>${i+1}.</b> ${q.question.substring(0, 50)}...
            </div>
        `).join('');
    },

    gateEdit(idx) {
        this.editIdx = idx;
        const q = this.data[idx];
        const area = document.getElementById('edit-area');
        const save = document.getElementById('btn-save-edit');
        save.classList.remove('hidden');
        area.innerHTML = `
            <textarea id="ed-q" style="height:100px; margin-bottom:10px">${q.question}</textarea>
            ${q.options.map((o, i) => `<input id="ed-o${i}" value="${o}" style="margin-bottom:5px">`).join('')}
            <p style="margin-top:10px">Đáp án đúng (0-3): <input type="number" id="ed-c" value="${q.correct}" min="0" max="3"></p>
        `;
        save.onclick = () => {
            this.data[this.editIdx].question = document.getElementById('ed-q').value;
            this.data[this.editIdx].options = [0,1,2,3].map(i => document.getElementById(`ed-o${i}`).value);
            this.data[this.editIdx].correct = parseInt(document.getElementById('ed-c').value);
            this.renderEditList();
        };
    },

    // UTILS
    startTimer(sec) {
        const disp = document.getElementById('ws-timer');
        this.timer = setInterval(() => {
            sec--;
            let m = Math.floor(sec/60), s = sec%60;
            disp.innerText = `${m}:${s<10?'0':''}${s}`;
            if(sec <= 0) this.submit();
        }, 1000);
    },

    exportPDF(score) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(`DIAMOND RESULT - ${document.getElementById('u-name').value}`, 20, 20);
        const rows = this.display.map((q, i) => [i+1, q.question.substring(0, 50), q.options[q.correct]]);
        doc.autoTable({ startY: 30, head: [['STT', 'Câu hỏi', 'Đáp án']], body: rows });
        doc.save('Diamond_Result.pdf');
    },

    drawNano() {
        const c = document.getElementById('nano-canvas'), ctx = c.getContext('2d');
        let ps = [];
        const res = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
        window.onresize = res; res();
        for(let i=0; i<50; i++) ps.push({x:Math.random()*c.width, y:Math.random()*c.height, v:Math.random()*0.2+0.1});
        const draw = () => {
            ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle = "rgba(26,115,232,0.08)";
            ps.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, 7); ctx.fill(); p.y += p.v; if(p.y>c.height) p.y=-5; });
            requestAnimationFrame(draw);
        };
        draw();
    }
};

const ui = {
    show(id) { document.getElementById(id).classList.remove('hidden'); },
    hide(id) { document.getElementById(id).classList.add('hidden'); },
    isVisible(id) { return !document.getElementById(id).classList.contains('hidden'); },
    
    switchTab(tab) {
        document.querySelectorAll('.tab-content, .nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-'+tab).classList.add('active');
        event.target.classList.add('active');
    },

    alert(title, msg, callback) {
        this.show('pop-alert');
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-msg').innerText = msg;
        document.getElementById('alert-ok').onclick = () => {
            this.hide('pop-alert');
            if(callback) callback();
        };
    },

    progress(from, to, duration, cb) {
        const fill = document.getElementById('p-fill');
        gsap.to(fill, { width: to + "%", duration: duration/1000, onComplete: cb });
    }
};

app.init();
