async function generateWithAI(prompt) {
    const res = await fetch("http://localhost:5000/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    return data.result;
}

// ── 로컬 스토리지 키 ────────────────────────
var STORAGE_KEY = 'sciQuiz_questions';
var SESSION_KEY = 'sciQuiz_session';

// ── 유틸 ────────────────────────────────────
function showToast(msg, type) {
    var ex = document.querySelector('.toast');
    if (ex) ex.remove();
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'success');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
}

function showLoading(msg) {
    var ex = document.getElementById('loading-overlay');
    if (ex) return;
    var o = document.createElement('div');
    o.id = 'loading-overlay';
    o.className = 'loading-overlay';
    o.innerHTML = '<div class="spinner"></div><p class="loading-text">' + (msg || '처리 중...') + '</p>';
    document.body.appendChild(o);
}

function hideLoading() {
    var o = document.getElementById('loading-overlay');
    if (o) o.remove();
}

function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function getSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { return []; }
}

function setSaved(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || []; } catch(e) { return []; }
}

function setSession(arr) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(arr));
}

// ── 샘플 데이터 ─────────────────────────────
var DEMO_CHAPTERS = [
    { title: '1단원. 물질의 구조와 특성', content: '원자, 분자, 이온, 화학결합의 종류와 특성에 대한 내용' },
    { title: '2단원. 화학 반응의 규칙성', content: '질량 보존 법칙, 일정 성분비 법칙, 화학 반응식 작성' },
    { title: '3단원. 지구와 우주', content: '태양계 구조, 지구의 자전과 공전, 별과 은하' },
    { title: '4단원. 생명과 진화', content: '세포의 구조와 기능, 유전, 진화의 원리' },
    { title: '5단원. 힘과 운동', content: '뉴턴의 운동 법칙, 중력, 마찰력, 에너지 보존' },
];

var DEMO_QUESTIONS = [
    {
        type: 'multiple_choice',
        question: '다음 중 원자의 구성 요소가 올바르게 짝지어진 것은?',
        choices: ['양성자, 중성자, 전자', '양성자, 전자, 이온', '중성자, 전자, 분자', '양성자, 중성자, 원소'],
        answer: '①',
        explanation: '원자는 핵 속의 양성자와 중성자, 핵 주위를 도는 전자로 구성됩니다.',
        chapterTitle: '1단원. 물질의 구조와 특성'
    },
    {
        type: 'short_answer',
        question: '화학 반응에서 반응 전후 물질의 총 질량이 변하지 않는 법칙을 무엇이라 하는가?',
        choices: null,
        answer: '질량 보존 법칙',
        explanation: '라부아지에가 발견한 질량 보존 법칙으로, 화학 반응에서 반응물의 총 질량 = 생성물의 총 질량입니다.',
        chapterTitle: '2단원. 화학 반응의 규칙성'
    },
    {
        type: 'multiple_choice',
        question: '태양계에서 가장 큰 행성은?',
        choices: ['토성', '목성', '천왕성', '해왕성'],
        answer: '②',
        explanation: '목성은 태양계에서 가장 큰 행성으로, 지구 질량의 약 318배에 달합니다.',
        chapterTitle: '3단원. 지구와 우주'
    },
    {
        type: 'short_answer',
        question: 'DNA의 이중 나선 구조에서 아데닌(A)과 쌍을 이루는 염기는?',
        choices: null,
        answer: '타이민(T)',
        explanation: 'DNA에서 염기 쌍 결합 규칙: A-T, G-C. RNA에서는 A-U 쌍을 이룹니다.',
        chapterTitle: '4단원. 생명과 진화'
    },
    {
        type: 'multiple_choice',
        question: '뉴턴의 운동 제2법칙에 따르면 힘(F)과 질량(m), 가속도(a)의 관계는?',
        choices: ['F = m + a', 'F = m × a', 'F = m / a', 'F = a / m'],
        answer: '②',
        explanation: 'F = ma. 힘은 질량과 가속도의 곱으로, 힘이 클수록 가속도가 크고 질량이 클수록 가속도가 작습니다.',
        chapterTitle: '5단원. 힘과 운동'
    }
];

