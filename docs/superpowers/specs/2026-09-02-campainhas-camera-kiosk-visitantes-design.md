# Design: Campainhas nomeadas, câmera ao vivo, modo kiosk "vírus" e aba de visitantes

**Data:** 2026-09-02
**Status:** Aprovado para planejamento

## Objetivo

Adicionar quatro capacidades ao sistema da Campainha Digital, sobre uma base
comum de cadastro de campainhas:

- **A.** Ver a câmera da campainha ao vivo, sob demanda (em `/notificações` e no
  painel admin), mesmo sem ninguém tocando.
- **B.** Cada campainha tem um nome próprio, definido no painel admin.
- **C.** O app Android roda em modo kiosk "vírus": reabre sozinho ao ser
  fechado e só pode ser encerrado quando o painel admin o "desbloqueia"
  (desbloqueio temporário, retrava sozinho). PIN local continua como backup.
- **D.** Aba de visitantes com duas visões: "Pessoas" (agrupado por rosto, nome
  editável, histórico de visitas) e "Linha do tempo" (feed cronológico de
  visitas com foto e hora).

## Contexto do código atual

- **Backend** Node + Express + TypeScript, banco `sql.js` (SQLite em memória
  persistido em arquivo). Migrations em `backend/src/database/migrations.ts`.
  Repositórios em `backend/src/database/repositories/`.
- **Sinalização de chamadas** (`backend/src/services/CallSignalingService.ts`):
  relay burro por `deviceId` via WebSocket em `/ws/calls`. O kiosk usa
  `deviceId = "kiosk"` fixo; dispositivos de morador geram um id aleatório.
  Repassa qualquer `{to, ...}` para o socket do destino — **não precisa mudar**
  para novos tipos de mensagem.
- **Câmera ao vivo hoje** (`LiveController.ts`): NÃO é WebRTC. O kiosk faz
  `POST /api/live/frame` com um JPEG base64 a cada ~1,5s **somente durante um
  evento** (entrega ou visitante conhecido). `/notificações` faz poll de
  `GET /api/live/status`. Não há "espiar" sob demanda.
- **WebRTC real** já existe para chamadas: `RealCallPage.tsx` (lado kiosk,
  conecta à sinalização como `'kiosk'` só durante a chamada),
  `NotificationsPage.tsx` (lado morador), `frontend/src/utils/callSignaling.ts`,
  `frontend/src/utils/webrtcConfig.ts` (`ICE_SERVERS`).
- **Kiosk Android** (`android-app/app/src/main/java/com/campainha/kiosk/`):
  `MainActivity.kt` — WebView em tela cheia, `onBackPressed` no-op, saída por
  5 toques no canto → PIN → menu (`Recarregar / Trocar URL / Trocar PIN / Sair`).
  `BootReceiver.kt` relança no boot. Sem Lock Task, sem watchdog, sem
  desbloqueio remoto.
- **Visitantes hoje:** tabela `visitors` (migration 006) com
  `name, descriptor, photo_path, notes, visit_count, created_at, last_seen_at`
  — reconhecimento de rostos recorrentes. `VisitorFaceController` /
  `VisitorRepository`. A aba admin `AdminVisitorsTab.tsx` **não** usa essa
  tabela: só lista eventos `PERSON_DETECTED` com `recognized === false` e mostra
  o vídeo. Não dá nome, não mostra histórico com horários.
- **Admin** (`frontend/src/pages/AdminResidentsPage.tsx`): abas
  `residents / messages / visitors / deliveries / recordings / settings`,
  sidebar no desktop.

## Princípios

- Reaproveitar o máximo do que existe: `CallSignalingClient`, `ICE_SERVERS`, o
  relay burro de sinalização, o padrão controller/route/repository.
- `sql.js`: toda migration nova segue o padrão do arquivo (split por `;`,
  `Database.getInstance().save()` ao final). `ALTER TABLE ADD COLUMN` é suportado.
- Multi-campainha: modelar banco/API para várias desde já; UI começa cobrindo
  uma, mas já permite cadastrar/renomear várias.
- YAGNI: sem áudio no live-view; sem provisionamento MDM completo; sem
  reescrever o fluxo de chamadas.

