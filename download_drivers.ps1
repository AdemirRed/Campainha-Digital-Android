# Download de Drivers - Ulefone Armor 27 (Sem Admin)
# Este script baixa os drivers e fornece instruções de instalação

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Download de Drivers Ulefone Armor 27" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Criar pasta de drivers
$driversDir = "f:\Campainha Digital Android\drivers"
New-Item -ItemType Directory -Path $driversDir -Force | Out-Null

Write-Host "Pasta de drivers: $driversDir" -ForegroundColor Green
Write-Host ""

# Baixar Google USB Driver
Write-Host "Baixando Google USB Driver..." -ForegroundColor Yellow
$googleUrl = "https://dl.google.com/android/repository/usb_driver_r13-windows.zip"
$googleZip = "$driversDir\google_usb_driver.zip"

try {
    Invoke-WebRequest -Uri $googleUrl -OutFile $googleZip -UseBasicParsing
    Write-Host "Download concluído!" -ForegroundColor Green
    
    # Extrair
    Write-Host "Extraindo..." -ForegroundColor Yellow
    Expand-Archive -Path $googleZip -DestinationPath "$driversDir\google_usb_driver" -Force
    Write-Host "Arquivos extraídos em: $driversDir\google_usb_driver" -ForegroundColor Green
    
} catch {
    Write-Host "Erro ao baixar: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  INSTRUÇÕES DE INSTALAÇÃO" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "MÉTODO 1 - Instalação Manual (Recomendado):" -ForegroundColor Yellow
Write-Host "1. Abra o PowerShell como ADMINISTRADOR" -ForegroundColor White
Write-Host "   (Botão Iniciar → PowerShell → Botão direito → Executar como Administrador)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Execute o comando:" -ForegroundColor White
Write-Host "   cd '$driversDir\google_usb_driver\usb_driver'" -ForegroundColor Cyan
Write-Host "   pnputil /add-driver android_winusb.inf /install" -ForegroundColor Cyan
Write-Host ""

Write-Host "MÉTODO 2 - Via Gerenciador de Dispositivos:" -ForegroundColor Yellow
Write-Host "1. Conecte o Ulefone Armor 27 no PC via USB" -ForegroundColor White
Write-Host "2. No celular: Configurações → Opções do desenvolvedor → Ativar 'Depuração USB'" -ForegroundColor White
Write-Host "3. No PC: Win+X → Gerenciador de Dispositivos" -ForegroundColor White
Write-Host "4. Procure por 'Dispositivo desconhecido' ou 'Android Device'" -ForegroundColor White
Write-Host "5. Botão direito → Atualizar driver → Procurar drivers no computador" -ForegroundColor White
Write-Host "6. Navegue até: $driversDir\google_usb_driver\usb_driver" -ForegroundColor Cyan
Write-Host "7. Clique em 'Avançar' e aguarde instalação" -ForegroundColor White
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Ativar Depuração USB no Celular" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Abra Configurações no Ulefone" -ForegroundColor White
Write-Host "2. Vá em 'Sobre o telefone' ou 'Sistema'" -ForegroundColor White
Write-Host "3. Toque 7 vezes em 'Número da versão'" -ForegroundColor White
Write-Host "4. Voltará uma tela e verá 'Opções do desenvolvedor'" -ForegroundColor White
Write-Host "5. Entre em 'Opções do desenvolvedor'" -ForegroundColor White
Write-Host "6. Ative o modo desenvolvedor (toggle no topo)" -ForegroundColor White
Write-Host "7. Ative 'Depuração USB'" -ForegroundColor White
Write-Host "8. Conecte o celular no PC" -ForegroundColor White
Write-Host "9. Aceite a permissão que aparecerá no celular" -ForegroundColor White
Write-Host ""

Write-Host "Drivers baixados com sucesso!" -ForegroundColor Green
Write-Host "Agora execute a instalação conforme as instruções acima." -ForegroundColor Yellow
Write-Host ""

# Abrir pasta dos drivers
Write-Host "Abrindo pasta dos drivers..." -ForegroundColor Gray
Start-Process explorer.exe -ArgumentList $driversDir

pause
