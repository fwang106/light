from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ActionItem(BaseModel):
    id: str
    text: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    completed: bool = False


class SummaryRequest(BaseModel):
    model: Optional[str] = None  # Override user's default


class SummaryResponse(BaseModel):
    meeting_id: str
    summary: str
    action_items: list[ActionItem]
    key_decisions: list[str]
    participants: list[str]
    model_used: str
    tts_summary_path: Optional[str] = None
    tts_summary_url: Optional[str] = None
    created_at: datetime


class ActionItemUpdate(BaseModel):
    completed: bool
