# 📱 Guia Completo - Drivers Ulefone Armor 27

## ✅ Status da Instalação

### Google USB Driver
- ✅ **Instalado com sucesso!**
- Localização: `oem23.inf` no sistema
- Permite: ADB, Fastboot, transferência de arquivos

### MTK Driver (MediaTek)
- ⏳ **Pendente - Instalação Manual**
- Necessário para: Flash de ROM, SP Flash Tool, modo Download

---

## 🔧 Próximos Passos

### 1️⃣ Baixar e Instalar Driver MTK

O navegador deve ter aberto automaticamente. Se não:

**Link direto**: https://spflashtool.com/download/mediatek-usb-vcom-drivers

#### Passo a passo:

1. **Baixar o driver**:
   - Procure por: **"MTK USB All Driver"** ou **"MediaTek USB VCOM Drivers"**
   - Baixe o arquivo `.zip`

2. **Extrair**:
   - Clique com botão direito no arquivo baixado
   - Escolha "Extrair tudo..."
   - Extraia para uma pasta (ex: `C:\MTK_Drivers`)

3. **Instalar**:
   - Abra a pasta extraída
   - Encontre o arquivo: `Install.bat` ou `Drv_Install.exe`
   - **Clique com botão direito** → **"Executar como administrador"**
   - Siga as instruções na tela
   - Clique em "Install" ou "Next"
   - Aguarde concluir

✅ **Driver MTK instalado!**

---

### 2️⃣ Configurar o Celular (Ulefone Armor 27)

#### Ativar Modo Desenvolvedor:

1. Abra **Configurações** no celular
2. Role até **"Sobre o telefone"** ou **"Sistema"**
3. Encontre **"Número da versão"** ou **"Versão do Android"**
4. **Toque 7 vezes** rapidamente
5. Deve aparecer: *"Você agora é um desenvolvedor!"*

#### Ativar Depuração USB:

1. Volte para **Configurações**
2. Procure por **"Opções do desenvolvedor"** ou **"Developer options"**
3. Ative a chave geral das **Opções do desenvolvedor**
4. Role e encontre **"Depuração USB"**
5. **Ative** a depuração USB
6. Aceite o aviso de segurança

#### Conectar ao PC:

1. Conecte o celular ao PC via **cabo USB**
2. No celular, deve aparecer um popup:
   - **"Permitir depuração USB?"**
   - Marque: **"Sempre permitir deste computador"**
   - Toque em **"Permitir"** ou **"OK"**

---

### 3️⃣ Verificar Conexão

Abra o PowerShell e execute:

```powershell
adb devices
```

**Resultado esperado:**
```
List of devices attached
ABC123456789    device
```

Se aparecer `unauthorized`:
- Verifique o popup no celular e aceite a depuração

Se aparecer `no devices`:
- Verifique se os drivers estão instalados
- Tente outro cabo USB
- Tente outra porta USB do PC

---

## 🔍 Comandos Úteis ADB

Após conectar com sucesso:

```powershell
# Verificar dispositivos conectados
adb devices

# Informações do dispositivo
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release

# Instalar APK no celular
adb install caminho\para\app.apk

# Copiar arquivo para celular
adb push arquivo.txt /sdcard/

# Copiar arquivo do celular para PC
adb pull /sdcard/arquivo.txt .

# Abrir shell no celular
adb shell

# Reiniciar celular
adb reboot

# Reiniciar em modo bootloader/fastboot
adb reboot bootloader

# Reiniciar em modo recovery
adb reboot recovery

# Capturar screenshot
adb exec-out screencap -p > screenshot.png

# Gravar tela (video)
adb shell screenrecord /sdcard/recording.mp4
# Ctrl+C para parar, depois:
adb pull /sdcard/recording.mp4 .

# Ver logs em tempo real
adb logcat
```

---

## 🚀 Uso com Termux (Campainha Digital)

### Conectar via ADB Wi-Fi (sem cabo)

1. **Com cabo USB conectado**, execute:

```powershell
# No PC
adb tcpip 5555
```

2. **Descubra o IP do celular**:

```powershell
adb shell ip addr show wlan0
# Ou simplesmente:
adb shell "ip -f inet addr show wlan0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1"
```

