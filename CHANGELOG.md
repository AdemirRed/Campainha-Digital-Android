# Campainha Digital - Fase 1 MVP

## ✅ Implementação Completa

Sistema de campainha/intercomunicador inteligente 100% funcional rodando em celular Android via Termux.

---

## 📋 O que foi implementado

### Backend (Node.js + TypeScript)
- ✅ API REST completa com Express
- ✅ Banco de dados SQLite com WAL mode
- ✅ Sistema de eventos (EventBus pub/sub)
- ✅ Repositories pattern (Event, Delivery, Settings)
- ✅ Controllers com validação
- ✅ Middleware (auth, rate limiting, logging, error handling)
- ✅ Migrações automáticas do banco
- ✅ Logging estruturado (Winston)
- ✅ Segurança (Helmet, CORS, rate limit 100req/15min)

### Frontend (React + Vite PWA)
- ✅ Interface kiosk fullscreen
- ✅ 4 páginas (Standby, Home, Delivery, DeliveryCode)
- ✅ Componentes reutilizáveis (Button, Toast, Loading)
- ✅ Timer de inatividade (retorna ao standby)
- ✅ Prevenção de navegação (kiosk mode)
- ✅ Service Worker para PWA
- ✅ API service centralizado
- ✅ Design responsivo para celular

### Shared
- ✅ Types TypeScript compartilhados
- ✅ Constants (empresas de entrega, botões)

### Scripts Termux
- ✅ install.sh (instalação automática)
- ✅ start.sh (iniciar sistema)
- ✅ stop.sh (parar sistema)
- ✅ health-check.sh (verificação de saúde)
- ✅ logs.sh (visualizar logs em tempo real)

### Documentação
- ✅ README.md (visão geral do projeto)
- ✅ ARCHITECTURE.md (arquitetura do sistema)
- ✅ API.md (referência completa da API)
- ✅ TERMUX_SETUP.md (guia de instalação Termux)
- ✅ ANDROID_CONFIG.md (configuração kiosk mode)
- ✅ TROUBLESHOOTING.md (solução de problemas)

---

## 🚀 Como Usar

### 1. No Termux (Android)

```bash
# Instalar
bash scripts/termux/install.sh

# Configurar .env
nano backend/.env
# Defina API_TOKEN e SESSION_SECRET

# Iniciar
bash scripts/termux/start.sh
```

### 2. No Navegador

Acesse: `http://localhost:3000`

---

## 📦 Estrutura do Projeto

```
smart-doorbell/
├── backend/              # API Node.js
│   ├── src/
│   │   ├── controllers/  # Event, Delivery, Settings
│   │   ├── services/     # EventBus, EventService
│   │   ├── database/     # migrations, repositories
│   │   ├── routes/       # rotas da API
│   │   ├── middleware/   # auth, rateLimiter, etc
│   │   └── utils/        # logger, filesystem
│   └── dist/             # build output
│
├── frontend/             # React PWA
│   ├── src/
│   │   ├── pages/        # Standby, Home, Delivery, etc
│   │   ├── components/   # Button, Toast, Loading
│   │   ├── services/     # apiService
│   │   ├── hooks/        # useInactivityTimer, etc
│   │   └── styles/       # global.css
│   └── dist/             # build output
│
├── shared/               # Types compartilhados
├── scripts/termux/       # Scripts de deploy
├── docs/                 # Documentação
└── data/                 # Database (criado em runtime)
```

---

## 🧪 Testar API

```bash
# Health check
curl http://localhost:3000/health

# Criar evento
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"person_detected"}'

# Listar eventos
curl http://localhost:3000/api/events

# Criar entrega
curl -X POST http://localhost:3000/api/deliveries \
  -H "Content-Type: application/json" \
  -d '{"company":"mercadolivre","tracking_code":"ML123456"}'
```

---

## 🎯 Fluxo de Uso

1. **Standby**: Sistema aguarda (tela em espera)
2. **Detecção** (simulada): Após 3s, mostra "Bem-vindo!"
3. **Home**: Visitante vê 3 botões:
   - 🔔 CHAMAR (placeholder - Fase 3)
   - 📦 ENTREGA
   - 🤝 OUTRO MOTIVO
4. **Delivery**: Escolhe empresa (Mercado Livre, Shopee, etc)
5. **Código**: Digita código de rastreamento
6. **Confirmação**: Sistema registra e retorna ao standby

---

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
bash scripts/termux/logs.sh

# Verificar saúde do sistema
bash scripts/termux/health-check.sh

# Parar sistema
bash scripts/termux/stop.sh

# Reinstalar
bash scripts/termux/install.sh
```

---

## 📱 Próximas Fases (Roadmap)

- **Fase 2**: Câmera real + gravação de vídeo
- **Fase 3**: Sistema de chamada (videochamada)
- **Fase 4**: Acesso remoto via internet + painel admin web
- **Fase 5**: Reconhecimento facial com embeddings + IA (Ollama)
- **Fase 6**: Sincronização com PC/servidor
- **Fase 7**: Escalabilidade (PostgreSQL + VPS)
- **Fase 8**: Automação e controle de acesso
- **Fase 9**: Multi-dispositivos

---

## 🐛 Problemas?

Consulte [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📊 Status do Projeto

**Versão**: 1.0.0  
**Fase Atual**: 1 - MVP ✅  
**Status**: Pronto para uso  
**Última Atualização**: 2026-08-22

---

## 🏗️ Arquitetura

```
┌─────────────┐
│   Browser   │ ← Interface kiosk fullscreen
└──────┬──────┘
       │ HTTP/REST
┌──────▼──────┐
│   Express   │ ← Backend Node.js
└──────┬──────┘
       │
┌──────▼──────┐
│   SQLite    │ ← Banco de dados local
└─────────────┘
```

Detalhes completos: [ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 📖 Documentação

- [API Reference](docs/API.md)
- [Termux Setup](docs/TERMUX_SETUP.md)
- [Android Config](docs/ANDROID_CONFIG.md)
- [Architecture](docs/ARCHITECTURE.md)

---

## 🎉 Pronto para produção!

O sistema está 100% funcional e pode ser usado em ambiente de produção no celular Android.

**Próximo passo**: Execute `bash scripts/termux/install.sh` no Termux!
