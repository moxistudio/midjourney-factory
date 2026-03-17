#!/usr/bin/env python3
# pyright: basic, reportMissingImports=false, reportMissingModuleSource=false
"""
Architect Module - LLM-powered Midjourney prompt generator
"""

import json
import os
import random
import shlex
import subprocess
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

import typer
import yaml
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

if TYPE_CHECKING:
    from openai import OpenAI

if __package__:
    from .system_prompts import PROMPT_EXPANSION_SYSTEM
else:
    from system_prompts import PROMPT_EXPANSION_SYSTEM  # pyright: ignore[reportImplicitRelativeImport]

app = typer.Typer(help="Generate Midjourney prompts using LLM")
console = Console()


def get_source_root() -> Path:
    return Path(__file__).parent.parent.parent


def get_data_root() -> Path:
    env_root = str(os.environ.get("MIDJOURNEY_FACTORY_HOME", "")).strip()
    if env_root:
        return Path(env_root).expanduser().resolve()
    return get_source_root()


def calculate_completion_max_tokens(count: int, detail_level: int) -> int:
    """Estimate a safe output budget for long JSON prompt batches."""
    per_prompt_budget = {
        1: 180,
        2: 260,
        3: 360,
        4: 480,
        5: 620,
    }.get(max(1, min(5, int(detail_level or 3))), 360)

    estimated = int(count or 1) * per_prompt_budget + 600
    return max(4000, min(16000, estimated))


def _resolve_env_value(env_name: str, current_value: Any) -> str:
    """Resolve a config value with ENV override support."""
    if env_name and env_name in os.environ:
        return str(os.environ.get(env_name, "")).strip()
    if isinstance(current_value, str):
        return current_value.strip()
    return ""


def _overlay_llm_profile(profile: Any, api_key_env: str, base_url_env: str) -> None:
    """Annotate and resolve a single LLM profile."""
    if not isinstance(profile, dict):
        return

    profile["__api_key_env_var"] = api_key_env
    profile["__base_url_env_var"] = base_url_env
    profile["api_key"] = _resolve_env_value(api_key_env, profile.get("api_key"))
    profile["base_url"] = _resolve_env_value(base_url_env, profile.get("base_url"))


def load_config() -> dict[str, Any]:
    """Load configuration from settings.yaml"""
    config_path = get_data_root() / "config" / "settings.yaml"
    
    if not config_path.exists():
        console.print(f"[red]Error: Config file not found at {config_path}[/red]")
        raise typer.Exit(1)
    
    with open(config_path, "r", encoding="utf-8") as f:
        raw_config = yaml.safe_load(f) or {}

    config = raw_config if isinstance(raw_config, dict) else {}

    midjourney_config = config.get("midjourney")
    if not isinstance(midjourney_config, dict):
        midjourney_config = {}
        config["midjourney"] = midjourney_config

    midjourney_config["discord_token"] = _resolve_env_value(
        "DISCORD_TOKEN",
        midjourney_config.get("discord_token"),
    )
    midjourney_config["channel_id"] = _resolve_env_value(
        "MJ_CHANNEL_ID",
        midjourney_config.get("channel_id"),
    )
    midjourney_config["niji_channel_id"] = _resolve_env_value(
        "NIJI_CHANNEL_ID",
        midjourney_config.get("niji_channel_id"),
    )

    llm_config = config.get("llm")
    if isinstance(llm_config, dict):
        has_nested_profiles = isinstance(llm_config.get("primary"), dict) or isinstance(llm_config.get("fallback"), dict)
        if has_nested_profiles:
            _overlay_llm_profile(llm_config.get("primary"), "LLM_PRIMARY_API_KEY", "LLM_PRIMARY_BASE_URL")
            _overlay_llm_profile(llm_config.get("fallback"), "LLM_FALLBACK_API_KEY", "LLM_FALLBACK_BASE_URL")
        else:
            _overlay_llm_profile(llm_config, "LLM_PRIMARY_API_KEY", "LLM_PRIMARY_BASE_URL")

    return config


def resolve_llm_profiles(config: dict[str, Any]) -> tuple[dict[str, Any], Optional[dict[str, Any]]]:
    """Resolve primary/fallback LLM profiles with backward compatibility."""
    raw_llm_config = config.get("llm", {})
    llm_config = raw_llm_config if isinstance(raw_llm_config, dict) else {}

    primary = llm_config.get("primary")
    fallback = llm_config.get("fallback")

    primary_config = primary if isinstance(primary, dict) else llm_config
    fallback_config = fallback if isinstance(fallback, dict) else None
    return primary_config, fallback_config