// ── 업로드 페이지 ────────────────────────────
function setupUploadZone() {
    var zone = document.getElementById('upload-zone');
    var input = document.getElementById('pdf-file');
    if (!zone || !input) return;

    zone.addEventListener('click', function() { input.click(); });

    zone.addEventListener('dragover', function(e) {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', function() { zone.classList.remove('dragover'); });
    zone.addEventListener('drop', function(e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            input.files = e.dataTransfer.files;
            onFileSelected(input.files[0]);
        }
    });
    input.addEventListener('change', function() {
        if (input.files.length > 0) onFileSelected(input.files[0]);
    });
}

function onFileSelected(file) {
    document.getElementById('upload-title').textContent = file.name;
    document.getElementById('upload-desc').textContent = '파일이 선택되었습니다.';
}

function handleUpload() {
    var input = document.getElementById('pdf-file');
    if (!input.files || input.files.length === 0) {
        showToast('PDF 파일을 먼저 선택해주세요.', 'error');
        return;
    }
    showLoading('PDF를 분석하고 있습니다...');
    setTimeout(function() {
        hideLoading();
        sessionStorage.setItem('sciQuiz_chapters', JSON.stringify(DEMO_CHAPTERS));
        window.location.href = 'settings.html';
    }, 1800);
}

// ── 설정 페이지 ─────────────────────────────
function renderSettings() {
    var chapters;
    try { chapters = JSON.parse(sessionStorage.getItem('sciQuiz_chapters')); } catch(e) { chapters = null; }
    if (!chapters || chapters.length === 0) chapters = DEMO_CHAPTERS;

    var container = document.getElementById('chapter-list');
    if (!container) return;
    container.innerHTML = '';
    chapters.forEach(function(ch, i) {
        var div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML =
            '<input type="checkbox" name="chapters" value="' + i + '" id="ch-' + i + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<label for="ch-' + i + '"><strong>' + escHtml(ch.title) + '</strong><small>' + escHtml(ch.content.substring(0, 80)) + '...</small></label>';
        container.appendChild(div);
    });
}

async function generateQuestions() {
    var chapters;
    try { chapters = JSON.parse(sessionStorage.getItem('sciQuiz_chapters')); } catch(e) { chapters = null; }
    if (!chapters || chapters.length === 0) chapters = DEMO_CHAPTERS;

    var selected = [];
    document.querySelectorAll('input[name="chapters"]:checked').forEach(function(cb) {
        selected.push(parseInt(cb.value));
    });

    if (selected.length === 0) {
        showToast('최소 1개의 단원을 선택하세요.', 'error');
        return;
    }

    var count = parseInt(document.getElementById('q-count').value);
    var type = document.querySelector('input[name="q-type"]:checked').value;

    showLoading('AI가 문제를 생성 중입니다...');

    try {
        var selectedTitles = selected.map(function(i) {
            return chapters[i].title;
        });

        var prompt = `
다음 단원을 기반으로 중학교 과학 문제 ${count}개를 만들어줘.

조건:
- 반드시 JSON 배열만 출력 (설명 금지)
- 형식:

[
  {
    "type": "multiple_choice 또는 short_answer",
    "question": "문제",
    "choices": ["보기1","보기2","보기3","보기4"], 
    "answer": "정답",
    "explanation": "해설"
  }
]

- 객관식이면 choices 포함
- 서술형이면 choices = null

단원:
${selectedTitles.join(", ")}

문제 유형: ${type}
`;

        var result = await generateWithAI(prompt);

        // 👉 JSON 파싱
        var questions = JSON.parse(result);

        // 단원 정보 붙이기
        questions.forEach(function(q, i) {
            q.chapterTitle = selectedTitles[i % selectedTitles.length];
        });

        setSession(questions);

        hideLoading();
        window.location.href = 'editor.html';

    } catch (err) {
        console.error(err);
        hideLoading();
        showToast('AI 문제 생성 실패 (JSON 오류 가능)', 'error');
    }
}

// ── 편집기 ───────────────────────────────────
function renderEditorQuestions() {
    var questions = getSession();
    var container = document.getElementById('questions-container');
    var emptyState = document.getElementById('empty-state');
    if (!container) return;

    if (questions.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    var mc = 0, sa = 0;
    questions.forEach(function(q) { if (q.type === 'multiple_choice') mc++; else sa++; });

    var totalEl = document.getElementById('total-count');
    var mcEl    = document.getElementById('mc-count');
    var saEl    = document.getElementById('sa-count');
    if (totalEl) totalEl.textContent = questions.length;
    if (mcEl) mcEl.textContent = mc;
    if (saEl) saEl.textContent = sa;

    container.innerHTML = '';
    questions.forEach(function(q, i) {
        container.appendChild(buildEditorCard(q, i));
    });
}

function buildEditorCard(q, i) {
    var div = document.createElement('div');
    div.className = 'question-card';
    div.id = 'question-card-' + i;
    div.dataset.type = q.type;

    var choicesHtml = '';
    if (q.type === 'multiple_choice' && q.choices) {
        choicesHtml = '<div class="choices-section"><label class="form-label">보기</label>';
        q.choices.forEach(function(ch, ci) {
            choicesHtml += '<div class="choice-item"><div class="choice-num">' + (ci+1) + '</div>' +
                '<input type="text" class="form-control choice-input" value="' + escHtml(ch) + '"></div>';
        });
        choicesHtml += '<div style="margin-bottom:.75rem;"></div></div>';
    }

    var regenChoicesBtn = q.type === 'multiple_choice' ?
        '<button class="btn btn-ghost btn-sm" onclick="regenChoicesDemo(' + i + ')">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>오답만</button>' : '';

    div.innerHTML =
        '<div class="question-card-header">' +
            '<div class="question-number">' +
                '<div class="q-num">' + (i+1) + '</div>' +
                '<span class="question-badge ' + (q.type === 'multiple_choice' ? 'badge-mc' : 'badge-sa') + '">' +
                    (q.type === 'multiple_choice' ? '객관식' : '서술형') +
                '</span>' +
                (q.chapterTitle ? '<span class="badge-chapter">' + escHtml(q.chapterTitle) + '</span>' : '') +
            '</div>' +
            '<div class="question-actions">' +
                '<button class="btn btn-ghost btn-sm" onclick="regenDemo(' + i + ')">' +
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>재생성' +
                '</button>' +
                regenChoicesBtn +
                '<button class="btn btn-success btn-sm" onclick="saveEditorQuestion(' + i + ')">' +
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>저장' +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div class="question-card-body">' +
            '<div class="form-group"><label class="form-label">문제</label>' +
            '<textarea class="form-control question-text" rows="3">' + escHtml(q.question) + '</textarea></div>' +
            choicesHtml +
            '<div class="grid-2" style="gap:.75rem;">' +
                '<div class="form-group" style="margin-bottom:0;"><label class="form-label">정답</label>' +
                '<textarea class="form-control answer-text" rows="2">' + escHtml(q.answer) + '</textarea></div>' +
                '<div class="form-group" style="margin-bottom:0;"><label class="form-label">해설</label>' +
                '<textarea class="form-control explanation-text" rows="2">' + escHtml(q.explanation || '') + '</textarea></div>' +
            '</div>' +
        '</div>';
    return div;
}

function regenDemo(i) {
    var questions = getSession();
    var pool = DEMO_QUESTIONS;
    var newQ = JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
    if (questions[i]) newQ.chapterTitle = questions[i].chapterTitle;
    questions[i] = newQ;
    setSession(questions);
    var container = document.getElementById('questions-container');
    var oldCard = document.getElementById('question-card-' + i);
    var newCard = buildEditorCard(newQ, i);
    container.replaceChild(newCard, oldCard);
    showToast('문제가 재생성되었습니다!', 'success');
}

function regenChoicesDemo(i) {
    var card = document.getElementById('question-card-' + i);
    var newChoices = ['새 보기 A', '새 보기 B', '새 보기 C', '새 보기 D'];
    var inputs = card.querySelectorAll('.choice-input');
    inputs.forEach(function(inp, ci) { if (newChoices[ci]) inp.value = newChoices[ci]; });
    showToast('보기가 재생성되었습니다!', 'success');
}

function saveEditorQuestion(i) {
    var card = document.getElementById('question-card-' + i);
    var questionText = card.querySelector('.question-text').value;
    var answer       = card.querySelector('.answer-text').value;
    var explanation  = card.querySelector('.explanation-text').value;
    var type         = card.dataset.type;
    var chapterTitle = '';
    var chBadge = card.querySelector('.badge-chapter');
    if (chBadge) chapterTitle = chBadge.textContent;

    var choices = null;
    if (type === 'multiple_choice') {
        choices = [];
        card.querySelectorAll('.choice-input').forEach(function(inp) { choices.push(inp.value); });
    }

    var saved = getSaved();
    var newQ = {
        id: Date.now() + '_' + i,
        type: type,
        question: questionText,
        choices: choices,
        answer: answer,
        explanation: explanation,
        chapterTitle: chapterTitle,
        savedAt: new Date().toISOString()
    };
    saved.push(newQ);
    setSaved(saved);

    var numDiv = card.querySelector('.question-number');
    if (!numDiv.querySelector('.saved-badge')) {
        var badge = document.createElement('span');
        badge.className = 'saved-badge';
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 저장됨';
        numDiv.appendChild(badge);
    }
    showToast('문제가 저장되었습니다!', 'success');
}

// ── 저장소 ───────────────────────────────────
var currentFilter = null;

function renderStorageQuestions(filter) {
    currentFilter = filter || null;
    var saved = getSaved();
    var container = document.getElementById('storage-container');
    var emptyState = document.getElementById('empty-state');
    var countEl = document.getElementById('storage-count');
    if (!container) return;

    // 단원 필터 버튼
    var filterBar = document.getElementById('filter-bar');
    if (filterBar) {
        var chapters = [];
        saved.forEach(function(q) { if (q.chapterTitle && chapters.indexOf(q.chapterTitle) === -1) chapters.push(q.chapterTitle); });
        var extra = filterBar.querySelectorAll('.filter-chapter');
        extra.forEach(function(el) { el.remove(); });
        chapters.forEach(function(ch) {
            var btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-outline filter-chapter';
            if (currentFilter === ch) btn.className = 'btn btn-sm btn-primary filter-chapter';
            btn.textContent = ch.length > 18 ? ch.substring(0, 18) + '…' : ch;
            btn.onclick = function() { filterByChapter(ch); };
            filterBar.appendChild(btn);
        });
        var allBtn = document.getElementById('filter-all');
        if (allBtn) allBtn.className = 'btn btn-sm ' + (currentFilter ? 'btn-outline' : 'btn-primary');
    }

    var filtered = currentFilter ? saved.filter(function(q) { return q.chapterTitle === currentFilter; }) : saved;

    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = '';
    filtered.forEach(function(q) { container.appendChild(buildStorageCard(q)); });
}

function filterByChapter(ch) {
    renderStorageQuestions(ch);
}

function buildStorageCard(q) {
    var div = document.createElement('div');
    div.className = 'question-card';
    div.id = 'storage-card-' + q.id;

    var choicesHtml = '';
    if (q.choices && q.choices.length > 0) {
        choicesHtml = '<div class="choices-section"><label class="form-label">보기</label>';
        q.choices.forEach(function(ch, ci) {
            choicesHtml += '<div class="choice-item"><div class="choice-num">' + (ci+1) + '</div>' +
                '<input type="text" class="form-control choice-input" value="' + escHtml(ch) + '"></div>';
        });
        choicesHtml += '<div style="margin-bottom:.75rem;"></div></div>';
    }

    var savedDate = '';
    if (q.savedAt) {
        var d = new Date(q.savedAt);
        savedDate = d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
    }

    div.innerHTML =
        '<div class="question-card-header">' +
            '<div class="question-number">' +
                '<div class="q-num" style="background:linear-gradient(135deg,#64748b,#475569);font-size:.65rem;">' + savedDate + '</div>' +
                '<span class="question-badge ' + (q.type === 'multiple_choice' ? 'badge-mc' : 'badge-sa') + '">' +
                    (q.type === 'multiple_choice' ? '객관식' : '서술형') +
                '</span>' +
                (q.chapterTitle ? '<span class="badge-chapter">' + escHtml(q.chapterTitle) + '</span>' : '') +
                '<span class="saved-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 저장됨</span>' +
            '</div>' +
            '<div class="question-actions">' +
                '<button class="btn btn-success btn-sm" onclick="updateStorageQuestion(\'' + q.id + '\')">' +
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>수정저장' +
                '</button>' +
                '<button class="btn btn-danger btn-sm" onclick="deleteStorageQuestion(\'' + q.id + '\')">' +
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>삭제' +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div class="question-card-body">' +
            '<div class="form-group"><label class="form-label">문제</label>' +
            '<textarea class="form-control question-text" rows="3">' + escHtml(q.question) + '</textarea></div>' +
            choicesHtml +
            '<div class="grid-2" style="gap:.75rem;">' +
                '<div class="form-group" style="margin-bottom:0;"><label class="form-label">정답</label>' +
                '<textarea class="form-control answer-text" rows="2">' + escHtml(q.answer) + '</textarea></div>' +
                '<div class="form-group" style="margin-bottom:0;"><label class="form-label">해설</label>' +
                '<textarea class="form-control explanation-text" rows="2">' + escHtml(q.explanation || '') + '</textarea></div>' +
            '</div>' +
        '</div>';
    return div;
}

function updateStorageQuestion(id) {
    var card = document.getElementById('storage-card-' + id);
    var saved = getSaved();
    var idx = saved.findIndex(function(q) { return q.id == id; });
    if (idx === -1) { showToast('문제를 찾을 수 없습니다.', 'error'); return; }

    saved[idx].question = card.querySelector('.question-text').value;
    saved[idx].answer = card.querySelector('.answer-text').value;
    saved[idx].explanation = card.querySelector('.explanation-text').value;

    var choices = [];
    card.querySelectorAll('.choice-input').forEach(function(inp) { choices.push(inp.value); });
    if (choices.length > 0) saved[idx].choices = choices;

    setSaved(saved);
    showToast('수정 사항이 저장되었습니다!', 'success');
}

function deleteStorageQuestion(id) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    var saved = getSaved().filter(function(q) { return q.id != id; });
    setSaved(saved);
    var card = document.getElementById('storage-card-' + id);
    card.style.opacity = '0';
    card.style.transform = 'translateY(-8px)';
    card.style.transition = 'all .3s ease';
    setTimeout(function() {
        card.remove();
        var countEl = document.getElementById('storage-count');
        if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1;
    }, 300);
    showToast('문제가 삭제되었습니다.', 'success');
}
