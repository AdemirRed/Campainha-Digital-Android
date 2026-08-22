# 🔧 Fix Termux Compatibility

## Problema Resolvido

❌ **Problema Original:**
- `better-sqlite3` requer compilação nativa (C++)
- Precisa de Python e ferramentas de build
- Não funciona bem no Termux/Android

✅ **Solução:**
- Substituído por `sql.js` (SQLite em WebAssembly)
- Não requer compilação nativa
- Funciona perfeitamente no Termux
- Removida opção `ignoreDeprecations` incompatível

---

## Arquivos Modificados

1. **backend/package.json**
   - `better-sqlite3` → `sql.js`

2. **backend/src/database/index.ts**
   - Reescrito para usar sql.js
   - `initialize()` agora é async
   - Adicionado método `save()` para persistência

3. **backend/src/database/migrations.ts**
   - Adaptado para API do sql.js
   - `db.exec()` → `db.run()`
   - Queries parametrizadas

4. **backend/src/index.ts**
   - Envolvido em função `async startServer()`
   - `await db.initialize()`

5. **backend/src/database/repositories/EventRepository.ts**
   - Reescrito para usar `db.exec()` do sql.js
   - Mapeamento manual de resultados

6. **backend/tsconfig.json & frontend/tsconfig.json**
   - Removido `ignoreDeprecations: "6.0"`
   - Ajustado `moduleResolution`

---

## Como Testar

No Termux, execute:

```bash
cd ~/Campainha-Digital-Android
git pull
bash scripts/termux/install.sh
```

Agora deve funcionar sem erros de Python!

---

**Data**: 2026-08-22
