# 🔔 Campainha Digital Inteligente

Sistema de campainha/intercomunicador inteligente usando celular Android antigo como dispositivo principal.

## 🎯 Características

- ✅ **Funcionamento 100% local** - não depende de PC ou internet
- 🤖 **Interface Kiosk** - tela fullscreen para visitantes
- 📦 **Gestão de Entregas** - fluxo específico para Mercado Livre, Correios, etc
- 🎥 **Câmera Inteligente** - detecção de movimento e pessoas (fases futuras)
- 🧠 **Reconhecimento Facial** - identifica moradores vs visitantes (fase 5)
- 📞 **Chamadas de Vídeo** - WebRTC para comunicação (fase 3)
- 🔐 **Seguro** - autenticação, criptografia, logs completos

## 🏗️ Arquitetura

```
┌─────────────────────────────────────┐
│  Celular Android Externo (Termux)  │
│  ┌───────────┐     ┌─────────────┐ │
│  │  Backend  │────→│   SQLite    │ │
│  │  Node.js  │     └─────────────┘ │
│  └─────┬─────┘                     │
│        │ HTTP API                  │
│  ┌─────┴─────┐                     │
│  │ Frontend  │                     │
│  │ React PWA │                     │
│  └───────────┘                     │
└─────────────────────────────────────┘
```

## 📦 Estrutura do Projeto

```
smart-doorbell/
├── frontend/          # React + Vite + PWA
├── backend/           # Node.js + Express + TypeScript
├── shared/            # Types compartilhados
├── scripts/           # Scripts Termux
├── docs/              # Documentação
└── README.md
```

## 🚀 Início Rápido

### Pré-requisitos

- **Android**: >= 8.0 (API 26)
- **Termux**: versão F-Droid (não Google Play)
- **Node.js**: >= 18.0.0
- **Armazenamento**: mínimo 2GB livre

### Instalação

1. **Instale o Termux** no celular Android (via F-Droid)

2. **Clone o repositório**:
```bash
pkg install git
git clone [URL_DO_REPO]
cd smart-doorbell
```

3. **Execute o script de instalação**:
```bash
bash scripts/termux/install.sh
```

4. **Inicie o sistema**:
```bash
bash scripts/termux/start.sh
```

5. **Acesse a interface**:
- Abra o navegador no celular
- Vá para: `http://localhost:3000`
- Ative o modo fullscreen

## 📱 Uso

### Interface Kiosk (Visitante)

1. Pessoa chega na porta
2. Sistema detecta presença (simulado no MVP)
3. Tela ativa automaticamente
4. Visitante vê 3 opções:
   - **CHAMAR MORADOR** - inicia chamada (fase 3)
   - **ENTREGA** - fluxo de registro de entrega
   - **OUTRO MOTIVO** - registro genérico

### Fluxo de Entrega

1. Visitante seleciona "ENTREGA"
2. Escolhe empresa: Mercado Livre, Shopee, Correios, Outra
3. Informa código de rastreamento
4. Sistema registra no banco de dados
5. Retorna à tela inicial

## 🛠️ Desenvolvimento

### Instalar Dependências

```bash
npm install
```

### Backend (desenvolvimento local)

```bash
cd backend
npm run dev
```

### Frontend (desenvolvimento local)

```bash
cd frontend
npm run dev
```

### Build Completo

```bash
npm run build
```

## 📋 Scripts Disponíveis

- `scripts/termux/install.sh` - Instalação inicial
- `scripts/termux/start.sh` - Iniciar sistema
- `scripts/termux/stop.sh` - Parar sistema
- `scripts/termux/health-check.sh` - Verificar status
- `scripts/termux/logs.sh` - Ver logs

## 🗺️ RoadMap

- ✅ **Fase 1**: MVP - Interface kiosk + fluxo de entrega (ATUAL)
- 🔄 **Fase 2**: Câmera real + gravação de vídeo
- 🔄 **Fase 3**: Chamadas de vídeo (WebRTC)
- 🔄 **Fase 4**: Acesso remoto + notificações push
- 🔄 **Fase 5**: IA (Ollama) + reconhecimento facial + painel admin
- 🔄 **Fase 6**: Sincronização com PC
- 🔄 **Fase 7**: PostgreSQL + VPS
- 🔄 **Fase 8**: Automação residencial + fechadura
- 🔄 **Fase 9**: Múltiplos dispositivos + polimento

## 📚 Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Setup Termux](docs/TERMUX_SETUP.md)
- [Configuração Android](docs/ANDROID_CONFIG.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🔒 Segurança

- Autenticação por token
- Rate limiting
- Validação de inputs
- Logs de auditoria
- Chaves armazenadas de forma segura (criptografadas na fase 5)

## 🤝 Contribuindo

Este é um projeto pessoal, mas sugestões são bem-vindas via issues.

## 📄 Licença

MIT License

## 🆘 Suporte

Consulte [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) para problemas comuns.

---

**Versão**: 1.0.0 (Fase 1 - MVP)  
**Última Atualização**: 2026-08-22
