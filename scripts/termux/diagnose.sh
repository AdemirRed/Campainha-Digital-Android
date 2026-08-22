#!/data/data/com.termux/files/usr/bin/bash

echo "🔍 Diagnóstico da Campainha Digital"
echo "========================================="
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "📂 Verificando estrutura de arquivos..."
echo ""

# Check backend build
if [ -f "backend/dist/backend/src/index.js" ]; then
    echo "✓ Backend compilado: backend/dist/backend/src/index.js"
else
    echo "❌ Backend não compilado: backend/dist/backend/src/index.js não encontrado"
fi

# Check frontend build
if [ -d "frontend/dist" ]; then
    echo "✓ Frontend compilado: frontend/dist/"
else
    echo "❌ Frontend não compilado: frontend/dist/ não encontrado"
fi

# Check .env
if [ -f "backend/.env" ]; then
    echo "✓ Configuração: backend/.env existe"
else
    echo "❌ Configuração: backend/.env não encontrado"
fi

# Check directories
if [ -d "logs" ]; then
    echo "✓ Diretório de logs existe"
else
    echo "❌ Diretório de logs não existe"
    mkdir -p logs
    echo "  → Criado logs/"
fi

if [ -d "data/storage" ]; then
    echo "✓ Diretório de dados existe"
else
    echo "❌ Diretório de dados não existe"
    mkdir -p data/storage
    echo "  → Criado data/storage/"
fi

echo ""
echo "📝 Últimas 30 linhas do log do backend:"
echo "========================================="
if [ -f "logs/backend.log" ]; then
    tail -30 logs/backend.log
else
    echo "Nenhum log encontrado ainda"
fi

echo ""
echo "🔧 Tentando iniciar backend manualmente..."
echo "========================================="
cd "$PROJECT_ROOT/backend"
NODE_ENV=production node dist/index.js
