# 🚀 Guia de Instalação - Campainha Digital Android

Guia completo passo a passo para publicar no GitHub e instalar no seu celular Android.

---

## 📋 Índice

1. [Publicar no GitHub](#1-publicar-no-github)
2. [Preparar o Celular Android](#2-preparar-o-celular-android)
3. [Instalar Termux](#3-instalar-termux)
4. [Clonar e Instalar o Projeto](#4-clonar-e-instalar-o-projeto)
5. [Iniciar o Sistema](#5-iniciar-o-sistema)
6. [Configurar Modo Kiosk](#6-configurar-modo-kiosk)
7. [Verificação Final](#7-verificação-final)

---

## 1️⃣ Publicar no GitHub

### Passo 1.1: Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Preencha:
   - **Repository name**: `campainha-digital-android`
   - **Description**: `Sistema de campainha inteligente rodando em Android via Termux`
   - **Visibility**: Public ou Private (sua escolha)
   - ⚠️ **NÃO marque** "Add a README file"
   - ⚠️ **NÃO adicione** .gitignore (já existe)
3. Clique em **"Create repository"**

### Passo 1.2: Configurar Git Local (no seu PC)

Abra o PowerShell ou Git Bash na pasta do projeto:

```bash
cd "f:\Campainha Digital Android"
```

Configure seu nome e email (se ainda não configurou):

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@example.com"
```

### Passo 1.3: Conectar ao GitHub

**Substitua `SEU-USUARIO` pelo seu nome de usuário do GitHub:**

```bash
git remote add origin https://github.com/SEU-USUARIO/campainha-digital-android.git
```

### Passo 1.4: Fazer Push

```bash
git branch -M main
git push -u origin main
```

Se solicitar autenticação:
- **Username**: seu usuário do GitHub
- **Password**: use um **Personal Access Token** (PAT)

#### Como criar um PAT:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Marque: `repo` (Full control of private repositories)
4. Gere e **copie o token** (não será mostrado novamente!)
5. Use o token como senha ao fazer push

✅ **Repositório publicado com sucesso!**

---

## 2️⃣ Preparar o Celular Android

### Requisitos Mínimos

- ✅ Android 8.0 ou superior (API 26+)
- ✅ 2GB de armazenamento livre
- ✅ Wi-Fi ou dados móveis
- ✅ Carregador/fonte de energia

### Passo 2.1: Configurações Iniciais

1. **Ativar Fontes Desconhecidas**:
   - Configurações → Segurança
   - Ative "Fontes desconhecidas" (para instalar F-Droid)

2. **Desativar Otimização de Bateria** (preparação):
   - Configurações → Bateria → Otimização de bateria
   - Mostrar "Todos os apps"
   - Procure "Termux" (após instalar) → "Não otimizar"

---

## 3️⃣ Instalar Termux

### Passo 3.1: Instalar F-Droid

⚠️ **IMPORTANTE**: Use apenas a versão do F-Droid, **NÃO** do Google Play!

1. No celular, acesse: https://f-droid.org/
2. Baixe o arquivo **F-Droid.apk**
3. Abra o arquivo baixado e instale
4. Abra o F-Droid

### Passo 3.2: Instalar Termux via F-Droid

1. No F-Droid, procure por **"Termux"**
2. Instale o app **Termux** (versão oficial)
3. Aguarde a instalação completar

### Passo 3.3: Configurar Termux

Abra o Termux e execute:

```bash
# Dar permissão de armazenamento
termux-setup-storage
```

Aceite a permissão quando aparecer o popup.

```bash
# Atualizar repositórios
pkg update
pkg upgrade
```

Digite `Y` e pressione Enter quando solicitado.

```bash
# Instalar Git
pkg install git
```

Digite `Y` para confirmar.

✅ **Termux configurado!**

---

## 4️⃣ Clonar e Instalar o Projeto

### Passo 4.1: Clonar Repositório

**Substitua `SEU-USUARIO` pelo seu usuário do GitHub:**

```bash
cd ~
git clone https://github.com/SEU-USUARIO/campainha-digital-android.git
cd campainha-digital-android
```

Se o repositório for privado, use:
```bash
git clone https://SEU-USUARIO:SEU-TOKEN@github.com/SEU-USUARIO/campainha-digital-android.git
```

### Passo 4.2: Executar Instalação Automática

```bash
bash scripts/termux/install.sh
```

Este script irá:
- ✅ Instalar Node.js (via pkg)
- ✅ Instalar todas as dependências (backend, frontend, shared)
- ✅ Compilar TypeScript
- ✅ Criar diretórios necessários
- ✅ Criar arquivo `.env` de configuração

⏱️ **Tempo estimado**: 5-10 minutos

### Passo 4.3: Configurar Variáveis de Ambiente

Edite o arquivo de configuração:

```bash
nano backend/.env
```

**Configure as seguintes variáveis OBRIGATÓRIAS:**

```env
# Porta do servidor
PORT=3000

# Token de acesso (use uma senha forte!)
API_TOKEN=sua-senha-super-secreta-aqui

# Chave de sessão (use outra senha forte!)
SESSION_SECRET=outra-chave-secreta-diferente
```

💡 **Dica**: Para gerar senhas fortes:
```bash
openssl rand -hex 32
```

**Para salvar no nano:**
- Pressione `Ctrl+O` (salvar)
- Pressione `Enter` (confirmar)
- Pressione `Ctrl+X` (sair)

✅ **Projeto instalado e configurado!**

---

## 5️⃣ Iniciar o Sistema

### Passo 5.1: Iniciar Backend

```bash
bash scripts/termux/start.sh
```

Aguarde a mensagem:
```
✅ Backend rodando em http://localhost:3000
```

### Passo 5.2: Verificar Saúde

```bash
bash scripts/termux/health-check.sh
```

Deve mostrar:
- ✅ Backend: ONLINE
- ✅ API: RESPONDENDO

### Passo 5.3: Acessar Interface

1. Abra o **Chrome** no celular
2. Acesse: `http://localhost:3000`
3. Você deve ver a tela de **"Sistema em espera..."**
4. Após 3 segundos: **"Bem-vindo!"**
5. Depois: Tela principal com 3 botões

✅ **Sistema funcionando!**

---

## 6️⃣ Configurar Modo Kiosk

### Opção A: PWA (Progressive Web App) - Simples

1. No Chrome, acesse `http://localhost:3000`
2. Menu (⋮) → **"Adicionar à tela inicial"**
3. Marque **"Abrir como aplicativo"**
4. Toque em "Adicionar"
5. Um ícone será criado na tela inicial
6. Abra pelo ícone → Interface fullscreen sem barra do navegador

### Opção B: Fully Kiosk Browser - Avançado

**Para instalação permanente e segura:**

1. Instale **Fully Kiosk Browser** da Play Store:
   - https://play.google.com/store/apps/details?id=de.ozerov.fully

2. Configure:
   - **Website URL**: `http://localhost:3000`
   - Ative: "Start on Boot"
   - Ative: "Prevent Status Bar"
   - Ative: "Hide System UI"
   - Ative: "Lock Settings"
   - Configure senha de administrador

3. Defina como launcher padrão quando solicitado

### Configurações Android para Modo Kiosk

1. **Tela sempre ligada**:
   - Configurações → Opções do Desenvolvedor
   - Ative "Permanecer ativo" (mantém tela ligada enquanto carrega)

2. **Desativar bloqueio de tela**:
   - Configurações → Segurança → Bloqueio de tela → Nenhum
   - ⚠️ Apenas para dispositivo dedicado!

3. **Brilho fixo**:
   - Configurações → Tela
   - Ajuste brilho para 70-80%
   - Desative "Brilho automático"

4. **Wi-Fi sempre ativo**:
   - Configurações → Wi-Fi → Avançado
   - "Manter Wi-Fi ativo": Sempre

✅ **Modo kiosk configurado!**

---

## 7️⃣ Verificação Final

### Checklist de Funcionamento

Execute cada teste:

#### Teste 1: Backend Ativo
```bash
bash scripts/termux/health-check.sh
```
✅ Deve mostrar: Backend ONLINE, API RESPONDENDO

#### Teste 2: Fluxo de Entrega
1. Acesse interface no navegador
2. Aguarde aparecer "Bem-vindo!"
3. Toque em **"ENTREGA"**
4. Escolha **"Mercado Livre"**
5. Digite código: `ML123456`
6. Toque em **"CONFIRMAR"**
7. Deve aparecer: "Entrega registrada com sucesso!"
8. Sistema volta ao standby

#### Teste 3: API Direta
```bash
curl http://localhost:3000/health
```
✅ Deve retornar: `{"status":"ok",...}`

```bash
curl http://localhost:3000/api/events
```
✅ Deve retornar lista de eventos JSON

### Teste 4: Logs
```bash
bash scripts/termux/logs.sh
```
✅ Deve mostrar logs do sistema (Ctrl+C para sair)

---

## 🎯 Comandos Úteis

### Iniciar Sistema
```bash
cd ~/campainha-digital-android
bash scripts/termux/start.sh
```

### Parar Sistema
```bash
bash scripts/termux/stop.sh
```

### Ver Logs em Tempo Real
```bash
bash scripts/termux/logs.sh
```

### Verificar Saúde
```bash
bash scripts/termux/health-check.sh
```

### Atualizar do GitHub
```bash
cd ~/campainha-digital-android
git pull
bash scripts/termux/install.sh
bash scripts/termux/stop.sh
bash scripts/termux/start.sh
```

---

## 🔧 Inicialização Automática (Opcional)

### Instalar Termux:Boot

1. No F-Droid, procure **"Termux:Boot"**
2. Instale
3. No Termux, execute:

```bash
mkdir -p ~/.termux/boot
nano ~/.termux/boot/start-doorbell.sh
```

4. Cole o conteúdo:

```bash
#!/data/data/com.termux/files/usr/bin/bash
cd ~/campainha-digital-android
bash scripts/termux/start.sh
```

5. Salve (Ctrl+O, Enter, Ctrl+X)

6. Dar permissão:
```bash
chmod +x ~/.termux/boot/start-doorbell.sh
```

7. Reinicie o celular

✅ O sistema iniciará automaticamente ao ligar o celular!

---

## 🆘 Problemas Comuns

### "pkg: command not found"
- Reinstale Termux via F-Droid (NÃO Google Play)

### Backend não inicia
```bash
# Verificar logs
cat logs/backend.log

# Recompilar
cd backend
npm run build
```

### Página em branco
```bash
# Verificar se backend está rodando
bash scripts/termux/health-check.sh

# Limpar cache do navegador
```

### Termux fecha sozinho
- Configurações → Apps → Termux → Bateria → "Sem restrições"
- No Termux: Menu → "Acquire wakelock"

### Mais problemas?
Consulte: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📚 Documentação Completa

- [📖 Arquitetura do Sistema](docs/ARCHITECTURE.md)
- [📖 Referência da API](docs/API.md)
- [📖 Setup Termux Detalhado](docs/TERMUX_SETUP.md)
- [📖 Configuração Android Kiosk](docs/ANDROID_CONFIG.md)
- [📖 Troubleshooting](docs/TROUBLESHOOTING.md)

---

## 🎉 Pronto!

Seu sistema de campainha digital está funcionando!

**Fluxo de uso:**
1. Sistema em standby
2. Detecta pessoa (simulado - 3s)
3. Mostra interface com 3 opções
4. Visitante interage
5. Sistema registra e volta ao standby

**Próximas fases:**
- Fase 2: Câmera real + gravação
- Fase 3: Sistema de chamada
- Fase 4: Acesso remoto + painel admin
- Fase 5: Reconhecimento facial com IA

---

**Versão**: 1.0.0  
**Data**: 2026-08-22  
**Status**: ✅ Production Ready
