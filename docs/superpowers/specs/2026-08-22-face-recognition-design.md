# Fase 2 — Reconhecimento Facial (Design)

## Objetivo

Identificar moradores automaticamente pela câmera do kiosk, dar boas-vindas, e
permitir que moradores marcados como administradores acessem o painel
`/admin` sem PIN. Serve de base para as Fases 3 (painel admin web) e 6
(integração smart home), mas este documento cobre apenas o reconhecimento
facial e o cadastro de moradores.

## Arquitetura

```
StandbyPage/HomePage
  estado "dormant"
    - câmera ligada em baixo custo
    - useMotionDetector: frame-diff a cada ~1s (canvas, sem IA)
    - sem movimento → permanece dormant
  movimento detectado → estado "active"
    - useFaceRecognition.tryRecognize(videoEl, timeoutMs=8000)
    - face-api.js roda detecção + descriptor a cada ~500ms durante a janela
    - compara contra os descriptors de moradores já carregados em memória
      (euclideanDistance < threshold, ~0.6)
    match encontrado:
      - is_admin = true  → navigate('/admin')  (sem PIN)
      - is_admin = false → toast "Bem-vindo, {nome}!" + registra evento
                            resident_identified
      volta para "dormant" após a ação
    sem match / timeout:
      - volta para "dormant" silenciosamente
```

A câmera nunca fica processando reconhecimento facial completo em modo
contínuo — só ativa o pipeline pesado (face-api.js) depois que o
frame-diff barato detecta movimento, para poupar CPU/bateria do tablet.

## Backend

### Migration `005_create_residents_table`

```sql
CREATE TABLE residents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  descriptors TEXT NOT NULL,  -- JSON: float[128][] (3-5 capturas por pessoa)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_residents_is_admin ON residents(is_admin);
```

Segue o padrão de migrations existente (array com nome único, `db.run`,
`Database.getInstance().save()`).

### Componentes (mesmo padrão de Delivery/Event/Settings)

- `ResidentRepository` — CRUD sobre a tabela `residents`, (de)serializa
  `descriptors` de/para JSON.
- `ResidentController` — valida input (nome obrigatório, descriptors
  array não vazio, cada descriptor com 128 floats).
- `routes/residents.ts` — `createResidentsRouter()` (factory function,
  instanciada após `Database.initialize()`), protegida pelo middleware
  `auth` já existente (Bearer `API_TOKEN`).

### Rotas

| Método | Rota                | Descrição                                      |
|--------|---------------------|-------------------------------------------------|
| POST   | /api/residents       | cria morador (name, is_admin, descriptors[])     |
| GET    | /api/residents       | lista todos — usada pelo frontend para carregar embeddings |
| GET    | /api/residents/:id   | detalhe de um morador                            |
| PUT    | /api/residents/:id   | atualiza nome/is_admin/descriptors               |
| DELETE | /api/residents/:id   | remove morador                                   |

### Eventos

Reaproveita `EventService`/`EventBus` existentes. Novo tipo de evento
`resident_identified`, metadata `{ residentId, name }`, gravado quando um
morador não-admin é reconhecido (moradores admin também geram o evento,
antes de navegar para `/admin`).

## Frontend

- `hooks/useMotionDetector.ts` — abre a câmera (`getUserMedia`), desenha
  frames num canvas oculto a ~1fps, compara diferença de pixel média entre
  frames consecutivos contra um threshold; expõe `motionDetected: boolean`.
- `hooks/useFaceRecognition.ts` — na montagem, carrega os modelos do
  face-api.js (tiny face detector, face landmark 68, face recognition) uma
  única vez a partir de `/models` (estático); busca `GET /api/residents` e
  monta `LabeledFaceDescriptors` em memória. Expõe
  `tryRecognize(videoEl, timeoutMs)` que roda detecção repetida durante a
  janela e resolve com `{ resident, isAdmin } | null`.
- `StandbyPage.tsx` — orquestra os dois hooks: dormant → (motion) → active
  → tryRecognize → ação (navegar para `/admin` ou toast de boas-vindas +
  registrar evento) → volta a dormant.
- Nova rota `/admin/residents`, protegida por PIN simples (mesmo nível de
  proteção combinado, já que o painel admin completo é escopo da Fase 3):
  - formulário: nome, checkbox `is_admin`
  - botão "Capturar foto": tira 3-5 fotos em sequência da webcam
  - gera os descriptors localmente com face-api.js
  - `POST /api/residents` com os descriptors gerados
- Modelos do face-api.js (~6MB) ficam em `frontend/public/models/`,
  servidos como arquivo estático — não é módulo nativo, não afeta o build
  Termux.

## Tratamento de erros

- **Permissão de câmera negada / indisponível**: `useMotionDetector`
  captura o erro do `getUserMedia`, expõe `cameraError`; a StandbyPage cai
  de volta no fluxo manual atual (botões da tela) sem quebrar o kiosk.
- **Modelos do face-api.js falham ao carregar**: `useFaceRecognition`
  loga o erro e marca reconhecimento como indisponível; o motion detector
  continua funcionando mas nunca entra em "active" com sucesso — sistema
  permanece utilizável via toque manual.
- **Nenhum match dentro do timeout**: volta a "dormant" silenciosamente,
  sem toast de erro (evita ruído para visitantes que não são moradores).
- **Match ambíguo (duas pessoas dentro do threshold)**: usa a menor
  distância euclidiana; loga aviso com as duas distâncias para ajuste
  futuro do threshold.
- **Cadastro com menos de 1 descriptor válido**: `ResidentController`
  retorna 400 com mensagem clara.
- **descriptors com formato inválido** (tamanho ≠ 128): rejeitado na
  validação do controller antes de persistir.

## Testes

O projeto não tem test runner configurado ainda (nenhum `*.test.ts` fora
de `node_modules`), então a verificação desta fase é manual, seguindo o
padrão atual do repositório:

- Backend: exercitar as rotas de `residents` via curl/Postman (criar,
  listar, atualizar, remover) e confirmar migration aplicada + evento
  `resident_identified` gravado em `events`.
- Frontend: testar no navegador (Chrome/WebView Android) —
  1. Cadastrar um morador não-admin com 3 fotos, validar reconhecimento
     dando boas-vindas.
  2. Cadastrar um morador admin, validar que reconhecimento navega direto
     para `/admin` sem PIN.
  3. Simular ausência de rosto (ninguém na frente) por >8s → volta a
     dormant sem toast.
  4. Negar permissão de câmera → confirmar que os botões manuais do kiosk
     continuam funcionando.
- Testar especificamente no Termux/Android real antes de commitar,
  conforme diretriz do projeto.

## Fora de escopo (fases futuras)

- Auto-unlock de fechadura física (Fase 6).
- Painel admin web completo com autenticação robusta (Fase 3).
- Detecção de movimento para gravação contínua (Fase 5) — o motion
  detector aqui é só um gatilho leve, não grava nada.
