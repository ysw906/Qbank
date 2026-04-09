import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'questions.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS textbooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            textbook_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            chapter_order INTEGER DEFAULT 0,
            FOREIGN KEY (textbook_id) REFERENCES textbooks(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER,
            chapter_title TEXT,
            question_type TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            question_text TEXT NOT NULL,
            choices TEXT,
            answer TEXT NOT NULL,
            explanation TEXT,
            is_edited INTEGER DEFAULT 0,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_style (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_question TEXT,
            edited_question TEXT,
            edit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()


def save_textbook(filename):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO textbooks (filename) VALUES (?)', (filename,))
    textbook_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return textbook_id


def save_chapter(textbook_id, title, content, order):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO chapters (textbook_id, title, content, chapter_order) VALUES (?, ?, ?, ?)',
        (textbook_id, title, content, order)
    )
    chapter_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return chapter_id


def get_chapters(textbook_id):
    conn = get_db()
    chapters = conn.execute(
        'SELECT * FROM chapters WHERE textbook_id = ? ORDER BY chapter_order',
        (textbook_id,)
    ).fetchall()
    conn.close()
    return chapters


def save_question(chapter_id, chapter_title, question_type, difficulty,
                  question_text, choices, answer, explanation):
    conn = get_db()
    cursor = conn.cursor()
    choices_json = json.dumps(choices, ensure_ascii=False) if choices else None
    cursor.execute('''
        INSERT INTO questions 
        (chapter_id, chapter_title, question_type, difficulty, question_text, choices, answer, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (chapter_id, chapter_title, question_type, difficulty,
          question_text, choices_json, answer, explanation))
    question_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return question_id


def update_question(question_id, question_text, choices, answer, explanation):
    conn = get_db()
    choices_json = json.dumps(choices, ensure_ascii=False) if choices else None
    conn.execute('''
        UPDATE questions 
        SET question_text = ?, choices = ?, answer = ?, explanation = ?, is_edited = 1
        WHERE id = ?
    ''', (question_text, choices_json, answer, explanation, question_id))
    conn.commit()
    conn.close()


def get_saved_questions(chapter_title=None):
    conn = get_db()
    if chapter_title:
        questions = conn.execute(
            'SELECT * FROM questions WHERE chapter_title = ? ORDER BY created_date DESC',
            (chapter_title,)
        ).fetchall()
    else:
        questions = conn.execute(
            'SELECT * FROM questions ORDER BY created_date DESC'
        ).fetchall()
    conn.close()
    return questions


def get_question_by_id(question_id):
    conn = get_db()
    question = conn.execute(
        'SELECT * FROM questions WHERE id = ?', (question_id,)
    ).fetchone()
    conn.close()
    return question


def delete_question(question_id):
    conn = get_db()
    conn.execute('DELETE FROM questions WHERE id = ?', (question_id,))
    conn.commit()
    conn.close()


def get_chapter_titles():
    conn = get_db()
    titles = conn.execute(
        'SELECT DISTINCT chapter_title FROM questions WHERE chapter_title IS NOT NULL ORDER BY chapter_title'
    ).fetchall()
    conn.close()
    return [t['chapter_title'] for t in titles]


def save_user_edit(original, edited):
    conn = get_db()
    conn.execute(
        'INSERT INTO user_style (original_question, edited_question) VALUES (?, ?)',
        (original, edited)
    )
    conn.commit()
    conn.close()


def get_user_style_samples(limit=5):
    conn = get_db()
    samples = conn.execute(
        'SELECT edited_question FROM user_style ORDER BY edit_date DESC LIMIT ?',
        (limit,)
    ).fetchall()
    conn.close()
    return [s['edited_question'] for s in samples]
