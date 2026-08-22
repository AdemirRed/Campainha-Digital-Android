#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Iniciando Campainha Digital..."

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "❌ Arquivo backend/.env não encontrado!"
    echo "Execute: bash scripts/termux/install.sh"
    exit 1
fi

# Kill existing processes
echo "🧹 Parando processos existentes..."
pkill -f "node.*backend/dist/index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Start backend in background
echo "🔧 Iniciando backend..."
cd "$PROJECT_ROOT/backend"
NODE_ENV=production node dist/index.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✓ Backend iniciado (PID: $BACKEND_PID)"

# Save PID for stop script
echo $BACKEND_PID > "$PROJECT_ROOT/.backend.pid"

# Wait for backend to start
echo "⏳ Aguardando backend inicializar..."
sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend rodando em http://localhost:3000"
else
    echo "❌ Falha ao iniciar backend. Verifique logs/backend.log"
    exit 1
fi

echo ""
echo "========================================="
echo "  Campainha Digital - ATIVA"
echo "========================================="
echo ""
echo "📱 Acesse: http://localhost:3000"
echo "📊 Logs: tail -f logs/backend.log"
echo "🛑 Parar: bash scripts/termux/stop.sh"
echo ""
echo "💡 Dica: Configure o navegador para fullscreen"
echo "========================================="
