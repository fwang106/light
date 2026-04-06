import json
from typing import AsyncIterator, Optional
import anthropic
import openai
import structlog

from app.config import get_settings

log = structlog.get_logger()

CLAUDE_MODELS = {
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
}

OPENAI_MODELS = {
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
}


def _is_claude(model: str) -> bool:
    return model.startswith("claude")


class LLMService:
    def __init__(self):
        settings = get_settings()
        self.anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.openai_client = openai.OpenAI(api_key=settings.openai_api_key)

    def generate_summary(self, transcript_text: str, model: str, participants: list[str]) -> dict:
        """Generate structured meeting summary with action items."""
        system_prompt = """You are an expert meeting analyst. Given a meeting transcript, produce a structured JSON summary.

Output ONLY valid JSON with this exact structure:
{
  "summary": "A 2-4 paragraph prose summary of the meeting",
  "action_items": [
    {"text": "description", "assignee": "person or null", "due_date": "ISO date or null"}
  ],
  "key_decisions": ["decision 1", "decision 2"],
  "participants": ["Speaker 1", "Speaker 2"]
}"""

        user_prompt = f"""Transcript:
{transcript_text}

Known speakers: {', '.join(participants) if participants else 'Unknown'}

Generate the structured JSON summary."""

        content = self._complete(model, system_prompt, user_prompt)

        # Extract JSON from response
        try:
            # Handle markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except Exception:
            log.warning("Failed to parse LLM JSON, using fallback", raw=content[:200])
            return {
                "summary": content,
                "action_items": [],
                "key_decisions": [],
                "participants": participants,
            }

    async def stream_chat(
        self,
        model: str,
        system_prompt: str,
        messages: list[dict],
    ) -> AsyncIterator[str]:
        """Stream chat response tokens."""
        if _is_claude(model):
            async for token in self._stream_anthropic(model, system_prompt, messages):
                yield token
        else:
            async for token in self._stream_openai(model, system_prompt, messages):
                yield token

    def _complete(self, model: str, system: str, user: str) -> str:
        if _is_claude(model):
            resp = self.anthropic_client.messages.create(
                model=model,
                max_tokens=4096,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return resp.content[0].text
        else:
            resp = self.openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=4096,
            )
            return resp.choices[0].message.content

    async def _stream_anthropic(
        self, model: str, system: str, messages: list[dict]
    ) -> AsyncIterator[str]:
        with self.anthropic_client.messages.stream(
            model=model,
            max_tokens=2048,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text

    async def _stream_openai(
        self, model: str, system: str, messages: list[dict]
    ) -> AsyncIterator[str]:
        all_messages = [{"role": "system", "content": system}] + messages
        stream = self.openai_client.chat.completions.create(
            model=model,
            messages=all_messages,
            stream=True,
            max_tokens=2048,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