---

## Base comum: cadastro de campainhas

### Migration `009_create_doorbells_table`

```sql
CREATE TABLE IF NOT EXISTS doorbells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  device_key TEXT NOT NULL UNIQUE,
  lock_enabled INTEGER NOT NULL DEFAULT 1,
  unlock_until DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO doorbells (id, name, device_key) VALUES (1, 'Campainha', 'kiosk-1');
```

O `INSERT` de semente roda junto da migration (linha própria no array de
statements). `device_key` é o identificador estável usado pelo kiosk na
sinalização.

### Backend

- `backend/src/database/repositories/DoorbellRepository.ts`:
  `findAll()`, `findById(id)`, `findByDeviceKey(key)`, `create({name})` (gera
  `device_key = "kiosk-" + id` após inserir), `rename(id, name)`,
  `delete(id)` (proíbe apagar a última; proíbe apagar `id=1`),
  `setLockEnabled(id, enabled)`, `setUnlockUntil(id, isoOrNull)`.
- `backend/src/controllers/DoorbellController.ts`:
  `list`, `create`, `rename` (`PATCH /:id`), `remove` (`DELETE /:id`).
  Escrita exige o middleware `auth` (Bearer token), como `SettingsController`.
- `backend/src/routes/doorbells.ts` + registrar em `routes/index.ts` como
  `/api/doorbells`.
- `shared/types/` — novo `doorbell.ts` com a interface `Doorbell`.

### Kiosk (frontend)

- `frontend/src/utils/callSignaling.ts`: `getOrCreateDeviceId('kiosk')` passa a
  retornar `"kiosk:" + doorbellId` (lido de `localStorage['campainha_doorbell_id']`,
  padrão `1`). Residente continua id aleatório.
- Novo helper `frontend/src/utils/doorbell.ts`: `getDoorbellId()`,
  `setDoorbellId(n)`, `fetchDoorbellName()` (GET `/api/doorbells`, acha o próprio).
- `StandbyPage` e `NotificationsPage`: mostram/repassam o nome da campainha nos
  rótulos e banners (`describeEvent` prefixa `"<nome>: "`).

### Kiosk (Android)

- `MainActivity` — menu admin (5 toques → PIN) ganha item **"ID da campainha"**
  que grava `doorbell_id` nas `SharedPreferences` e injeta em
  `localStorage['campainha_doorbell_id']` antes de recarregar a WebView
  (via `evaluateJavascript` no `onPageStarted`, ou parâmetro `?doorbell=` na URL).
  Abordagem escolhida: parâmetro de query `?doorbell=<id>` acrescentado a
  `currentUrl()`; o frontend lê e persiste no localStorage no bootstrap.

### Admin

- Nova aba **"Campainhas"** (ícone 📟) em `AdminResidentsPage.tsx` (novo `Tab`
  `'doorbells'`, entrada em `TABS`, componente
  `frontend/src/pages/admin/AdminDoorbellsTab.tsx`).
- Lista campainhas: nome (edição inline → `PATCH /api/doorbells/:id`), `device_key`,
  botão "Adicionar campainha", excluir (com confirmação; a última fica
  desabilitada). Os controles de kiosk (Feature C) vivem nesta mesma aba, um
  bloco por campainha.

### Efeito nas features

- **A** endereça o kiosk por `"kiosk:" + doorbellId`.
- **B** é essencialmente esta base + exibição do nome.
- **C** guarda `lock_enabled` / `unlock_until` por campainha.
- **D** carimba `doorbell_id` em cada visita.

---

## Feature A — Câmera ao vivo sob demanda (WebRTC)

### Fluxo

1. Kiosk, em standby, mantém um `CallSignalingClient('kiosk', <nome>)`
   **persistente** (novo — hoje só conecta durante chamada). Vive num
   componente/hook montado no shell do app enquanto a rota é a standby.
2. Visualizador (aba admin "Câmera" ou `/notificações`) clica "Ver câmera ao
   vivo" → envia `{ type: 'watch-request', to: 'kiosk:<id>', watchId }`.
