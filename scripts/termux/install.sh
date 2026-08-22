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
echo "📦 Instalando dependências do projeto..."
cd "$(dirname "$0")/../.."

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

echo ""
echo "🗄️ Criando diretórios necessários..."
mkdir -p data/storage/videos
mkdir -p data/storage/photos
mkdir -p data/storage/thumbnails
mkdir -p logs

echo ""
echo "⚙️ Configurando variáveis de ambiente..."
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✓ Arquivo .env criado"
    echo "⚠️  IMPORTANTE: Edite backend/.env e configure:"
    echo "   - API_TOKEN (senha de acesso)"
    echo "   - SESSION_SECRET (chave de sessão)"
fi

echo ""
echo "🔨 Compilando backend..."
cd backend
npm run build
cd ..

echo ""
echo "🔨 Compilando frontend..."
cd frontend
npm run build:termux
cd ..

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "📝 Próximos passos:"
echo "  1. Edite backend/.env com suas configurações"
echo "  2. Execute: bash scripts/termux/start.sh"
echo "  3. Abra o navegador em: http://localhost:3000"
echo ""
echo "========================================="
