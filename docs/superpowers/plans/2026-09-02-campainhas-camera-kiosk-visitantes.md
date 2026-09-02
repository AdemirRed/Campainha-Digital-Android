# Campainhas nomeadas, câmera ao vivo, modo kiosk e aba de visitantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cadastro de campainhas com nome próprio, visualização da câmera ao vivo sob demanda (WebRTC), modo kiosk "vírus" com desbloqueio temporário remoto, e uma aba de visitantes com visão por pessoa e linha do tempo.

**Architecture:** Backend Node/Express + `sql.js` ganha uma tabela `doorbells` (nome + estado de lock) e uma `visits`, com repositórios/controllers no padrão existente. A câmera ao vivo reaproveita a sinalização WebSocket de chamadas (`/ws/calls`, relay burro) com novos tipos de mensagem `watch-*`; o kiosk mantém uma conexão de sinalização persistente em standby. O app Android lê o estado de lock do backend (poll + push WS) e aplica Lock Task (se device owner) e/ou um watchdog de relançamento.

**Tech Stack:** TypeScript, Express, sql.js, React 18 + react-router, WebRTC, WebSocket (`ws`), Kotlin/Android (WebView kiosk), Vitest (novo, para lógica pura e repositórios).

## Global Constraints

- Node `>=18`, npm `>=9` (workspaces: `frontend`, `backend`, `shared`).
- Backend: sql.js sem `ON CONFLICT`; toda escrita chama `Database.getInstance().save()`; ler `last_insert_rowid()` **antes** de `save()`. Migrations em `backend/src/database/migrations.ts` seguem o array `migrations` (split por `;`, um `INSERT`/`CREATE` por statement).
- Rotas de escrita administrativas usam o middleware `auth` (header `Authorization: Bearer <API_TOKEN>`), como `routes/settings.ts`.
- Respostas da API sempre no formato `{ success: boolean, data?, error?, message? } as ApiResponse`.
- Frontend fala com a API por `apiService` (`frontend/src/services/apiService.ts`); base `import.meta.env.VITE_API_URL || 'http://localhost:3000/api'`; mídia servida de `STORAGE_BASE_URL`.
- Sinalização: `CallSignalingClient` (`frontend/src/utils/callSignaling.ts`); `ICE_SERVERS` de `frontend/src/utils/webrtcConfig.ts`; o servidor `CallSignalingService.ts` repassa qualquer `{ to, ... }` sem inspecionar — novos tipos de mensagem **não exigem** mudança no servidor, exceto o novo `sendToDevice` do push de lock.
- Android: `minSdk = 24`, `targetSdk = 34`, `compileSdk = 34`, Kotlin/JVM 17. Sem root. Device owner é opcional (`adb shell dpm set-device-owner ...`).
- Idioma de toda a UI e mensagens: português do Brasil.
- Commits pequenos e frequentes, um por task no mínimo.
- `npm run type-check` (na raiz) deve passar ao fim de cada task que toca `.ts`/`.tsx`.

---

## File Structure

**Backend (novos):**
- `backend/vitest.config.ts` — config de teste.
- `backend/test/helpers/testDb.ts` — cria/reseta um banco sql.js temporário isolado.
- `backend/src/database/repositories/DoorbellRepository.ts` — CRUD de campainhas + estado de lock.
- `backend/src/database/repositories/VisitsRepository.ts` — CRUD/consulta de visitas.
- `backend/src/domain/kioskLock.ts` — função pura `computeLocked()`.
- `backend/src/controllers/DoorbellController.ts`, `backend/src/controllers/KioskController.ts`.
- `backend/src/routes/doorbells.ts`, `backend/src/routes/kiosk.ts`, `backend/src/routes/visits.ts`.
- `backend/test/*.test.ts` — testes de repositório/domínio.

**Backend (modificados):**
- `backend/src/database/migrations.ts` — migrations `009_create_doorbells_table`, `010_create_visits_table`.
- `backend/src/routes/index.ts` — registrar `/api/doorbells`, `/api/kiosk`, `/api/visits`, e as novas rotas em `/api/visitors`.
- `backend/src/routes/visitors.ts` — `GET /`, `PATCH /:id`, `GET /:id/visits`.
- `backend/src/controllers/VisitorController.ts` — aceitar `photoBase64`, gravar visita; novo método `list`/`rename`/`listVisits`.
- `backend/src/controllers/VisitorFaceController.ts` — gravar visita ao reconhecer.
- `backend/src/services/CallSignalingService.ts` — exportar `sendToDevice(deviceId, payload)`.
- `backend/src/controllers/EventController.ts`, `MessageController.ts`, `DeliveryController.ts` — persistir `doorbellId` no `metadata` do evento quando presente no body.
- `backend/package.json` — devDep `vitest`, script `test`.

**Shared (novos):**
- `shared/types/doorbell.ts` — `Doorbell`, `KioskLockState`.
- `shared/types/visit.ts` — `Visit`, `VisitorSummary`.

**Frontend (novos):**
- `frontend/src/utils/doorbell.ts` — `getDoorbellId`, `setDoorbellId`, `fetchDoorbells`, `bootstrapDoorbellFromUrl`.
- `frontend/src/utils/kioskBusy.ts` — flag compartilhada chamada-vs-observação.
- `frontend/src/hooks/useKioskLiveHost.ts` — lado kiosk do live-view.
- `frontend/src/hooks/useLiveViewer.ts` — lado visualizador + `liveViewerReducer` pura.
- `frontend/src/pages/admin/AdminDoorbellsTab.tsx` — aba "Campainhas" (nome + bloco de kiosk).
- `frontend/src/pages/admin/AdminCameraTab.tsx` — aba "Câmera".
- `frontend/vitest.config.ts`, `frontend/test/*.test.ts`.

**Frontend (modificados):**
- `frontend/src/utils/callSignaling.ts` — `getOrCreateDeviceId('kiosk')` → `"kiosk:" + doorbellId`.
- `frontend/src/main.tsx` — chamar `bootstrapDoorbellFromUrl()` antes do render.
- `frontend/src/services/apiService.ts` — injetar `doorbellId` nas mutações do kiosk; métodos novos (`getDoorbells`, `createDoorbell`, `renameDoorbell`, `deleteDoorbell`, `getKioskLock`, `unlockKiosk`, `lockKiosk`, `setKioskLockEnabled`, `getVisitors`, `renameVisitor`, `getVisits`, `getVisitorVisits`, `nameVisit`, `startLiveWatch` helpers via signaling).
- `frontend/src/pages/AdminResidentsPage.tsx` — abas `doorbells` e `camera`.
- `frontend/src/pages/StandbyPage.tsx` — montar `useKioskLiveHost`.
- `frontend/src/pages/NotificationsPage.tsx` — prefixo do nome da campainha em `describeEvent`; botão "Ver câmera ao vivo".
- `frontend/src/pages/admin/AdminVisitorsTab.tsx` — reescrita (Pessoas + Linha do tempo).

**Android (novos):**
- `android-app/app/src/main/java/com/campainha/kiosk/KioskLockClient.kt`
- `android-app/app/src/main/java/com/campainha/kiosk/KioskWatchdogService.kt`
- `android-app/app/src/main/java/com/campainha/kiosk/DeviceAdminReceiver.kt`
- `android-app/app/src/main/res/xml/device_admin.xml`

**Android (modificados):**
- `android-app/app/build.gradle.kts` — dep OkHttp.
- `android-app/app/src/main/AndroidManifest.xml` — `FOREGROUND_SERVICE*`, serviço, receiver de admin.
- `android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt` — estado de lock, watchdog, Lock Task, item de menu "ID da campainha" e "Desbloquear 15 min", `?doorbell=` na URL.
- `android-app/app/src/main/java/com/campainha/kiosk/BootReceiver.kt` — iniciar watchdog se travado.
- `docs/ANDROID_CONFIG.md` / `README.md` — passo do device owner.

---

# PHASE 1 — Base + nome da campainha

## Task 1: Infra de teste do backend (Vitest + banco temporário)

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/test/helpers/testDb.ts`
- Create: `backend/test/helpers/testDb.test.ts`

**Interfaces:**
- Produces:
  - `initTestDb(): Promise<void>` — cria um banco sql.js novo em arquivo temporário único (via `DB_PATH`), reseta o singleton `Database` e roda migrations.
  - `resetTestDb(): Promise<void>` — descarta e recria (chama `initTestDb`).
  - `closeTestDb(): void` — fecha e apaga o arquivo temporário.

- [ ] **Step 1: Adicionar Vitest ao backend**

Editar `backend/package.json`: em `devDependencies` adicionar `"vitest": "^2.1.0"`, e em `scripts` adicionar `"test": "vitest run"`.

Run: `npm install --workspace=backend`
Expected: instala `vitest` sem erros.

- [ ] **Step 2: Config do Vitest**

Create `backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false, // singleton Database + arquivo em disco: sem paralelismo entre arquivos
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

- [ ] **Step 3: Helper de banco temporário**

Create `backend/test/helpers/testDb.ts`:

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Database } from '../../src/database';

let currentPath: string | null = null;

export async function initTestDb(): Promise<void> {
  closeTestDb();
  currentPath = path.join(os.tmpdir(), `doorbell-test-${crypto.randomUUID()}.db`);
  process.env.DB_PATH = currentPath;
  // Zera o singleton: `Database` guarda a instância num campo estático privado.
  (Database as unknown as { instance?: unknown }).instance = undefined;
  await Database.getInstance().initialize();
}

export async function resetTestDb(): Promise<void> {
  await initTestDb();
}

export function closeTestDb(): void {
  try {
    (Database as unknown as { instance?: { close?: () => void } }).instance?.close?.();
  } catch {
    // já fechado
  }
  if (currentPath && fs.existsSync(currentPath)) {
    fs.rmSync(currentPath, { force: true });
  }
  currentPath = null;
  (Database as unknown as { instance?: unknown }).instance = undefined;
}
```

- [ ] **Step 4: Teste que prova o harness**

Create `backend/test/helpers/testDb.test.ts`:

```ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { Database } from '../../src/database';
import { initTestDb, closeTestDb } from './testDb';

describe('test db harness', () => {
  beforeEach(async () => {
    await initTestDb();
  });
  afterAll(() => {
    closeTestDb();
  });

  it('roda migrations e cria a tabela events', () => {
    const db = Database.getInstance().getDb();
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='events'");
    expect(res[0].values[0][0]).toBe('events');
  });
});
```

- [ ] **Step 5: Rodar**

Run: `npm run test --workspace=backend`
Expected: PASS (1 arquivo, 1 teste).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/vitest.config.ts backend/test/ package-lock.json
git commit -m "test: Vitest + harness de banco temporário no backend"
```

---

## Task 2: Migration 009 + DoorbellRepository (nome)

**Files:**
- Modify: `backend/src/database/migrations.ts` (array `migrations`, após `008_...`)
- Create: `backend/src/database/repositories/DoorbellRepository.ts`
- Create: `shared/types/doorbell.ts`
- Create: `backend/test/doorbellRepository.test.ts`

**Interfaces:**
- Consumes: `initTestDb` (Task 1), `Database` singleton.
- Produces:
  - `shared/types/doorbell.ts`:
    ```ts
    export interface Doorbell {
      id: number;
      name: string;
      device_key: string;
      lock_enabled: boolean;
      unlock_until: string | null; // ISO ou null
      created_at: string;
      updated_at: string;
    }
    export interface KioskLockState {
      locked: boolean;
      unlockUntil: string | null;
      lockEnabled: boolean;
    }
    ```
  - `DoorbellRepository` com:
    `findAll(): Doorbell[]`,
    `findById(id: number): Doorbell | null`,
    `findByDeviceKey(key: string): Doorbell | null`,
    `create(name: string): Doorbell` (gera `device_key = "kiosk-" + id`),
    `rename(id: number, name: string): Doorbell | null`,
    `delete(id: number): { ok: boolean; reason?: string }` (bloqueia `id === 1` e "última campainha"),
    `setLockEnabled(id: number, enabled: boolean): void`,
    `setUnlockUntil(id: number, iso: string | null): void`.

- [ ] **Step 1: Escrever os testes (falham)**

Create `backend/test/doorbellRepository.test.ts`:

```ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { DoorbellRepository } from '../src/database/repositories/DoorbellRepository';

describe('DoorbellRepository', () => {
  let repo: DoorbellRepository;
  beforeEach(async () => {
    await initTestDb();
    repo = new DoorbellRepository();
  });
  afterAll(() => closeTestDb());

  it('semeia a campainha 1 "Campainha" com device_key kiosk-1', () => {
    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 1, name: 'Campainha', device_key: 'kiosk-1', lock_enabled: true, unlock_until: null });
  });

  it('cria campainha gerando device_key a partir do id', () => {
    const d = repo.create('Fundos');
    expect(d.name).toBe('Fundos');
    expect(d.device_key).toBe(`kiosk-${d.id}`);
    expect(repo.findByDeviceKey(d.device_key)?.id).toBe(d.id);
  });

  it('renomeia', () => {
    const r = repo.rename(1, 'Portão da frente');
    expect(r?.name).toBe('Portão da frente');
  });

  it('não apaga a campainha 1', () => {
    expect(repo.delete(1)).toEqual({ ok: false, reason: 'default' });
  });

  it('não apaga a última campainha', () => {
    const d = repo.create('Temp');
    expect(repo.delete(d.id)).toEqual({ ok: true });
    // sobra só a 1, que já é protegida; cria e apaga de novo para exercitar "última"
    const d2 = repo.create('Temp2');
    repo.delete(d2.id);
    expect(repo.findAll()).toHaveLength(1);
  });

  it('setLockEnabled e setUnlockUntil persistem', () => {
    repo.setLockEnabled(1, false);
    expect(repo.findById(1)?.lock_enabled).toBe(false);
    repo.setUnlockUntil(1, '2030-01-01T00:00:00.000Z');
    expect(repo.findById(1)?.unlock_until).toBe('2030-01-01T00:00:00.000Z');
    repo.setUnlockUntil(1, null);
    expect(repo.findById(1)?.unlock_until).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npm run test --workspace=backend -- doorbellRepository`
Expected: FAIL (`Cannot find module '.../DoorbellRepository'`).

- [ ] **Step 3: Migration 009**

Em `backend/src/database/migrations.ts`, adicionar ao final do array `migrations` (depois do objeto `008_create_push_subscriptions_table`):

```ts
    ,{
      name: '009_create_doorbells_table',
      sql: `
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
      `
    }
```

(O runner já faz `split(';')` e roda cada statement; o `INSERT` de semente roda uma vez junto da migration.)

- [ ] **Step 4: DoorbellRepository**

Create `backend/src/database/repositories/DoorbellRepository.ts`:

```ts
import { Database } from '../index';
import { Doorbell } from '@shared/types/doorbell';

export class DoorbellRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  findAll(): Doorbell[] {
    const result = this.db.exec('SELECT * FROM doorbells ORDER BY id ASC');
    if (!result || result.length === 0) return [];
    const row = result[0];
    return row.values.map((_: unknown, i: number) => this.map(row, i));
  }

  findById(id: number): Doorbell | null {
    const result = this.db.exec('SELECT * FROM doorbells WHERE id = ?', [id]);
    if (!result || result.length === 0 || result[0].values.length === 0) return null;
    return this.map(result[0], 0);
  }

  findByDeviceKey(key: string): Doorbell | null {
    const result = this.db.exec('SELECT * FROM doorbells WHERE device_key = ?', [key]);
    if (!result || result.length === 0 || result[0].values.length === 0) return null;
    return this.map(result[0], 0);
  }

  create(name: string): Doorbell {
    this.db.run('INSERT INTO doorbells (name, device_key) VALUES (?, ?)', [name, 'pending']);
    const id = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    this.db.run('UPDATE doorbells SET device_key = ? WHERE id = ?', [`kiosk-${id}`, id]);
    Database.getInstance().save();
    return this.findById(id)!;
  }

  rename(id: number, name: string): Doorbell | null {
    this.db.run('UPDATE doorbells SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
    Database.getInstance().save();
    return this.findById(id);
  }

  delete(id: number): { ok: boolean; reason?: string } {
    if (id === 1) return { ok: false, reason: 'default' };
    if (this.findAll().length <= 1) return { ok: false, reason: 'last' };
    this.db.run('DELETE FROM doorbells WHERE id = ?', [id]);
    Database.getInstance().save();
    return { ok: true };
  }

  setLockEnabled(id: number, enabled: boolean): void {
    this.db.run('UPDATE doorbells SET lock_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [enabled ? 1 : 0, id]);
    Database.getInstance().save();
  }

  setUnlockUntil(id: number, iso: string | null): void {
    this.db.run('UPDATE doorbells SET unlock_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [iso, id]);
    Database.getInstance().save();
  }

  private map(result: any, index: number): Doorbell {
    const columns: string[] = result.columns;
    const values = result.values[index];
    const row: any = {};
    columns.forEach((c, i) => (row[c] = values[i]));
    return {
      id: row.id,
      name: row.name,
      device_key: row.device_key,
      lock_enabled: row.lock_enabled === 1,
      unlock_until: row.unlock_until ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
```

