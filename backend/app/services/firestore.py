from firebase_admin import firestore
from datetime import datetime, timezone
from typing import Optional, Any
import uuid
import structlog

log = structlog.get_logger()


def get_db():
    return firestore.client()


def now() -> datetime:
    return datetime.now(timezone.utc)


class FirestoreService:
    def __init__(self):
        self.db = get_db()

    # ---- Users ----

    def get_user(self, uid: str) -> Optional[dict]:
        doc = self.db.collection("users").document(uid).get()
        return doc.to_dict() if doc.exists else None

    def upsert_user(self, uid: str, data: dict) -> None:
        self.db.collection("users").document(uid).set(
            {**data, "updatedAt": now()}, merge=True
        )

    # ---- Meetings ----

    def create_meeting(self, user_id: str, data: dict) -> str:
        meeting_id = str(uuid.uuid4())
        ts = now()
        doc_data = {
            "id": meeting_id,
            "userId": user_id,
            "createdAt": ts,
            "updatedAt": ts,
            "recordedAt": ts,
            **data,
        }
        self.db.collection("meetings").document(meeting_id).set(doc_data)
        return meeting_id

    def get_meeting(self, meeting_id: str) -> Optional[dict]:
        doc = self.db.collection("meetings").document(meeting_id).get()
        return doc.to_dict() if doc.exists else None

    def list_meetings(self, user_id: str, limit: int = 20, offset: int = 0) -> list[dict]:
        query = (
            self.db.collection("meetings")
            .where("userId", "==", user_id)
            .where("status", "!=", "deleted")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        return [doc.to_dict() for doc in query.stream()]

    def update_meeting(self, meeting_id: str, data: dict) -> None:
        self.db.collection("meetings").document(meeting_id).update(
            {**data, "updatedAt": now()}
        )

    def delete_meeting(self, meeting_id: str) -> None:
        self.update_meeting(meeting_id, {"status": "deleted"})

    # ---- Transcripts ----

    def save_transcript(self, meeting_id: str, data: dict) -> None:
        ts = now()
        self.db.collection("meetings").document(meeting_id)\
            .collection("transcript").document("data")\
            .set({**data, "meetingId": meeting_id, "createdAt": ts})

    def get_transcript(self, meeting_id: str) -> Optional[dict]:
        doc = self.db.collection("meetings").document(meeting_id)\
            .collection("transcript").document("data").get()
        return doc.to_dict() if doc.exists else None

    # ---- Summary ----

    def save_summary(self, meeting_id: str, data: dict) -> None:
        ts = now()
        self.db.collection("meetings").document(meeting_id)\
            .collection("summary").document("data")\
            .set({**data, "meetingId": meeting_id, "createdAt": ts})

    def get_summary(self, meeting_id: str) -> Optional[dict]:
        doc = self.db.collection("meetings").document(meeting_id)\
            .collection("summary").document("data").get()
        return doc.to_dict() if doc.exists else None

    def update_summary(self, meeting_id: str, data: dict) -> None:
        self.db.collection("meetings").document(meeting_id)\
            .collection("summary").document("data").update(data)

    # ---- Embeddings ----

    def save_embeddings(self, meeting_id: str, chunks: list[dict]) -> None:
        batch = self.db.batch()
        coll = self.db.collection("meetings").document(meeting_id).collection("embeddings")
        # Clear old embeddings first
        for old in coll.stream():
            batch.delete(old.reference)
        for chunk in chunks:
            ref = coll.document(str(chunk["chunkIndex"]))
            batch.set(ref, chunk)
        batch.commit()

    def get_embeddings(self, meeting_id: str) -> list[dict]:
        docs = self.db.collection("meetings").document(meeting_id)\
            .collection("embeddings").order_by("chunkIndex").stream()
        return [doc.to_dict() for doc in docs]

    # ---- Chat History ----

    def add_chat_message(self, meeting_id: str, message: dict) -> str:
        msg_id = str(uuid.uuid4())
        self.db.collection("meetings").document(meeting_id)\
            .collection("chatHistory").document(msg_id)\
            .set({**message, "id": msg_id, "createdAt": now()})
        return msg_id

    def get_chat_history(self, meeting_id: str) -> list[dict]:
        docs = self.db.collection("meetings").document(meeting_id)\
            .collection("chatHistory").order_by("createdAt").stream()
        return [doc.to_dict() for doc in docs]

    def clear_chat_history(self, meeting_id: str) -> None:
        coll = self.db.collection("meetings").document(meeting_id).collection("chatHistory")
        batch = self.db.batch()
        for doc in coll.stream():
            batch.delete(doc.reference)
        batch.commit()
