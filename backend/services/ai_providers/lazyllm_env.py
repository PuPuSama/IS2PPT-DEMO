"""Utilities for resolving LazyLLM API keys from vendor-prefixed env vars."""
import json
import os

ALLOWED_LAZYLLM_VENDORS = frozenset({
    'qwen', 'doubao', 'deepseek', 'glm', 'siliconflow',
    'sensenova', 'minimax', 'openai', 'kimi',
})

PROJECT_LAZYLLM_NAMESPACE = "IS2PPT"
LEGACY_LAZYLLM_NAMESPACE = "BANANA"


def collect_env_lazyllm_api_keys() -> str | None:
    """Scan env vars for {VENDOR}_API_KEY and return JSON string, or None."""
    keys = {}
    for vendor in ALLOWED_LAZYLLM_VENDORS:
        val = os.getenv(f"{vendor.upper()}_API_KEY", "")
        if val:
            keys[vendor] = val
    return json.dumps(keys) if keys else None


def get_lazyllm_api_key(source: str, namespace: str = PROJECT_LAZYLLM_NAMESPACE) -> str:
    """
    Resolve API key for a LazyLLM source.

    Preferred format: {SOURCE}_API_KEY, e.g. QWEN_API_KEY. Namespaced
    IS2PPT_{SOURCE}_API_KEY and legacy BANANA_{SOURCE}_API_KEY are accepted
    for deployments that already configured LazyLLM-specific keys.
    """
    source_upper = (source or "").upper()
    if not source_upper:
        return ""

    candidate_names = [
        f"{source_upper}_API_KEY",
        f"{namespace}_{source_upper}_API_KEY",
    ]
    legacy_name = f"{LEGACY_LAZYLLM_NAMESPACE}_{source_upper}_API_KEY"
    if legacy_name not in candidate_names:
        candidate_names.append(legacy_name)

    for env_name in candidate_names:
        value = os.getenv(env_name, "")
        if value:
            return value
    return ""


def ensure_lazyllm_namespace_key(source: str, namespace: str = PROJECT_LAZYLLM_NAMESPACE) -> bool:
    """
    Ensure LazyLLM namespace key exists by mapping from vendor-prefixed key.
    """
    source_upper = (source or "").upper()
    if not source_upper:
        return False

    namespace_key = f"{namespace}_{source_upper}_API_KEY"
    resolved_key = get_lazyllm_api_key(source, namespace=namespace)
    if resolved_key:
        os.environ[namespace_key] = resolved_key
        return True
    return False
