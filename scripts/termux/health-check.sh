#!/data/data/com.termux/files/usr/bin/bash

echo "🏥 Verificação de Saúde - Campainha Digital"
echo "========================================="
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Check if frontend (this device) is running
if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
    PID=$(cat "$PROJECT_ROOT/.frontend.pid")

    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Frontend: ONLINE (PID: $PID)"
    else
        echo "❌ Frontend: OFFLINE (PID inválido)"
    fi
else
    echo "❌ Frontend: OFFLINE (sem PID)"
fi

echo ""
echo "🔍 Testando frontend local..."
if command -v curl &> /dev/null; then
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend local: RESPONDENDO"
    else
        echo "❌ Frontend local: SEM RESPOSTA"
    fi
else
    echo "⚠️  curl não instalado. Execute: pkg install curl"
fi

echo ""
echo "🔍 Testando backend remoto (VPS)..."
if [ -f "$PROJECT_ROOT/frontend/.env" ]; then
    API_URL=$(grep '^VITE_API_URL=' "$PROJECT_ROOT/frontend/.env" | cut -d'=' -f2-)
    HEALTH_URL="${API_URL%/api}/health"
    if command -v curl &> /dev/null && [ -n "$API_URL" ]; then
        RESPONSE=$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null)
        if [ -n "$RESPONSE" ]; then
            echo "✅ Backend (VPS): RESPONDENDO"
            echo "   Response: $RESPONSE"
        else
            echo "❌ Backend (VPS): SEM RESPOSTA ($HEALTH_URL)"
        fi
    fi
else
    echo "⚠️  frontend/.env não encontrado, não sei qual VPS testar"
fi

echo ""
echo "📝 Últimas 5 linhas do log local:"
if [ -f "$PROJECT_ROOT/logs/frontend.log" ]; then
    tail -n 5 "$PROJECT_ROOT/logs/frontend.log"
else
    echo "   (sem logs ainda)"
fi

echo ""
echo "========================================="