- [ ] **Step 5: shared type**

Create `shared/types/doorbell.ts` com o conteúdo do bloco "Produces" acima.

- [ ] **Step 6: Rodar — passa**

Run: `npm run test --workspace=backend -- doorbellRepository`
Expected: PASS (6 testes).

- [ ] **Step 7: type-check + commit**

Run: `npm run type-check`
Expected: sem erros.

```bash
git add backend/src/database/migrations.ts backend/src/database/repositories/DoorbellRepository.ts shared/types/doorbell.ts backend/test/doorbellRepository.test.ts
git commit -m "feat: tabela doorbells + DoorbellRepository"
```

---

## Task 3: DoorbellController + rotas /api/doorbells

**Files:**
- Create: `backend/src/controllers/DoorbellController.ts`
- Create: `backend/src/routes/doorbells.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/test/doorbellRoutes.test.ts`

**Interfaces:**
- Consumes: `DoorbellRepository` (Task 2), `auth` middleware.
- Produces (HTTP):
  - `GET /api/doorbells` → `{ success: true, data: Doorbell[] }` (sem auth — o kiosk precisa ler o próprio nome).
  - `POST /api/doorbells` (auth) body `{ name: string }` → `201 { data: Doorbell }`.
  - `PATCH /api/doorbells/:id` (auth) body `{ name: string }` → `{ data: Doorbell }`.
  - `DELETE /api/doorbells/:id` (auth) → `{ data: null }` ou `400 { error }` (`default`/`last`).

- [ ] **Step 1: Testes (falham)**

Create `backend/test/doorbellRoutes.test.ts`:

```ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import request from 'node:http';
import { initTestDb, closeTestDb } from './helpers/testDb';

// helper mínimo de request usando fetch contra um servidor efêmero
import http from 'http';
import { setupRoutes } from '../src/routes';

let server: http.Server;
let base: string;

async function startServer() {
  process.env.API_TOKEN = 'test-token';
  const app = express();
  app.use(express.json());
  setupRoutes(app);
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      base = `http://127.0.0.1:${port}`;
      r();
    });
  });
}

