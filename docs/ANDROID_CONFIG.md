# Configuração do Android - Modo Kiosk

Guia para configurar o celular Android como dispositivo dedicado (kiosk) para a campainha.

---

## Configurações Essenciais

### 1. Tela Sempre Ligada

**Opção A: Configurações do Desenvolvedor**

1. Vá em **Configurações** → **Sobre o telefone**
2. Toque 7 vezes em "Número da versão"
3. Volte → **Opções do desenvolvedor**
4. Ative: **"Permanecer ativo"** (tela nunca desliga enquanto carregando)

**Opção B: App de Terceiros**

- Instale **"Stay Alive!"** ou **"Keep Screen On"** da Play Store

---

### 2. Desativar Otimização de Bateria

1. **Configurações** → **Apps** → **Termux**
2. **Bateria** → **Sem restrições**

Repita para o navegador que será usado (Chrome, Firefox, etc).

---

### 3. Desativar Bloqueio de Tela

1. **Configurações** → **Segurança**
2. **Bloqueio de tela** → **Nenhum**

⚠️ **Atenção**: Isso remove a segurança do dispositivo!  
Recomendado apenas para dispositivo dedicado.

---

### 4. Configurar Brilho

1. **Configurações** → **Tela**
2. **Brilho** → Ajuste para 70-80% (suficiente para visibilidade externa)
3. Desative **"Brilho automático"**

---

## Modo Kiosk (Fullscreen)

### Opção A: Chrome Custom Tab (Simples)

1. Abra Chrome em `http://localhost:3000`
2. Menu (⋮) → **"Adicionar à tela inicial"**
3. Ative **"Abrir como aplicativo"**
4. Toque no ícone criado na tela inicial

Resultado: PWA abre em fullscreen sem barras do navegador.

---

### Opção B: Kiosk Browser (Avançado)

Instale um navegador dedicado para modo kiosk:

**Fully Kiosk Browser** (Pago, mas completo)
- Download: https://www.fully-kiosk.com
- Recursos:
  - Fullscreen forçado
  - Bloqueia botões físicos
  - Inicia automaticamente
  - Proteção por senha
  - Remote management

**Configuração Básica Fully Kiosk:**
1. Instale o app
2. Em "Website URL", coloque: `http://localhost:3000`
3. Ative:
   - "Start on Boot"
   - "Prevent Status Bar"
   - "Hide System UI"
   - "Lock Settings"
4. Configure senha de administrador

---

### Opção C: App Launcher Customizado

**Simple Kiosk Launcher** (Grátis)
1. Instale via Play Store
2. Defina como launcher padrão
3. Adicione apenas o navegador/PWA

---

## Configurações de Rede

### Wi-Fi Sempre Conectado

1. **Configurações** → **Wi-Fi**
2. Conecte na rede desejada
3. Pressione e segure na rede → **Modificar**
4. **Opções avançadas** → **Manter Wi-Fi ativo: Sempre**

### IP Estático (Recomendado)

1. Configurações do Wi-Fi → **Modificar rede**
2. **Opções avançadas** → **Configurações de IP: Estático**
3. Defina:
   - **Endereço IP**: 192.168.1.100 (exemplo)
   - **Gateway**: 192.168.1.1
   - **DNS1**: 8.8.8.8
   - **DNS2**: 8.8.4.4

---

## Segurança Física

### Evitar Acesso Não Autorizado

**Bloqueio de Botões Físicos**:
- Use app como **Button Savior** para desativar botões
- Ou configure Fully Kiosk para ignorar botões

**Proteção com Senha**:
- Configure senha no navegador kiosk
- Senha necessária para sair do modo kiosk

---

## Montagem Física

### Posicionamento do Celular

1. **Altura**: 1,40m - 1,60m (confortável para acesso)
2. **Orientação**: Portrait (vertical)
3. **Proteção**: Case à prova d'água se exposto ao tempo

### Alimentação

- **Cabo USB**: Use cabo longo e resistente
- **Carregador**: Mínimo 2A para manter carga
- **Proteção de Sobrecarga**: Recomendado

### Proteção Solar

