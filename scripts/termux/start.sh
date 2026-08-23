#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Iniciando Campainha Digital..."

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# As of the server-side face recognition migration, the backend (API +
# database) runs on a remote VPS - this device only needs to serve the
# built frontend. Configure frontend/.env with VITE_API_URL pointing at
# that VPS before running this script.
if [ ! -f "frontend/.env" ]; then
    echo "❌ Arquivo frontend/.env não encontrado!"
    echo "Crie frontend/.env com VITE_API_URL apontando para o backend (VPS)."
    exit 1
fi

if [ ! -d "frontend/dist" ]; then
    echo "❌ frontend/dist não encontrado! Rode antes: cd frontend && npm run build:termux"
    exit 1
fi

# Kill existing processes
echo "🧹 Parando processos existentes..."
pkill -f "vite preview" 2>/dev/null
if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
    kill "$(cat "$PROJECT_ROOT/.frontend.pid")" 2>/dev/null
    rm "$PROJECT_ROOT/.frontend.pid"
fi

# Serve the built frontend as static files
echo "🔧 Iniciando frontend..."
cd "$PROJECT_ROOT/frontend"
mkdir -p ../logs
nohup npx vite preview --port 3000 --host > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✓ Frontend iniciado (PID: $FRONTEND_PID)"

echo $FRONTEND_PID > "$PROJECT_ROOT/.frontend.pid"

echo "⏳ Aguardando frontend inicializar..."
sleep 3

if ps -p $FRONTEND_PID > /dev/null; then
    echo "✅ Frontend rodando em http://localhost:3000"
else
    echo "❌ Falha ao iniciar frontend. Verifique logs/frontend.log"
    exit 1
fi

echo ""
echo "========================================="
echo "  Campainha Digital - ATIVA"
echo "========================================="
echo ""
echo "📱 Acesse: http://localhost:3000"
echo "📊 Logs: tail -f logs/frontend.log"
echo "🛑 Parar: bash scripts/termux/stop.sh"
echo ""
echo "💡 Dica: Configure o navegador para fullscreen"
echo "========================================="
