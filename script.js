/** * OTTN181 v1 - MAIN SCRIPT (ULTIMATE) */

const app = {
    originalData: [],
    workingData: [],
    userName: "",
    isDataLoaded: false,

    init() {
        this.initNano();
        document.getElementById('btn-run').onclick = () => this.handleAIProcess();
        document.getElementById('btn-done').onclick = () => this.submitQuiz();
        this.renderLeaderboard();
    },

    initNano() {
        const canvas = document.getElementById('nano-canvas');
        const ctx = canvas.getContext('2d');
        let pts = [];
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.onresize = resize; resize();
        for(let i=0; i<80; i++) pts.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, s:Math.random()*2, v:Math.random()*0.3+0.1});
        const anim = () => {
            ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle = "rgba(26,115,232,0.15)";
            pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); p.y += p.v; if(p.y>canvas.height) p.y=-5; });
            requestAnimationFrame(anim);
        };
        anim();
    },

    checkEditCondition() {
        if(!this.isDataLoaded) return ui.show('pop-error');
        this.openEditor();
    },

    async handleAIProcess() {
        const file = document.getElementById('file-upload').files[0];
        const prompt = document.getElementById('ai-prompt').value;
        
        ui.show('pop-loading');
        this.startProgress(7000);

        try {
            let text = "";
            if(file) text = await QuizAI.extractText(file);
            
            this.originalData = await QuizAI.generate({
                text: text, prompt: prompt,
                count: document.getElementById('q-count').value,
                mode: document.getElementById('quiz-mode').value
            });

            this.isDataLoaded = true;
            setTimeout(() => { ui.hide('pop-loading'); ui.show('pop-name'); }, 7000);
        } catch (e) {
            ui.hide('pop-loading');
            alert("Lỗi: " + e.message);
        }
    },

    startProgress(time) {
        let p = 0;
        const fill = document.getElementById('bar-fill');
        const txt = document.getElementById('load-txt');
        const iv = setInterval(() => {
            p += 1; fill.style.width = p + "%";
            if(p>30) txt.innerText = "Đang tối ưu câu hỏi...";
            if(p>70) txt.innerText = "Đang kiểm duyệt đáp án...";
            if(p>=100) clearInterval(iv);
        }, time/100);
    },

    confirmEntry(skip = false) {
        const passSet = document.getElementById('quiz-pass').value;
        if(passSet) {
            const passTrial = prompt("Nhập mật khẩu để bắt đầu bài làm:");
            if(passTrial !== passSet) return alert("Sai mật khẩu!");
        }

        const name = document.getElementById('user-name').value;
        if(!skip && !name) return alert("Vui lòng nhập tên!");
        this.userName = skip ? "" : name;
        ui.hide('pop-name');
        this.startQuiz();
    },

    startQuiz() {
        ui.hide('control-panel');
        ui.show('workspace');
        document.getElementById('display-title').innerText = document.getElementById('quiz-title').value || "Bài làm OTTN181";
        
        // Logic xáo trộn chuyên sâu
        this.workingData = JSON.parse(JSON.stringify(this.originalData));
        if(document.getElementById('mix-q').checked) this.workingData.sort(() => Math.random() - 0.5);
        
        if(document.getElementById('mix-a').checked) {
            this.workingData.forEach(q => {
                const correctText = q.options[q.correct];
                q.options.sort(() => Math.random() - 0.5);
                q.correct = q.options.indexOf(correctText);
            });
        }

        this.renderQuiz();
        this.runTimer();
    },

    renderQuiz() {
        const area = document.getElementById('quiz-render-area');
        area.innerHTML = this.workingData.map((q, i) => `
            <div class="q-card">
                <h4>Câu ${i+1}: ${q.question}</h4>
                ${q.options.map((o, j) => `
                    <label class="opt-lab"><input type="radio" name="q${i}" value="${j}"> ${o}</label>
                `).join('')}
            </div>
        `).join('');
    },

    openEditor() {
        const area = document.getElementById('editor-area');
        area.innerHTML = this.originalData.map((q, i) => `
            <div style="border-bottom:1px solid #eee; padding:15px 0;">
                <b>Câu ${i+1}:</b> <input type="text" value="${q.question}" onchange="app.originalData[${i}].question=this.value">
                <div style="margin-top:10px">
                    ${q.options.map((o, j) => `
                        <input type="text" value="${o}" onchange="app.originalData[${i}].options[${j}]=this.value" style="width:45%; margin:2px">
                    `).join('')}
                </div>
            </div>
        `).join('');
        ui.show('pop-editor');
    },

    submitQuiz() {
        let score = 0;
        this.workingData.forEach((q, i) => {
            const pick = document.querySelector(`input[name="q${i}"]:checked`);
            if(pick && parseInt(pick.value) === q.correct) score++;
        });

        const final = Math.round((score / this.workingData.length) * 10);
        if(this.userName) this.saveScore(this.userName, final);
        ui.showResult(final);
    },

    saveScore(n, s) {
        let db = JSON.parse(localStorage.getItem('ottn_db') || "[]");
        db.push({ n, s, t: new Date().toLocaleDateString() });
        db.sort((a,b) => b.s - a.s);
        localStorage.setItem('ottn_db', JSON.stringify(db.slice(0, 10)));
        this.renderLeaderboard();
    },

    renderLeaderboard() {
        const db = JSON.parse(localStorage.getItem('ottn_db') || "[]");
        document.getElementById('leaderboard-ui').innerHTML = db.map((x, i) => `
            <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <span>${i+1}. <b>${x.n}</b></span>
                <span>${x.s} điểm</span>
            </div>
        `).join('');
    },

    runTimer() {
        let sec = document.getElementById('q-time').value * 60;
        const timerUI = document.getElementById('display-timer');
        const iv = setInterval(() => {
            sec--;
            let m = Math.floor(sec/60), s = sec % 60;
            timerUI.innerText = `${m}:${s<10?'0':''}${s}`;
            if(sec <= 0) { clearInterval(iv); this.submitQuiz(); }
        }, 1000);
    },

    share() { navigator.clipboard.writeText(window.location.href); alert("Link bài làm đã được copy!"); }
};

const ui = {
    show(id) { document.getElementById(id).classList.remove('hidden'); },
    hide(id) { document.getElementById(id).classList.add('hidden'); },
    close(id) { document.getElementById(id).classList.add('hidden'); },
    showResult(s) {
        document.getElementById('score-val').innerText = s;
        document.getElementById('score-msg').innerText = s >= 8 ? "Huy khen: Quá xuất sắc!" : "Cần cố gắng thêm nhé!";
        this.show('pop-result');
    }
};

app.init();
  
