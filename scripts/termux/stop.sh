#!/data/data/com.termux/files/usr/bin/bash

echo "🛑 Parando Campainha Digital..."

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Read PID file
if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
    PID=$(cat "$PROJECT_ROOT/.frontend.pid")

    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✓ Frontend parado (PID: $PID)"
    else
        echo "⚠️  Frontend já estava parado"
    fi

    rm "$PROJECT_ROOT/.frontend.pid"
else
    # Fallback: kill by name
    pkill -f "vite preview"
    echo "✓ Processos finalizados"
fi

# Leftover from older versions of this project that ran the backend
# locally - harmless if nothing matches.
pkill -f "node.*backend/dist/backend/src/bootstrap.js" 2>/dev/null

echo "✅ Sistema parado"
