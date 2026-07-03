"""
OpenAI SDK implementation for text generation
"""
import base64
import logging
import time
from typing import Generator
from openai import OpenAI
from .base import TextProvider, strip_think_tags
from config import get_config

logger = logging.getLogger(__name__)


class OpenAITextProvider(TextProvider):
    """Text generation using OpenAI SDK (compatible with Gemini via proxy)"""
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-flash-preview"):
        """
        Initialize OpenAI text provider
        
        Args:
            api_key: API key
            api_base: API base URL (e.g., https://aihubmix.com/v1)
            model: Model name to use
        """
        self.client = OpenAI(
            api_key=api_key,
            base_url=api_base,
            timeout=get_config().OPENAI_TIMEOUT,  # set timeout from config
            max_retries=get_config().OPENAI_MAX_RETRIES  # set max retries from config
        )
        self.model = model
    
    def generate_text(self, prompt: str, thinking_budget: int = 0,
                      reasoning_effort: str = None) -> str:
        """
        Generate text using OpenAI SDK

        Args:
            prompt: The input prompt
            thinking_budget: Not used in OpenAI format, kept for interface compatibility (0 = default)
            reasoning_effort: Optional reasoning effort (low/medium/high/xhigh) for reasoning
                models; passed via extra_body to bypass SDK enum validation. None = model default.

        Returns:
            Generated text
        """
        # Reasoning effort (low/medium/high/xhigh) is only honored by the Responses
        # API (/responses); chat.completions silently drops it on routers like
        # 4router.net. So when an effort is requested, route through Responses —
        # but /responses can be flaky/overloaded on some channels, so on any failure
        # we degrade gracefully to chat.completions (effort unapplied) rather than
        # failing the whole generation.
        if reasoning_effort:
            try:
                return self._generate_via_responses(prompt, reasoning_effort)
            except Exception as e:
                logger.warning(
                    "Responses API (effort=%s) failed (%s); falling back to "
                    "chat.completions WITHOUT reasoning effort.",
                    reasoning_effort, f"{type(e).__name__}: {str(e)[:120]}",
                )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
        )
        return strip_think_tags(response.choices[0].message.content)

    def _generate_via_responses(self, prompt: str, reasoning_effort: str,
                                first_token_timeout: float = 280.0,
                                max_total: float = 420.0,
                                read_timeout: float = 120.0) -> str:
        """Generate via the Responses API (streamed) so reasoning.effort is applied.

        Streaming is required: a long high/xhigh reasoning + large output in a single
        non-streamed call exceeds the gateway window on routers (disconnect/500).

        Deadlines are tuned for high-effort reasoning on a full-page SVG, which
        measured ~165–252s of silent reasoning before the first visible token and
        ~327s total on packyapi (xhigh). They still bound a stalled upstream so we
        fall back to chat.completions instead of hanging:
          - read_timeout: per-read gap cap (packyapi sends keepalives, max gap ~30s,
            so a dead connection is caught well before this);
          - first_token_timeout: wall-clock cap until the first VISIBLE output token;
          - max_total: hard cap on total stream duration.

        extra_body carries the effort to bypass SDK enum validation (allows 'xhigh').
        """
        client = self.client.with_options(timeout=read_timeout)
        stream = client.responses.create(
            model=self.model,
            input=prompt,
            extra_body={"reasoning": {"effort": reasoning_effort}},
            stream=True,
        )
        parts = []
        start = time.time()
        got_output = False
        for event in stream:
            elapsed = time.time() - start
            if not got_output and elapsed > first_token_timeout:
                raise TimeoutError(f"/responses produced no output within {first_token_timeout:.0f}s")
            if elapsed > max_total:
                raise TimeoutError(f"/responses exceeded {max_total:.0f}s total")
            etype = getattr(event, "type", "")
            # text deltas of the assistant's visible output (not the reasoning trace)
            if etype == "response.output_text.delta":
                delta = getattr(event, "delta", None)
                if delta:
                    got_output = True
                    parts.append(delta)
            elif etype == "response.error" or etype == "error":
                err = getattr(event, "error", None) or getattr(event, "message", "")
                raise RuntimeError(f"Responses stream error: {err}")
        return strip_think_tags("".join(parts))

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text using OpenAI SDK with stream=True."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content

    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        """Generate text with image input using OpenAI-compatible chat completions."""
        with open(image_path, "rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode("ascii")

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{encoded}"},
                        },
                    ],
                }
            ],
        )

        message_content = response.choices[0].message.content
        if isinstance(message_content, str):
            return strip_think_tags(message_content)

        parts = []
        for item in message_content or []:
            text = item.get("text") if isinstance(item, dict) else getattr(item, "text", None)
            if text:
                parts.append(text)
        return strip_think_tags("\n".join(parts))
