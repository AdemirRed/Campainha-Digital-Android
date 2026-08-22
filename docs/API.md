# API Reference - Campainha Digital

Base URL: `http://localhost:3000/api`

## Endpoints

### Events

#### `POST /api/events`
Cria um novo evento.

**Body:**
```json
{
  "type": "person_detected",
  "metadata": {
    "confidence": 0.95
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "person_detected",
    "status": "pending",
    "metadata": { "confidence": 0.95 },
    "created_at": "2026-08-22T10:30:00.000Z",
    "ended_at": null
  }
}
```

---

#### `GET /api/events`
Lista eventos com paginação.

**Query Params:**
- `page` (default: 1)
- `pageSize` (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

---

#### `GET /api/events/:id`
Busca evento por ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "delivery_selected",
    "status": "completed",
    "created_at": "2026-08-22T10:30:00.000Z"
  }
}
```

---

#### `PUT /api/events/:id`
Atualiza um evento.

**Body:**
```json
{
  "status": "completed",
  "ended_at": "2026-08-22T10:35:00.000Z"
}
```

---

#### `DELETE /api/events/:id`
Remove um evento.

**Response:**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

### Deliveries

#### `POST /api/deliveries`
Registra uma entrega.

**Body:**
```json
{
  "company": "mercadolivre",
  "tracking_code": "ML123456789",
  "notes": "Deixar na portaria"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "event_id": 5,
    "company": "mercadolivre",
    "tracking_code": "ML123456789",
    "notes": "Deixar na portaria",
    "created_at": "2026-08-22T10:30:00.000Z"
  }
}
```

**Nota:** Se `event_id` não for fornecido, um novo evento será criado automaticamente.

---

#### `GET /api/deliveries`
Lista entregas com paginação.

**Query Params:**
- `page` (default: 1)
- `pageSize` (default: 20)

---

#### `GET /api/deliveries/:id`
Busca entrega por ID.

---

### Settings

**Requer autenticação via header:**
```
Authorization: Bearer <API_TOKEN>
```

#### `GET /api/settings`
Lista todas as configurações.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "detection_enabled",
      "value": "true",
      "updated_at": "2026-08-22T10:00:00.000Z"
    }
  ]
}
```

---

#### `GET /api/settings/:key`
Busca uma configuração específica.

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "detection_enabled",
    "value": "true"
  }
}
```

---

#### `PUT /api/settings/:key`
Atualiza/cria uma configuração.

**Body:**
```json
{
  "value": "false"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "detection_enabled",
    "value": "false"
  },
  "message": "Setting updated successfully"
}
```

---

## Event Types

```typescript
enum EventType {
  PERSON_DETECTED = 'person_detected',
  BUTTON_PRESSED = 'button_pressed',
  DELIVERY_SELECTED = 'delivery_selected',
  CALL_REQUESTED = 'call_requested',
  CALL_STARTED = 'call_started',
  CALL_ENDED = 'call_ended',
  RECORDING_STARTED = 'recording_started',
  RECORDING_FINISHED = 'recording_finished',
  NOTIFICATION_SENT = 'notification_sent',
  MOTION_DETECTED = 'motion_detected',
  PERSON_LEFT = 'person_left'
}
```

## Event Status

```typescript
enum EventStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}
```

## Delivery Companies

```typescript
enum DeliveryCompany {
  MERCADO_LIVRE = 'mercadolivre',
  SHOPEE = 'shopee',
  CORREIOS = 'correios',
  AMAZON = 'amazon',
  OTHER = 'other'
}
```

## Error Handling

Todos os endpoints retornam erros no formato:

```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validação falhou)
- `401` - Unauthorized (token inválido/ausente)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Rate Limiting

- **Limite**: 100 requisições por IP a cada 15 minutos
- **Headers** retornados:
  - `RateLimit-Limit`: limite máximo
  - `RateLimit-Remaining`: requisições restantes
  - `RateLimit-Reset`: timestamp do reset

---

**Versão**: 1.0 (Fase 1 - MVP)
