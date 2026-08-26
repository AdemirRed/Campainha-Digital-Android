# 🔔 Campainha Digital Inteligente

Sistema de campainha/interfone inteligente que transforma um celular Android antigo (fixado na
porta, sempre carregando e no Wi-Fi) em um kiosk com câmera, reconhecimento facial, gravação
contínua e um assistente de voz com IA que conversa com visitantes desconhecidos.

## 🎯 Características

- 🤖 **App Android nativo (WebView kiosk)** — wrapper Kotlin que abre a interface em tela cheia,
  concede permissões de câmera/microfone automaticamente e fala por TTS nativo (mais confiável que
  a Web Speech API do WebView).
- 🧠 **Reconhecimento facial** — identifica moradores cadastrados automaticamente (processado no
  servidor, via `@vladmandic/face-api` + WASM, sem depender de binários nativos do TensorFlow).
- 🗣️ **Assistente virtual com IA (Ollama Cloud)** — conversa por voz com quem não é reconhecido,
  pergunta o motivo da visita, oferece registrar um recado e responde sobre entregas.
- 📋 **Recados com contexto** — ao reconhecer um morador, o assistente pergunta se ele quer ouvir
  os recados pendentes; as mensagens salvas guardam a pergunta do assistente junto da resposta do
  visitante.
- 🏠 **Status de presença** — o morador grava por voz um aviso (“saí, volto às 21h”) que o
  assistente usa para responder visitantes perguntando se há alguém em casa (expira em 12h).
- 🎥 **Gravação contínua 24/7** — clipes de 5 minutos com retenção de 7 dias, apagando os mais
  antigos automaticamente.
- 📦 **Gestão de entregas** — fluxo dedicado para Mercado Livre, Shopee, Correios, Amazon etc.
- ⚙️ **Painel admin** — moradores, mensagens, visitantes não reconhecidos, gravações, uso de
  armazenamento e instruções personalizadas para a IA.
- 🔔 **Notificações em outro aparelho** — tela `/notifications` que toca um aviso sempre que a
  campainha for acionada, com vídeo/áudio do evento.
- 🔐 **Autenticação por token, rate limiting e CORS controlado.**

## 🏗️ Arquitetura

```
┌────────────────────────┐        ┌───────────────────────────────┐
│  Celular na porta       │        │  VPS (Node.js + Express)       │
│  (Android nativo/kiosk) │──HTTP─▶│  - API REST                    │
│  - Câmera + microfone   │        │  - sql.js (SQLite em WASM)     │
│  - TTS nativo           │        │  - Reconhecimento facial       │
│  - Gravação contínua    │        │  - Integração Ollama Cloud     │
└────────────────────────┘        │  - Armazenamento de mídia      │
                                    └───────────────────────────────┘
┌────────────────────────┐                    ▲
│  Celular/PC do morador  │────────────────────┘
│  (PWA via navegador)    │   Painel admin / notificações
└────────────────────────┘
```

O frontend (React + Vite) é o mesmo código servido tanto pelo app Android nativo (WebView) quanto
por um PWA acessado via navegador; o backend roda centralizado em um VPS, não mais no próprio
celular.

## 📦 Estrutura do Projeto

```
Campainha Digital Android/
├── android-app/        # Wrapper Android nativo (Kotlin) - WebView kiosk + TTS bridge
├── frontend/            # React + Vite + PWA
├── backend/             # Node.js + Express + TypeScript (roda no VPS)
├── shared/              # Types e constantes compartilhados
├── scripts/termux/      # Scripts para rodar o frontend via Termux
├── docs/                # Documentação
└── README.md
```

## 🚀 Início Rápido

### Backend (VPS)

```bash
cd backend
npm install
cp .env.example .env   # configure OLLAMA_API_KEY, API_TOKEN etc.
npm run build
npm start               # ou via pm2: pm2 start dist/backend/src/bootstrap.js --name campainha-backend
```

### Frontend

**Opção 1 — PWA via Termux** (celular antigo fixado na porta):

```bash
pkg install git nodejs
git clone [URL_DO_REPO]
cd "Campainha Digital Android"
bash scripts/termux/install.sh
bash scripts/termux/start.sh
```

**Opção 2 — App Android nativo**: build o projeto em `android-app/` (Android Studio ou
`./gradlew assembleRelease`) e instale o APK gerado. Ele já vem configurado para apontar para a
URL do backend definida em `frontend/.env` no momento do build.

Configure `frontend/.env` com a URL do backend (`VITE_API_URL`) e o token de API
(`VITE_API_TOKEN`) antes de gerar o build de produção.

## 📱 Uso

### Tela de espera (Standby)

1. Detecção de movimento ativa a câmera.
2. O sistema tenta reconhecer o rosto por alguns segundos.
3. **Morador reconhecido** → saudação por voz, resumo das últimas 24h e pergunta se quer ouvir
   recados pendentes.
4. **Visitante desconhecido** → o assistente de IA puxa conversa, pergunta o motivo da visita e
   registra um recado; a conversa inteira fica gravada em vídeo.

### Botões manuais (tela inicial)

- **🤖 Falar com assistente** — inicia a conversa com a IA sob demanda.
- **📦 Entrega** — escolhe a transportadora e informa o código.
- **💬 Outro motivo** — texto ou áudio livre.

### Painel Admin

Moradores, mensagens recebidas, visitantes não reconhecidos, gravações 24h, uso de
armazenamento, instruções personalizadas para a IA e o botão de gravar o status de presença.

## 🛠️ Desenvolvimento

```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Type-check
cd backend && npm run type-check
cd frontend && npx tsc --noEmit
```

## 🚢 Deploy (VPS)

```bash
ssh <usuario>@<vps>
cd /opt/campainha-digital
git pull
cd backend && npm run build
pm2 restart campainha-backend
```

## 📚 Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Setup Termux](docs/TERMUX_SETUP.md)
- [Configuração Android](docs/ANDROID_CONFIG.md)
- [Drivers Ulefone](docs/ULEFONE_DRIVERS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🗺️ Roadmap

- ✅ Interface kiosk + fluxo de entrega
- ✅ Câmera real, detecção de movimento e gravação contínua 24/7
- ✅ Reconhecimento facial de moradores (processado no servidor)
- ✅ Assistente de voz com IA (Ollama Cloud) para visitantes
- ✅ App Android nativo com TTS confiável e permissões automáticas
- ✅ Painel admin, notificações em outro aparelho, status de presença por voz
- 🔄 Identificação de visitantes recorrentes (nome + foto), reconhecendo entregadores que já
  passaram antes
- 🔄 Detecção de presença do morador via geolocalização/Bluetooth/rede Wi-Fi, com relatório de
  entradas e saídas

## 🔒 Segurança

- Autenticação por token (`API_TOKEN`)
- Rate limiting
- Validação de inputs
- CORS restrito por origem configurável

## 🆘 Suporte

Consulte [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) para problemas comuns.

---

**Projeto pessoal** — sugestões são bem-vindas via issues.
