# Workspace

## Overview

pnpm workspace monorepo using TypeScript + Python Flask. The main application is a Flask-based science question generator tool.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Python version**: 3.12
- **Package manager**: pnpm (JS), pip (Python)
- **Main App**: Python Flask (flask-app/)
- **Database**: SQLite (questions.db in flask-app/)
- **PDF Processing**: pdfplumber
- **AI**: Ollama (optional, demo mode fallback)
- **API framework**: Express 5 (api-server, background)

## Project Structure

- `flask-app/` — Main Flask application (science question generator)
  - `app.py` — Flask server
  - `utils/db.py` — SQLite database operations
  - `utils/pdf_parser.py` — PDF text extraction and chapter splitting
  - `utils/question_gen.py` — Question generation (Ollama / demo mode)
  - `templates/` — Jinja2 templates (upload, settings, editor, storage)
  - `static/` — CSS and JavaScript
- `artifacts/api-server/` — Express API server (background)
- `lib/` — Shared TypeScript libraries

## Key Commands

- Flask app runs via artifact workflow on port 20111
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Features

1. PDF upload and text extraction with chapter splitting
2. Question generation settings (chapter, count, type, difficulty)
3. AI question generation via Ollama (or demo mode)
4. Card-based question editor with regenerate/save
5. SQLite question storage with chapter filtering
6. User style learning from edits
