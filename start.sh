#!/bin/bash
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$ROOT_DIR" || exit 1

echo "🚀 Initializing Midjourney Factory Commander..."

ensure_architect_env() {
    local venv_dir="modules/architect/.venv"
    local venv_python="$venv_dir/bin/python"
    local requirements_file="modules/architect/requirements.txt"

    if [ ! -x "$venv_python" ]; then
        echo "📦 Preparing Architect Python environment..."
        python3 -m venv "$venv_dir"
    fi

    if ! "$venv_python" -c "import typer, yaml, rich, openai" >/dev/null 2>&1; then
        echo "📦 Installing Architect Python dependencies..."
        "$venv_python" -m pip install -r "$requirements_file"
    fi

    echo "✅ Architect environment ready"
}

open_url() {
    URL="$1"
    if command -v open >/dev/null 2>&1; then
        open "$URL" >/dev/null 2>&1
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL" >/dev/null 2>&1
    fi
}

pick_port() {
    for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
        if ! lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

PORT=$(pick_port) || {
    echo "❌ No free port found in 3001-3010"
    exit 1
}

# Ensure architect dependencies are available
ensure_architect_env

# Install factory dependencies if not exists
if [ ! -d "modules/factory/node_modules" ]; then
    echo "📦 Installing Factory dependencies..."
    cd modules/factory && npm install && cd ../..
fi

# Install curator dependencies if not exists
if [ ! -d "modules/curator/node_modules" ]; then
    echo "📦 Installing Curator dependencies..."
    cd modules/curator && npm install && cd ../..
fi

# Install Playwright browser if missing
if [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "🌐 Installing Playwright Chromium..."
    cd modules/factory && npx playwright install chromium && cd ../..
fi

# Install commander dependencies if not exists
if [ ! -d "modules/commander/node_modules" ]; then
    echo "📦 Installing Commander dependencies..."
    cd modules/commander && npm install && cd ../..
fi

# Clean stale previous commander instances (best effort)
pkill -f "modules/commander/server.js" >/dev/null 2>&1 || true
pkill -f "next dev" >/dev/null 2>&1 || true

# Start Commander
echo "🕹️  Starting Commander Dashboard on http://localhost:$PORT"
cd modules/commander
PORT=$PORT npm run dev
