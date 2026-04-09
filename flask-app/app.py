import os
import json
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from werkzeug.utils import secure_filename
from utils.db import (
    init_db, save_textbook, save_chapter, get_chapters,
    save_question, update_question, get_saved_questions,
    get_question_by_id, delete_question, get_chapter_titles,
    save_user_edit, get_user_style_samples
)
from utils.pdf_parser import extract_text_from_pdf, split_into_chapters
from utils.question_gen import (
    generate_questions, regenerate_single_question,
    regenerate_choices_only, check_ollama
)

app = Flask(__name__)
app.secret_key = os.environ.get('SESSION_SECRET', 'dev-secret-key-change-in-production')

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

init_db()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return render_template('upload.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'pdf_file' not in request.files:
        flash('파일을 선택해주세요.', 'error')
        return redirect(url_for('index'))

    file = request.files['pdf_file']
    if file.filename == '':
        flash('파일을 선택해주세요.', 'error')
        return redirect(url_for('index'))

    if not allowed_file(file.filename):
        flash('PDF 파일만 업로드 가능합니다.', 'error')
        return redirect(url_for('index'))

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        text = extract_text_from_pdf(filepath)
        if not text.strip():
            flash('PDF에서 텍스트를 추출할 수 없습니다.', 'error')
            return redirect(url_for('index'))

        chapters = split_into_chapters(text)
        textbook_id = save_textbook(filename)

        chapter_ids = []
        for i, chapter in enumerate(chapters):
            chapter_id = save_chapter(textbook_id, chapter['title'], chapter['content'], i)
            chapter_ids.append(chapter_id)

        session['textbook_id'] = textbook_id
        session['chapters'] = [
            {'id': chapter_ids[i], 'title': ch['title'], 'content': ch['content']}
            for i, ch in enumerate(chapters)
        ]

        flash(f'"{filename}" 업로드 완료! {len(chapters)}개의 단원을 찾았습니다.', 'success')
        return redirect(url_for('settings'))

    except Exception as e:
        flash(f'PDF 처리 중 오류 발생: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/settings')
def settings():
    chapters = session.get('chapters', [])
    if not chapters:
        flash('먼저 PDF를 업로드해주세요.', 'error')
        return redirect(url_for('index'))

    ollama_available = check_ollama()
    return render_template('settings.html', chapters=chapters, ollama_available=ollama_available)


@app.route('/generate', methods=['POST'])
def generate():
    chapters = session.get('chapters', [])
    if not chapters:
        flash('먼저 PDF를 업로드해주세요.', 'error')
        return redirect(url_for('index'))

    selected_chapters = request.form.getlist('chapters')
    question_count = int(request.form.get('question_count', 5))
    question_type = request.form.get('question_type', 'mixed')
    difficulty = request.form.get('difficulty', 'medium')

    if not selected_chapters:
        flash('최소 1개의 단원을 선택해주세요.', 'error')
        return redirect(url_for('settings'))

    all_questions = []
    is_demo = False
    style_samples = get_user_style_samples()

    for chapter_idx in selected_chapters:
        idx = int(chapter_idx)
        if idx < len(chapters):
            chapter = chapters[idx]
            questions, demo = generate_questions(
                chapter['content'], question_type, difficulty,
                question_count, style_samples
            )
            is_demo = is_demo or demo

            for q in questions:
                q['chapter_title'] = chapter['title']
                q['chapter_id'] = chapter['id']

            all_questions.extend(questions)

    session['generated_questions'] = all_questions
    session['generation_settings'] = {
        'question_type': question_type,
        'difficulty': difficulty,
        'question_count': question_count
    }

    return render_template(
        'editor.html',
        questions=all_questions,
        is_demo=is_demo,
        chapters=chapters
    )


@app.route('/api/regenerate', methods=['POST'])
def api_regenerate():
    data = request.get_json()
    idx = data.get('index', 0)
    chapters = session.get('chapters', [])
    settings_data = session.get('generation_settings', {})
    questions = session.get('generated_questions', [])

    if idx >= len(questions):
        return jsonify({'error': '잘못된 인덱스'}), 400

    q = questions[idx]
    chapter_content = ""
    for ch in chapters:
        if ch['title'] == q.get('chapter_title', ''):
            chapter_content = ch['content']
            break

    if not chapter_content and chapters:
        chapter_content = chapters[0]['content']

    style_samples = get_user_style_samples()
    new_q, is_demo = regenerate_single_question(
        chapter_content,
        q.get('type', settings_data.get('question_type', 'mixed')),
        settings_data.get('difficulty', 'medium'),
        style_samples
    )

    if new_q:
        new_q['chapter_title'] = q.get('chapter_title', '')
        new_q['chapter_id'] = q.get('chapter_id', '')
        questions[idx] = new_q
        session['generated_questions'] = questions
        return jsonify({'question': new_q, 'is_demo': is_demo})

    return jsonify({'error': '문제 재생성 실패'}), 500


@app.route('/api/regenerate_choices', methods=['POST'])
def api_regenerate_choices():
    data = request.get_json()
    idx = data.get('index', 0)
    chapters = session.get('chapters', [])
    questions = session.get('generated_questions', [])

    if idx >= len(questions):
        return jsonify({'error': '잘못된 인덱스'}), 400

    q = questions[idx]
    chapter_content = ""
    for ch in chapters:
        if ch['title'] == q.get('chapter_title', ''):
            chapter_content = ch['content']
            break

    new_choices = regenerate_choices_only(
        q['question'], q['answer'], chapter_content
    )

    questions[idx]['choices'] = new_choices
    session['generated_questions'] = questions

    return jsonify({'choices': new_choices})


@app.route('/api/save_question', methods=['POST'])
def api_save_question():
    data = request.get_json()
    chapter_id = data.get('chapter_id')
    chapter_title = data.get('chapter_title', '')
    question_type = data.get('type', 'multiple_choice')
    difficulty = session.get('generation_settings', {}).get('difficulty', 'medium')
    question_text = data.get('question', '')
    choices = data.get('choices')
    answer = data.get('answer', '')
    explanation = data.get('explanation', '')

    original = data.get('original_question', '')
    if original and original != question_text:
        save_user_edit(original, question_text)

    question_id = save_question(
        chapter_id, chapter_title, question_type, difficulty,
        question_text, choices, answer, explanation
    )

    return jsonify({'success': True, 'id': question_id})


@app.route('/api/update_question/<int:question_id>', methods=['PUT'])
def api_update_question(question_id):
    data = request.get_json()
    question_text = data.get('question', '')
    choices = data.get('choices')
    answer = data.get('answer', '')
    explanation = data.get('explanation', '')

    existing = get_question_by_id(question_id)
    if existing and existing['question_text'] != question_text:
        save_user_edit(existing['question_text'], question_text)

    update_question(question_id, question_text, choices, answer, explanation)
    return jsonify({'success': True})


@app.route('/api/delete_question/<int:question_id>', methods=['DELETE'])
def api_delete_question(question_id):
    delete_question(question_id)
    return jsonify({'success': True})


@app.route('/storage')
def storage():
    chapter_filter = request.args.get('chapter', '')
    chapter_titles = get_chapter_titles()

    if chapter_filter:
        questions = get_saved_questions(chapter_filter)
    else:
        questions = get_saved_questions()

    questions_list = []
    for q in questions:
        q_dict = dict(q)
        if q_dict.get('choices'):
            try:
                q_dict['choices'] = json.loads(q_dict['choices'])
            except (json.JSONDecodeError, TypeError):
                q_dict['choices'] = None
        questions_list.append(q_dict)

    return render_template(
        'storage.html',
        questions=questions_list,
        chapter_titles=chapter_titles,
        selected_chapter=chapter_filter
    )


@app.route('/api/load_question/<int:question_id>')
def api_load_question(question_id):
    q = get_question_by_id(question_id)
    if q:
        q_dict = dict(q)
        if q_dict.get('choices'):
            try:
                q_dict['choices'] = json.loads(q_dict['choices'])
            except (json.JSONDecodeError, TypeError):
                q_dict['choices'] = None
        return jsonify(q_dict)
    return jsonify({'error': '문제를 찾을 수 없습니다.'}), 404


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
