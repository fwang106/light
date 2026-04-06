from fastapi import APIRouter, Depends
from app.dependencies import get_current_user

router = APIRouter()

AVAILABLE_MODELS = {
    "transcription": [
        {"id": "whisper-1", "name": "Whisper v1", "provider": "openai", "default": True},
    ],
    "summarization": [
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "provider": "anthropic", "default": True},
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "provider": "anthropic", "default": False},
        {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "provider": "anthropic", "default": False},
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "default": False},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openai", "default": False},
    ],
    "chat": [
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "provider": "anthropic", "default": True},
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "provider": "anthropic", "default": False},
        {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "provider": "anthropic", "default": False},
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "default": False},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openai", "default": False},
    ],
    "action_items": [
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "provider": "anthropic", "default": True},
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "default": False},
    ],
    "tts": [
        {"id": "tts-1", "name": "TTS v1 (fast)", "provider": "openai", "default": True},
        {"id": "tts-1-hd", "name": "TTS v1 HD (high quality)", "provider": "openai", "default": False},
    ],
    "tts_voice": [
        {"id": "alloy", "name": "Alloy (neutral)", "provider": "openai", "default": True},
        {"id": "echo", "name": "Echo (male)", "provider": "openai", "default": False},
        {"id": "fable", "name": "Fable (British)", "provider": "openai", "default": False},
        {"id": "onyx", "name": "Onyx (deep male)", "provider": "openai", "default": False},
        {"id": "nova", "name": "Nova (female)", "provider": "openai", "default": False},
        {"id": "shimmer", "name": "Shimmer (female)", "provider": "openai", "default": False},
    ],
}


@router.get("")
async def list_models(user: dict = Depends(get_current_user)):
    return AVAILABLE_MODELS
