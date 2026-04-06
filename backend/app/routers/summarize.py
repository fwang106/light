import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.dependencies import get_current_user
from app.services.firestore import FirestoreService
from app.services.llm import LLMService
from app.models.summary import SummaryRequest, SummaryResponse, ActionItem, ActionItemUpdate
from datetime import datetime, timezone

router = APIRouter()


def _parse_dt(v):
    if v is None:
        return datetime.now(timezone.utc)
    if hasattr(v, "isoformat"):
        return v
    return datetime.now(timezone.utc)


def _to_response(meeting_id: str, doc: dict) -> SummaryResponse:
    action_items = [
        ActionItem(
            id=item.get("id", str(uuid.uuid4())),
            text=item["text"],
            assignee=item.get("assignee"),
            due_date=item.get("dueDate"),
            completed=item.get("completed", False),
        )
        for item in doc.get("actionItems", [])
    ]
    return SummaryResponse(
        meeting_id=meeting_id,
        summary=doc.get("summary", ""),
        action_items=action_items,
        key_decisions=doc.get("keyDecisions", []),
        participants=doc.get("participants", []),
        model_used=doc.get("modelUsed", ""),
        tts_summary_path=doc.get("ttsSummaryPath"),
        tts_summary_url=doc.get("ttsSummaryUrl"),
        created_at=_parse_dt(doc.get("createdAt")),
    )


@router.get("/{meeting_id}/summary", response_model=SummaryResponse)
async def get_summary(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    summary = fs.get_summary(meeting_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not available yet")

    return _to_response(meeting_id, summary)


@router.post("/{meeting_id}/summarize", response_model=SummaryResponse)
async def generate_summary(
    meeting_id: str,
    body: SummaryRequest,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcript = fs.get_transcript(meeting_id)
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript not available")

    model = body.model or doc.get("modelConfig", {}).get("summarization", "claude-3-5-sonnet-20241022")

    llm = LLMService()
    participants = list({s["speaker"] for s in transcript.get("segments", [])})
    result = llm.generate_summary(transcript["fullText"], model, participants)

    action_items = [
        {
            "id": str(uuid.uuid4()),
            "text": item.get("text", ""),
            "assignee": item.get("assignee"),
            "dueDate": item.get("due_date"),
            "completed": False,
        }
        for item in result.get("action_items", [])
    ]

    summary_data = {
        "summary": result.get("summary", ""),
        "actionItems": action_items,
        "keyDecisions": result.get("key_decisions", []),
        "participants": result.get("participants", participants),
        "modelUsed": model,
    }

    fs.save_summary(meeting_id, summary_data)
    return _to_response(meeting_id, summary_data)


@router.patch("/{meeting_id}/summary/action-items/{item_id}", response_model=SummaryResponse)
async def update_action_item(
    meeting_id: str,
    item_id: str,
    body: ActionItemUpdate,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    summary = fs.get_summary(meeting_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    action_items = summary.get("actionItems", [])
    updated = False
    for item in action_items:
        if item.get("id") == item_id:
            item["completed"] = body.completed
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Action item not found")

    fs.update_summary(meeting_id, {"actionItems": action_items})
    summary["actionItems"] = action_items
    return _to_response(meeting_id, summary)
