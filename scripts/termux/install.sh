#!/data/data/com.termux/files/usr/bin/bash

echo "========================================="
echo "  Instalação da Campainha Digital"
echo "========================================="
echo ""

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo "❌ Este script deve ser executado no Termux"
    exit 1
fi

echo "📦 Atualizando pacotes do Termux..."
pkg update -y
pkg upgrade -y

echo ""
echo "📦 Instalando Node.js..."
pkg install -y nodejs

echo ""
echo "📦 Verificando Node.js instalado..."
node --version
npm --version

echo ""
echo "📦 Instalando dependências do frontend..."
cd "$(dirname "$0")/../.."

# The backend (API + database + face recognition) runs on a remote VPS -
# this device only builds and serves the frontend as static files, so it
# doesn't need backend/node_modules (which would try to compile native
# modules like `canvas` that Termux can't build without Python/gyp).
cd frontend
npm install
cd ..

echo ""
echo "🗄️ Criando diretório de logs..."
mkdir -p logs

echo ""
echo "⚙️ Configurando variáveis de ambiente..."
if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    echo "✓ Arquivo frontend/.env criado"
    echo "⚠️  IMPORTANTE: Edite frontend/.env e configure:"
    echo "   - VITE_API_URL (endereço do backend na VPS, ex: http://SEU_IP:4000/api)"
    echo "   - VITE_API_TOKEN (deve bater com o API_TOKEN configurado na VPS)"
    echo "   - VITE_ADMIN_PIN (PIN de acesso ao cadastro de moradores)"
fi

echo ""
echo "🔨 Compilando frontend..."
cd frontend
npm run build:termux
cd ..

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "📝 Próximos passos:"
echo "  1. Edite frontend/.env com o endereço do seu backend"
echo "  2. Execute: bash scripts/termux/start.sh"
echo "  3. Abra o navegador em: http://localhost:3000"
echo ""
echo "========================================="
