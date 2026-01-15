#!/bin/bash
# Script de Deploy para Homologação em Linux
# Laboratório Docker - Stack Manager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "   Deploy em HOMOLOGAÇÃO - Linux"
echo "========================================"
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "[ERRO] Docker não encontrado. Instale o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está disponível
if ! docker compose version &> /dev/null; then
    echo "[ERRO] Docker Compose não encontrado."
    exit 1
fi

echo "[OK] Docker e Docker Compose encontrados"
echo ""

# Opção 1: Deploy com Docker Compose
echo "Iniciando Stack Manager com Docker Compose..."
echo ""

cd "$SCRIPT_DIR"

# Parar containers antigos se existirem
echo "[INFO] Parando containers antigos (se existirem)..."
docker compose -f docker-compose.homologacao.yml down 2>/dev/null || true

# Fazer build da imagem
echo "[INFO] Construindo imagem Docker..."
docker compose -f docker-compose.homologacao.yml build

# Subir container
echo "[INFO] Iniciando container..."
docker compose -f docker-compose.homologacao.yml up -d

# Aguardar container estar pronto
echo "[INFO] Aguardando aplicação iniciar..."
sleep 5

# Verificar status
if docker compose -f docker-compose.homologacao.yml ps | grep -q "Up"; then
    echo ""
    echo "========================================"
    echo "   ✓ Deploy realizado com sucesso!"
    echo "========================================"
    echo ""
    echo "   URL: http://localhost:5000"
    echo ""
    echo "Comandos úteis:"
    echo "  Ver logs:     docker compose -f docker-compose.homologacao.yml logs -f"
    echo "  Parar:        docker compose -f docker-compose.homologacao.yml down"
    echo "  Reiniciar:    docker compose -f docker-compose.homologacao.yml restart"
    echo ""
else
    echo ""
    echo "[ERRO] Falha ao iniciar container. Verifique os logs:"
    echo "  docker compose -f docker-compose.homologacao.yml logs"
    exit 1
fi
