# MeetingLight - AI Meeting Transcription App

A mobile-first PWA for recording meetings, transcribing audio with speaker labeling, and performing AI-powered analysis.

## Features

- **Record** meeting audio directly from mobile browser (iOS Safari + Android Chrome)
- **Transcribe** with OpenAI Whisper (with speaker diarization)
- **Summarize** with Claude or GPT-4o (model switchable)
- **Action Items** extracted automatically
- **Chat** with your transcript via RAG (ask questions, get cited answers)
- **Audio Replay** synchronized with transcript highlights (click-to-seek)
- **Voice Summary** - TTS narration of the summary
- **Model Selection** - choose different AI models per operation in Settings

## Architecture

```
Mobile PWA (Next.js 14)          GCP Cloud Run (FastAPI)
Firebase Auth         ──────►   /api/meetings
Firebase Storage                 /api/transcribe   → Whisper API
Firebase Firestore               /api/summarize    → Claude / GPT-4o
                                 /api/chat (SSE)   → RAG + LLM
                                 /api/tts          → OpenAI TTS
```

## Directory Structure

```
light/
├── frontend/        # Next.js 14 PWA
├── backend/         # FastAPI backend (Python 3.12)
└── infrastructure/  # Firebase rules, Cloud Run config, CI/CD
```

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- Firebase project with Firestore + Storage enabled
- GCP project with Cloud Run API enabled
- OpenAI API key (for Whisper + TTS)
- Anthropic API key (for Claude)

### Backend (local dev)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in values
uvicorn app.main:app --reload --port 8080
```

### Frontend (local dev)

```bash
cd frontend
npm install
cp .env.local.example .env.local  # fill in Firebase config
npm run dev
```

Open https://localhost:3000 (use `npm run dev:https` for microphone on iOS)

## Deployment

### GCP Setup

```bash
# One-time setup
bash infrastructure/setup.sh YOUR_PROJECT_ID

# Set API keys
echo -n "sk-..." | gcloud secrets versions add openai-api-key --data-file=-
echo -n "sk-ant-..." | gcloud secrets versions add anthropic-api-key --data-file=-
```

### Deploy

```bash
# Trigger CI/CD
git push origin main

# Or deploy manually
gcloud builds submit --config=infrastructure/cloudbuild.yaml
```

## Mobile Recording Notes

- **iOS Safari**: Uses `audio/mp4` (AAC). Keep screen on during recording.
- **Android Chrome**: Uses `audio/webm;codecs=opus` with 10s chunked collection.
- Wake Lock API is used to prevent screen sleep during recording.
- Whisper supports files up to 25MB (~60-100 min of audio). Longer recordings are auto-split.

## AI Model Selection

Models can be changed per-operation in **Settings**:

| Operation | Available Models |
|-----------|-----------------|
| Transcription | Whisper v1 |
| Summarization | Claude 3.5 Sonnet, Claude Sonnet 4.6, GPT-4o, GPT-4o Mini |
| Action Items | Claude 3.5 Sonnet, GPT-4o |
| Chat | Claude 3.5 Sonnet, Claude Sonnet 4.6, Claude 3.5 Haiku, GPT-4o, GPT-4o Mini |
| Voice (TTS) | OpenAI TTS-1, TTS-1-HD (6 voice options) |
