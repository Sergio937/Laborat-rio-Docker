#!/bin/bash
# Script de inicialização em modo Homologação
# Laboratório Docker - Stack Manager

set -e

echo "========================================"
echo "   Iniciando em Modo HOMOLOGAÇÃO"
echo "========================================"
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "[ERRO] Docker não encontrado. Instale o Docker primeiro."
    exit 1
fi

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "[ERRO] Python não encontrado. Instale o Python primeiro."
    exit 1
fi

echo "[OK] Docker e Python encontrados"
echo ""

# Criar ambiente virtual se não existir
if [ ! -d "venv" ]; then
    echo "[INFO] Criando ambiente virtual Python..."
    python3 -m venv venv
fi

# Ativar ambiente virtual
echo "[INFO] Ativando ambiente virtual..."
source venv/bin/activate

# Instalar/Atualizar dependências
echo "[INFO] Instalando dependências..."
pip install -q -r requirements.txt

# Definir variáveis de ambiente para homologação
export FLASK_ENV=staging
export FLASK_DEBUG=0
export FLASK_HOST=0.0.0.0
export FLASK_PORT=5000

echo ""
echo "========================================"
echo "   Ambiente: HOMOLOGAÇÃO"
echo "   Host: ${FLASK_HOST}"
echo "   Porta: ${FLASK_PORT}"
echo "========================================"
echo ""

# Iniciar aplicação
echo "[INFO] Iniciando Stack Manager..."
python app.py