3. Kiosk recebe:
   - Se houver chamada real em andamento → responde
     `{ type: 'watch-busy', to: <from>, watchId }`. Visualizador mostra
     "Campainha ocupada em uma chamada".
   - Senão → `getUserMedia({ video: true, audio: false })` da câmera da porta,
     cria `RTCPeerConnection(ICE_SERVERS)`, adiciona a track de vídeo, cria
     offer, envia `{ type: 'watch-offer', to: <from>, watchId, sdp }`.
4. Visualizador: `setRemoteDescription`, cria answer,
   `{ type: 'watch-answer', ... }`. Trocam `{ type: 'watch-ice', candidate }`.
   `<video autoPlay playsInline muted>` recebe a track.
5. Encerrar: visualizador envia `{ type: 'watch-end', watchId }`; kiosk para as
   tracks, fecha a `RTCPeerConnection`, **desliga a câmera** se nenhum outro
   recurso a estiver usando. Timeout de segurança: kiosk encerra sozinho após
   3 min sem `watch-ping` (visualizador manda ping a cada 20s).

### Implementação

- **Novo** `frontend/src/hooks/useKioskLiveHost.ts` — usado pela `StandbyPage`
  (ou pelo shell). Mantém o `CallSignalingClient('kiosk')` aberto, trata
  `watch-request/-ice/-end/-ping`, gerencia uma `RTCPeerConnection` de
  observação separada da de chamada. Reusa `ICE_SERVERS`.
- **Novo** `frontend/src/hooks/useLiveViewer.ts` — lado visualizador: expõe
  `start()`, `stop()`, `state` (`idle | requesting | busy | connecting |
  live | error`), `videoRef`.
- **Novo** `frontend/src/pages/admin/AdminCameraTab.tsx` — aba "Câmera" (📷):
  seletor de campainha (uma por ora), botão liga/desliga, `<video>`, estado.
  Registrar `Tab` `'camera'` em `AdminResidentsPage.tsx`.
- **`NotificationsPage.tsx`** — botão "📷 Ver câmera ao vivo" acima do
  histórico, usando `useLiveViewer`. Não interfere no fluxo de chamada
  existente (usa `watchId` e mensagens próprias).
- **Backend:** nenhuma mudança em `CallSignalingService.ts` (o relay já
  repassa `{to,...}`). `LiveController`/`/api/live` (frames JPEG) permanece
  intacto para o feed durante eventos.
- **Conflito chamada × observação:** o host do kiosk mantém uma flag
  `callActive`; `RealCallPage` e `useKioskLiveHost` compartilham esse estado
  via um pequeno módulo `frontend/src/utils/kioskBusy.ts` (get/set + listener).
  Ao iniciar uma chamada, qualquer observação ativa recebe `watch-end`.

### Erros

- Sem permissão de câmera / `getUserMedia` falha → kiosk envia
  `{ type: 'watch-error', reason }`; visualizador mostra mensagem.
- Kiosk offline (sem socket) → relay não entrega; visualizador dá timeout em
  10s → "Campainha não está respondendo".

---

## Feature B — Nome próprio por campainha

Coberto pela Base comum. Detalhes de exibição:

- `describeEvent` em `NotificationsPage.tsx` prefixa o nome da campainha de
  origem quando o evento tiver `metadata.doorbellId` (novo campo opcional,
  gravado pelo kiosk ao criar eventos). Sem `doorbellId` → sem prefixo
  (retrocompatível).
- Rótulo do `CallSignalingClient('kiosk')` passa a ser o nome da campainha
  (hoje fixo `'Campainha'`), então `callerLabel` em chamadas e o rótulo do
  live-view já saem nomeados.
- Kiosk grava `metadata.doorbellId` em: eventos de entrega, recado, visitante
  não identificado, residente identificado (pontos onde hoje chama
  `apiService.createEvent` / endpoints correlatos). Fonte: `getDoorbellId()`.

---

## Feature C — Modo kiosk "vírus" + desbloqueio temporário

### Modelo de estado (backend)

Colunas em `doorbells` (migration 009): `lock_enabled`, `unlock_until`.

- **`lock_enabled = 0`** → modo kiosk totalmente desligado. O app se comporta
  como app comum: back funciona, dá pra sair, sem watchdog. É o "não quero mais
  o app reabrindo".
