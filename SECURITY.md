# Security Policy

## Supported Scope

Midjourney Factory is currently a local-first toolchain. The most sensitive
areas are:

- local environment variables and API keys
- Discord session state under `output/browser_state*`
- uploaded reference images and downloaded outputs
- any automation that could leak prompts, tokens, or private assets

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities involving credentials,
session state, or exploitable automation behavior.

If this repository is hosted on GitHub, prefer a private GitHub Security
Advisory. If private advisories are not available yet, contact the maintainer
through the repository profile or other published private contact channel and
include:

- a clear description of the issue
- affected files or modules
- reproduction steps
- impact assessment
- any suggested mitigation

## Response Expectations

The goal is to acknowledge reports promptly, confirm impact, and publish a fix
or mitigation guidance as soon as practical. Public disclosure should wait
until users have a reasonable path to update or mitigate.
