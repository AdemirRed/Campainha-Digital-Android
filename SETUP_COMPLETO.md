# 🚀 INSTALAÇÃO FINAL - Drivers + GitHub Push

## ✅ STATUS ATUAL

- ✅ Projeto commitado localmente
- ✅ Drivers Google USB baixados
- ⏳ Pendente: Instalar drivers
- ⏳ Pendente: Push para GitHub

---

## 1️⃣ INSTALAR DRIVERS (OBRIGATÓRIO)

### Abra PowerShell como ADMINISTRADOR:

1. Pressione `Win + X`
2. Escolha **"Windows PowerShell (Admin)"** ou **"Terminal (Admin)"**
3. Se aparecer UAC, clique em **"Sim"**

### Cole e execute este comando:

```powershell
cd 'f:\Campainha Digital Android\drivers\google_usb_driver\usb_driver'
pnputil /add-driver android_winusb.inf /install
```

**Resultado esperado:**
```
Utilitário PnP da Microsoft
Adicionando o pacote de driver:  android_winusb.inf
Pacote de drivers adicionado com êxito.
Nome Publicado:         oem23.inf (ou outro número)
```

✅ **Driver instalado!**

---

## 2️⃣ PUBLICAR NO GITHUB

### Passo 1: Criar repositório no GitHub

1. Acesse: https://github.com/new
2. Preencha:
   - **Nome**: `Campainha-Digital-Android` (use exatamente este nome!)
   - **Descrição**: `Sistema de campainha inteligente rodando em Android via Termux`
   - **Visibilidade**: Public
   - ⚠️ NÃO marque "Add a README file"
3. Clique em **"Create repository"**

### Passo 2: Conectar e fazer Push

No PowerShell **NORMAL** (não precisa ser admin), execute:

```powershell
cd 'f:\Campainha Digital Android'

# Configurar Git (apenas primeira vez)
git config user.name "AdemirRed"
git config user.email "seu-email@exemplo.com"

# Conectar ao repositório GitHub
git remote add origin https://github.com/AdemirRed/Campainha-Digital-Android.git

# Renomear branch para main
git branch -M main

# Fazer push
git push -u origin main
```

**Se pedir autenticação:**
- Username: `AdemirRed`
- Password: Use um **Personal Access Token (PAT)**

#### Como criar PAT:
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. Nome: "Campainha Digital"
5. Marque: ✅ `repo` (Full control of private repositories)
6. Generate token
7. **COPIE O TOKEN** (não será mostrado novamente!)
8. Use o token como senha ao fazer push

---

## 3️⃣ CONECTAR ULEFONE ARMOR 27

### No Celular:

1. **Ativar Modo Desenvolvedor:**
   - Configurações → Sobre o telefone
   - Toque **7 vezes** em "Número da versão"
   - Deve aparecer: "Você agora é um desenvolvedor!"

2. **Ativar Depuração USB:**
   - Configurações → Sistema → Opções do desenvolvedor
   - Ative o toggle **"Opções do desenvolvedor"**
   - Role e ative **"Depuração USB"**

3. **Conectar ao PC:**
   - Conecte o celular via cabo USB
   - No celular deve aparecer popup: **"Permitir depuração USB?"**
   - Marque: ✅ "Sempre permitir deste computador"
   - Toque em **"Permitir"**

### No PC (PowerShell):

```powershell
# Verificar se ADB está funcionando
adb devices
```

**Resultado esperado:**
```
List of devices attached
ABC123456789    device
```

Se aparecer `unauthorized`:
- Revogue no celular: Opções do desenvolvedor → Revogar autorizações USB
- Desconecte e reconecte o cabo
- Aceite novamente

---

## 4️⃣ INSTALAR PROJETO NO CELULAR

### Método 1: Clonar do GitHub (Recomendado)

No Termux do celular:

```bash
# Dar permissão de armazenamento
termux-setup-storage

# Atualizar
pkg update && pkg upgrade

# Instalar Git
pkg install git

# Clonar repositório
git clone https://github.com/AdemirRed/Campainha-Digital-Android.git

# Entrar no projeto
cd Campainha-Digital-Android

# Instalar automaticamente
bash scripts/termux/install.sh

# Configurar (editar API_TOKEN e SESSION_SECRET)
nano backend/.env

# Iniciar
bash scripts/termux/start.sh
```

### Método 2: Copiar via ADB

No PC (PowerShell):

```powershell
cd 'f:\Campainha Digital Android'

# Copiar projeto para o celular
adb push . /sdcard/campainha-digital/
```

No Termux do celular:

```bash
termux-setup-storage
cd /storage/emulated/0/campainha-digital
bash scripts/termux/install.sh
nano backend/.env  # Configurar
bash scripts/termux/start.sh
```

---

## 5️⃣ TESTAR SISTEMA

1. **No Termux**, execute:
```bash
bash scripts/termux/health-check.sh
```

2. **No navegador do celular**, acesse:
```
http://localhost:3000
```

3. **Adicionar à tela inicial:**
   - Chrome → Menu (⋮) → "Adicionar à tela inicial"
   - Marque "Abrir como aplicativo"

✅ **Sistema funcionando em modo kiosk!**

---

## 📋 CHECKLIST FINAL

- [ ] Drivers Google USB instalados (PowerShell Admin)
- [ ] Repositório criado no GitHub
- [ ] Git remote configurado
- [ ] Push realizado com sucesso
- [ ] Modo desenvolvedor ativado no celular
- [ ] Depuração USB ativada
- [ ] Celular conectado (`adb devices` funciona)
- [ ] Projeto clonado/copiado para o celular
- [ ] Sistema instalado no Termux
- [ ] Backend iniciado
- [ ] Interface acessível em localhost:3000

---

## 🆘 PROBLEMAS?

### Driver não instalou
```powershell
# PowerShell como Admin
cd 'f:\Campainha Digital Android\drivers\google_usb_driver\usb_driver'
pnputil /add-driver android_winusb.inf /install
```

### Git push falhou
- Verifique se criou o repositório no GitHub
- Verifique se o nome está correto: `AdemirRed/Campainha-Digital-Android`
- Use PAT como senha, não sua senha do GitHub

### ADB não encontra celular
- Reinstale o driver
- Tente outro cabo USB
- Tente porta USB 2.0 (não 3.0)
- Revogue autorizações USB no celular

### Termux não abre/fecha
- Configurações → Apps → Termux → Bateria → "Sem restrições"
- Use versão F-Droid, não Google Play

---

## 🎯 PRÓXIMO PASSO

Após completar o checklist:

**Acesse no celular:** http://localhost:3000

O sistema deve mostrar:
1. Tela "Sistema em espera..." (3s)
2. "Bem-vindo!" (2s)
3. Interface principal com 3 botões

**Teste o fluxo:**
- Toque em "ENTREGA"
- Escolha "Mercado Livre"
- Digite um código (ex: ML123456)
- Confirme
- Deve mostrar "Entrega registrada!"

✅ **Campainha Digital funcionando!**

---

**Versão**: 1.0.0  
**Data**: 2026-08-22
