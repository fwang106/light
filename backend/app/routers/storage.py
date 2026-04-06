from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.services.storage import StorageService

router = APIRouter()


class UploadUrlRequest(BaseModel):
    meeting_id: str
    file_name: str
    content_type: str


@router.post("/upload-url")
async def get_upload_url(
    body: UploadUrlRequest,
    user: dict = Depends(get_current_user),
):
    """Generate a signed upload URL for direct browser-to-GCS audio upload."""
    # Restrict content types to audio only
    allowed_types = {"audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"}
    if body.content_type not in allowed_types and not body.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Only audio files are allowed")

    # Construct safe storage path
    storage_path = f"audio/{user['uid']}/{body.meeting_id}/{body.file_name}"

    storage = StorageService()
    upload_url = storage.generate_upload_url(storage_path, body.content_type)

    return {"upload_url": upload_url, "storage_path": storage_path}
