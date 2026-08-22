#!/data/data/com.termux/files/usr/bin/bash

echo "🏥 Verificação de Saúde - Campainha Digital"
echo "========================================="
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Check if backend is running
if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
    PID=$(cat "$PROJECT_ROOT/.backend.pid")
    
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Backend: ONLINE (PID: $PID)"
    else
        echo "❌ Backend: OFFLINE (PID inválido)"
    fi
else
    echo "❌ Backend: OFFLINE (sem PID)"
fi

# Check API endpoint
echo ""
echo "🔍 Testando API..."
if command -v curl &> /dev/null; then
    RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "✅ API: RESPONDENDO"
        echo "   Response: $RESPONSE"
    else
        echo "❌ API: SEM RESPOSTA"
    fi
else
    echo "⚠️  curl não instalado. Execute: pkg install curl"
fi

# Check disk space
echo ""
echo "💾 Armazenamento:"
cd "$PROJECT_ROOT"
USED=$(du -sh data 2>/dev/null | cut -f1)
echo "   Dados: ${USED:-0}"

# Check database
if [ -f "$PROJECT_ROOT/data/doorbell.db" ]; then
    DB_SIZE=$(du -h "$PROJECT_ROOT/data/doorbell.db" | cut -f1)
    echo "   Database: $DB_SIZE"
else
    echo "   Database: não criado"
fi

# Check logs
echo ""
echo "📝 Últimas 5 linhas do log:"
if [ -f "$PROJECT_ROOT/logs/backend.log" ]; then
    tail -n 5 "$PROJECT_ROOT/logs/backend.log"
else
    echo "   (sem logs ainda)"
fi

echo ""
echo "========================================="
