# Arquitetura - Campainha Digital Inteligente

## Visão Geral

O sistema é dividido em 3 camadas principais:

```
┌─────────────────────────────────────────────────┐
│          FRONTEND (React PWA)                   │
│  Interface Kiosk para visitantes                │
│  - Modo Fullscreen                              │
│  - Timeout de inatividade                       │
│  - Navegação simplificada                       │
└────────────────┬────────────────────────────────┘
                 │ HTTP/REST
                 ↓
┌─────────────────────────────────────────────────┐
│          BACKEND (Node.js + Express)            │
│  API REST + Lógica de Negócio                   │
│  - Controllers                                  │
│  - Services (EventBus, EventService)            │
│  - Middleware (Auth, RateLimit, Logging)        │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│          DATABASE (SQLite)                      │
│  Armazenamento Local                            │
│  - events                                       │
│  - deliveries                                   │
│  - settings                                     │
│  - sync_queue                                   │
└─────────────────────────────────────────────────┘
```

## Estrutura de Diretórios

```
smart-doorbell/
├── frontend/              # PWA React + Vite
│   ├── src/
│   │   ├── pages/        # StandbyPage, HomePage, DeliveryPage, DeliveryCodePage
│   │   ├── components/   # Button, Toast, Loading
│   │   ├── services/     # apiService
│   │   ├── hooks/        # useInactivityTimer, usePreventNavigation
│   │   └── styles/       # global.css
│   └── dist/             # Build output
│
├── backend/              # API Node.js + TypeScript
│   ├── src/
│   │   ├── controllers/  # EventController, DeliveryController, SettingsController
│   │   ├── services/     # EventBus, EventService
│   │   ├── database/     # Database, migrations, repositories
│   │   ├── routes/       # events, deliveries, settings
│   │   ├── middleware/   # auth, rateLimiter, errorHandler, requestLogger
│   │   └── utils/        # logger, filesystem
│   └── dist/             # Build output
│
├── shared/               # Types compartilhados
│   ├── types/           # event, delivery, api, settings
│   └── constants/       # delivery companies, button options
│
├── scripts/termux/      # Scripts de instalação e execução
├── docs/                # Documentação
└── data/                # Banco de dados e storage (runtime)
```

## Fluxo de Dados

### 1. Standby → Detecção → Home

```
StandbyPage
    ↓ (simulação de detecção após 3s)
HomePage (ativa automaticamente)
```

### 2. Fluxo de Entrega Completo

```
HomePage
    ↓ (botão "ENTREGA")
DeliveryPage (escolha empresa)
    ↓ (seleciona "Mercado Livre")
DeliveryCodePage (digita código)
    ↓ (confirma)
API POST /api/deliveries
    ↓
Backend cria evento + delivery
    ↓
SQLite armazena
    ↓
EventBus emite evento
    ↓
Retorna StandbyPage
```

## Camadas do Backend

### Controllers
Recebem requests HTTP, validam dados, chamam services, retornam responses.

### Services
Lógica de negócio, coordenam repositories, emitem eventos.

### Repositories
Acesso direto ao banco de dados, queries SQL.

### EventBus
Sistema pub/sub interno para desacoplamento. Qualquer parte do sistema pode emitir/escutar eventos.

## Database Schema

### events
```sql
id INTEGER PRIMARY KEY
type TEXT (person_detected, delivery_selected, etc)
status TEXT (pending, completed, failed)
metadata TEXT (JSON)
created_at DATETIME
ended_at DATETIME
```

### deliveries
```sql
id INTEGER PRIMARY KEY
event_id INTEGER (FK → events.id)
company TEXT
tracking_code TEXT
notes TEXT
created_at DATETIME
```

### settings
```sql
key TEXT PRIMARY KEY
value TEXT
updated_at DATETIME
```

### sync_queue
```sql
id INTEGER PRIMARY KEY
entity_type TEXT (event, delivery, recording)
entity_id INTEGER
status TEXT (pending, synced, failed)
attempts INTEGER
created_at DATETIME
```

## Autenticação (MVP)

- **Frontend público**: Não requer autenticação (interface kiosk)
- **Settings API**: Requer header `Authorization: Bearer <token>`
- Token configurado em `.env` (API_TOKEN)
- **Fase 4**: Migração para JWT

## Segurança

### Implementado (Fase 1)
- ✅ Rate limiting (100 req/15min por IP)
- ✅ Helmet (security headers)
- ✅ CORS configurado
- ✅ Input validation
- ✅ Logging de todas requisições
- ✅ Error handling centralizado

### Futuro (Fases 2-5)
- JWT authentication
- HTTPS (Let's Encrypt)
- Chaves de API criptografadas (AES-256)
- 2FA para painel admin
- Audit logs completos

## Performance

### Otimizações Atuais
- SQLite com WAL mode (Write-Ahead Logging)
- Índices em colunas frequentemente consultadas
- Paginação em todas listagens
- Frontend com code splitting (Vite)
- PWA com service worker para cache

### Futuras
- Compressão de vídeos
- Lazy loading de imagens
- WebP para thumbnails
- Database connection pooling (se migrar para PostgreSQL)

## Escalabilidade

O sistema foi projetado para evoluir:

1. **Fase 1 (MVP)**: Tudo local no Android
2. **Fase 4**: Acesso remoto via internet
3. **Fase 5**: IA em VPS externa (Ollama)
4. **Fase 6**: Sync com PC
5. **Fase 7**: Migração opcional para PostgreSQL + VPS
6. **Fase 9**: Múltiplos dispositivos

## Monitoramento

### Logs
- `logs/combined.log` - Todos os logs
- `logs/error.log` - Apenas erros
- Console em desenvolvimento

### Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-22T10:30:00.000Z",
  "uptime": 12345
}
```

## Evolução Futura

### Fase 2: Câmera Real
```
CameraService → DetectionService → RecordingService
        ↓
  EventBus emite PERSON_DETECTED
        ↓
  Grava vídeo automaticamente
```

### Fase 5: Reconhecimento Facial
```
Frame → FaceRecognitionService.detectFaces()
     → extractEmbedding()
     → compareFaces(known_embeddings)
     → PersonRecognitionService.identify()
     → KNOWN_PERSON vs UNKNOWN_PERSON
```

### Fase 8: Automação
```
KNOWN_PERSON + allowed_time + access_rules
        ↓
  AccessControlService.evaluate()
        ↓
  Unlock door (GPIO/Relay)
```

---

**Versão**: 1.0 (Fase 1 - MVP)  
**Data**: 2026-08-22
