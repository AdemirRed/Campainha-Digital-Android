#!/data/data/com.termux/files/usr/bin/bash

echo "🛑 Parando Campainha Digital..."

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Read PID file
if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
    PID=$(cat "$PROJECT_ROOT/.backend.pid")
    
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✓ Backend parado (PID: $PID)"
    else
        echo "⚠️  Backend já estava parado"
    fi
    
    rm "$PROJECT_ROOT/.backend.pid"
else
    # Fallback: kill by name
    pkill -f "node.*backend/dist/index.js"
    echo "✓ Processos finalizados"
fi

echo "✅ Sistema parado"
