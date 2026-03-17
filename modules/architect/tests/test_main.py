import json
from datetime import datetime as real_datetime

import pytest
import typer

from modules.architect import main as architect_main


def test_resolve_llm_profiles_supports_primary_and_fallback():
    config = {
        "llm": {
            "primary": {"provider": "openai", "model": "gpt-4.1"},
            "fallback": {"provider": "opencode", "models": ["deepseek-r1"]},
        }
    }

    primary, fallback = architect_main.resolve_llm_profiles(config)

    assert primary == {"provider": "openai", "model": "gpt-4.1"}
    assert fallback == {"provider": "opencode", "models": ["deepseek-r1"]}


def test_resolve_llm_profiles_keeps_legacy_shape_as_primary():
    config = {"llm": {"provider": "openai", "model": "gpt-4o-mini"}}

    primary, fallback = architect_main.resolve_llm_profiles(config)

    assert primary == {"provider": "openai", "model": "gpt-4o-mini"}
    assert fallback is None


def test_parse_prompts_response_accepts_fenced_json():
    content = """
```json
[
  {"prompt": "cinematic forest", "parameters": {"v": 7}}
]
```
"""

    prompts = architect_main.parse_prompts_response(content)

    assert prompts == [{"prompt": "cinematic forest", "parameters": {"v": 7}}]


def test_parse_prompts_response_ignores_trailing_text_after_json_array():
    content = """
[
  {"prompt": "cinematic forest", "parameters": {"v": 7}}
]

Architect finished with code 0
"""

    prompts = architect_main.parse_prompts_response(content)

    assert prompts == [{"prompt": "cinematic forest", "parameters": {"v": 7}}]


def test_parse_prompts_response_recovers_complete_items_from_truncated_array():
    content = """
[
  {"prompt": "prompt one", "parameters": {"v": 7}},
  {"prompt": "prompt two", "parameters": {"v": 7}},
  {
"""

    prompts = architect_main.parse_prompts_response(content)

    assert prompts == [
        {"prompt": "prompt one", "parameters": {"v": 7}},
        {"prompt": "prompt two", "parameters": {"v": 7}},
    ]


def test_parse_prompts_response_rejects_non_array_json():
    with pytest.raises(typer.Exit):
        architect_main.parse_prompts_response('{"prompt": "not-a-list"}')


def test_force_niji_parameters_rewrites_dict_parameters():
    prompts = [{"prompt": "hero portrait", "parameters": {"v": 7, "stylize": 250}}]

    result = architect_main._force_niji_parameters(prompts)

    assert result[0]["parameters"] == {"stylize": 250, "niji": 7}


def test_force_niji_parameters_rewrites_string_parameters():
    prompts = [{"prompt": "hero portrait", "parameters": "--v 7 --ar 1:1"}]

    result = architect_main._force_niji_parameters(prompts)

    assert result[0]["parameters"] == "--ar 1:1 --niji 7"


def test_force_niji_parameters_initializes_missing_parameters():
    prompts = [{"prompt": "hero portrait"}]

    result = architect_main._force_niji_parameters(prompts)

    assert result[0]["parameters"] == {"niji": 7}


def test_save_prompts_writes_metadata_and_topic_slug(tmp_path, monkeypatch):
    fixed_now = real_datetime(2026, 3, 10, 12, 34, 56)

    class FixedDatetime:
        @classmethod
        def now(cls):
            return fixed_now

    monkeypatch.setattr(architect_main, "datetime", FixedDatetime)

    prompts = [{"prompt": "cyberpunk alley", "parameters": {"v": 7}}]
    output_path = architect_main.save_prompts(
        prompts,
        "Cyber Punk/City",
        output_dir=str(tmp_path),
        mode="niji",
    )

    assert output_path.name == "20260310_123456_cyber_punk_city.json"

    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["topic"] == "Cyber Punk/City"
    assert payload["mode"] == "niji"
    assert payload["count"] == 1
    assert payload["generated_at"] == fixed_now.isoformat()
    assert payload["prompts"] == prompts


def test_calculate_completion_max_tokens_scales_for_large_batches():
    assert architect_main.calculate_completion_max_tokens(20, 4) == 10200
    assert architect_main.calculate_completion_max_tokens(1, 1) == 4000
