# Contributing to Midjourney Factory

Thanks for helping improve Midjourney Factory.

## Scope

This project is a local-first creative workflow for Midjourney and Niji. Good
contributions include:

- bug fixes and reliability improvements
- clearer setup and troubleshooting docs
- test coverage for prompt generation, approval flows, and downloads
- safer defaults around local credentials and browser state
- UX improvements in Commander and Curator that preserve the current workflow

## Development Setup

1. Copy `.env.example` to `.env`.
2. Install the root desktop dependencies with `npm install`.
3. Start the full local workflow with `./start.sh` on macOS/Linux or `start.bat`
   on Windows.
4. When working on the Discord automation module, create login state with:
   - `cd modules/factory && npm run login:factory`
   - `cd modules/factory && npm run login:uploader`

## Tests

Please run the relevant tests before opening a pull request:

```bash
cd modules/commander && npm test
cd modules/factory && npm test
cd modules/curator && npm test
cd modules/architect && pytest -q
```

## Pull Request Guidelines

- Keep changes focused and explain the user-facing impact.
- Avoid committing secrets, browser state, generated images, or local build
  artifacts.
- Update `README.md` when behavior or setup changes.
- Add or update tests whenever practical.
- Preserve the local-first workflow unless the change explicitly introduces an
  optional hosted component.

## Design Notes

- `Architect` owns structured prompt generation.
- `Commander` owns human review, approval, and orchestration.
- `Factory` owns Discord automation and downloads.
- `Curator` owns image triage after generation.

Changes that blur those boundaries should explain why.