def resolve_model(
    llm_config: dict[str, Any],
    default_model: str,
    *,
    random_from_models: bool = False,
) -> str:
    """Resolve model name from config with optional random list selection."""
    if random_from_models:
        raw_models = llm_config.get("models", [])
        if isinstance(raw_models, list):
            models = [item.strip() for item in raw_models if isinstance(item, str) and item.strip()]
            if models:
                return random.choice(models)

    model = llm_config.get("model")
    if isinstance(model, str) and model.strip():
        return model.strip()

    return default_model


def create_openai_client(llm_config: dict[str, Any]) -> "OpenAI":
    """Create OpenAI client from config"""
    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError("openai package is required for OpenAI-compatible providers.")
    
    api_key_env_var = llm_config.get("__api_key_env_var")
    api_key = _resolve_env_value(
        api_key_env_var if isinstance(api_key_env_var, str) else "",
        llm_config.get("api_key", ""),
    )
    access_token = llm_config.get("access_token", "")
    if (not api_key or api_key == "YOUR_API_KEY_HERE") and access_token:
        api_key = access_token

    if not api_key or api_key == "YOUR_API_KEY_HERE":
        raise RuntimeError("Please set the LLM API key via environment variable or config/settings.yaml")
    
    base_url_env_var = llm_config.get("__base_url_env_var")
    base_url = _resolve_env_value(
        base_url_env_var if isinstance(base_url_env_var, str) else "",
        llm_config.get("base_url", ""),
    ) or "https://api.openai.com/v1"

    headers = llm_config.get("headers", {})
    if not isinstance(headers, dict):
        console.print("[yellow]Warning: llm.headers must be a dictionary; ignoring custom headers.[/yellow]")
        headers = {}

    if access_token and "Authorization" not in headers:
        headers["Authorization"] = f"Bearer {access_token}"

    client_kwargs = {
        "api_key": api_key,
        "base_url": base_url,
    }
    if headers:
        client_kwargs["default_headers"] = headers

    return OpenAI(**client_kwargs)


def load_reference_knowledge() -> str:
    """Load markdown/text knowledge files for system prompt context."""
    knowledge_dir = get_data_root() / "modules" / "architect" / "knowledge"
    if not knowledge_dir.exists():
        return ""

    knowledge_sections = []
    for pattern in ("*.md", "*.txt"):
        for file_path in sorted(knowledge_dir.glob(pattern)):
            try:
                content = file_path.read_text(encoding="utf-8").strip()
            except Exception as e:
                console.print(f"[yellow]Warning: Could not read {file_path.name}: {e}[/yellow]")
                continue

            if content:
                knowledge_sections.append(f"## {file_path.name}\n{content}")

    return "\n\n".join(knowledge_sections)


def build_prompt_messages(
    topic: str,
    count: int,
    *,
    niji: bool = False,
    requirements: str = "",
    detail_level: int = 3,
    use_knowledge: bool = True,
) -> tuple[str, str]:
    """Build system and user prompts for generation."""
    knowledge_content = load_reference_knowledge() if use_knowledge else ""

    system_prompt = PROMPT_EXPANSION_SYSTEM
    if knowledge_content:
        system_prompt = (
            f"{PROMPT_EXPANSION_SYSTEM}\n\n"
            f"Here is your reference knowledge base: \n\n{knowledge_content}"
        )

    niji_instruction = (
        "For anime, manga, or illustration-focused prompts, prefer `--niji 7` and "
        "lean into Niji 7 aesthetics: expressive character design, clean linework, "
        "dynamic compositions, and rich cinematic color storytelling."
    )

    system_prompt = f"{system_prompt}\n\nNiji mode guidance:\n- {niji_instruction}"

    level = max(1, min(5, int(detail_level or 3)))
    length_guidance = {
        1: "Keep prompts concise and clean (25-60 words).",
        2: "Keep prompts moderately detailed (45-90 words).",
        3: "Make prompts detailed (60-130 words).",
        4: "Make prompts richly detailed with layered art direction (90-170 words).",
        5: "Make prompts highly complex, cinematic, and deeply art-directed (120-220 words).",
    }[level]

    user_parts: list[str] = []
    user_parts.append(f"Topic: {topic}")
    user_parts.append(f"Generate exactly {count} unique Midjourney prompts.")
    user_parts.append(f"Detail level: {level}/5. {length_guidance}")

    if niji:
        user_parts.append("Mode: Niji 7 (anime/illustration). Prefer `--niji 7` parameters.")

    req = (requirements or "").strip()
    if req:
        user_parts.append("Additional requirements:\n" + req)

    user_message = "\n\n".join(user_parts)
    return system_prompt, user_message


