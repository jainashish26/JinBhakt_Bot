// --- STATE & INITIALIZATION ---
let currentLang = 'en';
let playerName = '';
let gameMode = 'chinh';
let timerInterval = null;
let startTime = 0;
let elapsedSeconds = 0;

// For Memory Game
let flippedCards = [];
let matchedPairs = 0;
let memoryDeck = [];
let canFlip = true;

// For Sorting Game
let sortOrder = [];
let hasMoved = false;
let selectedSortEl = null;

document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('player-name');
    if(nameInput) {
        nameInput.addEventListener('input', (e) => {
            document.getElementById('btn-start').disabled = e.target.value.trim() === '';
        });
    }
    
    document.querySelectorAll('.radio-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input').checked = true;
            gameMode = card.dataset.val;
        });
    });

    updateUI();
});

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    updateUI();
}

function updateUI() {
    const t = uiText[currentLang];
    const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text; };
    
    setText('header-title', t.headerTitle);
    setText('welcome-title', t.welcomeTitle);
    setText('welcome-desc', t.welcomeDesc);
    setText('name-label', t.nameLabel);
    setText('mode-label', t.modeLabel);
    setText('btn-start', t.btnStart);
    setText('memory-instructions', t.memInstr);
    setText('sort-instructions', t.sortInstr);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if(key === 'cat-chinh') el.innerText = t.catChinh;
        if(key === 'cat-complexion') el.innerText = t.catComplexion;
        if(key === 'cat-aasan') el.innerText = t.catAasan;
        if(key === 'cat-moksha') el.innerText = t.catMoksha;
    });

    if(document.getElementById('lb-body')) renderLeaderboard();
}

function startGame() {
    const t = uiText[currentLang];
    playerName = document.getElementById('player-name').value.trim();
    if(!playerName) return alert(t.alertName);

    // Route based on category
    if(gameMode === 'moksha') {
        // Since all Moksha sthals are Sammed Shikharji, sorting by sequence makes more sense while displaying Moksha info.
        window.location.href = 'sorting.html';
    } else {
        window.location.href = 'memory.html';
    }
}

// --- TIMER LOGIC ---
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
        const secs = (elapsedSeconds % 60).toString().padStart(2, '0');
        const el = document.getElementById('timer');
        if(el) el.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

// --- LEADERBOARD LOGIC ---
function toggleLeaderboard() {
    document.getElementById('leaderboard-panel').classList.toggle('hidden');
    renderLeaderboard();
}

function getLB() { return JSON.parse(localStorage.getItem('jainQuestLB') || '[]'); }

function saveScore(time, category) {
    const lb = getLB();
    lb.push({ name: playerName, time, category, date: Date.now() });
    lb.sort((a,b) => a.time - b.time);
    localStorage.setItem('jainQuestLB', JSON.stringify(lb.slice(0, 20)));
}