- **`lock_enabled = 1` e (`unlock_until` nulo ou já passou)** → **travado**.
- **`lock_enabled = 1` e `unlock_until` no futuro** → **destravado
  temporariamente** até aquele instante; depois retrava sozinho.

`locked = lock_enabled === 1 && (unlock_until == null || now >= unlock_until)`.

### Rotas — `KioskController` + `backend/src/routes/kiosk.ts` (`/api/kiosk`)

| Método | Rota | Auth | Efeito |
|---|---|---|---|
| `GET` | `/:doorbellId/lock` | não | `{ locked, unlockUntil, lockEnabled }` |
| `POST` | `/:doorbellId/unlock` | admin | body `{ minutes?: number = 15 }` → `unlock_until = now + minutes` |
| `POST` | `/:doorbellId/lock` | admin | `unlock_until = null` (retrava já) |
| `PATCH` | `/:doorbellId/lock-enabled` | admin | body `{ enabled: boolean }` |

Ao mudar qualquer um desses, o backend também empurra
`{ type: 'kiosk-lock', locked, unlockUntil, lockEnabled }` para o socket
`kiosk:<doorbellId>` (nova função exportada em `CallSignalingService.ts`,
tipo `sendToDevice(deviceId, payload)`), para efeito instantâneo sem esperar o
poll.

### Android — `MainActivity.kt` e novos arquivos

Duas camadas, com detecção automática:

**Camada 1 — Lock Task (se for device owner):**
- `DevicePolicyManager` — se `dpm.isDeviceOwnerApp(packageName)`:
  `dpm.setLockTaskPackages(admin, arrayOf(packageName))` e
  `startLockTask()` quando `locked`; `stopLockTask()` quando destravado.
- Device owner é configurado **uma vez** por
  `adb shell dpm set-device-owner com.campainha.kiosk/.DeviceAdminReceiver`
  (sem root; exige nenhuma conta Google no aparelho). Novo
  `DeviceAdminReceiver.kt` + `res/xml/device_admin.xml` + declaração no manifest.
- Documentar o passo no `README` / `docs/ANDROID_CONFIG.md`.

**Camada 2 — Fallback agressivo (sempre ativa quando `locked`, redundante com a 1):**
- `KioskWatchdogService.kt` — `startForeground` com notificação fixa
  ("Campainha ativa"). A `MainActivity` informa o serviço em `onStart`/`onStop`
  se está em foreground. Em `onStop` com `locked == true`, o serviço agenda
  (`Handler.postDelayed`, ~700ms) um `Intent` para reabrir `MainActivity`
  (`FLAG_ACTIVITY_REORDER_TO_FRONT or FLAG_ACTIVITY_SINGLE_TOP`).
- `MainActivity`: `launchMode="singleInstance"`; `onUserLeaveHint()` reabre-se
  quando `locked`; `onBackPressed` continua no-op quando `locked`, e passa a
  chamar `super` quando destravado.
- `AndroidManifest.xml`: permissão `FOREGROUND_SERVICE` (+
  `FOREGROUND_SERVICE_SPECIAL_USE` ou `_MEDIA_PLAYBACK` conforme target);
  declarar `KioskWatchdogService` e `DeviceAdminReceiver`.
- `BootReceiver.kt`: além de abrir a activity, inicia o `KioskWatchdogService`
  se `locked`.

**Origem do estado no Android:**
- `KioskLockClient.kt` — faz `GET http://<host>/api/kiosk/<id>/lock` a cada 10s
  (OkHttp ou `HttpURLConnection`), e também escuta a WS `/ws/calls?deviceId=kiosk:<id>&role=kiosk`
  para a mensagem `kiosk-lock` (push instantâneo). Guarda o último
  `locked/unlockUntil` em `SharedPreferences` para funcionar offline (usa o
  último conhecido; se `unlock_until` passou, retrava).
- Quando o estado vira **destravado**: `stopLockTask()`, `stopService(watchdog)`,
  para de consumir back, permite `finishAffinity()` pelo menu.
- Quando vira **travado** de novo: reativa tudo.

