from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from app.dependencies import get_current_user
from app.services.firestore import FirestoreService
from app.services.storage import StorageService
from app.services.transcription import TranscriptionService
from app.models.meeting import (
    MeetingCreate, MeetingUpdate, MeetingResponse, MeetingStatus,
    ModelConfig, UploadCompleteRequest,
)
from datetime import datetime, timezone

router = APIRouter()


def _to_response(doc: dict) -> MeetingResponse:
    def parse_dt(v):
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v
        return v

    cfg = doc.get("modelConfig", {})
    return MeetingResponse(
        id=doc["id"],
        user_id=doc["userId"],
        title=doc["title"],
        description=doc.get("description"),
        status=doc.get("status", MeetingStatus.READY),
        duration=doc.get("duration"),
        audio_path=doc.get("audioPath"),
        audio_download_url=doc.get("audioDownloadUrl"),
        recorded_at=parse_dt(doc.get("recordedAt")),
        created_at=parse_dt(doc["createdAt"]),
        updated_at=parse_dt(doc["updatedAt"]),
        error_message=doc.get("errorMessage"),
        model_config_data=ModelConfig(
            transcription=cfg.get("transcription", "whisper-1"),
            summarization=cfg.get("summarization", "claude-3-5-sonnet-20241022"),
            action_items=cfg.get("actionItems", "claude-3-5-sonnet-20241022"),
            chat=cfg.get("chat", "claude-3-5-sonnet-20241022"),
        ),
    )


@router.get("", response_model=list[MeetingResponse])
async def list_meetings(
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    docs = fs.list_meetings(user["uid"], limit=limit)
    # Refresh audio URLs
    storage = StorageService()
    results = []
    for doc in docs:
        if doc.get("audioPath") and doc.get("status") == MeetingStatus.READY:
            try:
                doc["audioDownloadUrl"] = storage.generate_download_url(doc["audioPath"])
            except Exception:
                pass
        results.append(_to_response(doc))
    return results


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    body: MeetingCreate,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    cfg = body.model_config_data or ModelConfig()
    data = {
        "title": body.title,
        "description": body.description,
        "status": MeetingStatus.RECORDING,
        "modelConfig": {
            "transcription": cfg.transcription,
            "summarization": cfg.summarization,
            "actionItems": cfg.action_items,
            "chat": cfg.chat,
        },
    }
    meeting_id = fs.create_meeting(user["uid"], data)
    doc = fs.get_meeting(meeting_id)
    return _to_response(doc)


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Refresh audio download URL
    if doc.get("audioPath"):
        try:
            doc["audioDownloadUrl"] = StorageService().generate_download_url(doc["audioPath"])
        except Exception:
            pass

    return _to_response(doc)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: str,
    body: MeetingUpdate,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    updates = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.description is not None:
        updates["description"] = body.description

    if updates:
        fs.update_meeting(meeting_id, updates)

    doc = fs.get_meeting(meeting_id)
    return _to_response(doc)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")
    fs.delete_meeting(meeting_id)


@router.post("/{meeting_id}/upload-complete")
async def upload_complete(
    meeting_id: str,
    body: UploadCompleteRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Called by frontend after audio upload to Firebase Storage finishes."""
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    fs.update_meeting(meeting_id, {
        "status": MeetingStatus.TRANSCRIBING,
        "audioPath": body.storage_path,
        "audioFileName": body.file_name,
        "audioContentType": body.content_type,
        "duration": body.duration_seconds,
    })

    # Kick off transcription in background
    transcription_model = doc.get("modelConfig", {}).get("transcription", "whisper-1")
    background_tasks.add_task(
        _run_transcription,
        meeting_id,
        body.storage_path,
        transcription_model,
        doc.get("modelConfig", {}),
    )

    return {"status": "transcription_queued", "meeting_id": meeting_id}


def _run_transcription(meeting_id: str, audio_path: str, transcription_model: str, model_config: dict):
    """Background task: transcribe then summarize."""
    from app.services.transcription import TranscriptionService
    from app.services.llm import LLMService
    from app.services.rag import RAGService

    fs = FirestoreService()
    try:
        svc = TranscriptionService()
        transcript = svc.transcribe_meeting(meeting_id, audio_path, transcription_model)

        # Auto-generate summary
        summarization_model = model_config.get("summarization", "claude-3-5-sonnet-20241022")
        llm = LLMService()
        participants = list({s["speaker"] for s in transcript["segments"]})
        summary_data = llm.generate_summary(
            transcript["fullText"], summarization_model, participants
        )

        import uuid
        action_items = [
            {
                "id": str(uuid.uuid4()),
                "text": item.get("text", ""),
                "assignee": item.get("assignee"),
                "dueDate": item.get("due_date"),
                "completed": False,
            }
            for item in summary_data.get("action_items", [])
        ]

        fs.save_summary(meeting_id, {
            "summary": summary_data.get("summary", ""),
            "actionItems": action_items,
            "keyDecisions": summary_data.get("key_decisions", []),
            "participants": summary_data.get("participants", participants),
            "modelUsed": summarization_model,
        })
        fs.update_meeting(meeting_id, {"status": "ready"})

        # Build RAG embeddings
        rag = RAGService()
        rag.build_embeddings(meeting_id, transcript["segments"])

    except Exception as e:
        import structlog
        log = structlog.get_logger()
        log.error("Background transcription/summarization failed", meeting_id=meeting_id, error=str(e))
        fs.update_meeting(meeting_id, {"status": "error", "errorMessage": str(e)})