Se exposto ao sol:
- Use protetor de tela anti-reflexo
- Considere case com viseira
- Evite luz solar direta (pode superaquecer)

---

## Manutenção

### Limpeza da Tela
- Use pano de microfibra
- Evite produtos abrasivos

### Verificação Semanal
```bash
# No Termux
bash scripts/termux/health-check.sh
```

### Reinicialização Mensal
- Reinicie o celular 1x por mês
- Verificar se Termux:Boot ativa automaticamente

---

## Configurações Avançadas

### ADB via Wi-Fi (Para Manutenção Remota)

1. Conecte o celular via USB ao PC (apenas uma vez)
2. Ative **Depuração USB** em Opções do Desenvolvedor
3. No PC:
```bash
adb tcpip 5555
adb connect <IP_DO_CELULAR>:5555
```
4. Desconecte USB
5. Agora pode acessar via Wi-Fi:
```bash
adb shell
```

### Rotação de Tela Bloqueada

Desative auto-rotate para manter portrait:
1. **Configurações** → **Tela**
2. Desative **"Girar automaticamente"**

---

## Checklist Final

Antes de considerar o setup completo:

- [ ] Tela sempre ligada configurada
- [ ] Otimização de bateria desativada
- [ ] Bloqueio de tela removido (ou configurado)
- [ ] Brilho fixo configurado
- [ ] PWA adicionada à tela inicial (ou kiosk browser instalado)
- [ ] Wi-Fi sempre ativo
- [ ] IP estático configurado (opcional mas recomendado)
- [ ] Termux:Boot instalado e testado
- [ ] Sistema inicia automaticamente após reboot
- [ ] Celular montado na posição final
- [ ] Alimentação contínua garantida
- [ ] Teste completo de fluxo (detecção → entrega)

---

## Configurações por Fabricante

### Samsung

**Desativar Bixby** (evita ativação acidental):
1. Configurações → Apps → Bixby → Desativar

**Desativar Edge Screen**:
1. Configurações → Display → Edge Screen → Desativar

### Xiaomi/Redmi

**Desativar MIUI Optimization**:
1. Opções do Desenvolvedor → Desative "MIUI optimization"

**Autostart**:
1. Configurações → Apps → Gerenciar apps → Termux
2. Ative **"Inicialização automática"**

### Motorola

Geralmente já vem com Android puro, poucas configurações extras necessárias.

---

## Troubleshooting

### Tela desliga mesmo com "Permanecer ativo"
- Verifique se carregador está conectado
- Use app de terceiros "Stay Alive!"

### Sistema lento
- Libere espaço: mínimo 1GB livre
- Limpe cache: Configurações → Armazenamento → Cache

### Superaquecimento
- Reduza brilho para 60%
- Verifique ventilação adequada
- Evite exposição solar direta

### Wi-Fi desconecta
- Desative "Scanning sempre disponível"
- Configure IP estático
- Use banda 2.4GHz (melhor alcance)

---

## Modo kiosk reforçado (opcional, sem root)

Sem esta etapa o app já funciona: quando o "Modo kiosk" está ligado no
painel, o `KioskWatchdogService` relança o app se alguém sair dele. Mas o
botão Home não é bloqueável nesse modo.

> **Atenção:** o loop de relançamento do `KioskWatchdogService` é
> *best-effort*. Em aparelhos que **não** estão provisionados como device
> owner, o Android 10+ bloqueia o "background activity start", então o
> relançamento automático pode simplesmente não acontecer. Por isso o
> provisionamento como **device owner** (o passo `adb dpm set-device-owner`
> abaixo) é **fortemente recomendado** para um enforcement de kiosk
> confiável — o watchdog sozinho não garante nada. Limitação conhecida: o
> loop do watchdog também roda com a tela desligada (ele só pula o
> relançamento quando o aparelho não está interativo).

Para travar de verdade (Lock Task,
com Home e Recentes bloqueados), provisione o app como **device owner**:

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

O comando `set-device-owner` só funciona num aparelho recém-configurado
(sem contas adicionadas). Não requer root.

---

**Próximo Passo**: [Troubleshooting Geral](TROUBLESHOOTING.md)

**Versão**: 1.0 (Fase 1 - MVP)
