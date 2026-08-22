#!/data/data/com.termux/files/usr/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "📝 Logs da Campainha Digital"
echo "Pressione Ctrl+C para sair"
echo "========================================="
echo ""

if [ -f "$PROJECT_ROOT/logs/backend.log" ]; then
    tail -f "$PROJECT_ROOT/logs/backend.log"
else
    echo "Nenhum log encontrado ainda"
fi
