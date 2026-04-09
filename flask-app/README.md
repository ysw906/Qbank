# 과학 문제 생성기

과학 교재(PDF)를 업로드하면 AI가 자동으로 문제를 생성하고, 사용자가 직접 수정·저장·재사용할 수 있는 도구입니다.

## 주요 기능

- **PDF 업로드**: 과학 교재 PDF를 업로드하면 텍스트를 추출하고 단원별로 분류
- **문제 생성 설정**: 단원 선택, 문제 수(3~10), 유형(객관식/서술형/혼합), 난이도(쉬움/보통/어려움) 설정
- **AI 문제 생성**: Ollama 로컬 LLM을 활용한 문제 자동 생성 (없으면 데모 모드)
- **문제 편집**: 카드형 UI로 문제/보기/정답/해설 수정, 재생성, 오답만 재생성
- **문제 저장소**: SQLite DB에 문제 저장, 단원별 분류, 재사용
- **사용자 스타일 반영**: 수정 이력을 학습하여 다음 문제 생성에 반영

## 실행 방법

### 1. 필수 환경

- Python 3.10 이상

### 2. 패키지 설치

```bash
pip install -r requirements.txt
```

### 3. 실행

```bash
python app.py
```

브라우저에서 `http://localhost:5000` 접속

## Ollama 설치 (선택사항)

Ollama를 설치하면 실제 AI가 문제를 생성합니다. 없으면 데모 모드로 동작합니다.

### macOS

```bash
brew install ollama
ollama serve
ollama pull llama3
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull llama3
```

### Windows

[ollama.com](https://ollama.com)에서 설치 파일 다운로드 후 실행

```bash
ollama pull llama3
```

## 기술 스택

- Python Flask
- Jinja2 템플릿
- SQLite
- pdfplumber (PDF 텍스트 추출)
- requests (Ollama API 호출)

## 프로젝트 구조

```
flask-app/
├── app.py              # 메인 서버
├── requirements.txt    # 패키지 목록
├── questions.db        # SQLite 데이터베이스 (자동 생성)
├── utils/
│   ├── db.py           # 데이터베이스 관리
│   ├── pdf_parser.py   # PDF 텍스트 추출 및 단원 분리
│   └── question_gen.py # 문제 생성 (Ollama / 데모)
├── templates/
│   ├── base.html       # 기본 레이아웃
│   ├── upload.html     # 업로드 화면
│   ├── settings.html   # 설정 화면
│   ├── editor.html     # 문제 편집 화면
│   └── storage.html    # 저장소 화면
├── static/
│   ├── css/style.css   # 스타일
│   └── js/main.js      # 클라이언트 스크립트
└── uploads/            # 업로드된 PDF 파일
```
