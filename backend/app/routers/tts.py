from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services.firestore import FirestoreService
from app.services.tts import TTSService
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class TTSRequest(BaseModel):
    voice: str = "alloy"
    model: str = "tts-1"


@router.post("/{meeting_id}/tts")
async def generate_tts(
    meeting_id: str,
    body: TTSRequest,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    summary = fs.get_summary(meeting_id)
    if not summary:
        raise HTTPException(status_code=400, detail="Summary not available. Generate summary first.")

    tts = TTSService()
    result = tts.generate_voice_summary(
        meeting_id,
        summary["summary"],
        voice=body.voice,
        model=body.model,
    )
    return result


@router.get("/{meeting_id}/tts")
async def get_tts_url(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    tts = TTSService()
    url = tts.get_voice_summary_url(meeting_id)
    if not url:
        raise HTTPException(status_code=404, detail="Voice summary not generated yet")

    return {"download_url": url}