**PIN local (mantido, backup offline):**
- O menu admin (5 toques → PIN) ganha o item **"Desbloquear 15 min"**: grava
  `local_unlock_until = now + 15min` nas prefs. O cálculo de `locked` no
  Android passa a ser
  `serverLocked && now >= max(server unlock_until, local_unlock_until)`.
  Assim, mesmo sem backend, dá pra sair.
- Item existente "Sair do app" só aparece/funciona quando `locked == false`.

### Admin — bloco de kiosk na aba "Campainhas"

Por campainha:
- Toggle **"Modo kiosk (reabre sozinho)"** → `PATCH /:id/lock-enabled`.
- Estado atual: 🔒 Travado / 🔓 Destravado (faltam `mm:ss`) / ⚪ Desligado.
- Botão **"Desbloquear por [15 ▾] min"** (select 5/15/30/60) →
  `POST /:id/unlock`.
- Botão **"Retravar agora"** → `POST /:id/lock`.
- Contagem regressiva renderizada no cliente a partir de `unlockUntil`.

---

## Feature D — Aba Visitantes (Pessoas + Linha do tempo)

### Migration `010_create_visits_table`

```sql
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER,
  descriptor TEXT,
  photo_path TEXT,
  event_id INTEGER,
  doorbell_id INTEGER,
  name_snapshot TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
```

Uma linha por detecção de pessoa (reconhecida ou não). `descriptor` guardado
mesmo quando não há `visitor_id`, para permitir "batizar" depois criando um
`visitors` a partir dele. `name_snapshot` = nome no momento da visita.

### Captura de foto do rosto

Hoje o caminho "visitante não identificado" só grava `videoFile`. Passa a
enviar também 1 still (`photoFile`), reusando `frontend/src/utils/imageCapture.ts`
(já usado em entregas). O still vira `photo_path` da visita.

### Gravação da visita (backend)

- `VisitsRepository.ts`: `create(dto)`, `listTimeline(page, pageSize, doorbellId?)`,
  `listByVisitor(visitorId)`, `attachVisitor(visitId, visitorId, name)`.
- Hooks:
  - `VisitorFaceController.recognize` (rosto recorrente reconhecido) → após
    `markSeen`, insere `visits` com `visitor_id`, `descriptor`, `name_snapshot`,
    `doorbell_id` (do body), `photo_path`.
  - Caminho de visitante não identificado (onde hoje se cria o evento
    `PERSON_DETECTED recognized:false`) → insere `visits` sem `visitor_id`,
    com `descriptor` (se disponível) e `photo_path`, `event_id`.
- `VisitorRepository`: novo `rename(id, name)`.

### Rotas

| Método | Rota | Efeito |
|---|---|---|
| `GET` | `/api/visitors` | lista `visitors` (já pode existir; garantir) |
| `PATCH` | `/api/visitors/:id` | `{ name }` → renomeia |
| `GET` | `/api/visitors/:id/visits` | visitas daquela pessoa |
| `GET` | `/api/visits?page=&doorbellId=` | linha do tempo paginada |
| `POST` | `/api/visits/:id/name` | `{ name }` → cria/vincula `visitor` pelo `descriptor` da visita e propaga `name_snapshot` das visitas sem nome com o mesmo `visitor_id` |

### Admin — `AdminVisitorsTab.tsx` reescrita

Toggle no topo: **Pessoas** | **Linha do tempo**.

**Pessoas** (`GET /api/visitors`):
- Grid de cards: foto (`STORAGE_BASE_URL + photo_path`), nome editável inline
  (`PATCH /api/visitors/:id`), `visit_count`, `last_seen_at` formatado.
- Recorrente sem nome real → rótulo "Desconhecido #id" + campo pra nomear.
- Expandir card → `GET /api/visitors/:id/visits`: lista de visitas (foto
  miniatura + data/hora + nome da campainha).
- Excluir visitante (já existe `DELETE`), com confirmação.

**Linha do tempo** (`GET /api/visits?page=`):
- Feed cronológico desc.: miniatura + data/hora + campainha + nome ou
  "Desconhecido" com campo inline "batizar" → `POST /api/visits/:id/name`.
- Botão "carregar mais" (paginação).

`NotificationsPage`: mantém o card de "Visitante não identificado" como está
(sem ação de batizar — YAGNI; a aba admin cobre isso).

