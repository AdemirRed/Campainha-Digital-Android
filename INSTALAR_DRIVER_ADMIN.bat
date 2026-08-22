@echo off
echo ========================================
echo  Instalando Google USB Driver
echo ========================================
echo.
echo Este script requer permissoes de Administrador!
echo.
pause

:: Verifica se esta rodando como admin
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Executando como Administrador
    echo.
) else (
    echo [ERRO] Este script precisa ser executado como Administrador!
    echo.
    echo Clique com botao direito neste arquivo e selecione:
    echo "Executar como administrador"
    echo.
    pause
    exit /b 1
)

:: Instalar driver
echo Instalando driver...
echo.

cd /d "%~dp0drivers\google_usb_driver\usb_driver"
pnputil /add-driver android_winusb.inf /install

if %errorLevel% == 0 (
    echo.
    echo ========================================
    echo  Driver instalado com sucesso!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo  ERRO ao instalar driver
    echo ========================================
    echo.
    echo Tente instalar manualmente:
    echo 1. Abra PowerShell como Admin
    echo 2. Execute:
    echo    cd '%~dp0drivers\google_usb_driver\usb_driver'
    echo    pnputil /add-driver android_winusb.inf /install
)

echo.
pause