function renderLeaderboard() {
    const tbody = document.getElementById('lb-body');
    if(!tbody) return;
    const lb = getLB();
    tbody.innerHTML = '';
    const medals = ['🥇','🥈','🥉'];
    if(lb.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">No records yet.</td></tr>`; return; }
    
    lb.forEach((entry, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i < 3 ? medals[i] : i+1}</td>
            <td>${entry.name}</td>
            <td>${entry.category}</td>
            <td>${Math.floor(entry.time/60)}m ${entry.time%60}s</td>
        `;
        tbody.appendChild(tr);
    });
}

function clearLB() { if(confirm("Clear all records?")) { localStorage.removeItem('jainQuestLB'); renderLeaderboard(); } }

// ==========================================
// GAME 1: MEMORY MATCH (memory.html)
// ==========================================
function initMemoryGame() {
    const dispName = document.getElementById('disp-name');
    if(dispName) dispName.innerText = sessionStorage.getItem('playerName') || 'Player';
    
    // We pick 6 random Tirthankars per round to keep it kid-friendly (12 cards total)
    const shuffledT = [...tirthankars].sort(() => 0.5 - Math.random()).slice(0, 6);
    memoryDeck = [];

    shuffledT.forEach(t => {
        // Card 1: Name
        memoryDeck.push({ type: 'name', id: t.id, display: t[currentLang === 'hi' ? 'hi' : 'en'], tirth: t });
        
        // Card 2: Attribute based on selected mode
        let attrDisplay = '';
        let visualHtml = '';
        
        if(gameMode === 'chinh') {
            attrDisplay = currentLang === 'hi' ? t.chinh_hi : t.chinh_en;
            visualHtml = `<div class="visual-badge">${t.chinh_icon}</div>`;
        } else if(gameMode === 'complexion') {
            attrDisplay = currentLang === 'hi' ? t.comp_hi : t.comp_en;
            visualHtml = `<div class="visual-badge" style="background:${t.comp_hex};"></div>`;
        } else if(gameMode === 'aasan') {
            attrDisplay = currentLang === 'hi' ? t.aasan_hi : t.aasan_en;
            visualHtml = `<div class="visual-badge">${t.aasan_icon}</div>`;
        }
        
        memoryDeck.push({ type: 'attr', id: t.id, display: attrDisplay, visual: visualHtml, tirth: t });
    });

    memoryDeck.sort(() => 0.5 - Math.random());
    renderMemoryGrid();
    startTimer();
}

function renderMemoryGrid() {
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    flippedCards = [];
    matchedPairs = 0;
    canFlip = true;

    memoryDeck.forEach((cardData, index) => {
        const card = document.createElement('div');
        card.classList.add('mem-card');
        card.dataset.index = index;
        card.dataset.id = cardData.id;
        card.dataset.type = cardData.type;

        const front = document.createElement('div');
        front.classList.add('mem-face', 'mem-front');
        front.innerHTML = 'ॐ';

        const back = document.createElement('div');
        back.classList.add('mem-face', 'mem-back');
        back.innerHTML = `${cardData.visual || ''}<span>${cardData.display}</span>`;

        card.appendChild(front);
        card.appendChild(back);
        card.addEventListener('click', handleCardFlip);
        grid.appendChild(card);
    });
}

function handleCardFlip(e) {
    const card = e.currentTarget;
    if (!canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) return;

    card.classList.add('flipped');
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        canFlip = false;
        const [c1, c2] = flippedCards;
        
        // Check match: Same ID, different types (one name, one attr)
        if (c1.dataset.id === c2.dataset.id && c1.dataset.type !== c2.dataset.type) {
            // Match!
            setTimeout(() => {
                c1.classList.add('matched');
                c2.classList.add('matched');
                flippedCards = [];
                canFlip = true;
                matchedPairs++;
                
                if(matchedPairs === 6) finishGameLogic();
            }, 500);
        } else {
            // No match
            setTimeout(() => {
                c1.classList.remove('flipped');
                c2.classList.remove('flipped');
                flippedCards = [];
                canFlip = true;
            }, 1000);
        }
    }
}

function finishGameLogic() {
    stopTimer();
    saveScore(elapsedSeconds, gameMode);
    setTimeout(() => {
        alert(currentLang === 'hi' ? "बधाई हो! आपने पूरा कर लिया!" : "Congratulations! You completed the quest!");
        window.location.href = 'index.html';
    }, 500);
}


// ==========================================
// GAME 2: SORTING (sorting.html)
// ==========================================
function initSortingGame() {
    const dispName = document.getElementById('disp-name');
    if(dispName) dispName.innerText = sessionStorage.getItem('playerName') || 'Player';
    
    hasMoved = false;
    sortOrder = Array.from({length: 24}, (_, i) => i);
    shuffleArray(sortOrder);
    renderSortGrid();
}

function shuffleArray(arr) {
    for(let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function renderSortGrid() {
    const grid = document.getElementById('sort-grid');
    grid.innerHTML = '';

    sortOrder.forEach((tIdx, pos) => {
        const t = tirthankars[tIdx];
        const item = document.createElement('div');
        item.classList.add('sort-item');
        item.setAttribute('draggable', 'true');
        item.dataset.pos = pos;
        item.dataset.tIdx = tIdx;

        const badge = document.createElement('div');
        badge.classList.add('num-badge');
        badge.innerText = `${pos + 1}`;

        const name = document.createElement('span');
        name.innerText = currentLang === 'hi' ? t.hi : t.en;

        item.appendChild(badge);
        item.appendChild(name);

        if(hasMoved) applySortColor(item, pos, tIdx);

        // Desktop Drag Events
        item.addEventListener('dragstart', dragStart);
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('dragenter', e => { e.preventDefault(); item.classList.add('drag-over'); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', e => { e.preventDefault(); item.classList.remove('drag-over'); dropItem(pos); });
        item.addEventListener('dragend', () => document.querySelectorAll('.sort-item').forEach(i => i.classList.remove('drag-over')));

        // Mobile Tap Swap
        item.addEventListener('click', () => tapSwap(item, pos));

        grid.appendChild(item);
    });
}

let dragSrcPos = null;
function dragStart(e) {
    dragSrcPos = parseInt(this.dataset.pos);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function dropItem(targetPos) {
    if(dragSrcPos !== null && dragSrcPos !== targetPos) swapSort(dragSrcPos, targetPos);
}

function tapSwap(el, pos) {
    if(!selectedSortEl) {
        selectedSortEl = { el, pos };
        el.classList.add('selected');
    } else {
        if(selectedSortEl.pos === pos) {
            el.classList.remove('selected');
            selectedSortEl = null;
            return;
        }
        selectedSortEl.el.classList.remove('selected');
        swapSort(selectedSortEl.pos, pos);
        selectedSortEl = null;
    }
}

function swapSort(p1, p2) {
    [sortOrder[p1], sortOrder[p2]] = [sortOrder[p2], sortOrder[p1]];
    if(!hasMoved) {
        hasMoved = true;
        startTimer();
    }
    renderSortGrid();
}

function applySortColor(el, pos, tIdx) {
    el.classList.remove('validated-correct', 'validated-incorrect');
    if(pos === tIdx) el.classList.add('validated-correct');
    else el.classList.add('validated-incorrect');
}

function finishSorting() {
    const t = uiText[currentLang];
    const isCorrect = sortOrder.every((val, idx) => val === idx);
    if(!isCorrect) return alert(t.alertIncomplete);
    
    stopTimer();
    saveScore(elapsedSeconds, 'sequence');
    alert(currentLang === 'hi' ? "बधाई हो! सही क्रम!" : "Congratulations! Perfect Sequence!");
    window.location.href = 'index.html';
}

// Pass state between pages via SessionStorage
window.addEventListener('beforeunload', () => {
    const nameInp = document.getElementById('player-name');
    if(nameInp && nameInp.value) sessionStorage.setItem('playerName', nameInp.value);
});