def run_openai_completion(
    llm_config: dict[str, Any],
    system_prompt: str,
    user_message: str,
    *,
    random_model: bool = False,
    max_tokens: Optional[int] = None,
) -> str:
    """Run completion via OpenAI-compatible API providers."""
    model = resolve_model(llm_config, "gpt-4-turbo", random_from_models=random_model)
    temperature = llm_config.get("temperature", 0.7)
    max_tokens = int(llm_config.get("max_tokens") or max_tokens or 4000)
    client = create_openai_client(llm_config)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(f"Generating prompts with {model}...", total=None)

        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )

            progress.update(task, completed=True)

        except Exception as e:
            raise RuntimeError(f"Error calling LLM API: {e}") from e

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("LLM API returned empty output.")

    return content.strip()


def build_opencode_command(
    llm_config: dict[str, Any],
    system_prompt: str,
    user_message: str,
    *,
    random_model: bool = False,
) -> list[str]:
    """Build OpenCode CLI command from template."""
    model = resolve_model(llm_config, "deepseek-r1", random_from_models=random_model)
    command_template = llm_config.get("command_template", 'opencode -p "{prompt}"')
    full_prompt = f"{system_prompt}\n\n{user_message}"

    template_values = {
        "prompt": full_prompt,
        "model": model,
        "system_prompt": system_prompt,
        "user_prompt": user_message,
    }

    try:
        command_parts = shlex.split(command_template)
    except ValueError as e:
        raise RuntimeError(f"Error parsing llm.command_template: {e}") from e

    try:
        return [part.format(**template_values) for part in command_parts]
    except KeyError as e:
        raise RuntimeError(
            "Unknown placeholder in llm.command_template: "
            f"{e}. Supported placeholders: {{prompt}}, {{model}}, {{system_prompt}}, {{user_prompt}}"
        ) from e


