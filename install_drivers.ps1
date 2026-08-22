# Script de Instalação de Drivers - Ulefone Armor 27
# Execução: Execute este script como Administrador

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Instalador de Drivers Ulefone Armor 27" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar privilégios de administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERRO: Este script precisa ser executado como Administrador!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Clique com botão direito no arquivo e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Verificando administrador... OK" -ForegroundColor Green
Write-Host ""

# Criar pasta temporária
$tempDir = "$env:TEMP\UlefoneDrivers"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Host "Pasta temporária criada: $tempDir" -ForegroundColor Gray
Write-Host ""

# Opções de driver
Write-Host "Escolha o tipo de driver para instalar:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Google USB Driver (Universal Android - Recomendado)" -ForegroundColor White
Write-Host "   - Para ADB, Fastboot, desenvolvimento" -ForegroundColor Gray
Write-Host "   - Funciona com qualquer Android" -ForegroundColor Gray
Write-Host ""
Write-Host "2. MTK USB All Driver (MediaTek - Avançado)" -ForegroundColor White
Write-Host "   - Para flashing, SP Flash Tool" -ForegroundColor Gray
Write-Host "   - Ulefone usa chipset MediaTek" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Ambos (Recomendado para uso completo)" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Digite sua escolha (1, 2 ou 3)"

function Install-GoogleUSBDriver {
    Write-Host ""
    Write-Host "=== Instalando Google USB Driver ===" -ForegroundColor Cyan
    Write-Host ""
    
    # URL do Android SDK Platform Tools (contém drivers)
    $url = "https://dl.google.com/android/repository/usb_driver_r13-windows.zip"
    $zipFile = "$tempDir\google_usb_driver.zip"
    $extractPath = "$tempDir\google_usb_driver"
    
    try {
        Write-Host "Baixando Google USB Driver..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing
        Write-Host "Download concluído!" -ForegroundColor Green
        
        Write-Host "Extraindo arquivos..." -ForegroundColor Yellow
        Expand-Archive -Path $zipFile -DestinationPath $extractPath -Force
        
        Write-Host "Instalando driver..." -ForegroundColor Yellow
        $infFile = Get-ChildItem -Path $extractPath -Filter "*.inf" -Recurse | Select-Object -First 1
        
        if ($infFile) {
            Write-Host "Arquivo INF encontrado: $($infFile.FullName)" -ForegroundColor Gray
            pnputil /add-driver $infFile.FullName /install
            Write-Host "Google USB Driver instalado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "ERRO: Arquivo INF não encontrado" -ForegroundColor Red
        }
    } catch {
        Write-Host "ERRO ao instalar Google USB Driver: $_" -ForegroundColor Red
    }
}

function Install-MTKDriver {
    Write-Host ""
    Write-Host "=== MTK Driver (MediaTek) ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Os drivers MTK precisam ser baixados manualmente:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Acesse: https://spflashtool.com/download/mediatek-usb-vcom-drivers" -ForegroundColor White
    Write-Host "2. Baixe o 'MTK USB All Driver'" -ForegroundColor White
    Write-Host "3. Extraia e execute 'Install.bat' como Administrador" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "Deseja abrir o link no navegador agora? (S/N)"
    if ($openBrowser -eq "S" -or $openBrowser -eq "s") {
        Start-Process "https://spflashtool.com/download/mediatek-usb-vcom-drivers"
    }
}

# Executar instalação conforme escolha
switch ($choice) {
    "1" {
        Install-GoogleUSBDriver
    }
    "2" {
        Install-MTKDriver
    }
    "3" {
        Install-GoogleUSBDriver
        Install-MTKDriver
    }
    default {
        Write-Host "Opção inválida!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Configuração do Celular" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para usar ADB/Fastboot, ative no celular:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Vá em Configurações → Sobre o telefone" -ForegroundColor White
Write-Host "2. Toque 7 vezes em 'Número da versão'" -ForegroundColor White
Write-Host "3. Volte → Opções do desenvolvedor" -ForegroundColor White
Write-Host "4. Ative 'Depuração USB'" -ForegroundColor White
Write-Host "5. Conecte o celular no PC via USB" -ForegroundColor White
Write-Host "6. Aceite a permissão de depuração no celular" -ForegroundColor White
Write-Host ""

Write-Host "Instalação concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "Aperte qualquer tecla para fechar..."
pause
