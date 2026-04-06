from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class MeetingStatus(str, Enum):
    RECORDING = "recording"
    UPLOADING = "uploading"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    READY = "ready"
    ERROR = "error"


class ModelConfig(BaseModel):
    transcription: str = "whisper-1"
    summarization: str = "claude-3-5-sonnet-20241022"
    action_items: str = "claude-3-5-sonnet-20241022"
    chat: str = "claude-3-5-sonnet-20241022"


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    model_config_data: Optional[ModelConfig] = None


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class MeetingResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str]
    status: MeetingStatus
    duration: Optional[float]
    audio_path: Optional[str]
    audio_download_url: Optional[str]
    recorded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str]
    model_config_data: ModelConfig


class UploadCompleteRequest(BaseModel):
    storage_path: str
    file_name: str
    content_type: str
    duration_seconds: Optional[float] = None