describe('/api/doorbells', () => {
  beforeEach(async () => {
    await initTestDb();
    if (server) server.close();
    await startServer();
  });
  afterAll(() => {
    server?.close();
    closeTestDb();
  });

  it('GET lista sem auth e traz a campainha semeada', async () => {
    const res = await fetch(`${base}/api/doorbells`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].name).toBe('Campainha');
  });

  it('POST sem auth → 401', async () => {
    const res = await fetch(`${base}/api/doorbells`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST com auth cria; PATCH renomeia; DELETE da 1 falha', async () => {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };
    const created = await (await fetch(`${base}/api/doorbells`, { method: 'POST', headers: h, body: JSON.stringify({ name: 'Fundos' }) })).json();
    expect(created.data.device_key).toBe(`kiosk-${created.data.id}`);

    const renamed = await (await fetch(`${base}/api/doorbells/${created.data.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ name: 'Quintal' }) })).json();
    expect(renamed.data.name).toBe('Quintal');

    const del1 = await fetch(`${base}/api/doorbells/1`, { method: 'DELETE', headers: h });
    expect(del1.status).toBe(400);
  });
});
```

Se `express` não estiver como dep de teste, ele já é dep do backend. Remover o `import request from 'node:http'` não usado ao implementar (é ruído — usar só `http`).

- [ ] **Step 2: Rodar — falha**

Run: `npm run test --workspace=backend -- doorbellRoutes`
Expected: FAIL (rota 404 / controller inexistente).

- [ ] **Step 3: Controller**

Create `backend/src/controllers/DoorbellController.ts`:

```ts
import { Request, Response } from 'express';
import { DoorbellRepository } from '../database/repositories/DoorbellRepository';
import { ApiResponse } from '@shared/types/api';

export class DoorbellController {
  private repo = new DoorbellRepository();

  list = (_req: Request, res: Response): void => {
    res.json({ success: true, data: this.repo.findAll() } as ApiResponse);
  };

  create = (req: Request, res: Response): void => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'name é obrigatório' } as ApiResponse);
      return;
    }
    res.status(201).json({ success: true, data: this.repo.create(name) } as ApiResponse);
  };

  rename = (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'name é obrigatório' } as ApiResponse);
      return;
    }
    const updated = this.repo.rename(id, name);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Campainha não encontrada' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: updated } as ApiResponse);
  };

  remove = (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const result = this.repo.delete(id);
    if (!result.ok) {
      const msg = result.reason === 'default' ? 'A campainha padrão não pode ser removida' : 'Deixe ao menos uma campainha';
      res.status(400).json({ success: false, error: msg } as ApiResponse);
      return;
    }
    res.json({ success: true, data: null } as ApiResponse);
  };
}
```

- [ ] **Step 4: Rotas**

Create `backend/src/routes/doorbells.ts`:

```ts
import { Router } from 'express';
import { DoorbellController } from '../controllers/DoorbellController';
import { auth } from '../middleware/auth';

export function createDoorbellRouter(): Router {
  const router = Router();
  const c = new DoorbellController();
  router.get('/', c.list);
  router.post('/', auth, c.create);
  router.patch('/:id', auth, c.rename);
  router.delete('/:id', auth, c.remove);
  return router;
}
```

Em `backend/src/routes/index.ts`, importar e registrar (junto dos outros `apiRouter.use`):

```ts
import { createDoorbellRouter } from './doorbells';
// ...
apiRouter.use('/doorbells', createDoorbellRouter());
```

- [ ] **Step 5: Rodar — passa**

Run: `npm run test --workspace=backend -- doorbellRoutes`
Expected: PASS (3 testes).

- [ ] **Step 6: type-check + commit**

Run: `npm run type-check`

```bash
git add backend/src/controllers/DoorbellController.ts backend/src/routes/doorbells.ts backend/src/routes/index.ts backend/test/doorbellRoutes.test.ts
git commit -m "feat: rotas REST /api/doorbells"
```

---

## Task 4: Frontend — util de campainha + deviceId + bootstrap por URL

**Files:**
- Create: `frontend/src/utils/doorbell.ts`
- Modify: `frontend/src/utils/callSignaling.ts:8-16`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/services/apiService.ts` (métodos de doorbell + injeção de `doorbellId`)

**Interfaces:**
- Produces:
  - `frontend/src/utils/doorbell.ts`:
    `getDoorbellId(): number` (localStorage `campainha_doorbell_id`, default `1`),
    `setDoorbellId(id: number): void`,
    `bootstrapDoorbellFromUrl(): void` (lê `?doorbell=` da URL e persiste),
    `fetchDoorbells(): Promise<Doorbell[]>`.
  - `apiService`: `getDoorbells()`, `createDoorbell(name)`, `renameDoorbell(id,name)`, `deleteDoorbell(id)`.
  - `getOrCreateDeviceId('kiosk')` retorna `"kiosk:" + getDoorbellId()`.

- [ ] **Step 1: util doorbell.ts**

Create `frontend/src/utils/doorbell.ts`:

```ts
import { apiService } from '../services/apiService';
import type { Doorbell } from '@shared/types/doorbell';

const KEY = 'campainha_doorbell_id';

export function getDoorbellId(): number {
  const raw = localStorage.getItem(KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function setDoorbellId(id: number): void {
  localStorage.setItem(KEY, String(id));
}

// O app Android abre a WebView com "?doorbell=<id>"; persistimos e seguimos
// usando localStorage nas próximas cargas.
export function bootstrapDoorbellFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('doorbell');
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) setDoorbellId(n);
    }
  } catch {
    // sem window/URL — ignora
  }
}

export async function fetchDoorbells(): Promise<Doorbell[]> {
  return apiService.getDoorbells();
}
```

- [ ] **Step 2: deviceId do kiosk inclui o id**

Em `frontend/src/utils/callSignaling.ts`, trocar a função:

```ts
import { getDoorbellId } from './doorbell';
// ...
export function getOrCreateDeviceId(role: 'kiosk' | 'resident'): string {
  if (role === 'kiosk') return `kiosk:${getDoorbellId()}`;
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
```

> Nota: `RealCallPage` e o novo `useKioskLiveHost` passam a se registrar como `kiosk:<id>`. O lado morador endereça mensagens para esse mesmo id (Tasks 9–12). O `NotificationsPage` atual usa `msg.from || 'kiosk'` só como rótulo de fallback — continua ok.

- [ ] **Step 3: bootstrap no main.tsx**

Em `frontend/src/main.tsx`, antes de `ReactDOM.createRoot(...).render(...)`:

```ts
import { bootstrapDoorbellFromUrl } from './utils/doorbell';
bootstrapDoorbellFromUrl();
```

- [ ] **Step 4: métodos de doorbell no apiService**

Em `frontend/src/services/apiService.ts`, adicionar (dentro da classe, perto de "Residents"):

```ts
  // Doorbells
  async getDoorbells(): Promise<import('@shared/types/doorbell').Doorbell[]> {
    return this.request('/doorbells');
  }
  async createDoorbell(name: string): Promise<import('@shared/types/doorbell').Doorbell> {
    return this.request('/doorbells', {
      method: 'POST',
      body: JSON.stringify({ name }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
  async renameDoorbell(id: number, name: string): Promise<import('@shared/types/doorbell').Doorbell> {
    return this.request(`/doorbells/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
  async deleteDoorbell(id: number): Promise<void> {
    await this.request(`/doorbells/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
```

- [ ] **Step 5: type-check**

Run: `npm run type-check`
Expected: sem erros. (Import circular `doorbell.ts` ↔ `apiService.ts` é ok — `apiService` não usa `doorbell` no topo do módulo.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/doorbell.ts frontend/src/utils/callSignaling.ts frontend/src/main.tsx frontend/src/services/apiService.ts
git commit -m "feat: id de campainha no frontend (localStorage + ?doorbell= + deviceId)"
```

---

## Task 5: Aba admin "Campainhas" (renomear)

**Files:**
- Create: `frontend/src/pages/admin/AdminDoorbellsTab.tsx`
- Modify: `frontend/src/pages/AdminResidentsPage.tsx`

**Interfaces:**
- Consumes: `apiService.getDoorbells/createDoorbell/renameDoorbell/deleteDoorbell`.
- Produces: componente `AdminDoorbellsTab({ showToast })`. Reservar espaço para o bloco de kiosk (Task 15) com um comentário `{/* bloco de modo kiosk — Task 15 */}`.

- [ ] **Step 1: Componente**

Create `frontend/src/pages/admin/AdminDoorbellsTab.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import type { Doorbell } from '@shared/types/doorbell';

export function AdminDoorbellsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [doorbells, setDoorbells] = useState<Doorbell[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [draft, setDraft] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    try {
      const list = await apiService.getDoorbells();
      setDoorbells(list);
      setDraft(Object.fromEntries(list.map((d) => [d.id, d.name])));
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar campainhas', 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleRename(id: number) {
    const name = (draft[id] ?? '').trim();
    if (!name) return;
    try {
      await apiService.renameDoorbell(id, name);
      showToast('Nome salvo');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao renomear', 'error');
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await apiService.createDoorbell(name);
      setNewName('');
      showToast('Campainha adicionada');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao adicionar', 'error');
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Remover esta campainha?')) return;
    try {
      await apiService.deleteDoorbell(id);
      showToast('Campainha removida');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao remover', 'error');
    }
  }

  return (
    <div>
      <h2 className="admin-section-title">Campainhas</h2>
      {loading && <p>Carregando...</p>}

      {doorbells.map((d) => (
        <div key={d.id} className="admin-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={draft[d.id] ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, [d.id]: e.target.value }))}
              style={{ fontSize: 16, padding: 8, flex: '1 1 180px' }}
            />
            <button className="admin-btn" onClick={() => handleRename(d.id)}>Salvar nome</button>
            {d.id !== 1 && (
              <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(d.id)}>Remover</button>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>ID técnico: {d.device_key}</div>
          {/* bloco de modo kiosk — Task 15 */}
        </div>
      ))}

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="Nome da nova campainha"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ fontSize: 16, padding: 8, flex: '1 1 180px' }}
        />
        <button className="admin-btn" onClick={handleCreate}>Adicionar campainha</button>
      </div>
    </div>
  );
}

export default AdminDoorbellsTab;
```

- [ ] **Step 2: Registrar a aba**

Em `frontend/src/pages/AdminResidentsPage.tsx`:
- import: `import AdminDoorbellsTab from './admin/AdminDoorbellsTab';`
- tipo `Tab`: adicionar `| 'doorbells'`.
- array `TABS`: adicionar `{ key: 'doorbells', icon: '📟', label: 'Campainhas' }` (após `visitors`).
- render: adicionar `{tab === 'doorbells' && <AdminDoorbellsTab showToast={showToast} />}`.

- [ ] **Step 3: Verificação manual**

Run: `npm run dev` (raiz). Abrir `http://localhost:3000/admin/residents`, PIN `1234`, aba **Campainhas**.
Expected: mostra "Campainha" editável; renomear para "Portão da frente" → toast "Nome salvo"; recarregar mantém o nome; "Adicionar campainha" cria uma segunda; "Remover" some com ela; a campainha 1 não tem botão Remover.

- [ ] **Step 4: type-check + commit**

Run: `npm run type-check`

```bash
git add frontend/src/pages/admin/AdminDoorbellsTab.tsx frontend/src/pages/AdminResidentsPage.tsx
git commit -m "feat: aba admin Campainhas (renomear/adicionar/remover)"
```

---

## Task 6: Nome da campainha nas notificações + carimbo doorbellId nos eventos

**Files:**
- Modify: `frontend/src/services/apiService.ts` (injetar `doorbellId` nas mutações do kiosk)
- Modify: `backend/src/controllers/EventController.ts`, `backend/src/controllers/MessageController.ts`, `backend/src/controllers/DeliveryController.ts`, `backend/src/controllers/VisitorController.ts` (persistir `doorbellId` no metadata do evento)
- Modify: `frontend/src/pages/NotificationsPage.tsx` (`describeEvent` recebe mapa de nomes; export)
- Create: `frontend/test/describeEvent.test.ts` + `frontend/vitest.config.ts` + devDep `vitest`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `getDoorbellId()`, `apiService.getDoorbells()`.
- Produces: `export function describeEvent(event: Event, doorbellNames?: Record<number, string>): string | null` — quando `event.metadata?.doorbellId` existe e há nome no mapa, prefixa `"<nome>: "`.

- [ ] **Step 1: Vitest no frontend**

`frontend/package.json`: devDep `"vitest": "^2.1.0"`, script `"test": "vitest run"`.
Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared') } },
});
```

Run: `npm install --workspace=frontend`

- [ ] **Step 2: Teste de describeEvent (falha)**

Create `frontend/test/describeEvent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { describeEvent } from '../src/pages/NotificationsPage';
import { EventType, EventStatus } from '@shared/types/event';

const base = { id: 1, status: EventStatus.PENDING, created_at: '' } as const;

describe('describeEvent', () => {
  it('descreve visitante não identificado', () => {
    const txt = describeEvent({ ...base, type: EventType.PERSON_DETECTED, metadata: { recognized: false } } as any);
    expect(txt).toBe('Visitante não identificado na porta');
  });

  it('prefixa o nome da campainha quando há doorbellId no mapa', () => {
    const txt = describeEvent(
      { ...base, type: EventType.PERSON_DETECTED, metadata: { recognized: false, doorbellId: 2 } } as any,
      { 2: 'Fundos' },
    );
    expect(txt).toBe('Fundos: Visitante não identificado na porta');
  });

  it('sem mapa/sem doorbellId, não prefixa', () => {
    const txt = describeEvent(
      { ...base, type: EventType.PERSON_DETECTED, metadata: { recognized: false, doorbellId: 2 } } as any,
    );
    expect(txt).toBe('Visitante não identificado na porta');
  });
});
```

Run: `npm run test --workspace=frontend -- describeEvent` → FAIL (`describeEvent` não exportado).

- [ ] **Step 3: refatorar describeEvent**

Em `frontend/src/pages/NotificationsPage.tsx`:
- trocar `function describeEvent(event: Event): string | null {` por
  `export function describeEvent(event: Event, doorbellNames?: Record<number, string>): string | null {`
- no início do corpo, computar o resultado atual numa variável `base` (renomear o `return`s internos para atribuições) **ou**, mais simples, embrulhar: manter a lógica atual numa função interna `core(event)` e no final:

```ts
export function describeEvent(event: Event, doorbellNames?: Record<number, string>): string | null {
  const core = (): string | null => {
    if (event.type === EventType.RESIDENT_IDENTIFIED) {
      return `${event.metadata?.name || 'Alguém'} chegou em casa`;
    }
    if (event.type === EventType.PERSON_DETECTED && event.metadata?.recognized === false) {
      return 'Visitante não identificado na porta';
    }
    if (event.type === EventType.BUTTON_PRESSED && event.metadata?.reason === 'other') {
      if (!event.metadata?.message) return 'Novo recado de áudio na porta';
      const preview = (event.metadata.message as string).replace(/\s+/g, ' ').slice(0, 70);
      return `Recado: "${preview}${preview.length === 70 ? '...' : ''}"`;
    }
    if (event.type === EventType.DELIVERY_SELECTED) {
      const company = event.metadata?.company;
      return company ? `Entrega registrada na porta (${company})` : 'Entrega registrada na porta';
    }
    return null;
  };
  const text = core();
  if (!text) return null;
  const id = event.metadata?.doorbellId as number | undefined;
  const name = id && doorbellNames ? doorbellNames[id] : undefined;
  return name ? `${name}: ${text}` : text;
}
```

- Na `NotificationsPage`, carregar os nomes uma vez:

```ts
const [doorbellNames, setDoorbellNames] = useState<Record<number, string>>({});
useEffect(() => {
  apiService.getDoorbells().then((list) => {
    setDoorbellNames(Object.fromEntries(list.map((d) => [d.id, d.name])));
  }).catch(() => {});
}, []);
```

- na chamada dentro de `poll()`: `const text = describeEvent(event, doorbellNames);`
  (mover `doorbellNames` para as deps do `useEffect` de poll, ou ler via `ref`. Usar um `ref`: `const doorbellNamesRef = useRef({}); useEffect(()=>{doorbellNamesRef.current = doorbellNames}, [doorbellNames]);` e usar `doorbellNamesRef.current` no `poll`.)

- [ ] **Step 4: injetar doorbellId nas mutações do kiosk (apiService)**

Em `frontend/src/services/apiService.ts`, no topo importar de forma preguiçosa para evitar ciclo:

```ts
function kioskDoorbellId(): number {
  try {
    // import estático causaria ciclo com doorbell.ts; leitura direta do storage
    const raw = localStorage.getItem('campainha_doorbell_id');
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}
```

Alterar os corpos:
- `createEvent`: `body: JSON.stringify({ ...event, metadata: { ...(event.metadata || {}), doorbellId: kioskDoorbellId() } })`
- `createDelivery`: `body: JSON.stringify({ ...delivery, doorbellId: kioskDoorbellId() })`
- `sendMessage`: `body: JSON.stringify({ ...message, doorbellId: kioskDoorbellId() })`
- `recordUnrecognizedVisit(videoBase64, photoBase64?)`: assinatura passa a
  `async recordUnrecognizedVisit(videoBase64: string, photoBase64?: string): Promise<Event>` e
  `body: JSON.stringify({ videoBase64, photoBase64, doorbellId: kioskDoorbellId() })` (o `photoBase64` é usado na Task 21; já deixar no contrato).

- [ ] **Step 5: backend persiste doorbellId no metadata do evento**

- `EventController` (método `create`): ao montar `metadata`, se `req.body.doorbellId` for número, incluir `doorbellId` no objeto `metadata` salvo.
- `MessageController` e `DeliveryController`: onde criam o `events` row (via `EventRepository.create({ type, metadata })`), adicionar `doorbellId: Number(req.body.doorbellId) || undefined` ao `metadata`.
- `VisitorController.recordUnrecognized`: idem, incluir `doorbellId` no `metadata` do evento `PERSON_DETECTED`.

Regra: nunca quebrar se `doorbellId` ausente (campo opcional).

- [ ] **Step 6: Rodar testes**

Run: `npm run test --workspace=frontend -- describeEvent` → PASS.
Run: `npm run test --workspace=backend` → PASS (nada regrediu).

- [ ] **Step 7: Verificação manual**

`npm run dev`. Numa aba abrir `/?doorbell=1` e na outra `/notifications` (ativar). Renomear a campainha 1 para "Frente" no admin. Disparar um "recado" pelo fluxo "outro motivo".
Expected: banner em `/notifications` aparece como `Frente: Recado: "..."`.

- [ ] **Step 8: type-check + commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/test/describeEvent.test.ts frontend/src/pages/NotificationsPage.tsx frontend/src/services/apiService.ts backend/src/controllers/EventController.ts backend/src/controllers/MessageController.ts backend/src/controllers/DeliveryController.ts backend/src/controllers/VisitorController.ts package-lock.json
git commit -m "feat: nome da campainha nas notificações + doorbellId nos eventos"
```

---

## Task 7: Android — item de menu "ID da campainha" + `?doorbell=` na URL

**Files:**
- Modify: `android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt`

**Interfaces:**
- Consumes: `SharedPreferences` (`kiosk_prefs`).
- Produces: pref `doorbell_id` (int, default 1). `currentUrl()` passa a anexar `?doorbell=<id>` (preservando query existente com `&`).

- [ ] **Step 1: pref + URL com doorbell**

Em `MainActivity.kt`:
- `companion object`: adicionar `private const val KEY_DOORBELL = "doorbell_id"` e `private const val DEFAULT_DOORBELL = 1`.
- Adicionar:

```kotlin
private fun currentDoorbellId(): Int = prefs.getInt(KEY_DOORBELL, DEFAULT_DOORBELL)

private fun urlWithDoorbell(): String {
    val baseUrl = currentUrl()
    val sep = if (baseUrl.contains("?")) "&" else "?"
    return "$baseUrl${sep}doorbell=${currentDoorbellId()}"
}
```

- Onde hoje chama `webView.loadUrl(currentUrl())` (em `onCreate`, no menu "Recarregar página", e no `promptForUrl` após salvar), trocar por `webView.loadUrl(urlWithDoorbell())`.

- [ ] **Step 2: item no menu admin**

Em `showAdminMenu()`, trocar o array e o `when`:

```kotlin
val options = arrayOf("Recarregar página", "Trocar URL", "Trocar PIN", "ID da campainha", "Desbloquear 15 min", "Sair do app")
```

```kotlin
when (which) {
    0 -> webView.loadUrl(urlWithDoorbell())
    1 -> promptForUrl()
    2 -> promptForNewPin()
    3 -> promptForDoorbellId()
    4 -> { /* Task 19: desbloqueio local */ }
    5 -> { /* Task 19: gate por locked */ finishAffinity() }
}
```

E adicionar:

```kotlin
private fun promptForDoorbellId() {
    val input = EditText(this)
    input.inputType = InputType.TYPE_CLASS_NUMBER
    input.setText(currentDoorbellId().toString())
    AlertDialog.Builder(this)
        .setTitle("ID da campainha")
        .setView(input)
        .setPositiveButton("Salvar") { _, _ ->
            val n = input.text.toString().trim().toIntOrNull()
            if (n != null && n > 0) {
                prefs.edit().putInt(KEY_DOORBELL, n).apply()
                webView.loadUrl(urlWithDoorbell())
            }
        }
        .setNegativeButton("Cancelar", null)
        .show()
}
```

> "Desbloquear 15 min" e o gate de "Sair do app" ficam como stubs até a Task 19.

- [ ] **Step 3: Verificação (build)**

Run: `cd android-app && ./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL. (Se não houver ambiente Android no runner, marcar como verificação manual pendente e seguir.)

- [ ] **Step 4: Commit**

```bash
git add android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt
git commit -m "feat(android): ID da campainha no menu admin + ?doorbell= na URL"
```

---

# PHASE 2 — Câmera ao vivo sob demanda (WebRTC)

## Task 8: Flag compartilhada de ocupação (kioskBusy)

**Files:**
- Create: `frontend/src/utils/kioskBusy.ts`
- Create: `frontend/test/kioskBusy.test.ts`

**Interfaces:**
- Produces:
  `setCallActive(active: boolean): void`,
  `isCallActive(): boolean`,
  `onCallActiveChange(cb: (active: boolean) => void): () => void`.

- [ ] **Step 1: Teste (falha)**

Create `frontend/test/kioskBusy.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { setCallActive, isCallActive, onCallActiveChange } from '../src/utils/kioskBusy';

describe('kioskBusy', () => {
  it('guarda o estado e notifica listeners', () => {
    const cb = vi.fn();
    const off = onCallActiveChange(cb);
    expect(isCallActive()).toBe(false);
    setCallActive(true);
    expect(isCallActive()).toBe(true);
    expect(cb).toHaveBeenCalledWith(true);
    off();
    setCallActive(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npm run test --workspace=frontend -- kioskBusy` → FAIL.

- [ ] **Step 2: Implementação**

Create `frontend/src/utils/kioskBusy.ts`:

```ts
// Estado global (por aba) para coordenar a chamada WebRTC real e a
// observação ao vivo (live-view). Se uma chamada está ativa, o host do
// live-view recusa novas observações e encerra as em curso.
let callActive = false;
const listeners = new Set<(active: boolean) => void>();

export function setCallActive(active: boolean): void {
  if (callActive === active) return;
  callActive = active;
  listeners.forEach((l) => l(active));
}

export function isCallActive(): boolean {
  return callActive;
}

export function onCallActiveChange(cb: (active: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
```

- [ ] **Step 3: Marcar chamada ativa no RealCallPage e NotificationsPage**

- `RealCallPage.tsx`: no início do `useEffect` principal `setCallActive(true)`; no cleanup `setCallActive(false)`. (import de `../utils/kioskBusy`.)
- `NotificationsPage.tsx`: em `acceptCall` → `setCallActive(true)`; em `endCall` → `setCallActive(false)`.

- [ ] **Step 4: Rodar + type-check + commit**

Run: `npm run test --workspace=frontend -- kioskBusy` → PASS
Run: `npm run type-check`

```bash
git add frontend/src/utils/kioskBusy.ts frontend/test/kioskBusy.test.ts frontend/src/pages/RealCallPage.tsx frontend/src/pages/NotificationsPage.tsx
git commit -m "feat: flag compartilhada kioskBusy (chamada x observação)"
```

---

## Task 9: Hook `useKioskLiveHost` + montar na StandbyPage

**Files:**
- Create: `frontend/src/hooks/useKioskLiveHost.ts`
- Modify: `frontend/src/pages/StandbyPage.tsx`

**Interfaces:**
- Consumes: `CallSignalingClient`, `ICE_SERVERS`, `isCallActive`/`onCallActiveChange`.
- Mensagens de sinalização (todas com `watchId: string`):
  - recebe `watch-request` `{ from }` → responde `watch-busy` **ou** `watch-offer` `{ sdp }`.
  - recebe `watch-answer` `{ sdp }`, `watch-ice` `{ candidate }`, `watch-end`, `watch-ping`.
  - envia `watch-offer`, `watch-ice`, `watch-error` `{ reason }`.
- Produces: `useKioskLiveHost(): void` — efeito que mantém um `CallSignalingClient('kiosk', <nome>)` aberto enquanto montado e atende observações. Sem retorno.

- [ ] **Step 1: Implementação**

Create `frontend/src/hooks/useKioskLiveHost.ts`:

```ts
import { useEffect } from 'react';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';
import { isCallActive } from '../utils/kioskBusy';
import { apiService } from '../services/apiService';
import { getDoorbellId } from '../utils/doorbell';

const WATCH_IDLE_TIMEOUT_MS = 180_000; // 3 min sem ping → encerra

interface WatchSession {
  watchId: string;
  from: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  idleTimer: ReturnType<typeof setTimeout>;
}

export function useKioskLiveHost(): void {
  useEffect(() => {
    let doorbellName = `Campainha ${getDoorbellId()}`;
    apiService.getDoorbells()
      .then((list) => {
        const mine = list.find((d) => d.id === getDoorbellId());
        if (mine) doorbellName = mine.name;
      })
      .catch(() => {});

    const client = new CallSignalingClient('kiosk', doorbellName);
    let session: WatchSession | null = null;

    function teardown() {
      if (!session) return;
      clearTimeout(session.idleTimer);
      session.pc.close();
      session.stream.getTracks().forEach((t) => t.stop());
      session = null;
    }

    function armIdleTimer() {
      if (!session) return;
      clearTimeout(session.idleTimer);
      session.idleTimer = setTimeout(teardown, WATCH_IDLE_TIMEOUT_MS);
    }

    client.connect();

    client.on('watch-request', async (msg) => {
      const { watchId, from } = msg as { watchId: string; from: string };
      if (!watchId || !from) return;
      if (isCallActive()) {
        client.send({ type: 'watch-busy', to: from, watchId });
        return;
      }
      if (session) teardown(); // só uma observação por vez
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const pc = new RTCPeerConnection(ICE_SERVERS);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) client.send({ type: 'watch-ice', to: from, watchId, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) teardown();
        };
        session = { watchId, from, pc, stream, idleTimer: setTimeout(teardown, WATCH_IDLE_TIMEOUT_MS) };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        client.send({ type: 'watch-offer', to: from, watchId, sdp: offer });
      } catch (err: any) {
        client.send({ type: 'watch-error', to: from, watchId, reason: err?.message || 'camera' });
        teardown();
      }
    });

    client.on('watch-answer', async (msg) => {
      if (!session || msg.watchId !== session.watchId) return;
      try {
        await session.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } catch {
        teardown();
      }
    });

    client.on('watch-ice', (msg) => {
      if (!session || msg.watchId !== session.watchId) return;
      session.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
    });

    client.on('watch-ping', (msg) => {
      if (session && msg.watchId === session.watchId) armIdleTimer();
    });

    client.on('watch-end', (msg) => {
      if (session && msg.watchId === session.watchId) teardown();
    });

    // Se uma chamada real começa, derruba a observação.
    const offBusy = (window as any).__kioskBusyOff = onCallActiveChangeSafe(() => {
      if (isCallActive() && session) {
        client.send({ type: 'watch-end', to: session.from, watchId: session.watchId });
        teardown();
      }
    });

    return () => {
      offBusy?.();
      teardown();
      client.close();
    };
  }, []);
}

// import isolado para manter o topo do arquivo legível
import { onCallActiveChange as onCallActiveChangeSafe } from '../utils/kioskBusy';
```

> Nota ao implementador: mover o `import { onCallActiveChange as onCallActiveChangeSafe }` para o topo junto dos outros imports (deixado embaixo aqui só para destacar). Remover a atribuição a `window.__kioskBusyOff` — era só para debug; usar `const offBusy = onCallActiveChangeSafe(...)`.

- [ ] **Step 2: Montar na StandbyPage**

Em `frontend/src/pages/StandbyPage.tsx`, dentro do componente, no topo:

```ts
import { useKioskLiveHost } from '../hooks/useKioskLiveHost';
// ...
useKioskLiveHost();
```

- [ ] **Step 3: type-check**

Run: `npm run type-check`
Expected: sem erros.

- [ ] **Step 4: Verificação manual (parcial)**

`npm run dev`. Abrir `/` (standby). No console do navegador, verificar log de conexão WS `/ws/calls?deviceId=kiosk:1&role=kiosk`. (Teste ponta-a-ponta na Task 10.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useKioskLiveHost.ts frontend/src/pages/StandbyPage.tsx
git commit -m "feat: kiosk atende observação de câmera ao vivo (host WebRTC persistente)"
```

---

## Task 10: Hook `useLiveViewer` (+ reducer puro testado)

**Files:**
- Create: `frontend/src/hooks/useLiveViewer.ts`
- Create: `frontend/test/liveViewerReducer.test.ts`

**Interfaces:**
- Produces:
  - `type LiveViewerState = 'idle' | 'requesting' | 'busy' | 'connecting' | 'live' | 'error'`
  - `liveViewerReducer(state: LiveViewerState, action: LiveViewerAction): LiveViewerState` onde
    `LiveViewerAction = { type: 'start' } | { type: 'offer' } | { type: 'connected' } | { type: 'busy' } | { type: 'error' } | { type: 'stop' } | { type: 'timeout' }`.
  - `useLiveViewer(targetDoorbellId: number): { state: LiveViewerState; start: () => void; stop: () => void; videoRef: React.RefObject<HTMLVideoElement>; errorMsg: string | null }`.

- [ ] **Step 1: Teste do reducer (falha)**

Create `frontend/test/liveViewerReducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { liveViewerReducer } from '../src/hooks/useLiveViewer';

describe('liveViewerReducer', () => {
  it('idle -> start -> requesting', () => {
    expect(liveViewerReducer('idle', { type: 'start' })).toBe('requesting');
  });
  it('requesting -> offer -> connecting -> connected -> live', () => {
    expect(liveViewerReducer('requesting', { type: 'offer' })).toBe('connecting');
    expect(liveViewerReducer('connecting', { type: 'connected' })).toBe('live');
  });
  it('requesting -> busy', () => {
    expect(liveViewerReducer('requesting', { type: 'busy' })).toBe('busy');
  });
  it('requesting -> timeout -> error', () => {
    expect(liveViewerReducer('requesting', { type: 'timeout' })).toBe('error');
  });
  it('qualquer -> stop -> idle', () => {
    expect(liveViewerReducer('live', { type: 'stop' })).toBe('idle');
    expect(liveViewerReducer('error', { type: 'stop' })).toBe('idle');
  });
  it('ignora offer fora de requesting', () => {
    expect(liveViewerReducer('idle', { type: 'offer' })).toBe('idle');
  });
});
```

Run: `npm run test --workspace=frontend -- liveViewerReducer` → FAIL.

- [ ] **Step 2: Implementação**

Create `frontend/src/hooks/useLiveViewer.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';

export type LiveViewerState = 'idle' | 'requesting' | 'busy' | 'connecting' | 'live' | 'error';
export type LiveViewerAction =
  | { type: 'start' } | { type: 'offer' } | { type: 'connected' }
  | { type: 'busy' } | { type: 'error' } | { type: 'stop' } | { type: 'timeout' };

export function liveViewerReducer(state: LiveViewerState, action: LiveViewerAction): LiveViewerState {
  switch (action.type) {
    case 'stop': return 'idle';
    case 'start': return state === 'idle' || state === 'error' || state === 'busy' ? 'requesting' : state;
    case 'offer': return state === 'requesting' ? 'connecting' : state;
    case 'connected': return state === 'connecting' ? 'live' : state;
    case 'busy': return state === 'requesting' ? 'busy' : state;
    case 'timeout': return state === 'requesting' || state === 'connecting' ? 'error' : state;
    case 'error': return 'error';
    default: return state;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 20_000;

export function useLiveViewer(targetDoorbellId: number) {
  const [state, setState] = useState<LiveViewerState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<CallSignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const watchIdRef = useRef<string>('');
  const timersRef = useRef<{ req?: ReturnType<typeof setTimeout>; ping?: ReturnType<typeof setInterval> }>({});

  const dispatch = useCallback((a: LiveViewerAction) => setState((s) => liveViewerReducer(s, a)), []);

  const stop = useCallback(() => {
    const client = clientRef.current;
    if (client && watchIdRef.current) {
      client.send({ type: 'watch-end', to: `kiosk:${targetDoorbellId}`, watchId: watchIdRef.current });
    }
    if (timersRef.current.req) clearTimeout(timersRef.current.req);
    if (timersRef.current.ping) clearInterval(timersRef.current.ping);
    pcRef.current?.close();
    pcRef.current = null;
    client?.close();
    clientRef.current = null;
    watchIdRef.current = '';
    dispatch({ type: 'stop' });
    setErrorMsg(null);
  }, [dispatch, targetDoorbellId]);

  const start = useCallback(() => {
    if (clientRef.current) return;
    const watchId = crypto.randomUUID();
    watchIdRef.current = watchId;
    const to = `kiosk:${targetDoorbellId}`;
    const client = new CallSignalingClient('resident', 'Observador');
    clientRef.current = client;
    dispatch({ type: 'start' });
    setErrorMsg(null);

    client.on('watch-busy', (msg) => {
      if (msg.watchId !== watchId) return;
      dispatch({ type: 'busy' });
    });
    client.on('watch-error', (msg) => {
      if (msg.watchId !== watchId) return;
      setErrorMsg(msg.reason === 'camera' ? 'A campainha não conseguiu abrir a câmera' : String(msg.reason || 'Erro'));
      dispatch({ type: 'error' });
    });
    client.on('watch-offer', async (msg) => {
      if (msg.watchId !== watchId) return;
      if (timersRef.current.req) clearTimeout(timersRef.current.req);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate) client.send({ type: 'watch-ice', to, watchId, candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        if (videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') dispatch({ type: 'connected' });
        if (['failed', 'disconnected'].includes(pc.connectionState)) { setErrorMsg('Conexão perdida'); dispatch({ type: 'error' }); }
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        client.send({ type: 'watch-answer', to, watchId, sdp: answer });
        dispatch({ type: 'offer' });
        timersRef.current.ping = setInterval(() => client.send({ type: 'watch-ping', to, watchId }), PING_INTERVAL_MS);
      } catch {
        setErrorMsg('Falha ao negociar vídeo');
        dispatch({ type: 'error' });
      }
    });
    client.on('watch-ice', (msg) => {
      if (msg.watchId !== watchId || !pcRef.current) return;
      pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
    });
    client.on('watch-end', (msg) => {
      if (msg.watchId === watchId) { setErrorMsg('A campainha encerrou a transmissão'); dispatch({ type: 'error' }); }
    });

    client.connect();
    // dá um tempo pro socket abrir antes de pedir
    setTimeout(() => client.send({ type: 'watch-request', to, watchId }), 300);
    timersRef.current.req = setTimeout(() => {
      setErrorMsg('A campainha não respondeu');
      dispatch({ type: 'timeout' });
    }, REQUEST_TIMEOUT_MS);
  }, [dispatch, targetDoorbellId]);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, videoRef, errorMsg };
}
```

- [ ] **Step 3: Rodar reducer**

Run: `npm run test --workspace=frontend -- liveViewerReducer` → PASS.

- [ ] **Step 4: type-check + commit**

Run: `npm run type-check`

```bash
git add frontend/src/hooks/useLiveViewer.ts frontend/test/liveViewerReducer.test.ts
git commit -m "feat: hook useLiveViewer + reducer de estado da observação"
```

---

## Task 11: Aba admin "Câmera"

**Files:**
- Create: `frontend/src/pages/admin/AdminCameraTab.tsx`
- Modify: `frontend/src/pages/AdminResidentsPage.tsx`

**Interfaces:**
- Consumes: `useLiveViewer`, `apiService.getDoorbells`.
- Produces: `AdminCameraTab({ showToast })`.

- [ ] **Step 1: Componente**

Create `frontend/src/pages/admin/AdminCameraTab.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import { useLiveViewer } from '../../hooks/useLiveViewer';
import type { Doorbell } from '@shared/types/doorbell';

export function AdminCameraTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [doorbells, setDoorbells] = useState<Doorbell[]>([]);
  const [selected, setSelected] = useState<number>(1);
  const { state, start, stop, videoRef, errorMsg } = useLiveViewer(selected);

  useEffect(() => {
    apiService.getDoorbells().then((list) => {
      setDoorbells(list);
      if (list[0]) setSelected(list[0].id);
    }).catch((e) => showToast(e.message || 'Erro ao carregar campainhas', 'error'));
  }, []);

  useEffect(() => () => stop(), [selected]); // troca de campainha encerra a atual

  const label: Record<string, string> = {
    idle: 'Parado', requesting: 'Chamando a campainha...', busy: 'Campainha ocupada em uma chamada',
    connecting: 'Conectando...', live: 'Ao vivo', error: errorMsg || 'Erro',
  };

  return (
    <div>
      <h2 className="admin-section-title">Câmera ao vivo</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={selected} onChange={(e) => setSelected(Number(e.target.value))} style={{ padding: 8, fontSize: 15 }}>
          {doorbells.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {state === 'idle' || state === 'error' || state === 'busy'
          ? <button className="admin-btn" onClick={start}>▶ Ver ao vivo</button>
          : <button className="admin-btn admin-btn-danger" onClick={stop}>■ Parar</button>}
        <span style={{ fontSize: 14, color: '#64748b' }}>{label[state]}</span>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 640, borderRadius: 12, background: '#000', display: state === 'live' || state === 'connecting' ? 'block' : 'none' }}
      />
      {state === 'error' && <p style={{ color: 'var(--error)' }}>{errorMsg}</p>}
    </div>
  );
}

export default AdminCameraTab;
```

- [ ] **Step 2: Registrar aba**

Em `AdminResidentsPage.tsx`: import `AdminCameraTab`; `Tab` += `| 'camera'`; `TABS` += `{ key: 'camera', icon: '📷', label: 'Câmera' }`; render `{tab === 'camera' && <AdminCameraTab showToast={showToast} />}`.

- [ ] **Step 3: Verificação manual ponta-a-ponta**

`npm run dev`. Aba A: `http://localhost:3000/?doorbell=1` (deixar em standby, permitir câmera). Aba B: `/admin/residents` → **Câmera** → "Ver ao vivo".
Expected: em ~1–3s o vídeo da câmera da Aba A aparece na Aba B; "Parar" encerra e a luz da câmera na Aba A apaga. Se a Aba A estiver numa chamada real (`/call/real`), o estado vai para "Campainha ocupada".

- [ ] **Step 4: type-check + commit**

```bash
git add frontend/src/pages/admin/AdminCameraTab.tsx frontend/src/pages/AdminResidentsPage.tsx
git commit -m "feat: aba admin Câmera (observação WebRTC ao vivo)"
```

---

## Task 12: Botão "Ver câmera ao vivo" em /notificações

**Files:**
- Modify: `frontend/src/pages/NotificationsPage.tsx`

**Interfaces:**
- Consumes: `useLiveViewer`, `getDoorbellId` (default 1) — ou seletor se houver várias.

- [ ] **Step 1: Integrar o hook**

Em `NotificationsPage.tsx`, dentro do componente:

```ts
import { useLiveViewer } from '../hooks/useLiveViewer';
// ...
const [watchDoorbellId] = useState<number>(1); // uma campainha por ora
const liveView = useLiveViewer(watchDoorbellId);
```

No JSX do estado "notificações ativas" (antes do bloco `live &&` existente do feed JPEG), adicionar:

```tsx
<div style={{ marginBottom: 16, textAlign: 'center' }}>
  {liveView.state === 'idle' || liveView.state === 'error' || liveView.state === 'busy'
    ? <button className="btn btn-outline" onClick={liveView.start}>📷 Ver câmera ao vivo</button>
    : <button className="btn btn-outline" onClick={liveView.stop}>■ Parar câmera</button>}
  {liveView.state === 'busy' && <p style={{ color: 'var(--text-gray)' }}>Campainha ocupada em uma chamada</p>}
  {liveView.state === 'error' && <p style={{ color: 'var(--error)' }}>{liveView.errorMsg}</p>}
</div>
<video
  ref={liveView.videoRef}
  autoPlay playsInline muted
  style={{ width: '100%', borderRadius: 12, background: '#000', marginBottom: 16, display: liveView.state === 'live' || liveView.state === 'connecting' ? 'block' : 'none' }}
/>
```

> A observação usa seu próprio `CallSignalingClient('resident', ...)` — não colide com o client de chamadas já aberto na página (o servidor relay chaveia por `deviceId`; um segundo socket do mesmo `deviceId` sobrescreve o mapa no servidor). **Para evitar conflito de deviceId**, passar um id efêmero: no `useLiveViewer`, trocar `new CallSignalingClient('resident', 'Observador')` por um client que usa `deviceId` próprio. Ajuste: adicionar parâmetro opcional em `CallSignalingClient` — ver Step 2.

- [ ] **Step 2: deviceId efêmero para o observador**

Em `frontend/src/utils/callSignaling.ts`, permitir override de id:

```ts
constructor(private role: 'kiosk' | 'resident', private label: string, deviceIdOverride?: string) {
  this.deviceId = deviceIdOverride ?? getOrCreateDeviceId(role);
}
```

Em `useLiveViewer.ts`, criar com id efêmero:

```ts
const client = new CallSignalingClient('resident', 'Observador', `watch-${watchId}`);
```

E no `useKioskLiveHost`, ao responder, endereçar `to: from` (já é `msg.from`, que o servidor preenche com o `deviceId` de origem — `watch-<uuid>`). OK sem mudança.

- [ ] **Step 3: Verificação manual**

Aba A standby `/?doorbell=1`; Aba B `/notifications` (ativa) → "Ver câmera ao vivo" → vídeo aparece; chega uma chamada real → o botão de observação mostra "ocupada" se tentar durante a chamada. Encerrar tudo, a câmera da Aba A apaga.

- [ ] **Step 4: type-check + commit**

```bash
git add frontend/src/pages/NotificationsPage.tsx frontend/src/utils/callSignaling.ts frontend/src/hooks/useLiveViewer.ts
git commit -m "feat: botão 'Ver câmera ao vivo' em /notificações"
```

---

# PHASE 3 — Modo kiosk "vírus" + desbloqueio temporário

## Task 13: Domínio do lock + métodos no repositório

**Files:**
- Create: `backend/src/domain/kioskLock.ts`
- Create: `backend/test/kioskLock.test.ts`

**Interfaces:**
- Produces:
  `computeLockState(input: { lockEnabled: boolean; unlockUntil: string | null; now?: Date }): KioskLockState`
  onde `locked = lockEnabled && (unlockUntil == null || now >= Date(unlockUntil))`.

- [ ] **Step 1: Teste (falha)**

Create `backend/test/kioskLock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeLockState } from '../src/domain/kioskLock';

const now = new Date('2026-09-02T12:00:00.000Z');

describe('computeLockState', () => {
  it('lock desligado → nunca travado', () => {
    expect(computeLockState({ lockEnabled: false, unlockUntil: null, now }).locked).toBe(false);
  });
  it('lock ligado, sem unlock → travado', () => {
    expect(computeLockState({ lockEnabled: true, unlockUntil: null, now }).locked).toBe(true);
  });
  it('lock ligado, unlock no futuro → destravado', () => {
    expect(computeLockState({ lockEnabled: true, unlockUntil: '2026-09-02T12:10:00.000Z', now }).locked).toBe(false);
  });
  it('lock ligado, unlock no passado → travado', () => {
    expect(computeLockState({ lockEnabled: true, unlockUntil: '2026-09-02T11:59:00.000Z', now }).locked).toBe(true);
  });
  it('devolve unlockUntil e lockEnabled', () => {
    const s = computeLockState({ lockEnabled: true, unlockUntil: '2026-09-02T12:10:00.000Z', now });
    expect(s).toEqual({ locked: false, unlockUntil: '2026-09-02T12:10:00.000Z', lockEnabled: true });
  });
});
```

Run: `npm run test --workspace=backend -- kioskLock` → FAIL.

- [ ] **Step 2: Implementação**

Create `backend/src/domain/kioskLock.ts`:

```ts
import { KioskLockState } from '@shared/types/doorbell';

export function computeLockState(input: {
  lockEnabled: boolean;
  unlockUntil: string | null;
  now?: Date;
}): KioskLockState {
  const now = input.now ?? new Date();
  let locked = input.lockEnabled;
  if (locked && input.unlockUntil) {
    locked = now.getTime() >= new Date(input.unlockUntil).getTime();
  }
  return { locked, unlockUntil: input.unlockUntil, lockEnabled: input.lockEnabled };
}
```

- [ ] **Step 3: Rodar → PASS; commit**

Run: `npm run test --workspace=backend -- kioskLock` → PASS

```bash
git add backend/src/domain/kioskLock.ts backend/test/kioskLock.test.ts
git commit -m "feat: domínio computeLockState do modo kiosk"
```

---

## Task 14: KioskController + rotas + push por WebSocket

**Files:**
- Create: `backend/src/controllers/KioskController.ts`
- Create: `backend/src/routes/kiosk.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/services/CallSignalingService.ts` (exportar `sendToDevice`)
- Create: `backend/test/kioskRoutes.test.ts`

**Interfaces:**
- Consumes: `DoorbellRepository`, `computeLockState`, `auth`.
- Produces (HTTP):
  - `GET /api/kiosk/:doorbellId/lock` → `{ data: KioskLockState }` (sem auth).
  - `POST /api/kiosk/:doorbellId/unlock` (auth) body `{ minutes?: number }` (default 15, clamp 1..240) → `{ data: KioskLockState }`, e `sendToDevice('kiosk:<id>', { type: 'kiosk-lock', ...state })`.
  - `POST /api/kiosk/:doorbellId/lock` (auth) → limpa `unlock_until`; push.
  - `PATCH /api/kiosk/:doorbellId/lock-enabled` (auth) body `{ enabled: boolean }` → push.
- `CallSignalingService.ts` novo export: `export function sendToDevice(deviceId: string, payload: object): boolean`.

- [ ] **Step 1: Testes (falham)**

Create `backend/test/kioskRoutes.test.ts` (mesmo padrão de servidor efêmero da Task 3):

```ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'http';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';

let server: http.Server; let base: string;
async function start() {
  process.env.API_TOKEN = 'test-token';
  const app = express(); app.use(express.json()); setupRoutes(app);
  await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; r(); }); });
}
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };

describe('/api/kiosk', () => {
  beforeEach(async () => { await initTestDb(); server?.close(); await start(); });
  afterAll(() => { server?.close(); closeTestDb(); });

  it('GET lock: por padrão travado', async () => {
    const b = await (await fetch(`${base}/api/kiosk/1/lock`)).json();
    expect(b.data).toMatchObject({ locked: true, lockEnabled: true, unlockUntil: null });
  });

  it('POST unlock destrava por N minutos', async () => {
    const b = await (await fetch(`${base}/api/kiosk/1/unlock`, { method: 'POST', headers: H, body: JSON.stringify({ minutes: 15 }) })).json();
    expect(b.data.locked).toBe(false);
    expect(new Date(b.data.unlockUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it('POST lock retrava (limpa unlockUntil)', async () => {
    await fetch(`${base}/api/kiosk/1/unlock`, { method: 'POST', headers: H, body: JSON.stringify({ minutes: 15 }) });
    const b = await (await fetch(`${base}/api/kiosk/1/lock`, { method: 'POST', headers: H })).json();
    expect(b.data).toMatchObject({ locked: true, unlockUntil: null });
  });

  it('PATCH lock-enabled=false → nunca travado', async () => {
    const b = await (await fetch(`${base}/api/kiosk/1/lock-enabled`, { method: 'PATCH', headers: H, body: JSON.stringify({ enabled: false }) })).json();
    expect(b.data).toMatchObject({ locked: false, lockEnabled: false });
  });

  it('unlock sem auth → 401', async () => {
    const r = await fetch(`${base}/api/kiosk/1/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(401);
  });
});
```

Run: `npm run test --workspace=backend -- kioskRoutes` → FAIL.

- [ ] **Step 2: `sendToDevice` no signaling**

Em `backend/src/services/CallSignalingService.ts`, adicionar (usa o `Map devices` do módulo):

```ts
export function sendToDevice(deviceId: string, payload: object): boolean {
  const target = devices.get(deviceId);
  if (target && target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}
```

- [ ] **Step 3: Controller**

Create `backend/src/controllers/KioskController.ts`:

```ts
import { Request, Response } from 'express';
import { DoorbellRepository } from '../database/repositories/DoorbellRepository';
import { computeLockState } from '../domain/kioskLock';
import { sendToDevice } from '../services/CallSignalingService';
import { ApiResponse } from '@shared/types/api';

export class KioskController {
  private repo = new DoorbellRepository();

  private stateFor(id: number) {
    const d = this.repo.findById(id);
    if (!d) return null;
    return computeLockState({ lockEnabled: d.lock_enabled, unlockUntil: d.unlock_until });
  }

  private pushAndRespond(id: number, res: Response) {
    const state = this.stateFor(id);
    if (!state) {
      res.status(404).json({ success: false, error: 'Campainha não encontrada' } as ApiResponse);
      return;
    }
    sendToDevice(`kiosk:${id}`, { type: 'kiosk-lock', ...state });
    res.json({ success: true, data: state } as ApiResponse);
  }

  getLock = (req: Request, res: Response): void => {
    const state = this.stateFor(Number(req.params.doorbellId));
    if (!state) {
      res.status(404).json({ success: false, error: 'Campainha não encontrada' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: state } as ApiResponse);
  };

  unlock = (req: Request, res: Response): void => {
    const id = Number(req.params.doorbellId);
    const minutes = Math.min(240, Math.max(1, Number(req.body?.minutes) || 15));
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    this.repo.setUnlockUntil(id, until);
    this.pushAndRespond(id, res);
  };

  lock = (req: Request, res: Response): void => {
    const id = Number(req.params.doorbellId);
    this.repo.setUnlockUntil(id, null);
    this.pushAndRespond(id, res);
  };

  setLockEnabled = (req: Request, res: Response): void => {
    const id = Number(req.params.doorbellId);
    this.repo.setLockEnabled(id, Boolean(req.body?.enabled));
    if (!req.body?.enabled) this.repo.setUnlockUntil(id, null);
    this.pushAndRespond(id, res);
  };
}
```

- [ ] **Step 4: Rotas + registro**

Create `backend/src/routes/kiosk.ts`:

```ts
import { Router } from 'express';
import { KioskController } from '../controllers/KioskController';
import { auth } from '../middleware/auth';

export function createKioskRouter(): Router {
  const router = Router();
  const c = new KioskController();
  router.get('/:doorbellId/lock', c.getLock);
  router.post('/:doorbellId/unlock', auth, c.unlock);
  router.post('/:doorbellId/lock', auth, c.lock);
  router.patch('/:doorbellId/lock-enabled', auth, c.setLockEnabled);
  return router;
}
```

Em `backend/src/routes/index.ts`: `import { createKioskRouter } from './kiosk';` + `apiRouter.use('/kiosk', createKioskRouter());`.

- [ ] **Step 5: Rodar → PASS; type-check; commit**

Run: `npm run test --workspace=backend -- kioskRoutes` → PASS
Run: `npm run type-check`

```bash
git add backend/src/controllers/KioskController.ts backend/src/routes/kiosk.ts backend/src/routes/index.ts backend/src/services/CallSignalingService.ts backend/test/kioskRoutes.test.ts
git commit -m "feat: /api/kiosk (estado de lock + push por WebSocket)"
```

---

## Task 15: apiService de kiosk + bloco de kiosk na aba Campainhas

**Files:**
- Modify: `frontend/src/services/apiService.ts`
- Modify: `frontend/src/pages/admin/AdminDoorbellsTab.tsx`

**Interfaces:**
- Produces em `apiService`:
  `getKioskLock(doorbellId): Promise<KioskLockState>`,
  `unlockKiosk(doorbellId, minutes): Promise<KioskLockState>`,
  `lockKiosk(doorbellId): Promise<KioskLockState>`,
  `setKioskLockEnabled(doorbellId, enabled): Promise<KioskLockState>`.

- [ ] **Step 1: apiService**

Em `frontend/src/services/apiService.ts` adicionar:

```ts
  // Kiosk lock
  async getKioskLock(doorbellId: number): Promise<import('@shared/types/doorbell').KioskLockState> {
    return this.request(`/kiosk/${doorbellId}/lock`);
  }
  async unlockKiosk(doorbellId: number, minutes: number): Promise<import('@shared/types/doorbell').KioskLockState> {
    return this.request(`/kiosk/${doorbellId}/unlock`, {
      method: 'POST', body: JSON.stringify({ minutes }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
  async lockKiosk(doorbellId: number): Promise<import('@shared/types/doorbell').KioskLockState> {
    return this.request(`/kiosk/${doorbellId}/lock`, {
      method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
  async setKioskLockEnabled(doorbellId: number, enabled: boolean): Promise<import('@shared/types/doorbell').KioskLockState> {
    return this.request(`/kiosk/${doorbellId}/lock-enabled`, {
      method: 'PATCH', body: JSON.stringify({ enabled }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
```

- [ ] **Step 2: bloco de kiosk no card da campainha**

Em `AdminDoorbellsTab.tsx`, substituir o comentário `{/* bloco de modo kiosk — Task 15 */}` por um subcomponente `<KioskBlock doorbellId={d.id} showToast={showToast} />` e adicionar no mesmo arquivo:

```tsx
import type { KioskLockState } from '@shared/types/doorbell';

function KioskBlock({ doorbellId, showToast }: { doorbellId: number; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [state, setState] = useState<KioskLockState | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [remaining, setRemaining] = useState<number>(0);

  async function refresh() {
    try { setState(await apiService.getKioskLock(doorbellId)); } catch { /* silencioso */ }
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [doorbellId]);

  useEffect(() => {
    if (!state?.unlockUntil) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, new Date(state.unlockUntil!).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [state?.unlockUntil]);

  const mmss = () => {
    const s = Math.floor(remaining / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  async function doUnlock() {
    try { setState(await apiService.unlockKiosk(doorbellId, minutes)); showToast(`Desbloqueado por ${minutes} min`); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }
  async function doLock() {
    try { setState(await apiService.lockKiosk(doorbellId)); showToast('Retravado'); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }
  async function toggleEnabled() {
    if (!state) return;
    try { setState(await apiService.setKioskLockEnabled(doorbellId, !state.lockEnabled)); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }

  if (!state) return null;
  const statusText = !state.lockEnabled ? '⚪ Modo kiosk desligado'
    : state.locked ? '🔒 Travado'
    : `🔓 Destravado${remaining > 0 ? ` (${mmss()})` : ''}`;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={state.lockEnabled} onChange={toggleEnabled} />
        Modo kiosk (reabre sozinho ao fechar)
      </label>
      <div style={{ margin: '6px 0', fontWeight: 600 }}>{statusText}</div>
      {state.lockEnabled && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ padding: 6 }}>
            {[5, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <button className="admin-btn" onClick={doUnlock}>Desbloquear</button>
          <button className="admin-btn admin-btn-danger" onClick={doLock}>Retravar agora</button>
        </div>
      )}
    </div>
  );
}
```

Adicionar `KioskBlock` na lista de exports internos (não precisa exportar). Referência no card: `<KioskBlock doorbellId={d.id} showToast={showToast} />`.

- [ ] **Step 3: Verificação manual**

`npm run dev` → `/admin/residents` → **Campainhas**. Cada campainha mostra "🔒 Travado". "Desbloquear" (15 min) → "🔓 Destravado (14:59...)" com contagem regressiva; "Retravar agora" → volta a "Travado". Desmarcar "Modo kiosk" → "⚪ Modo kiosk desligado".

- [ ] **Step 4: type-check + commit**

```bash
git add frontend/src/services/apiService.ts frontend/src/pages/admin/AdminDoorbellsTab.tsx
git commit -m "feat: controles de modo kiosk na aba Campainhas"
```

---

## Task 16: Android — dependência OkHttp + KioskLockClient (poll + WS)

**Files:**
- Modify: `android-app/app/build.gradle.kts`
- Create: `android-app/app/src/main/java/com/campainha/kiosk/KioskLockClient.kt`
- Modify: `android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt`

**Interfaces:**
- Produces:
  ```kotlin
  class KioskLockClient(
      private val baseUrl: String,       // ex: http://localhost:3000
      private val doorbellId: Int,
      private val onLockChange: (locked: Boolean) -> Unit,
  ) {
      fun start()
      fun stop()
      fun currentLocked(): Boolean       // último conhecido (com fallback local do PIN)
      fun setLocalUnlockUntil(epochMs: Long)
  }
  ```
- Regra do `locked` no cliente:
  `serverLocked && System.currentTimeMillis() >= max(serverUnlockUntilMs, localUnlockUntilMs)`.

- [ ] **Step 1: Dependências**

Em `android-app/app/build.gradle.kts`, bloco `dependencies`:

```kotlin
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")
```

(`org.json` já existe no Android SDK; a dep explícita só ajuda testes unitários — pode ser omitida se causar conflito. OkHttp cobre HTTP e WebSocket.)

- [ ] **Step 2: KioskLockClient**

Create `android-app/app/src/main/java/com/campainha/kiosk/KioskLockClient.kt`:

```kotlin
package com.campainha.kiosk

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class KioskLockClient(
    private val baseUrl: String,
    private val doorbellId: Int,
    private val onLockChange: (locked: Boolean) -> Unit,
) {
    private val http = OkHttpClient()
    private var ws: WebSocket? = null
    private var poller: ScheduledExecutorService? = null

    @Volatile private var serverLocked = true
    @Volatile private var serverUnlockUntilMs = 0L
    @Volatile private var localUnlockUntilMs = 0L
    @Volatile private var lastReported: Boolean? = null

    fun start() {
        poller = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "kiosk-lock-poll") }
        poller?.scheduleWithFixedDelay({ pollOnce() }, 0, 10, TimeUnit.SECONDS)
        connectWs()
    }

    fun stop() {
        poller?.shutdownNow(); poller = null
        ws?.close(1000, null); ws = null
    }

    fun currentLocked(): Boolean = compute()

    fun setLocalUnlockUntil(epochMs: Long) {
        localUnlockUntilMs = epochMs
        emitIfChanged()
    }

    private fun compute(): Boolean {
        val gate = maxOf(serverUnlockUntilMs, localUnlockUntilMs)
        return serverLocked && System.currentTimeMillis() >= gate
    }

    private fun emitIfChanged() {
        val now = compute()
        if (lastReported != now) {
            lastReported = now
            onLockChange(now)
        }
    }

    private fun pollOnce() {
        try {
            val req = Request.Builder().url("$baseUrl/api/kiosk/$doorbellId/lock").build()
            http.newCall(req).execute().use { resp: Response ->
                val body = resp.body?.string() ?: return
                val data = JSONObject(body).optJSONObject("data") ?: return
                applyState(data)
            }
        } catch (_: Exception) {
            // offline: mantém último estado; o gate local ainda vale
            emitIfChanged()
        }
    }

    private fun applyState(data: JSONObject) {
        serverLocked = data.optBoolean("locked", true) ||
            (data.optBoolean("lockEnabled", true) && data.isNull("unlockUntil"))
        // 'locked' já é a verdade calculada no servidor; usamos direto:
        serverLocked = data.optBoolean("locked", true)
        val until = if (data.isNull("unlockUntil")) null else data.optString("unlockUntil", null)
        serverUnlockUntilMs = parseIso(until)
        emitIfChanged()
    }

    private fun parseIso(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        return try {
            java.time.Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) { 0L }
    }

    private fun connectWs() {
        val wsUrl = baseUrl.replaceFirst("http", "ws") + "/ws/calls?deviceId=kiosk:$doorbellId&role=kiosk&label=Campainha"
        val req = Request.Builder().url(wsUrl).build()
        ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    if (msg.optString("type") == "kiosk-lock") {
                        serverLocked = msg.optBoolean("locked", true)
                        val until = if (msg.isNull("unlockUntil")) null else msg.optString("unlockUntil", null)
                        serverUnlockUntilMs = parseIso(until)
                        emitIfChanged()
                    }
                } catch (_: Exception) {}
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // reconecta em 5s
                poller?.schedule({ connectWs() }, 5, TimeUnit.SECONDS)
            }
        })
    }
}
```

> Nota: `applyState` tem uma linha redundante — manter apenas
> `serverLocked = data.optBoolean("locked", true)`. O servidor já entrega
> `locked` calculado; o cliente só reavalia o gate local por cima.

- [ ] **Step 3: Plugar no MainActivity (sem efeitos ainda)**

Em `MainActivity.kt`:
- campo `private var lockClient: KioskLockClient? = null`
- campo `@Volatile private var locked: Boolean = true`
- em `onCreate`, após `webView.loadUrl(...)`:

```kotlin
val host = currentUrl().removeSuffix("/")
lockClient = KioskLockClient(host, currentDoorbellId()) { isLocked ->
    runOnUiThread { onLockStateChanged(isLocked) }
}
lockClient?.start()
```

- adicionar método stub:

```kotlin
private fun onLockStateChanged(isLocked: Boolean) {
    locked = isLocked
    // Task 17: aplicar/retirar watchdog + lock task
}
```

- em `onDestroy`: `lockClient?.stop()`.

- [ ] **Step 4: Build**

Run: `cd android-app && ./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL. (Sem ambiente Android → verificação manual pendente.)

- [ ] **Step 5: Commit**

```bash
git add android-app/app/build.gradle.kts android-app/app/src/main/java/com/campainha/kiosk/KioskLockClient.kt android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt
git commit -m "feat(android): KioskLockClient (poll REST + push WebSocket do estado de lock)"
```

---

## Task 17: Android — watchdog de relançamento + gate do botão voltar

**Files:**
- Create: `android-app/app/src/main/java/com/campainha/kiosk/KioskWatchdogService.kt`
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt`
- Modify: `android-app/app/src/main/java/com/campainha/kiosk/BootReceiver.kt`

**Interfaces:**
- `KioskWatchdogService`: foreground service com notificação fixa; ações
  `ACTION_START` / `ACTION_STOP`. Enquanto rodando e `MainActivity` reportar
  `onStop`, reabre `MainActivity` após ~700ms.
- `MainActivity` expõe (estático) `var foreground: Boolean` e um método
  `relaunchSelf(context)`.

- [ ] **Step 1: Manifest**

Em `AndroidManifest.xml`:
- permissões:
  ```xml
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  ```
- `activity`: `android:launchMode="singleInstance"` (trocar de `singleTask`).
- dentro de `<application>`:
  ```xml
  <service
      android:name=".KioskWatchdogService"
      android:exported="false"
      android:foregroundServiceType="specialUse">
      <property
          android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
          android:value="Kiosk doorbell always-on" />
  </service>
  ```

- [ ] **Step 2: Service**

Create `android-app/app/src/main/java/com/campainha/kiosk/KioskWatchdogService.kt`:

```kotlin
package com.campainha.kiosk

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

class KioskWatchdogService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var running = false

    private val tick = object : Runnable {
        override fun run() {
            if (!running) return
            if (!MainActivity.foreground) {
                MainActivity.relaunchSelf(applicationContext)
            }
            handler.postDelayed(this, 700)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
        }
        startForeground(NOTIF_ID, buildNotification())
        if (!running) { running = true; handler.post(tick) }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val channelId = "kiosk_watchdog"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(channelId, "Campainha ativa", NotificationManager.IMPORTANCE_LOW)
            )
        }
        return Notification.Builder(this, channelId)
            .setContentTitle("Campainha ativa")
            .setContentText("O modo campainha está ligado neste aparelho.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val NOTIF_ID = 4711
        const val ACTION_START = "com.campainha.kiosk.WATCHDOG_START"
        const val ACTION_STOP = "com.campainha.kiosk.WATCHDOG_STOP"

        fun start(ctx: Context) {
            val i = Intent(ctx, KioskWatchdogService::class.java).setAction(ACTION_START)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
        }
        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, KioskWatchdogService::class.java).setAction(ACTION_STOP))
        }
    }
}
```

- [ ] **Step 3: MainActivity — lifecycle + relaunch + gate**

Em `MainActivity.kt`:
- `companion object`: adicionar
  ```kotlin
  @Volatile @JvmStatic var foreground: Boolean = false
  @JvmStatic fun relaunchSelf(context: Context) {
      val i = Intent(context, MainActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      context.startActivity(i)
  }
  ```
  (importar `android.content.Context`, `android.content.Intent`.)
- sobrescrever:
  ```kotlin
  override fun onStart() { super.onStart(); foreground = true }
  override fun onStop() { super.onStop(); foreground = false }
  override fun onUserLeaveHint() {
      super.onUserLeaveHint()
      if (locked) relaunchSelf(applicationContext)
  }
  ```
- `onBackPressed`: trocar por
  ```kotlin
  override fun onBackPressed() {
      if (!locked) super.onBackPressed()
      // travado: consome
  }
  ```
- implementar `onLockStateChanged`:
  ```kotlin
  private fun onLockStateChanged(isLocked: Boolean) {
      locked = isLocked
      if (isLocked) {
          KioskWatchdogService.start(applicationContext)
          tryStartLockTask() // Task 18
      } else {
          KioskWatchdogService.stop(applicationContext)
          tryStopLockTask()  // Task 18
      }
  }
  ```
  (adicionar stubs `private fun tryStartLockTask() {}` e `private fun tryStopLockTask() {}` — preenchidos na Task 18.)

- [ ] **Step 4: BootReceiver**

Em `BootReceiver.kt`, após `context.startActivity(launchIntent)`:

```kotlin
KioskWatchdogService.start(context)
```

(O serviço só relança se `MainActivity.foreground` for falso; ao abrir de fato,
vira `true` e o watchdog fica ocioso. Se o lock estiver desligado, a Task 16
vai chamar `onLockStateChanged(false)` no próximo poll e parar o serviço.)

- [ ] **Step 5: Build + verificação manual**

Run: `cd android-app && ./gradlew :app:assembleDebug` → BUILD SUCCESSFUL.
Manual (aparelho real): com "Modo kiosk" ligado e travado, apertar Home → o app volta em ~1s. Desbloquear pelo admin → Home passa a funcionar e "Sair do app" fecha (Task 19). Religar trava → volta a reabrir.

- [ ] **Step 6: Commit**

```bash
git add android-app/app/src/main/java/com/campainha/kiosk/KioskWatchdogService.kt android-app/app/src/main/AndroidManifest.xml android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt android-app/app/src/main/java/com/campainha/kiosk/BootReceiver.kt
git commit -m "feat(android): watchdog de relançamento + gate do voltar por estado de lock"
```

---

## Task 18: Android — Device Owner / Lock Task (camada opcional) + docs

**Files:**
- Create: `android-app/app/src/main/java/com/campainha/kiosk/DeviceAdminReceiver.kt`
- Create: `android-app/app/src/main/res/xml/device_admin.xml`
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt`
- Modify: `docs/ANDROID_CONFIG.md`

**Interfaces:**
- `tryStartLockTask()` / `tryStopLockTask()` no `MainActivity`: só agem se
  `dpm.isDeviceOwnerApp(packageName)`. Silenciosos caso contrário.

- [ ] **Step 1: Receiver + policy xml**

Create `android-app/app/src/main/java/com/campainha/kiosk/DeviceAdminReceiver.kt`:

```kotlin
package com.campainha.kiosk

import android.app.admin.DeviceAdminReceiver

class DeviceAdminReceiver : DeviceAdminReceiver()
```

Create `android-app/app/src/main/res/xml/device_admin.xml`:

```xml
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <force-lock />
    </uses-policies>
</device-admin>
```

- [ ] **Step 2: Manifest**

Dentro de `<application>`:

```xml
<receiver
    android:name=".DeviceAdminReceiver"
    android:permission="android.permission.BIND_DEVICE_ADMIN"
    android:exported="true">
    <meta-data
        android:name="android.app.device_admin"
        android:resource="@xml/device_admin" />
    <intent-filter>
        <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
    </intent-filter>
</receiver>
```

- [ ] **Step 3: Lock Task no MainActivity**

Substituir os stubs:

```kotlin
private fun dpm() = getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager

private fun tryStartLockTask() {
    try {
        val dpm = dpm()
        if (dpm.isDeviceOwnerApp(packageName)) {
            val admin = android.content.ComponentName(this, DeviceAdminReceiver::class.java)
            dpm.setLockTaskPackages(admin, arrayOf(packageName))
            if (android.os.Build.VERSION.SDK_INT >= 23 &&
                android.app.ActivityManager::class.java != null) {
                startLockTask()
            }
        }
    } catch (_: Exception) { /* sem device owner: só o watchdog atua */ }
}

private fun tryStopLockTask() {
    try {
        val am = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        if (am.lockTaskModeState != android.app.ActivityManager.LOCK_TASK_MODE_NONE) {
            stopLockTask()
        }
    } catch (_: Exception) {}
}
```

Chamar `tryStartLockTask()` também ao fim de `onCreate` se `locked` (o
`KioskLockClient` ainda pode não ter respondido; tudo bem, `onLockStateChanged`
re-chama).

- [ ] **Step 4: Docs**

Em `docs/ANDROID_CONFIG.md`, seção nova "Modo kiosk reforçado (opcional, sem root)":

```
1. No aparelho da campainha: remova todas as contas Google (Config > Contas).
2. Ative Depuração USB e conecte no PC.
3. Instale o app (adb install app-debug.apk).
4. Rode:
   adb shell dpm set-device-owner com.campainha.kiosk/.DeviceAdminReceiver
5. Pronto: com "Modo kiosk" ligado no painel, o app trava em Lock Task
   (Home e Recentes bloqueados). Sem esse passo, o app ainda usa o
   watchdog de relançamento, mas o botão Home não é bloqueável.
Para reverter: adb shell dpm remove-active-admin com.campainha.kiosk/.DeviceAdminReceiver
```

- [ ] **Step 5: Build + commit**

Run: `cd android-app && ./gradlew :app:assembleDebug` → BUILD SUCCESSFUL.

```bash
git add android-app/app/src/main/java/com/campainha/kiosk/DeviceAdminReceiver.kt android-app/app/src/main/res/xml/device_admin.xml android-app/app/src/main/AndroidManifest.xml android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt docs/ANDROID_CONFIG.md
git commit -m "feat(android): Lock Task via Device Owner (camada opcional) + docs"
```

---

## Task 19: Android — desbloqueio local por PIN (15 min) + gate do "Sair do app"

**Files:**
- Modify: `android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt`

- [ ] **Step 1: pref + menu**

Em `MainActivity.kt`:
- `companion object`: `private const val KEY_LOCAL_UNLOCK = "local_unlock_until"`.
- No `showAdminMenu()` `when`, preencher os stubs:

```kotlin
4 -> {
    val until = System.currentTimeMillis() + 15 * 60_000L
    prefs.edit().putLong(KEY_LOCAL_UNLOCK, until).apply()
    lockClient?.setLocalUnlockUntil(until)
}
5 -> {
    if (!locked) finishAffinity()
    else AlertDialog.Builder(this)
        .setMessage("O modo kiosk está travado. Desbloqueie pelo painel ou use \"Desbloquear 15 min\".")
        .setPositiveButton("OK", null).show()
}
```

- Em `onCreate`, ao criar o `KioskLockClient`, aplicar o unlock local salvo:

```kotlin
val savedLocal = prefs.getLong(KEY_LOCAL_UNLOCK, 0L)
if (savedLocal > System.currentTimeMillis()) lockClient?.setLocalUnlockUntil(savedLocal)
```

- [ ] **Step 2: Build + verificação manual**

Run: `cd android-app && ./gradlew :app:assembleDebug` → BUILD SUCCESSFUL.
Manual: com backend **offline** e modo kiosk travado, 5 toques → PIN → "Desbloquear 15 min" → em ~1s o watchdog para e "Sair do app" fecha o app. Após 15 min (ou reabrir), volta a travar.

- [ ] **Step 3: Commit**

```bash
git add android-app/app/src/main/java/com/campainha/kiosk/MainActivity.kt
git commit -m "feat(android): desbloqueio local por PIN (15 min) offline + gate do Sair"
```

---

# PHASE 4 — Aba de visitantes (Pessoas + Linha do tempo)

## Task 20: Migration 010 + VisitsRepository

**Files:**
- Modify: `backend/src/database/migrations.ts`
- Create: `backend/src/database/repositories/VisitsRepository.ts`
- Create: `shared/types/visit.ts`
- Create: `backend/test/visitsRepository.test.ts`

**Interfaces:**
- Produces:
  - `shared/types/visit.ts`:
    ```ts
    export interface Visit {
      id: number;
      visitor_id: number | null;
      descriptor: number[] | null;
      photo_path: string | null;
      event_id: number | null;
      doorbell_id: number | null;
      name_snapshot: string | null;
      created_at: string;
    }
    export interface CreateVisitDTO {
      visitor_id?: number | null;
      descriptor?: number[] | null;
      photo_path?: string | null;
      event_id?: number | null;
      doorbell_id?: number | null;
      name_snapshot?: string | null;
    }
    ```
  - `VisitsRepository`:
    `create(dto: CreateVisitDTO): Visit`,
    `listTimeline(page: number, pageSize: number, doorbellId?: number): { items: Visit[]; total: number }`,
    `listByVisitor(visitorId: number): Visit[]`,
    `attachVisitor(visitId: number, visitorId: number, name: string): void`,
    `findById(id: number): Visit | null`.

- [ ] **Step 1: Testes (falham)**

Create `backend/test/visitsRepository.test.ts`:

```ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';

describe('VisitsRepository', () => {
  let repo: VisitsRepository;
  beforeEach(async () => { await initTestDb(); repo = new VisitsRepository(); });
  afterAll(() => closeTestDb());

  it('cria e lê por id', () => {
    const v = repo.create({ photo_path: 'a.jpg', doorbell_id: 1, name_snapshot: 'Desconhecido' });
    expect(repo.findById(v.id)?.photo_path).toBe('a.jpg');
    expect(repo.findById(v.id)?.visitor_id).toBeNull();
  });

  it('timeline paginada, mais recente primeiro', () => {
    for (let i = 0; i < 5; i++) repo.create({ doorbell_id: 1, name_snapshot: `v${i}` });
    const p1 = repo.listTimeline(1, 2);
    expect(p1.total).toBe(5);
    expect(p1.items).toHaveLength(2);
    expect(p1.items[0].id).toBeGreaterThan(p1.items[1].id);
  });

  it('filtra por doorbell', () => {
    repo.create({ doorbell_id: 1 }); repo.create({ doorbell_id: 2 });
    expect(repo.listTimeline(1, 10, 2).total).toBe(1);
  });

  it('listByVisitor', () => {
    repo.create({ visitor_id: 7, doorbell_id: 1 });
    repo.create({ visitor_id: 7, doorbell_id: 1 });
    repo.create({ visitor_id: 8, doorbell_id: 1 });
    expect(repo.listByVisitor(7)).toHaveLength(2);
  });

  it('attachVisitor vincula e grava o nome', () => {
    const v = repo.create({ doorbell_id: 1 });
    repo.attachVisitor(v.id, 3, 'João');
    const got = repo.findById(v.id)!;
    expect(got.visitor_id).toBe(3);
    expect(got.name_snapshot).toBe('João');
  });

  it('descriptor round-trips como array', () => {
    const v = repo.create({ descriptor: [0.1, 0.2], doorbell_id: 1 });
    expect(repo.findById(v.id)?.descriptor).toEqual([0.1, 0.2]);
  });
});
```

Run: `npm run test --workspace=backend -- visitsRepository` → FAIL.

- [ ] **Step 2: Migration 010**

Ao final do array `migrations` em `backend/src/database/migrations.ts`:

```ts
    ,{
      name: '010_create_visits_table',
      sql: `
        CREATE TABLE IF NOT EXISTS visits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          visitor_id INTEGER,
          descriptor TEXT,
          photo_path TEXT,
          event_id INTEGER,
          doorbell_id INTEGER,
          name_snapshot TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id);
        CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
        CREATE INDEX IF NOT EXISTS idx_visits_doorbell_id ON visits(doorbell_id);
      `
    }
```

- [ ] **Step 3: Repositório**

Create `backend/src/database/repositories/VisitsRepository.ts`:

```ts
import { Database } from '../index';
import { Visit, CreateVisitDTO } from '@shared/types/visit';

export class VisitsRepository {
  private db;
  constructor() { this.db = Database.getInstance().getDb(); }

  create(dto: CreateVisitDTO): Visit {
    this.db.run(
      `INSERT INTO visits (visitor_id, descriptor, photo_path, event_id, doorbell_id, name_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dto.visitor_id ?? null,
        dto.descriptor ? JSON.stringify(dto.descriptor) : null,
        dto.photo_path ?? null,
        dto.event_id ?? null,
        dto.doorbell_id ?? null,
        dto.name_snapshot ?? null,
      ],
    );
    const id = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    Database.getInstance().save();
    return this.findById(id)!;
  }

  findById(id: number): Visit | null {
    const r = this.db.exec('SELECT * FROM visits WHERE id = ?', [id]);
    if (!r || r.length === 0 || r[0].values.length === 0) return null;
    return this.map(r[0], 0);
  }

  listTimeline(page: number, pageSize: number, doorbellId?: number): { items: Visit[]; total: number } {
    const where = doorbellId ? 'WHERE doorbell_id = ?' : '';
    const args = doorbellId ? [doorbellId] : [];
    const totalRes = this.db.exec(`SELECT COUNT(*) FROM visits ${where}`, args);
    const total = (totalRes[0]?.values[0][0] as number) ?? 0;
    const offset = (Math.max(1, page) - 1) * pageSize;
    const res = this.db.exec(
      `SELECT * FROM visits ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );
    const items = res[0] ? res[0].values.map((_: unknown, i: number) => this.map(res[0], i)) : [];
    return { items, total };
  }

  listByVisitor(visitorId: number): Visit[] {
    const res = this.db.exec('SELECT * FROM visits WHERE visitor_id = ? ORDER BY id DESC', [visitorId]);
    return res[0] ? res[0].values.map((_: unknown, i: number) => this.map(res[0], i)) : [];
  }

  attachVisitor(visitId: number, visitorId: number, name: string): void {
    this.db.run('UPDATE visits SET visitor_id = ?, name_snapshot = ? WHERE id = ?', [visitorId, name, visitId]);
    Database.getInstance().save();
  }

  private map(result: any, index: number): Visit {
    const columns: string[] = result.columns;
    const values = result.values[index];
    const row: any = {};
    columns.forEach((c, i) => (row[c] = values[i]));
    return {
      id: row.id,
      visitor_id: row.visitor_id ?? null,
      descriptor: row.descriptor ? JSON.parse(row.descriptor) : null,
      photo_path: row.photo_path ?? null,
      event_id: row.event_id ?? null,
      doorbell_id: row.doorbell_id ?? null,
      name_snapshot: row.name_snapshot ?? null,
      created_at: row.created_at,
    };
  }
}
```

- [ ] **Step 4: shared type**

Create `shared/types/visit.ts` com o bloco "Produces".

- [ ] **Step 5: Rodar → PASS; type-check; commit**

Run: `npm run test --workspace=backend -- visitsRepository` → PASS
Run: `npm run type-check`

```bash
git add backend/src/database/migrations.ts backend/src/database/repositories/VisitsRepository.ts shared/types/visit.ts backend/test/visitsRepository.test.ts
git commit -m "feat: tabela visits + VisitsRepository"
```

---

## Task 21: Gravar visita no reconhecimento + still do não identificado

**Files:**
- Modify: `backend/src/controllers/VisitorFaceController.ts`
- Modify: `backend/src/controllers/VisitorController.ts`
- Modify: `frontend/src/pages/StandbyPage.tsx` (enviar `photoBase64` no não identificado)
- Create: `backend/test/visitRecording.test.ts`

**Interfaces:**
- Consumes: `VisitsRepository`, `VisitorRepository`.
- `POST /api/visitors/recognize` passa a aceitar `doorbellId` no body e, ao dar match, insere uma `visits` (`visitor_id`, `descriptor` do match se disponível, `name_snapshot = visitor.name`, `doorbell_id`).
- `POST /api/visitors/unrecognized` passa a aceitar `photoBase64` e `doorbellId`; grava o still em `PHOTOS_PATH` e insere `visits` sem `visitor_id` (`photo_path`, `event_id`, `doorbell_id`, `name_snapshot = 'Desconhecido'`).

- [ ] **Step 1: Testes (falham)**

Create `backend/test/visitRecording.test.ts`:

```ts
import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';

let server: http.Server; let base: string;
async function start() {
  process.env.API_TOKEN = 'test-token';
  process.env.PHOTOS_PATH = require('os').tmpdir();
  process.env.VIDEOS_PATH = require('os').tmpdir();
  const app = express(); app.use(express.json({ limit: '10mb' })); setupRoutes(app);
  await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; r(); }); });
}
const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('gravação de visita', () => {
  beforeEach(async () => { await initTestDb(); server?.close(); await start(); });
  afterAll(() => { server?.close(); closeTestDb(); });

  it('unrecognized grava visita sem visitor_id e com foto', async () => {
    const res = await fetch(`${base}/api/visitors/unrecognized`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoBase64: PNG_1x1, photoBase64: PNG_1x1, doorbellId: 1 }),
    });
    expect(res.status).toBe(201);
    const visits = new VisitsRepository().listTimeline(1, 10);
    expect(visits.total).toBe(1);
    expect(visits.items[0]).toMatchObject({ visitor_id: null, doorbell_id: 1, name_snapshot: 'Desconhecido' });
    expect(visits.items[0].photo_path).toBeTruthy();
  });
});
```

> O teste de `recognize` depende de `face-api` (não instalado em todo host).
> Cobrir só o caminho `unrecognized` de forma determinística.

Run: `npm run test --workspace=backend -- visitRecording` → FAIL.

- [ ] **Step 2: VisitorController.recordUnrecognized**

Reescrever o método para também salvar foto e visita:

```ts
import { VisitsRepository } from '../database/repositories/VisitsRepository';
// no constructor: this.visitsRepo = new VisitsRepository();

async recordUnrecognized(req: Request, res: Response): Promise<void> {
  try {
    const { videoBase64, photoBase64, doorbellId } = req.body;
    if (!videoBase64) {
      res.status(400).json({ success: false, error: 'videoBase64 is required' } as ApiResponse);
      return;
    }
    const videosPath = process.env.VIDEOS_PATH || './data/storage/videos';
    const videoFile = `${Date.now()}-${crypto.randomUUID()}.webm`;
    fs.writeFileSync(path.join(videosPath, videoFile), base64ToBuffer(videoBase64));

    let photoFile: string | null = null;
    if (photoBase64 && typeof photoBase64 === 'string') {
      const photosPath = process.env.PHOTOS_PATH || './data/storage/photos';
      photoFile = `visit-${Date.now()}-${crypto.randomUUID()}.jpg`;
      fs.writeFileSync(path.join(photosPath, photoFile), base64ToBuffer(photoBase64));
    }

    const dbId = Number(doorbellId) || undefined;
    const event = this.eventRepo.create({
      type: EventType.PERSON_DETECTED,
      metadata: { recognized: false, videoFile, ...(photoFile ? { photoFile } : {}), ...(dbId ? { doorbellId: dbId } : {}) },
    });

    this.visitsRepo.create({
      visitor_id: null,
      photo_path: photoFile,
      event_id: event.id,
      doorbell_id: dbId ?? null,
      name_snapshot: 'Desconhecido',
    });

    res.status(201).json({ success: true, data: event } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
```

- [ ] **Step 3: VisitorFaceController.recognize**

Após `this.visitorRepo.markSeen(match.visitor.id)` (o caminho com match), inserir:

```ts
const { doorbellId } = req.body;
new VisitsRepository().create({
  visitor_id: match.visitor.id,
  descriptor,
  doorbell_id: Number(doorbellId) || null,
  name_snapshot: match.visitor.name,
});
```

(import de `VisitsRepository`.)

- [ ] **Step 4: Frontend envia o still**

Em `frontend/src/pages/StandbyPage.tsx`, no ponto onde chama
`apiService.recordUnrecognizedVisit(videoBase64)` (linha ~386): capturar um
frame com o util existente e passar como 2º argumento.

```ts
import { captureVideoFrameAsBase64 } from '../utils/imageCapture';
// ...
let stillBase64: string | undefined;
try {
  if (videoElRef.current) stillBase64 = captureVideoFrameAsBase64(videoElRef.current);
} catch { /* sem frame — segue sem foto */ }
apiService.recordUnrecognizedVisit(videoBase64, stillBase64).catch(() => { /* ... */ });
```

(Usar a mesma `ref` de `<video>` já existente na página; se o nome diferir,
ajustar. `recognizeVisitor` já recebe `frame` — dá para reaproveitar essa
variável `frame` se estiver em escopo.)

- [ ] **Step 5: Rodar → PASS; type-check; commit**

Run: `npm run test --workspace=backend -- visitRecording` → PASS
Run: `npm run test --workspace=backend` → tudo PASS
Run: `npm run type-check`

```bash
git add backend/src/controllers/VisitorController.ts backend/src/controllers/VisitorFaceController.ts frontend/src/pages/StandbyPage.tsx backend/test/visitRecording.test.ts
git commit -m "feat: registrar visita (com foto) no reconhecimento e no não identificado"
```

---

## Task 22: VisitorRepository.rename + rotas de visitantes/visitas

**Files:**
- Modify: `backend/src/database/repositories/VisitorRepository.ts` (add `rename`)
- Modify: `backend/src/controllers/VisitorController.ts` (add `list`, `rename`, `listVisits`, `nameVisit`)
- Modify: `backend/src/routes/visitors.ts`
- Create: `backend/src/routes/visits.ts`
- Modify: `backend/src/routes/index.ts`
- Create: `backend/test/visitorRoutes.test.ts`

**Interfaces:**
- `VisitorRepository.rename(id: number, name: string): Visitor | null`.
- HTTP:
  - `GET /api/visitors` → `{ data: Visitor[] }` (sem auth — usado pelo admin já logado por PIN no front; segue o padrão de `GET /api/doorbells`).
  - `PATCH /api/visitors/:id` (auth) `{ name }` → `{ data: Visitor }`.
  - `GET /api/visitors/:id/visits` → `{ data: Visit[] }`.
  - `GET /api/visits?page=&pageSize=&doorbellId=` → `{ data: { items: Visit[]; total: number } }`.
  - `POST /api/visits/:id/name` (auth) `{ name }` → cria/atualiza um `visitors`
    a partir do `descriptor` da visita (se houver) e chama `attachVisitor`;
    também propaga `name_snapshot` para visitas do mesmo `visitor_id`.
    Resposta `{ data: { visitorId: number } }`.

- [ ] **Step 1: Testes (falham)**

Create `backend/test/visitorRoutes.test.ts`:

```ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'http';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';
import { VisitorRepository } from '../src/database/repositories/VisitorRepository';

let server: http.Server; let base: string;
async function start() {
  process.env.API_TOKEN = 'test-token';
  const app = express(); app.use(express.json()); setupRoutes(app);
  await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; r(); }); });
}
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };

describe('rotas de visitantes/visitas', () => {
  beforeEach(async () => { await initTestDb(); server?.close(); await start(); });
  afterAll(() => { server?.close(); closeTestDb(); });

  it('GET /api/visitors lista', async () => {
    new VisitorRepository().create({ name: 'Ana', descriptor: [0.1], photo_path: null, notes: null });
    const b = await (await fetch(`${base}/api/visitors`)).json();
    expect(b.data[0].name).toBe('Ana');
  });

  it('PATCH renomeia (com auth)', async () => {
    const v = new VisitorRepository().create({ name: 'X', descriptor: [0.1], photo_path: null, notes: null });
    const b = await (await fetch(`${base}/api/visitors/${v.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'Beto' }) })).json();
    expect(b.data.name).toBe('Beto');
  });

  it('GET /api/visits pagina e /api/visitors/:id/visits filtra', async () => {
    const vr = new VisitsRepository();
    vr.create({ visitor_id: 5, doorbell_id: 1, name_snapshot: 'a' });
    vr.create({ visitor_id: null, doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const tl = await (await fetch(`${base}/api/visits?page=1&pageSize=10`)).json();
    expect(tl.data.total).toBe(2);
    const byV = await (await fetch(`${base}/api/visitors/5/visits`)).json();
    expect(byV.data).toHaveLength(1);
  });

  it('POST /api/visits/:id/name cria visitante pelo descriptor e vincula', async () => {
    const vr = new VisitsRepository();
    const visit = vr.create({ visitor_id: null, descriptor: [0.1, 0.2], doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const b = await (await fetch(`${base}/api/visits/${visit.id}/name`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Carla' }) })).json();
    expect(b.data.visitorId).toBeGreaterThan(0);
    expect(vr.findById(visit.id)?.visitor_id).toBe(b.data.visitorId);
    expect(new VisitorRepository().findById(b.data.visitorId)?.name).toBe('Carla');
  });
});
```

Run: `npm run test --workspace=backend -- visitorRoutes` → FAIL.

- [ ] **Step 2: VisitorRepository.rename**

Em `backend/src/database/repositories/VisitorRepository.ts`:

```ts
rename(id: number, name: string): Visitor | null {
  this.db.run('UPDATE visitors SET name = ? WHERE id = ?', [name, id]);
  Database.getInstance().save();
  return this.findById(id);
}
```

- [ ] **Step 3: Controller — novos métodos**

Em `backend/src/controllers/VisitorController.ts` adicionar imports
(`VisitorRepository`, `VisitsRepository`) e métodos:

```ts
list = (_req: Request, res: Response): void => {
  res.json({ success: true, data: new VisitorRepository().findAll() } as ApiResponse);
};

rename = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  if (!name) { res.status(400).json({ success: false, error: 'name é obrigatório' } as ApiResponse); return; }
  const updated = new VisitorRepository().rename(id, name);
  if (!updated) { res.status(404).json({ success: false, error: 'Visitante não encontrado' } as ApiResponse); return; }
  res.json({ success: true, data: updated } as ApiResponse);
};

listVisits = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  res.json({ success: true, data: new VisitsRepository().listByVisitor(id) } as ApiResponse);
};

timeline = (req: Request, res: Response): void => {
  const page = Number(req.query.page) || 1;
  const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
  const doorbellId = req.query.doorbellId ? Number(req.query.doorbellId) : undefined;
  res.json({ success: true, data: new VisitsRepository().listTimeline(page, pageSize, doorbellId) } as ApiResponse);
};

nameVisit = (req: Request, res: Response): void => {
  const visitId = Number(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  if (!name) { res.status(400).json({ success: false, error: 'name é obrigatório' } as ApiResponse); return; }
  const visitsRepo = new VisitsRepository();
  const visitorRepo = new VisitorRepository();
  const visit = visitsRepo.findById(visitId);
  if (!visit) { res.status(404).json({ success: false, error: 'Visita não encontrada' } as ApiResponse); return; }

  let visitorId = visit.visitor_id;
  if (visitorId) {
    visitorRepo.rename(visitorId, name);
  } else {
    const created = visitorRepo.create({
      name,
      descriptor: visit.descriptor ?? [],
      photo_path: visit.photo_path ?? null,
      notes: null,
    });
    visitorId = created.id;
  }
  visitsRepo.attachVisitor(visitId, visitorId, name);
  // propaga o nome para outras visitas já vinculadas a esse visitante
  for (const v of visitsRepo.listByVisitor(visitorId)) {
    if (!v.name_snapshot || v.name_snapshot === 'Desconhecido') {
      visitsRepo.attachVisitor(v.id, visitorId, name);
    }
  }
  res.json({ success: true, data: { visitorId } } as ApiResponse);
};
```

- [ ] **Step 4: Rotas**

`backend/src/routes/visitors.ts`:

```ts
import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';
import { auth } from '../middleware/auth';

export function createVisitorRouter(): Router {
  const router = Router();
  const c = new VisitorController();
  router.get('/', c.list);
  router.post('/unrecognized', c.recordUnrecognized.bind(c));
  router.patch('/:id', auth, c.rename);
  router.get('/:id/visits', c.listVisits);
  return router;
}
```

Create `backend/src/routes/visits.ts`:

```ts
import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';
import { auth } from '../middleware/auth';

export function createVisitsRouter(): Router {
  const router = Router();
  const c = new VisitorController();
  router.get('/', c.timeline);
  router.post('/:id/name', auth, c.nameVisit);
  return router;
}
```

`backend/src/routes/index.ts`: `import { createVisitsRouter } from './visits';` +
`apiRouter.use('/visits', createVisitsRouter());`. (Manter os `try/catch` de
`/visitors` face abaixo do `createVisitorRouter()`.)

> Atenção: o `recordUnrecognized` já não era arrow; os novos métodos são arrow
> (bind implícito). Padronizar: no router, `c.recordUnrecognized.bind(c)` como
> está. OK.

- [ ] **Step 5: Rodar → PASS; type-check; commit**

Run: `npm run test --workspace=backend -- visitorRoutes` → PASS
Run: `npm run test --workspace=backend` → tudo PASS
Run: `npm run type-check`

```bash
git add backend/src/database/repositories/VisitorRepository.ts backend/src/controllers/VisitorController.ts backend/src/routes/visitors.ts backend/src/routes/visits.ts backend/src/routes/index.ts backend/test/visitorRoutes.test.ts
git commit -m "feat: rotas de visitantes (lista/rename/visitas) e linha do tempo de visitas"
```

---

## Task 23: apiService — métodos de visitantes/visitas

**Files:**
- Modify: `frontend/src/services/apiService.ts`

**Interfaces:**
- Produces:
  `getVisitors(): Promise<Visitor[]>` (tipo local mínimo),
  `renameVisitor(id, name): Promise<Visitor>`,
  `getVisits(page, pageSize?, doorbellId?): Promise<{ items: Visit[]; total: number }>`,
  `getVisitorVisits(id): Promise<Visit[]>`,
  `nameVisit(visitId, name): Promise<{ visitorId: number }>`.

- [ ] **Step 1: Tipos + métodos**

Em `frontend/src/services/apiService.ts` (perto do fim da classe):

```ts
  // Visitors / Visits
  async getVisitors(): Promise<any[]> {
    return this.request('/visitors');
  }
  async renameVisitor(id: number, name: string): Promise<any> {
    return this.request(`/visitors/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
  async getVisitorVisits(id: number): Promise<import('@shared/types/visit').Visit[]> {
    return this.request(`/visitors/${id}/visits`);
  }
  async getVisits(page: number, pageSize = 20, doorbellId?: number): Promise<{ items: import('@shared/types/visit').Visit[]; total: number }> {
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (doorbellId) q.set('doorbellId', String(doorbellId));
    return this.request(`/visits?${q.toString()}`);
  }
  async nameVisit(visitId: number, name: string): Promise<{ visitorId: number }> {
    return this.request(`/visits/${visitId}/name`, {
      method: 'POST', body: JSON.stringify({ name }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
```

- [ ] **Step 2: type-check + commit**

Run: `npm run type-check`

```bash
git add frontend/src/services/apiService.ts
git commit -m "feat: apiService métodos de visitantes e visitas"
```

---

## Task 24: AdminVisitorsTab v2 — modo "Pessoas"

**Files:**
- Modify: `frontend/src/pages/admin/AdminVisitorsTab.tsx` (reescrita)

**Interfaces:**
- Consumes: `apiService.getVisitors/renameVisitor/getVisitorVisits`, `STORAGE_BASE_URL`, `apiService.getDoorbells`.
- Produces: um toggle de modo `'people' | 'timeline'` (a timeline vem na Task 25 — deixar botão desabilitado com "em breve" **não**; implementar o esqueleto do toggle e renderizar `null` no modo timeline até a Task 25).

- [ ] **Step 1: Reescrever o componente (modo Pessoas)**

Substituir todo o conteúdo de `frontend/src/pages/admin/AdminVisitorsTab.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../../services/apiService';
import type { Visit } from '@shared/types/visit';

type Mode = 'people' | 'timeline';

interface VisitorRow {
  id: number;
  name: string;
  photo_path: string | null;
  visit_count: number;
  last_seen_at: string;
}

function photoUrl(p: string | null): string | undefined {
  return p ? `${STORAGE_BASE_URL}/storage/photos/${p}` : undefined;
}

export function AdminVisitorsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [mode, setMode] = useState<Mode>('people');
  return (
    <div>
      <h2 className="admin-section-title">Visitantes</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`admin-btn${mode === 'people' ? '' : ' admin-btn-outline'}`} onClick={() => setMode('people')}>Pessoas</button>
        <button className={`admin-btn${mode === 'timeline' ? '' : ' admin-btn-outline'}`} onClick={() => setMode('timeline')}>Linha do tempo</button>
      </div>
      {mode === 'people' ? <PeopleView showToast={showToast} /> : <TimelineView showToast={showToast} />}
    </div>
  );
}

function PeopleView({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  async function load() {
    setLoading(true);
    try {
      const list = await apiService.getVisitors();
      setRows(list);
      setDraft(Object.fromEntries(list.map((v: VisitorRow) => [v.id, v.name])));
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar', 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function rename(id: number) {
    const name = (draft[id] ?? '').trim();
    if (!name) return;
    try { await apiService.renameVisitor(id, name); showToast('Nome salvo'); load(); }
    catch (e: any) { showToast(e.message || 'Erro', 'error'); }
  }

  async function toggle(id: number) {
    if (expanded === id) { setExpanded(null); setVisits([]); return; }
    setExpanded(id);
    try { setVisits(await apiService.getVisitorVisits(id)); }
    catch { setVisits([]); }
  }

  const isUnknown = (name: string) => !name || name.toLowerCase().startsWith('desconhecido');

  if (loading) return <p>Carregando...</p>;
  if (rows.length === 0) return <div className="admin-empty">Nenhum visitante ainda.</div>;

  return (
    <div className="admin-video-grid">
      {rows.map((v) => (
        <div key={v.id} className="admin-card">
          {photoUrl(v.photo_path)
            ? <img src={photoUrl(v.photo_path)} alt={v.name} style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
            : <div style={{ height: 120, background: 'var(--bg-darker)', borderRadius: 8, marginBottom: 8, display: 'grid', placeItems: 'center' }}>sem foto</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              value={draft[v.id] ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, [v.id]: e.target.value }))}
              placeholder={isUnknown(v.name) ? `Desconhecido #${v.id}` : ''}
              style={{ flex: '1 1 120px', padding: 6, fontSize: 15 }}
            />
            <button className="admin-btn" onClick={() => rename(v.id)}>Salvar</button>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            {v.visit_count} visita(s) · última {new Date(v.last_seen_at).toLocaleString('pt-BR')}
          </div>
          <button className="admin-btn admin-btn-outline" style={{ marginTop: 8 }} onClick={() => toggle(v.id)}>
            {expanded === v.id ? 'Ocultar visitas' : 'Ver visitas'}
          </button>
          {expanded === v.id && (
            <div style={{ marginTop: 8 }}>
              {visits.length === 0 && <p style={{ fontSize: 13 }}>Sem visitas registradas.</p>}
              {visits.map((vis) => (
                <div key={vis.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  {photoUrl(vis.photo_path) && <img src={photoUrl(vis.photo_path)} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />}
                  <span style={{ fontSize: 13 }}>{new Date(vis.created_at).toLocaleString('pt-BR')}{vis.doorbell_id ? ` · campainha ${vis.doorbell_id}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Preenchido na Task 25
function TimelineView(_props: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  return <p>Carregando linha do tempo...</p>;
}

export default AdminVisitorsTab;
```

> Se `admin.css` não tiver `.admin-btn-outline`, usar `.admin-btn` + estilo
> inline `style={{ opacity: mode === X ? 1 : 0.6 }}` no lugar. Verificar o CSS
> ao implementar e ajustar as classes para as que existem.

- [ ] **Step 2: Verificação manual**

`npm run dev`. Gerar um "visitante não identificado" pelo fluxo da porta (ou inserir manualmente via `sqlite`/endpoint). `/admin/residents` → **Visitantes** → **Pessoas**: card com foto, campo de nome com placeholder "Desconhecido #id"; salvar nome → toast; "Ver visitas" lista as visitas com data/hora.

- [ ] **Step 3: type-check + commit**

```bash
git add frontend/src/pages/admin/AdminVisitorsTab.tsx
git commit -m "feat: aba Visitantes v2 — modo Pessoas (foto, nome editável, histórico)"
```

---

## Task 25: AdminVisitorsTab v2 — modo "Linha do tempo"

**Files:**
- Modify: `frontend/src/pages/admin/AdminVisitorsTab.tsx` (implementar `TimelineView`)

**Interfaces:**
- Consumes: `apiService.getVisits`, `apiService.nameVisit`, `STORAGE_BASE_URL`.

- [ ] **Step 1: Implementar TimelineView**

Substituir o stub `TimelineView` por:

```tsx
function TimelineView({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [items, setItems] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const PAGE_SIZE = 20;

  async function loadPage(p: number) {
    setLoading(true);
    try {
      const res = await apiService.getVisits(p, PAGE_SIZE);
      setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
      setTotal(res.total);
      setPage(p);
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar', 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadPage(1); }, []);

  async function name(visitId: number) {
    const n = (draft[visitId] ?? '').trim();
    if (!n) return;
    try {
      await apiService.nameVisit(visitId, n);
      showToast('Visitante batizado');
      loadPage(1);
    } catch (e: any) {
      showToast(e.message || 'Erro', 'error');
    }
  }

  const isUnknown = (v: Visit) => !v.visitor_id && (!v.name_snapshot || v.name_snapshot.toLowerCase().startsWith('desconhecido'));

  if (loading && items.length === 0) return <p>Carregando...</p>;
  if (items.length === 0) return <div className="admin-empty">Nenhuma visita registrada.</div>;

  return (
    <div>
      {items.map((v) => (
        <div key={v.id} className="admin-card" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          {v.photo_path
            ? <img src={`${STORAGE_BASE_URL}/storage/photos/${v.photo_path}`} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
            : <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--bg-darker)' }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {new Date(v.created_at).toLocaleString('pt-BR')}{v.doorbell_id ? ` · campainha ${v.doorbell_id}` : ''}
            </div>
            {isUnknown(v) ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <input
                  placeholder="Desconhecido — dar um nome"
                  value={draft[v.id] ?? ''}
                  onChange={(e) => setDraft((p) => ({ ...p, [v.id]: e.target.value }))}
                  style={{ flex: '1 1 140px', padding: 6 }}
                />
                <button className="admin-btn" onClick={() => name(v.id)}>Batizar</button>
              </div>
            ) : (
              <div style={{ fontWeight: 600 }}>{v.name_snapshot || 'Visitante'}</div>
            )}
          </div>
        </div>
      ))}
      {items.length < total && (
        <button className="admin-btn admin-btn-outline" onClick={() => loadPage(page + 1)} disabled={loading}>
          {loading ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificação manual**

`/admin/residents` → **Visitantes** → **Linha do tempo**: feed cronológico (mais recente no topo), miniatura + data/hora + campainha; visita desconhecida tem campo "Batizar" → após batizar, a mesma pessoa aparece nomeada e some o campo; "Carregar mais" pagina.

- [ ] **Step 3: type-check + commit**

Run: `npm run type-check`
Run: `npm run test --workspace=backend && npm run test --workspace=frontend` → tudo PASS

```bash
git add frontend/src/pages/admin/AdminVisitorsTab.tsx
git commit -m "feat: aba Visitantes v2 — modo Linha do tempo (feed + batizar inline)"
```

---

# Verificação final

- [ ] **Step 1: Suíte completa**

Run: `npm run test --workspace=backend`
Expected: PASS (doorbellRepository, doorbellRoutes, kioskLock, kioskRoutes, visitsRepository, visitRecording, visitorRoutes, helpers).

Run: `npm run test --workspace=frontend`
Expected: PASS (describeEvent, kioskBusy, liveViewerReducer).

- [ ] **Step 2: type-check + build**

Run: `npm run type-check`
Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Build Android**

Run: `cd android-app && ./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Roteiro manual ponta-a-ponta**

1. `npm run dev`. Admin → **Campainhas**: renomear "Campainha" → "Frente", adicionar "Fundos".
2. Aba standby `/?doorbell=1`; aba `/notifications` (ativar). Fluxo "outro motivo" → banner "Frente: Recado...".
3. `/notifications` → "Ver câmera ao vivo" → vídeo aparece; "Parar" apaga a câmera.
4. Admin → **Câmera** → escolher "Frente" → "Ver ao vivo" → vídeo; durante uma chamada real → "ocupada".
5. Admin → **Campainhas** → "Desbloquear 15 min" → status "Destravado (14:5x)"; "Retravar agora" → "Travado".
6. (Aparelho) App em modo kiosk travado: Home volta pro app; desbloqueado: Home livre e "Sair do app" fecha.
7. Fluxo de visitante não identificado → Admin → **Visitantes** → **Pessoas**: card com foto e "Desconhecido #id"; batizar; "Ver visitas" mostra data/hora. **Linha do tempo**: feed com "Batizar" inline.

- [ ] **Step 5: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: ajustes finais da verificação ponta-a-ponta"
```

---

## Notas de execução

- **Sem ambiente Android no runner:** os passos `./gradlew` viram verificação
  manual pendente — não bloqueiam as tasks de backend/frontend. Registrar no
  PR quais builds Android foram verificados manualmente.
- **face-api ausente:** as rotas `/api/visitors/recognize` e `/api/face/*` já
  são carregadas via `try/catch` no `routes/index.ts`; os testes cobrem só
  caminhos determinísticos (não dependem de `canvas`/`face-api`).
- **Import de `@shared`:** backend usa `@shared/types/*` resolvido pelo
  `tsconfig` + alias do `vitest.config.ts`. Frontend usa o mesmo alias no
  `vite`/`vitest`.
- **Ciclo de import `apiService` ↔ `doorbell`:** resolvido lendo o
  `localStorage` direto em `apiService` (`kioskDoorbellId()`), sem importar
  `doorbell.ts`.
