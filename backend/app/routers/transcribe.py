from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services.firestore import FirestoreService
from app.models.transcript import TranscriptResponse, TranscriptStatusResponse, TranscriptSegment
from datetime import datetime, timezone

router = APIRouter()


def _parse_dt(v):
    if v is None:
        return datetime.now(timezone.utc)
    if hasattr(v, "isoformat"):
        return v
    return datetime.now(timezone.utc)


@router.get("/{meeting_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcript = fs.get_transcript(meeting_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not available yet")

    segments = [
        TranscriptSegment(
            id=s["id"],
            speaker=s["speaker"],
            text=s["text"],
            start_time=s["startTime"],
            end_time=s["endTime"],
            confidence=s.get("confidence"),
        )
        for s in transcript.get("segments", [])
    ]

    return TranscriptResponse(
        meeting_id=meeting_id,
        language=transcript.get("language", "en"),
        segments=segments,
        full_text=transcript.get("fullText", ""),
        created_at=_parse_dt(transcript.get("createdAt")),
    )


@router.get("/{meeting_id}/transcript/status", response_model=TranscriptStatusResponse)
async def get_transcript_status(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return TranscriptStatusResponse(
        meeting_id=meeting_id,
        status=doc.get("status", "unknown"),
        error=doc.get("errorMessage"),
    )
