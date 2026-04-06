import json
import numpy as np
from typing import AsyncIterator
import openai
import structlog

from app.config import get_settings
from app.services.firestore import FirestoreService
from app.services.llm import LLMService

log = structlog.get_logger()

EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 300  # tokens (approximate by words)
CHUNK_OVERLAP = 50
TOP_K = 5


def _chunk_segments(segments: list[dict]) -> list[dict]:
    """Split transcript segments into overlapping chunks."""
    chunks = []
    current_words = []
    current_segments = []
    chunk_idx = 0

    for seg in segments:
        words = seg["text"].split()
        current_words.extend(words)
        current_segments.append(seg)

        if len(current_words) >= CHUNK_SIZE:
            chunks.append({
                "chunkIndex": chunk_idx,
                "text": " ".join(current_words),
                "startTime": current_segments[0]["startTime"],
                "endTime": current_segments[-1]["endTime"],
                "speaker": current_segments[0]["speaker"],
            })
            # Overlap: keep last CHUNK_OVERLAP words
            current_words = current_words[-CHUNK_OVERLAP:]
            current_segments = current_segments[-2:]  # keep last 2 segs for context
            chunk_idx += 1

    if current_words:
        chunks.append({
            "chunkIndex": chunk_idx,
            "text": " ".join(current_words),
            "startTime": current_segments[0]["startTime"] if current_segments else 0,
            "endTime": current_segments[-1]["endTime"] if current_segments else 0,
            "speaker": current_segments[0]["speaker"] if current_segments else "Speaker 1",
        })

    return chunks


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a)
    vb = np.array(b)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


class RAGService:
    def __init__(self):
        settings = get_settings()
        self.openai_client = openai.OpenAI(api_key=settings.openai_api_key)
        self.firestore = FirestoreService()
        self.llm = LLMService()

    def build_embeddings(self, meeting_id: str, segments: list[dict]) -> None:
        """Chunk transcript and store embeddings in Firestore."""
        chunks = _chunk_segments(segments)
        if not chunks:
            return

        texts = [c["text"] for c in chunks]
        response = self.openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )
        embeddings = [e.embedding for e in response.data]

        docs = [
            {**chunk, "embedding": emb}
            for chunk, emb in zip(chunks, embeddings)
        ]
        self.firestore.save_embeddings(meeting_id, docs)
        log.info("Embeddings built", meeting_id=meeting_id, chunks=len(docs))

    async def chat(
        self,
        meeting_id: str,
        question: str,
        chat_history: list[dict],
        model: str,
    ) -> AsyncIterator[dict]:
        """RAG Q&A with streaming response."""
        # 1. Embed question
        q_resp = self.openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=[question],
        )
        q_embedding = q_resp.data[0].embedding

        # 2. Load all chunk embeddings
        chunk_docs = self.firestore.get_embeddings(meeting_id)
        if not chunk_docs:
            yield {"type": "chunk", "content": "No transcript available for this meeting yet."}
            yield {"type": "done"}
            return

        # 3. Cosine similarity retrieval
        scored = [
            (doc, _cosine_similarity(q_embedding, doc["embedding"]))
            for doc in chunk_docs
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        top_chunks = [doc for doc, _ in scored[:TOP_K]]

        # 4. Build context
        context = "\n\n".join(
            f"[{c['speaker']} @ {c['startTime']:.0f}s]: {c['text']}"
            for c in top_chunks
        )

        system_prompt = f"""You are a helpful meeting assistant. Answer questions based on the meeting transcript excerpts provided.
Be concise and cite specific speakers or times when relevant.
If the answer is not in the transcript, say so honestly.

Relevant transcript excerpts:
{context}"""

        # Build message history for LLM
        messages = []
        for msg in chat_history[-10:]:  # Last 10 turns
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": question})

        # 5. Stream LLM response
        full_response = ""
        async for token in self.llm.stream_chat(model, system_prompt, messages):
            full_response += token
            yield {"type": "chunk", "content": token}

        # 6. Emit sources
        sources = [
            {
                "chunkIndex": c["chunkIndex"],
                "text": c["text"][:200],
                "startTime": c["startTime"],
                "speaker": c.get("speaker"),
            }
            for c in top_chunks
        ]
        yield {"type": "sources", "sources": sources}
        yield {"type": "done", "fullContent": full_response}
