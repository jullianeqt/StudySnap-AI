# StudySnap AI ⚡

> **Turn your lessons into reviewers you'll actually want to read.**  
> *"Give me 30 pages of lecture material → give me the 3–5 pages of information I actually need to review."*

StudySnap AI is a modern, student-friendly web application designed to transform college and high-school learning materials (**PDFs**, **PowerPoint PPT/PPTX presentations**, **lesson images/diagrams/notes**, and **plain text**) into high-yield, exam-focused digital study sheets, interactive flashcards, comparison tables, step-by-step procedures, and customizable practice quizzes.

---

## ✨ Key Features

### 1. Multi-Format Learning Material Ingestion
- 📄 **PDFs**: Full page-by-page extraction, preserving headings and technical sections via `pypdf`.
- 📊 **PowerPoint (PPT / PPTX)**: Slide titles, body shapes, table cells, and speaker notes extracted via `python-pptx`.
- 🖼️ **Images (JPG / PNG / WEBP)**: High-resolution visual understanding, formula extraction, and diagram analysis powered by **Gemini 3.8 Flash**.
- ✍️ **Pasted Lesson Notes**: Built-in editor with character counters and 1-click sample presets (*Operating Systems*, *Photosynthesis*, *Database Normalization*).

### 2. The 10 Core Reviewer Sections
Every generated reviewer is organized into a clean, digital study sheet layout:
1. **QUICK REVIEW**: Short overview of the entire lesson in 3–7 high-yield bullet points.
2. **KEYWORDS**: Most important terms with crisp definitions, star/save buttons, and exam-core badges.
3. **CORE CONCEPTS**: Major concepts explained in bite-sized bullet points without long paragraphs.
4. **MUST REMEMBER**: High-yield callout cards for facts, rules, formulas, classifications, and exam alerts.
5. **COMPARE**: Side-by-side comparison tables highlighting differences between similar concepts.
6. **PROCESS / STEPS**: Numbered procedural sequences for algorithms and workflows.
7. **FORMULAS / RULES**: Formula cards featuring equations, variable breakdowns, when-to-use tips, and concrete examples.
8. **EXAMPLES**: Highly focused, short scenarios clarifying difficult concepts.
9. **POSSIBLE QUIZ POINTS**: Facts and concepts likely to appear on quizzes and exams.
10. **ONE-MINUTE REVIEW**: Ultra-compressed 60-second recap for last-minute review right before entering the exam room.

### 3. Student Controls & Interactive Tools
- ✂️ **Difficulty & Compression Selector**: Choose between **Quick** (condensed), **Standard** (balanced), or **Detailed** (rich context).
- 🪄 **"Make it simpler"**: Rewrites complex academic explanations into simpler language without altering technical definitions.
- ✨ **"Explain like I'm new to this" (ELI5)**: Beginner-friendly explanations using intuitive real-world analogies.
- 🔍 **Search Reviewer**: Real-time filtering and highlighting across keywords and concepts.
- ⭐ **Star / Save Concepts**: Save critical terms for quick revision.
- 📋 **Copy Reviewer**: 1-click copy formatted markdown study sheet.
- 🖨️ **Download as PDF / Print**: Formatted print stylesheet for printing or saving clean A4 study sheets.

### 4. Practice Quiz Engine
- 📝 **Customizable Quizzes**: Select question count (5, 10, 15, 20) and format (*Multiple Choice*, *True/False*, *Identification*, or *Mixed*).
- 🎯 **Performance Analytics**: Instant score calculation, celebratory confetti animation, and explanation for every answer.
- 🚨 **"Topics You Should Review Again"**: Directly flags missed concepts and allows 1-click navigation back to that section in the reviewer.

### 5. Persistent Dashboard & Reviewer History
- View past study sessions with subject tags, lesson titles, creation dates, and slide counts.
- 1-click reopen previous reviewers.

---

## 🚀 Quick Start Guide

### Option 1: 1-Click Batch Launcher (Windows)
Double-click `start_studysnap.bat` in the root folder. It will launch both the backend API and frontend Vite server, then automatically open your browser to `http://localhost:5173`.

### Option 2: Manual Terminal Execution

#### 1. Backend Service
```bash
cd backend
python app.py
```
*Backend runs on `http://localhost:5001`.*

#### 2. Frontend Development Server
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🤖 Dual AI Engine Architecture

StudySnap AI comes with an intelligent dual-engine architecture:

1. **Google Gemini 3.8 Flash (`gemini-3.8-flash`)**:
   - Official `google-genai` SDK integration for deep academic reasoning, diagram visual understanding, and quiz creation.
   - Enter your Gemini API key in the web app under **"AI Engine"** in the top navigation or configure `GEMINI_API_KEY` in your environment.
2. **Local Smart Synthesizer (Built-in Offline Fallback)**:
   - Zero-configuration engine that extracts definitions, equations, comparisons, processes, and quiz questions offline using pattern extraction heuristics.
   - Allows students to immediately use the app even without an API key or internet connection.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Canvas Confetti.
- **Backend**: Python 3.14, Flask 3.1, Flask-CORS, PyPDF, Python-PPTX, Pillow, Google-GenAI SDK.
- **Storage**: Browser localStorage + backend JSON session store.

