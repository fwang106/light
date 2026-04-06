from fastapi import Depends, HTTPException, status
from app.middleware.auth import verify_firebase_token
from app.config import get_settings, Settings


async def get_current_user(
    token_data: dict = Depends(verify_firebase_token),
) -> dict:
    """Extract authenticated user from verified token."""
    uid = token_data.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        )
    return {
        "uid": uid,
        "email": token_data.get("email"),
        "name": token_data.get("name"),
    }


def get_app_settings() -> Settings:
    return get_settings()
