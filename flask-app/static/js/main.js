function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
}

function showLoading(message) {
    var existing = document.getElementById('loading-overlay');
    if (existing) return;
    var overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-overlay';
    overlay.innerHTML =
        '<div class="spinner"></div>' +
        '<p class="loading-text">' + (message || '처리 중...') + '</p>';
    document.body.appendChild(overlay);
}

function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ── 문제 전체 재생성 ─── */
function regenerateQuestion(index) {
    showLoading('문제를 재생성하고 있습니다...');
    fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: index })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideLoading();
        if (data.question) {
            updateQuestionCard(index, data.question);
            showToast('문제가 재생성되었습니다!', 'success');
        } else {
            showToast(data.error || '재생성 실패', 'error');
        }
    })
    .catch(function() { hideLoading(); showToast('오류가 발생했습니다.', 'error'); });
}

/* ── 보기만 재생성 ─── */
function regenerateChoices(index) {
    showLoading('보기를 재생성하고 있습니다...');
    fetch('/api/regenerate_choices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: index })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideLoading();
        if (data.choices) {
            var card = document.getElementById('question-card-' + index);
            var choiceInputs = card.querySelectorAll('.choice-input');
            data.choices.forEach(function(choice, i) {
                if (choiceInputs[i]) choiceInputs[i].value = choice;
            });
            showToast('보기가 재생성되었습니다!', 'success');
        } else {
            showToast('보기 재생성 실패', 'error');
        }
    })
    .catch(function() { hideLoading(); showToast('오류가 발생했습니다.', 'error'); });
}

/* ── 문제 저장 ─── */
function saveQuestion(index) {
    var card = document.getElementById('question-card-' + index);
    var questionText   = card.querySelector('.question-text').value;
    var answer         = card.querySelector('.answer-text').value;
    var explanation    = card.querySelector('.explanation-text').value;
    var type           = card.dataset.type;
    var chapterId      = card.dataset.chapterId;
    var chapterTitle   = card.dataset.chapterTitle;
    var originalQuestion = card.dataset.originalQuestion || '';

    var choices = null;
    if (type === 'multiple_choice') {
        choices = [];
        card.querySelectorAll('.choice-input').forEach(function(input) { choices.push(input.value); });
    }

    fetch('/api/save_question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chapter_id: chapterId,
            chapter_title: chapterTitle,
            type: type,
            question: questionText,
            choices: choices,
            answer: answer,
            explanation: explanation,
            original_question: originalQuestion
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            showToast('문제가 저장되었습니다!', 'success');
            var numDiv = card.querySelector('.question-number');
            if (!numDiv.querySelector('.saved-badge')) {
                var badge = document.createElement('span');
                badge.className = 'saved-badge';
                badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 저장됨';
                numDiv.appendChild(badge);
            }
        } else {
            showToast('저장 실패', 'error');
        }
    })
    .catch(function() { showToast('오류가 발생했습니다.', 'error'); });
}

/* ── 카드 전체 갱신 ─── */
function updateQuestionCard(index, q) {
    var card = document.getElementById('question-card-' + index);
    card.dataset.type = q.type;
    card.dataset.originalQuestion = q.question;

    var typeBadge = card.querySelector('.question-badge');
    if (q.type === 'multiple_choice') {
        typeBadge.className = 'question-badge badge-mc';
        typeBadge.textContent = '객관식';
    } else {
        typeBadge.className = 'question-badge badge-sa';
        typeBadge.textContent = '서술형';
    }

    card.querySelector('.question-text').value      = q.question;
    card.querySelector('.answer-text').value        = q.answer;
    card.querySelector('.explanation-text').value   = q.explanation || '';

    var choicesSection = card.querySelector('.choices-section');
    var regenChoicesBtn = card.querySelector('.btn-regen-choices');

    if (q.type === 'multiple_choice' && q.choices) {
        var html = '<label class="form-label">보기</label>';
        q.choices.forEach(function(choice, i) {
            html += '<div class="choice-item">' +
                    '<div class="choice-num">' + (i + 1) + '</div>' +
                    '<input type="text" class="form-control choice-input" value="' + escapeHtml(choice) + '">' +
                    '</div>';
        });
        html += '<div style="margin-bottom:1rem;"></div>';
        choicesSection.innerHTML = html;
        choicesSection.style.display = 'block';
        if (regenChoicesBtn) regenChoicesBtn.style.display = 'inline-flex';
    } else {
        choicesSection.innerHTML = '';
        choicesSection.style.display = 'none';
        if (regenChoicesBtn) regenChoicesBtn.style.display = 'none';
    }
}

/* ── 저장소 문제 수정 ─── */
function updateStorageQuestion(questionId) {
    var card = document.getElementById('storage-card-' + questionId);
    var questionText  = card.querySelector('.question-text').value;
    var answer        = card.querySelector('.answer-text').value;
    var explanation   = card.querySelector('.explanation-text').value;

    var choices = null;
    var choiceInputs = card.querySelectorAll('.choice-input');
    if (choiceInputs.length > 0) {
        choices = [];
        choiceInputs.forEach(function(input) { choices.push(input.value); });
    }

    fetch('/api/update_question/' + questionId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionText, choices: choices, answer: answer, explanation: explanation })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) showToast('수정 사항이 저장되었습니다!', 'success');
        else showToast('저장 실패', 'error');
    })
    .catch(function() { showToast('오류가 발생했습니다.', 'error'); });
}

/* ── 저장소 문제 삭제 ─── */
function deleteStorageQuestion(questionId) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    fetch('/api/delete_question/' + questionId, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            var card = document.getElementById('storage-card-' + questionId);
            card.style.opacity = '0';
            card.style.transform = 'translateY(-8px)';
            card.style.transition = 'all .3s ease';
            setTimeout(function() { card.remove(); }, 300);
            showToast('문제가 삭제되었습니다.', 'success');
        }
    })
    .catch(function() { showToast('삭제 실패', 'error'); });
}

/* ── Upload zone ─── */
function updateFileName(input) {
    if (input.files.length > 0) {
        var name = input.files[0].name;
        var title = document.getElementById('upload-title');
        var desc  = document.getElementById('upload-desc');
        if (title) title.textContent = name;
        if (desc)  desc.textContent  = '파일이 선택되었습니다. 아래 업로드 버튼을 클릭하세요.';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var uploadZone = document.getElementById('upload-zone');
    var fileInput  = document.getElementById('pdf-file');

    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', function() { fileInput.click(); });

        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', function() {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                updateFileName(fileInput);
            }
        });

        fileInput.addEventListener('change', function() { updateFileName(fileInput); });
    }
});
