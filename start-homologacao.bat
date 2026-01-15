@echo off
REM Script de inicialização em modo Homologação
REM Laboratório Docker - Stack Manager

echo ========================================
echo   Iniciando em Modo HOMOLOGACAO
echo ========================================
echo.

REM Verificar se Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao encontrado. Instale o Docker primeiro.
    pause
    exit /b 1
)

REM Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado. Instale o Python primeiro.
    pause
    exit /b 1
)

echo [OK] Docker e Python encontrados
echo.

REM Criar ambiente virtual se não existir
if not exist venv (
    echo [INFO] Criando ambiente virtual Python...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao criar ambiente virtual
        pause
        exit /b 1
    )
)

REM Ativar ambiente virtual
echo [INFO] Ativando ambiente virtual...
call venv\Scripts\activate.bat

REM Instalar/Atualizar dependências
echo [INFO] Instalando dependencias...
pip install -q -r requirements.txt

REM Definir variáveis de ambiente para homologação
set FLASK_ENV=staging
set FLASK_DEBUG=0
set FLASK_HOST=0.0.0.0
set FLASK_PORT=5000

echo.
echo ========================================
echo   Ambiente: HOMOLOGACAO
echo   Host: %FLASK_HOST%
echo   Porta: %FLASK_PORT%
echo ========================================
echo.

REM Iniciar aplicação
echo [INFO] Iniciando Stack Manager...
python app.py

REM Manter terminal aberto em caso de erro
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar aplicacao
    pause
)
