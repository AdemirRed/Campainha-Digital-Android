# Troubleshooting - Problemas Comuns

Soluções para problemas frequentes da Campainha Digital.

---

## Backend

### ❌ Backend não inicia

**Sintomas**: Nada acontece ao executar `start.sh`

**Soluções**:

1. Verificar se compilou:
```bash
ls backend/dist/index.js
```
Se não existir:
```bash
cd backend
npm run build
```

2. Verificar logs:
```bash
cat logs/backend.log
```

3. Testar manualmente:
```bash
cd backend
node dist/index.js
```

4. Verificar porta 3000 ocupada:
```bash
netstat -tuln | grep 3000
```
Se ocupada:
```bash
pkill -f "node.*3000"
```

---

### ❌ Erro "Cannot find module"

**Solução**:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

### ❌ Database locked

**Causa**: Múltiplas instâncias do backend rodando

**Solução**:
```bash
bash scripts/termux/stop.sh
pkill -f "node.*backend"
bash scripts/termux/start.sh
```

---

## Frontend

### ❌ Página em branco

**Soluções**:

1. Verificar se backend está rodando:
```bash
curl http://localhost:3000/health
```

2. Limpar cache do navegador:
   - Chrome: Configurações → Privacidade → Limpar dados

3. Verificar build:
```bash
cd frontend
npm run build
```

---

### ❌ "Failed to fetch" ao enviar entrega

**Causa**: Backend não acessível

**Soluções**:

1. Verificar se backend está ativo:
```bash
bash scripts/termux/health-check.sh
```

2. Verificar firewall (se houver)

3. Testar API diretamente:
```bash
curl -X POST http://localhost:3000/api/deliveries \
  -H "Content-Type: application/json" \
  -d '{"company":"mercadolivre","tracking_code":"TEST123"}'
```

---

### ❌ Interface não volta para standby

**Causa**: Timer de inatividade não funcionando

**Solução**:
- Recarregue a página (F5 ou Pull-to-refresh)
- Verifique se JavaScript está habilitado

---

## Termux

### ❌ "pkg: command not found"

**Causa**: Termux corrompido ou versão Google Play

**Solução**:
1. Desinstale Termux
2. Instale versão F-Droid: https://f-droid.org/packages/com.termux/

---

### ❌ Termux fecha sozinho

**Soluções**:

1. Desativar otimização de bateria:
   - Configurações → Apps → Termux → Bateria → Sem restrições

2. Usar Wake Lock:
   - No Termux: Menu → "Acquire wakelock"

3. Reinstalar Termux:Boot

---

### ❌ "Permission denied" ao executar script

**Solução**:
```bash
chmod +x scripts/termux/*.sh
bash scripts/termux/install.sh
```

---

## Rede

### ❌ Não consigo acessar http://localhost:3000

**Soluções**:

1. Verificar se backend está rodando:
```bash
ps aux | grep node
```

2. Verificar porta:
```bash
netstat -tuln | grep 3000
```

3. Tentar IP ao invés de localhost:
```bash
ifconfig
# Anote o IP (ex: 192.168.1.100)
# Acesse: http://192.168.1.100:3000
```

---

### ❌ Wi-Fi desconecta frequentemente

**Soluções**:

1. Desativar "Scanning sempre disponível":
   - Configurações → Wi-Fi → Avançado

2. IP Estático:
   - Veja [ANDROID_CONFIG.md](ANDROID_CONFIG.md#ip-estático-recomendado)

3. Força da banda:
   - Use 2.4GHz (melhor alcance) em vez de 5GHz

---

## Performance

### ❌ Sistema lento

**Soluções**:

1. Liberar memória:
```bash
sync
echo 3 > /proc/sys/vm/drop_caches
```

2. Verificar espaço:
```bash
df -h
```
Libere espaço se < 500MB livres.

3. Limpar logs antigos:
```bash
rm logs/*.log
```

4. Limpar banco antigo:
```bash
sqlite3 data/doorbell.db "VACUUM;"
```

---

### ❌ Bateria descarrega rápido

**Causas**: Tela sempre ligada, processamento contínuo

**Soluções**:

1. Manter sempre no carregador (recomendado)

2. Reduzir brilho:
   - Configurações → Tela → Brilho 60%

3. Desativar recursos não usados:
   - Bluetooth
   - GPS
   - NFC

---

## Banco de Dados

### ❌ Erro "database is locked"

**Solução**:
```bash
bash scripts/termux/stop.sh
# Aguardar 5 segundos
bash scripts/termux/start.sh
```

---

### ❌ Banco corrompido

**Solução** (perde dados):
```bash
bash scripts/termux/stop.sh
mv data/doorbell.db data/doorbell_corrupted.db
bash scripts/termux/start.sh
# Backend criará novo banco
```

**Recuperação** (tentar):
```bash
sqlite3 data/doorbell_corrupted.db ".dump" | sqlite3 data/doorbell_recovered.db
```

---

## Geral

### ❌ Após atualização, sistema não funciona

**Solução**:
```bash
git pull
bash scripts/termux/stop.sh
bash scripts/termux/install.sh
bash scripts/termux/start.sh
```

---

### ❌ Reset completo (última opção)

**⚠️ ATENÇÃO: Perde todos os dados!**

```bash
bash scripts/termux/stop.sh
rm -rf data/ logs/ node_modules/ backend/node_modules/ frontend/node_modules/
bash scripts/termux/install.sh
nano backend/.env  # Configure novamente
bash scripts/termux/start.sh
```

---

## Logs e Diagnóstico

### Ver logs em tempo real
```bash
bash scripts/termux/logs.sh
```

### Ver logs do sistema
```bash
# Últimas 50 linhas
tail -n 50 logs/combined.log

# Apenas erros
tail -n 50 logs/error.log
```

### Verificar saúde do sistema
```bash
bash scripts/termux/health-check.sh
```

### Testar API manualmente
```bash
# Health check
curl http://localhost:3000/health

# Criar evento
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"person_detected"}'

# Listar eventos
curl http://localhost:3000/api/events
```

---

## Obter Ajuda

### Logs para Suporte

Se precisar relatar um bug, colete:

```bash
# 1. Informações do sistema
uname -a > debug_info.txt
node --version >> debug_info.txt
npm --version >> debug_info.txt

# 2. Status
bash scripts/termux/health-check.sh >> debug_info.txt

# 3. Logs recentes
echo "=== BACKEND LOG ===" >> debug_info.txt
tail -n 100 logs/backend.log >> debug_info.txt

# 4. Ver arquivo
cat debug_info.txt
```

### Informações Úteis

Ao reportar problemas, inclua:
- Versão do Android
- Modelo do celular
- Mensagem de erro completa
- Passos para reproduzir
- Logs (debug_info.txt)

---

## Prevenção

### Backup Regular

```bash
# Banco de dados
cp data/doorbell.db backups/doorbell_$(date +%Y%m%d).db

# Configurações
cp backend/.env backups/.env_$(date +%Y%m%d)
```

### Monitoramento

Configure verificação diária:
```bash
crontab -e
```

Adicione:
```
0 8 * * * cd ~/smart-doorbell && bash scripts/termux/health-check.sh > logs/daily_check.log
```

---

**Versão**: 1.0 (Fase 1 - MVP)  
**Última Atualização**: 2026-08-22