---

## Componentização / isolamento

| Unidade | O que faz | Depende de |
|---|---|---|
| `DoorbellRepository` | CRUD de campainhas + estado de lock | `Database` |
| `DoorbellController` / `routes/doorbells` | HTTP de campainhas | `DoorbellRepository`, `auth` |
| `KioskController` / `routes/kiosk` | estado de lock + push WS | `DoorbellRepository`, `CallSignalingService.sendToDevice` |
| `CallSignalingService.sendToDevice` | envia payload a um `deviceId` | `ws` |
| `useKioskLiveHost` (hook) | kiosk atende `watch-*` e transmite vídeo | `CallSignalingClient`, `ICE_SERVERS`, `kioskBusy` |
| `useLiveViewer` (hook) | visualizador pede/recebe stream | `CallSignalingClient`, `ICE_SERVERS` |
| `AdminCameraTab` / `AdminDoorbellsTab` | UI | hooks + `apiService` |
| `KioskLockClient.kt` | fonte de verdade do lock no Android | HTTP + WS |
| `KioskWatchdogService.kt` | relançamento agressivo | `MainActivity` lifecycle |
| `VisitsRepository` | CRUD/consulta de visitas | `Database` |
| `AdminVisitorsTab` (v2) | UI Pessoas + Linha do tempo | `apiService` |

Cada hook/serviço tem interface pública pequena e testável isoladamente.

## Testes

- **Backend (unit/integ):**
  - `DoorbellRepository`: seed, criar (gera `device_key`), renomear, não apagar
    `id=1`, não apagar a última.
  - Lógica de `locked`: matriz `lock_enabled` × `unlock_until` (nulo / passado /
    futuro).
  - `KioskController`: `unlock` grava `now + minutes`; `lock` limpa;
    `lock-enabled` alterna; cada um dispara `sendToDevice`.
  - `VisitsRepository`: timeline paginada ordenada desc.; `listByVisitor`;
    `attachVisitor` propaga nome; `POST /api/visits/:id/name` cria visitante a
    partir do `descriptor`.
- **Frontend:**
  - `useLiveViewer`: máquina de estados (`idle→requesting→busy`,
    `→connecting→live`, timeout→`error`) com `CallSignalingClient` e
    `RTCPeerConnection` mockados.
  - `describeEvent` prefixa nome da campainha quando `metadata.doorbellId`.
  - `AdminDoorbellsTab`: renomear chama `PATCH`; contagem regressiva de unlock.
  - `AdminVisitorsTab` v2: alterna modos; batizar chama endpoint certo.
- **Android:** teste instrumentado leve do cálculo de `locked` em
  `KioskLockClient` (server vs local unlock); verificação manual documentada
  para Lock Task e watchdog (difícil automatizar sem device owner em CI).

## Fora de escopo

- Provisionamento MDM/QR completo (apenas o comando `adb` documentado).
- Bloquear o botão Home sem device owner (limitação aceita).
- Áudio no live-view.
- Vários kiosks conectados simultaneamente com UI dedicada por dispositivo
  (banco/API já suportam; UI evolui depois).
- Migração de `sql.js` para outro banco.

## Ordem de implementação (fases de um plano único)

1. **Base + Feature B** — migration 009, `DoorbellRepository/Controller/routes`,
   `shared/types/doorbell`, aba admin "Campainhas" (só nome), kiosk lê
   `?doorbell=`, `deviceId = "kiosk:<id>"`, exibição do nome nos banners.
2. **Feature A** — hooks `useKioskLiveHost` / `useLiveViewer` / `kioskBusy`,
   `sendToDevice` no signaling, aba "Câmera", botão em `/notificações`.
3. **Feature C** — colunas de lock (já na migration 009), `KioskController` +
   rotas + push WS, `KioskLockClient` / `KioskWatchdogService` /
   `DeviceAdminReceiver` no Android, item de PIN "Desbloquear 15 min", bloco de
   kiosk na aba "Campainhas".
4. **Feature D** — migration 010, `VisitsRepository` + rotas, hooks de gravação
   de visita nos caminhos de reconhecimento, still de foto do não identificado,
   `AdminVisitorsTab` v2.
