from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatSource(BaseModel):
    chunk_index: int
    text: str
    start_time: float
    speaker: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None


class ChatMessage(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    sources: Optional[list[ChatSource]] = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    meeting_id: str
    messages: list[ChatMessage]