Exemplo de IP: `192.168.1.100`

3. **Conecte via Wi-Fi**:

```powershell
# Substitua pelo IP do seu celular
adb connect 192.168.1.100:5555
```

4. **Desconecte o cabo USB**

5. **Verifique**:

```powershell
adb devices
```

Deve aparecer:
```
192.168.1.100:5555    device
```

✅ Agora você pode usar ADB sem cabo!

### Acessar Termux via ADB

```powershell
# Abrir shell
adb shell

# Trocar para usuário termux
su -c 'am start -n com.termux/.app.TermuxActivity'

# Ou executar comando direto no Termux
adb shell "su -c 'cd /data/data/com.termux/files/home && bash'"
```

### Instalar APKs Remotamente

```powershell
# Instalar Termux via ADB
adb install termux.apk

# Instalar F-Droid
adb install f-droid.apk
```

---

## 🔧 Troubleshooting

### "adb não é reconhecido como comando"

**Solução 1 - Usar caminho completo:**
```powershell
cd "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools"
.\adb.exe devices
```

**Solução 2 - Adicionar ao PATH:**

Execute como Administrador:
```powershell
$androidPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$androidPath", "User")
```

Feche e reabra o PowerShell.

### Driver não instalou corretamente

1. **Desinstalar driver anterior**:
   - Gerenciador de Dispositivos
   - Encontre o dispositivo Android
   - Botão direito → Desinstalar
   - Marque "Excluir software de driver"

2. **Reinstalar**:
   - Execute `install_drivers.ps1` novamente
   - Ou instale manualmente via Gerenciador de Dispositivos:
     - Botão direito no dispositivo → Atualizar driver
     - "Procurar driver no computador"
     - Aponte para: `C:\Users\RedBlack-PC\AppData\Local\Temp\UlefoneDrivers\google_usb_driver\usb_driver`

### Celular aparece como "Unknown Device"

1. Desconecte o cabo
2. No celular:
   - Desative e reative "Depuração USB"
   - Ou: Revogue autorizações USB → Reconecte
3. Tente outro cabo USB (preferencialmente original)
4. Tente outra porta USB do PC (preferencialmente USB 2.0)

### "unauthorized" no adb devices

1. No celular, revogue autorizações:
   - Opções do desenvolvedor → Revogar autorizações de depuração USB
2. Desconecte e reconecte o cabo
3. Aceite o popup novamente (marque "Sempre permitir")

---

## 📋 Checklist Final

- [ ] Google USB Driver instalado (✅ Feito!)
- [ ] MTK Driver instalado (⏳ Pendente)
- [ ] Modo Desenvolvedor ativado no celular
- [ ] Depuração USB ativada
- [ ] Celular conectado via USB
- [ ] Permissão de depuração aceita no celular
- [ ] `adb devices` mostra o dispositivo
- [ ] (Opcional) ADB via Wi-Fi configurado

---

## 🎯 Próximo Passo: Instalar Campainha Digital

Após completar o checklist acima, você pode:

1. **Copiar projeto para o celular via ADB**:

```powershell
cd "f:\Campainha Digital Android"

# Criar pasta no celular
adb shell mkdir -p /sdcard/campainha-digital

# Copiar projeto
adb push . /sdcard/campainha-digital/

# No Termux do celular:
# termux-setup-storage
# cd /storage/emulated/0/campainha-digital
# bash scripts/termux/install.sh
```

2. **Ou clonar do GitHub** (método recomendado):

No Termux do celular:
```bash
git clone https://github.com/AdemirRed/Campainha-Digital-Android.git
cd Campainha-Digital-Android
bash scripts/termux/install.sh
```

---

## 📚 Links Úteis

- **Drivers MTK**: https://spflashtool.com/download/mediatek-usb-vcom-drivers
- **ADB Download**: https://developer.android.com/tools/releases/platform-tools
- **Ulefone Support**: https://www.ulefone.com/support.html
- **Repositório do Projeto**: https://github.com/AdemirRed/Campainha-Digital-Android

---

**Status**: ✅ Google USB Driver OK | ⏳ MTK Driver Pendente  
**Última Atualização**: 2026-08-22
