# 🔧 Build do Frontend - Guia Completo

## 📝 Modos de Build

Este projeto suporta **dois modos de build** para maximizar compatibilidade:

### 1️⃣ Build Normal (com PWA completo)
**Uso:** Desenvolvimento local, servidores, PC

```bash
npm run build
```

**Características:**
- ✅ PWA completo com Workbox
- ✅ Service Worker otimizado e minificado
- ✅ Offline-first caching
- ✅ Instalável como app
- ⚠️ **Requer ambiente com suporte a Terser**

---

### 2️⃣ Build para Termux (sem PWA plugin)
**Uso:** Termux/Android (evita problemas com Terser)

```bash
npm run build:termux
```

**Características:**
- ✅ Build sem vite-plugin-pwa
- ✅ Service Worker simples (sem minificação)
- ✅ Funciona perfeitamente no Termux
- ✅ Caching básico funcional
- ⚠️ PWA simplificado (sem Workbox)

---

## 🤔 Por que dois builds?

### Problema com Terser no Termux

O **vite-plugin-pwa** usa internamente o **Terser** para minificar o Service Worker. No ambiente Termux/Android, o Terser falha com:

```
Error: Unable to write the service worker file. 
'Unexpected early exit. This happens when Promises returned by plugins cannot resolve.
Unfinished hook action(s) on exit: (terser) renderChunk'
```

### Solução Implementada

- **Detecção automática** de ambiente Termux via `process.env.TERMUX_VERSION`
- **Variável manual** `DISABLE_PWA=true` para forçar modo sem PWA
- **Service Worker alternativo** em `public/sw-simple.js` (sem minificação)
- **Scripts pós-build** copiam SW simples quando PWA está desabilitado

---

## 🔄 Como Funciona

### Build Normal
```
npm run build
  ↓
tsc (TypeScript)
  ↓
vite build
  ↓
vite-plugin-pwa (Workbox + Terser)
  ↓
dist/ (com PWA completo)
```

### Build Termux
```
npm run build:termux
  ↓
scripts/build-termux.mjs
  ↓
DISABLE_PWA=true tsc
  ↓
DISABLE_PWA=true vite build (sem plugin PWA)
  ↓
scripts/post-build.mjs (copia SW simples)
  ↓
dist/ (com PWA básico)
```

---

## 📁 Arquivos Gerados

### Build Normal
```
dist/
├── index.html
├── assets/
├── manifest.webmanifest   ← Gerado por vite-plugin-pwa
├── registerSW.js           ← Gerado por vite-plugin-pwa
└── sw.js                   ← Minificado com Terser
```

### Build Termux
```
dist/
├── index.html
├── assets/
├── manifest.webmanifest   ← Gerado por post-build.mjs
├── registerSW.js          ← Gerado por post-build.mjs
└── sw.js                  ← Copiado de public/sw-simple.js (SEM minificação)
```

---

## 🛠️ Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `package.json` | Define scripts `build` e `build:termux` |
| `vite.config.ts` | Detecta Termux e desabilita PWA condicionalmente |
| `scripts/build-termux.mjs` | Script Node.js para build no Termux |
| `scripts/post-build.mjs` | Copia SW simples quando PWA desabilitado |
| `public/sw-simple.js` | Service Worker manual (sem Workbox) |

---

## 🧪 Testando Localmente

### Testar Build Normal
```bash
# Limpar variáveis (PowerShell)
Remove-Item Env:\DISABLE_PWA -ErrorAction SilentlyContinue

# Build
npm run build

# Verificar PWA gerado
ls dist/
# Deve mostrar: sw.js (pequeno, minificado)
```

### Testar Build Termux
```bash
# Build
npm run build:termux

# Verificar PWA simplificado
ls dist/
# Deve mostrar: sw.js (maior, não minificado)
```

---

## 🐛 Troubleshooting

### Erro: "Terser renderChunk"
**Causa:** Build normal rodado no Termux  
**Solução:** Use `npm run build:termux`

### PWA não funciona no Termux
**Causa:** Usou `npm run build` em vez de `npm run build:termux`  
**Solução:**
```bash
rm -rf dist
npm run build:termux
```

### Build normal não gera PWA
**Causa:** Variável `DISABLE_PWA` ainda setada  
**Solução (PowerShell):**
```powershell
Remove-Item Env:\DISABLE_PWA
npm run build
```

**Solução (Bash):**
```bash
unset DISABLE_PWA
npm run build
```

---

## 📚 Referências

- [Vite Plugin PWA](https://vite-pwa-org.netlify.app/)
- [Workbox](https://developer.chrome.com/docs/workbox/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Best Practices](https://web.dev/pwa/)

---

## ✅ Checklist de Deploy

### Termux/Android
- [ ] Clone do repositório
- [ ] `bash scripts/termux/install.sh` (usa `build:termux` automaticamente)
- [ ] Configurar `backend/.env`
- [ ] `bash scripts/termux/start.sh`
- [ ] Testar em `http://localhost:3000`

### Servidor/PC
- [ ] Clone do repositório
- [ ] `npm install`
- [ ] `npm run build` (frontend)
- [ ] `npm run build` (backend)
- [ ] Configurar variáveis de ambiente
- [ ] Iniciar servidor
- [ ] Verificar PWA completo funcionando

---

**Última atualização:** 2026-08-22
