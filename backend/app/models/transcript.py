from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TranscriptSegment(BaseModel):
    id: str
    speaker: str
    text: str
    start_time: float  # seconds
    end_time: float
    confidence: Optional[float] = None


class TranscriptResponse(BaseModel):
    meeting_id: str
    language: str
    segments: list[TranscriptSegment]
    full_text: str
    created_at: datetime


class TranscriptStatusResponse(BaseModel):
    meeting_id: str
    status: str
    progress: Optional[float] = None  # 0.0 - 1.0
    error: Optional[str] = None
