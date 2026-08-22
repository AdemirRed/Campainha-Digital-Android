# Setup Termux - Campainha Digital

Guia completo de instalação e configuração no Android via Termux.

## Pré-requisitos

- **Android**: versão 8.0 ou superior (API 26+)
- **Armazenamento**: mínimo 2GB livres
- **Bateria**: dispositivo conectado à fonte de energia
- **Rede**: Wi-Fi configurado (opcional, mas recomendado)

---

## Passo 1: Instalar Termux

⚠️ **IMPORTANTE**: Use apenas a versão do **F-Droid**, NÃO do Google Play!

A versão do Google Play está desatualizada e não recebe updates.

### Instalar F-Droid

1. Baixe F-Droid: https://f-droid.org/
2. Ative "Fontes Desconhecidas" nas configurações do Android
3. Instale o arquivo APK baixado

### Instalar Termux via F-Droid

1. Abra o F-Droid
2. Procure por "Termux"
3. Instale **Termux** (versão oficial)

---

## Passo 2: Configurar Termux

### Dar Permissões de Armazenamento

```bash
termux-setup-storage
```

Aceite as permissões quando solicitado.

### Atualizar Repositórios

```bash
pkg update
pkg upgrade
```

Pressione `Y` para confirmar.

---

## Passo 3: Clonar o Repositório

### Instalar Git

```bash
pkg install git
```

### Clonar Projeto

```bash
cd ~
git clone <URL_DO_REPOSITORIO>
cd smart-doorbell
```

---

## Passo 4: Executar Instalação Automática

```bash
bash scripts/termux/install.sh
```

Este script irá:
- ✅ Instalar Node.js
- ✅ Instalar dependências do backend e frontend
- ✅ Criar diretórios necessários
- ✅ Compilar o projeto
- ✅ Criar arquivo `.env`

**Tempo estimado**: 5-10 minutos (dependendo da internet)

---

## Passo 5: Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```bash
nano backend/.env
```

**Configure pelo menos:**

```env
API_TOKEN=sua-senha-secreta-aqui
SESSION_SECRET=outra-chave-secreta
```

💡 **Dica**: Use senhas fortes! Gere com:
```bash
openssl rand -hex 32
```

Salvar: `Ctrl+O`, `Enter`  
Sair: `Ctrl+X`

---

## Passo 6: Iniciar o Sistema

```bash
bash scripts/termux/start.sh
```

Aguarde a mensagem:
```
✅ Backend rodando em http://localhost:3000
```

---

## Passo 7: Acessar Interface

1. Abra o navegador do Android (Chrome recomendado)
2. Acesse: `http://localhost:3000`
3. Ative modo fullscreen:
   - Chrome: Menu → "Adicionar à tela inicial"
   - Ou ative manualmente nas configurações do navegador

---

## Scripts Disponíveis

### Iniciar Sistema
```bash
bash scripts/termux/start.sh
```

### Parar Sistema
```bash
bash scripts/termux/stop.sh
```

### Verificar Saúde
```bash
bash scripts/termux/health-check.sh
```

### Ver Logs em Tempo Real
```bash
bash scripts/termux/logs.sh
```

---

## Inicialização Automática (Opcional)

Para iniciar automaticamente quando o celular ligar:

### Instalar Termux:Boot

Via F-Droid:
1. Procure "Termux:Boot"
2. Instale

### Configurar Script de Boot

```bash
mkdir -p ~/.termux/boot
nano ~/.termux/boot/start-doorbell.sh
```

Conteúdo:
```bash
#!/data/data/com.termux/files/usr/bin/bash
cd ~/smart-doorbell
bash scripts/termux/start.sh
```

Dar permissão:
```bash
chmod +x ~/.termux/boot/start-doorbell.sh
```

### Ativar Boot
Reinicie o celular. O Termux:Boot deve aparecer nas notificações.

---

## Manter Termux Ativo em Background

### Método 1: Wake Lock
No Termux, menu → "Acquire wakelock"

### Método 2: Termux:API (avançado)

```bash
pkg install termux-api
```

Crie serviço persistente com `termux-wake-lock`.

---

## Solução de Problemas

### Termux fecha sozinho
- Desative otimização de bateria para Termux
- Configurações → Apps → Termux → Bateria → "Sem restrições"

### "pkg: command not found"
- Reinstale Termux (versão F-Droid)

### "Permission denied"
- Execute: `termux-setup-storage` novamente
- Verifique permissões de armazenamento

### Backend não inicia
- Verifique logs: `cat logs/backend.log`
- Verifique porta 3000 disponível: `netstat -tuln | grep 3000`

### "Cannot find module"
- Execute: `bash scripts/termux/install.sh` novamente

---

## Otimizações de Performance

### Liberar Memória
```bash
sync
echo 3 > /proc/sys/vm/drop_caches
```

### Monitorar Recursos
```bash
top
```

Pressione `q` para sair.

---

## Backup do Banco de Dados

### Manual
```bash
cp data/doorbell.db data/doorbell_backup_$(date +%Y%m%d).db
```

### Automático (Cron)
```bash
pkg install cronie
crontab -e
```

Adicionar linha:
```
0 3 * * * cd ~/smart-doorbell && cp data/doorbell.db data/backup_$(date +\%Y\%m\%d).db
```

---

## Atualizar Sistema

```bash
cd ~/smart-doorbell
git pull
bash scripts/termux/install.sh
bash scripts/termux/stop.sh
bash scripts/termux/start.sh
```

---

## Desinstalar

```bash
bash scripts/termux/stop.sh
cd ~
rm -rf smart-doorbell
```

---

**Próximos Passos**: [Configuração do Android](ANDROID_CONFIG.md)

**Versão**: 1.0 (Fase 1 - MVP)
