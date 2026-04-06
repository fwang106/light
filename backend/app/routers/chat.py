import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.dependencies import get_current_user
from app.services.firestore import FirestoreService
from app.services.rag import RAGService
from app.models.chat import ChatRequest, ChatHistoryResponse, ChatMessage, ChatSource
from datetime import datetime, timezone

router = APIRouter()


def _parse_dt(v):
    if v is None:
        return datetime.now(timezone.utc)
    if hasattr(v, "isoformat"):
        return v
    return datetime.now(timezone.utc)


@router.post("/{meeting_id}/chat")
async def chat(
    meeting_id: str,
    body: ChatRequest,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    model = body.model or doc.get("modelConfig", {}).get("chat", "claude-3-5-sonnet-20241022")

    # Save user message
    fs.add_chat_message(meeting_id, {"role": "user", "content": body.message, "sources": None})

    # Load chat history for context
    history = fs.get_chat_history(meeting_id)

    rag = RAGService()

    async def event_stream():
        full_content = ""
        sources = []
        try:
            async for event in rag.chat(meeting_id, body.message, history[:-1], model):
                if event["type"] == "chunk":
                    full_content += event["content"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "sources":
                    sources = event["sources"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "done":
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"

            # Save assistant message
            fs.add_chat_message(meeting_id, {
                "role": "assistant",
                "content": full_content,
                "sources": sources,
            })
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{meeting_id}/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")

    history = fs.get_chat_history(meeting_id)
    messages = [
        ChatMessage(
            id=msg["id"],
            role=msg["role"],
            content=msg["content"],
            sources=[
                ChatSource(**s) for s in (msg.get("sources") or [])
            ] or None,
            created_at=_parse_dt(msg.get("createdAt")),
        )
        for msg in history
    ]
    return ChatHistoryResponse(meeting_id=meeting_id, messages=messages)


@router.delete("/{meeting_id}/chat/history", status_code=204)
async def clear_chat_history(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    fs = FirestoreService()
    doc = fs.get_meeting(meeting_id)
    if not doc or doc.get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Meeting not found")
    fs.clear_chat_history(meeting_id)