def verify_opencode_cli() -> str:
    """Verify OpenCode CLI availability and return version output."""
    try:
        version_result = subprocess.run(
            ["opencode", "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        console.print("[red]Error: OpenCode CLI not found. Install it and ensure 'opencode' is in PATH.[/red]")
        raise typer.Exit(1)

    if version_result.returncode != 0:
        error_output = version_result.stderr.strip() or version_result.stdout.strip() or "Unknown error"
        console.print(f"[red]Error: OpenCode CLI check failed: {error_output}[/red]")
        raise typer.Exit(1)

    return version_result.stdout.strip()


def run_opencode_completion(
    llm_config: dict[str, Any],
    system_prompt: str,
    user_message: str,
    *,
    random_model: bool = False,
    max_tokens: Optional[int] = None,
) -> str:
    """Run completion via OpenCode CLI."""
    model = resolve_model(llm_config, "deepseek-r1", random_from_models=random_model)
    command = build_opencode_command(
        llm_config,
        system_prompt,
        user_message,
        random_model=random_model,
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(f"Generating prompts with {model} via OpenCode CLI...", total=None)

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
            progress.update(task, completed=True)
        except FileNotFoundError:
            raise RuntimeError("OpenCode CLI not found. Install it and ensure 'opencode' is in PATH.")
        except Exception as e:
            raise RuntimeError(f"Error executing OpenCode CLI: {e}") from e

    if result.returncode != 0:
        error_output = result.stderr.strip() or result.stdout.strip() or "Unknown error"
        raise RuntimeError(f"Error running OpenCode command: {error_output}")

    content = result.stdout.strip()
    if not content:
        raise RuntimeError("OpenCode command returned empty output.")

    return content


def call_provider(
    llm_config: dict[str, Any],
    system_prompt: str,
    user_message: str,
    *,
    random_model: bool = False,
    max_tokens: Optional[int] = None,
) -> str:
    """Route prompt generation to provider in a single profile."""
    provider = str(llm_config.get("provider", "openai")).lower()

    if provider == "opencode":
        return run_opencode_completion(
            llm_config,
            system_prompt,
            user_message,
            random_model=random_model,
            max_tokens=max_tokens,
        )

    if provider in {"openai", "anthropic"}:
        return run_openai_completion(
            llm_config,
            system_prompt,
            user_message,
            random_model=random_model,
            max_tokens=max_tokens,
        )

    raise RuntimeError(
        f"Unsupported LLM provider '{provider}'. "
        "Use one of: openai, anthropic, opencode."
    )


def call_llm(
    config: dict[str, Any],
    system_prompt: str,
    user_message: str,
    *,
    max_tokens: Optional[int] = None,
) -> str:
    """Route prompt generation with primary/fallback support."""
    primary_config, fallback_config = resolve_llm_profiles(config)

    try:
        return call_provider(primary_config, system_prompt, user_message, max_tokens=max_tokens)
    except Exception as primary_error:
        if not fallback_config:
            console.print(f"[red]Error calling primary LLM: {primary_error}[/red]")
            raise typer.Exit(1)

        console.print(
            f"[yellow]Warning: Primary LLM failed ({primary_error}). "
            "Switching to fallback profile.[/yellow]"
        )

    assert fallback_config is not None

    try:
        return call_provider(
            fallback_config,
            system_prompt,
            user_message,
            random_model=True,
            max_tokens=max_tokens,
        )
    except Exception as fallback_error:
        console.print(f"[red]Error: Fallback LLM failed: {fallback_error}[/red]")
        raise typer.Exit(1)


def _clean_json_response(content: str) -> str:
    """Normalize markdown-wrapped JSON output."""
    content = content.strip()

    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


def _parse_json_array_prefix(content: str) -> list[Any]:
    """Parse the first JSON array found in the content."""
    decoder = json.JSONDecoder()
    prompts, _ = decoder.raw_decode(content)
    if not isinstance(prompts, list):
        raise ValueError("Response is not a JSON array")
    return prompts


def _recover_partial_json_array(content: str) -> list[Any]:
    """Recover complete array items from a truncated JSON array response."""
    decoder = json.JSONDecoder()
    payload = content.lstrip()
    if not payload.startswith("["):
        raise ValueError("Response does not start with a JSON array")

    items: list[Any] = []
    index = 1

    while index < len(payload):
        while index < len(payload) and payload[index].isspace():
            index += 1

        if index >= len(payload) or payload[index] == "]":
            break

        try:
            item, end = decoder.raw_decode(payload, index)
        except json.JSONDecodeError:
            break

        items.append(item)
        index = end

        while index < len(payload) and payload[index].isspace():
            index += 1

        if index >= len(payload):
            break
        if payload[index] == ",":
            index += 1
            continue
        if payload[index] == "]":
            break
        break

    if not items:
        raise ValueError("Could not recover any prompt items from response")

    return items


def parse_prompts_response(content: str) -> list[dict[str, Any]]:
    """Parse LLM response content into prompt list."""
    cleaned = _clean_json_response(content)
    candidates = [cleaned]

    first_bracket = cleaned.find("[")
    if first_bracket > 0:
        candidates.append(cleaned[first_bracket:])

    last_error: Optional[Exception] = None

    for candidate in candidates:
        try:
            prompts = _parse_json_array_prefix(candidate)
            return prompts
        except (json.JSONDecodeError, ValueError) as error:
            last_error = error
            try:
                recovered = _recover_partial_json_array(candidate)
                console.print(
                    f"[yellow]Warning: Recovered {len(recovered)} prompt objects from a truncated JSON response.[/yellow]"
                )
                return recovered
            except ValueError:
                continue

    console.print(f"[red]Error parsing JSON response: {last_error}[/red]")
    console.print(f"[yellow]Raw response:[/yellow]\n{cleaned}")
    raise typer.Exit(1)


def _force_niji_parameters(prompts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for item in prompts:
        if not isinstance(item, dict):
            continue

        params = item.get("parameters")
        if isinstance(params, dict):
            params = dict(params)
            params.pop("v", None)
            params["niji"] = 7
            item["parameters"] = params
        elif isinstance(params, str):
            s = params
            s = s.replace("--v 7", "").replace("--v7", "")
            if "--niji" not in s:
                s = (s + " --niji 7").strip()
            item["parameters"] = " ".join(s.split())
        else:
            item["parameters"] = {"niji": 7}

    return prompts


def generate_prompts(
    topic: str,
    count: int,
    config: dict[str, Any],
    *,
    niji: bool = False,
    requirements: str = "",
    detail_level: int = 3,
    use_knowledge: bool = True,
) -> list[dict[str, Any]]:
    """Generate prompts using configured LLM provider."""
    system_prompt, user_message = build_prompt_messages(
        topic,
        count,
        niji=niji,
        requirements=requirements,
        detail_level=detail_level,
        use_knowledge=use_knowledge,
    )
    content = call_llm(
        config,
        system_prompt,
        user_message,
        max_tokens=calculate_completion_max_tokens(count, detail_level),
    )
    prompts = parse_prompts_response(content)
    if niji:
        prompts = _force_niji_parameters(prompts)
    return prompts


def save_prompts(
    prompts: list[dict[str, Any]],
    topic: str,
    *,
    output_dir: str = "",
    mode: str = "standard",
) -> Path:
    """Save prompts to output directory"""
    # Create output directory
    base_dir = Path(output_dir).expanduser().resolve() if output_dir else (get_data_root() / "output" / "prompts")
    base_dir.mkdir(parents=True, exist_ok=True)
    
    # Create filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    topic_slug = topic.lower().replace(" ", "_").replace("/", "_")[:50]
    filename = f"{timestamp}_{topic_slug}.json"

    output_path = base_dir / filename
    
    # Save with metadata
    output_data = {
        "topic": topic,
        "mode": mode,
        "generated_at": datetime.now().isoformat(),
        "count": len(prompts),
        "prompts": prompts
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    return output_path


@app.command()
def generate(
    topic: str = typer.Argument("", help="Topic for prompt generation"),
    count: int = typer.Option(20, "--count", "-c", help="Number of prompts to generate"),
    niji: bool = typer.Option(False, "--niji", help="Prefer Niji 7 aesthetics and parameters"),
    detail_level: int = typer.Option(3, "--detail", min=1, max=5, help="Prompt complexity/detail level (1-5)"),
    requirements: str = typer.Option("", "--requirements", "-r", help="Additional constraints or art direction"),
    use_knowledge: bool = typer.Option(True, "--knowledge/--no-knowledge", help="Include architect knowledge base context"),
    output_dir: str = typer.Option("", "--output-dir", help="Override output directory for prompt JSON"),
):
    """
    Generate Midjourney prompts for a given topic using LLM.
    
    Example:
        python main.py "cyberpunk city" --count 20
    """
    
    topic = topic.strip()
    while not topic:
        topic = typer.prompt("Enter topic for prompt generation").strip()

    # Display header
    console.print(Panel.fit(
        f"[bold cyan]Architect Module[/bold cyan]\n"
        f"Topic: [yellow]{topic}[/yellow]\n"
        f"Count: [yellow]{count}[/yellow]",
        border_style="cyan"
    ))
    
    # Load config
    console.print("\n[dim]Loading configuration...[/dim]")
    config = load_config()
    
    primary_llm, _ = resolve_llm_profiles(config)
    provider = str(primary_llm.get("provider", "openai")).lower()
    default_model = "deepseek-r1" if provider == "opencode" else "gpt-4-turbo"
    model = resolve_model(primary_llm, default_model)
    console.print(f"[dim]Using provider: {provider} (model: {model})[/dim]")

    if provider == "opencode":
        console.print("[dim]Checking OpenCode CLI...[/dim]")
        version = verify_opencode_cli()
        if version:
            console.print(f"[dim]OpenCode CLI: {version.splitlines()[0]}[/dim]")
    
    # Generate prompts
    console.print(f"\n[bold]Generating prompts...[/bold]")
    prompts = generate_prompts(
        topic,
        count,
        config,
        niji=niji,
        requirements=requirements,
        detail_level=detail_level,
        use_knowledge=use_knowledge,
    )
    
    # Validate count
    if len(prompts) != count:
        console.print(f"[yellow]Warning: Generated {len(prompts)} prompts instead of {count}[/yellow]")
    
    # Save prompts
    output_path = save_prompts(prompts, topic, output_dir=output_dir, mode='niji' if niji else 'standard')
    
    # Display success
    console.print(f"\n[bold green]✓ Success![/bold green]")
    console.print(f"Generated [cyan]{len(prompts)}[/cyan] prompts")
    console.print(f"Saved to: [blue]{output_path}[/blue]")
    
    # Display sample prompts
    console.print("\n[bold]Sample prompts:[/bold]")
    for i, prompt_data in enumerate(prompts[:3], 1):
        prompt_text = prompt_data.get("prompt", "")
        params = prompt_data.get("parameters", {})
        
        # Build parameter string
        param_str = " ".join([
            f"--{k} {v}" for k, v in params.items() if v is not None
        ])
        
        console.print(f"\n[dim]{i}.[/dim] {prompt_text[:100]}...")
        console.print(f"   [dim]{param_str}[/dim]")
    
    if len(prompts) > 3:
        console.print(f"\n[dim]... and {len(prompts) - 3} more prompts[/dim]")


if __name__ == "__main__":
    app()
