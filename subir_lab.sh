#!/bin/bash
set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Função para verificar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar dependências
log_info "Verificando dependências..."
if ! command_exists docker; then
    log_error "Docker não encontrado. Por favor, instale o Docker primeiro."
    exit 1
fi

if ! command_exists docker compose; then
    log_error "Docker Compose não encontrado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi

# ---------------------------
# Verificando estrutura do lab
# ---------------------------
log_info "Verificando estrutura do lab-devops..."

if [ ! -d "lab-devops" ]; then
    log_error "Diretório lab-devops não encontrado!"
    log_info "Crie a estrutura primeiro ou execute de outro diretório"
    exit 1
fi

if [ ! -d "stacks" ]; then
    log_error "Diretório stacks não encontrado!"
    exit 1
fi

cd lab-devops

if [ ! -f "docker-compose.yaml" ]; then
    log_error "Arquivo docker-compose.yaml não encontrado em lab-devops/"
    exit 1
fi

if [ ! -f "haproxy/haproxy.cfg" ]; then
    log_error "Arquivo haproxy/haproxy.cfg não encontrado!"
    exit 1
fi

if [ ! -f "../stacks/traefik-stack.yaml" ]; then
    log_error "Arquivo stacks/traefik-stack.yaml não encontrado!"
    exit 1
fi

if [ ! -f "../stacks/portainer-stack.yaml" ]; then
    log_error "Arquivo stacks/portainer-stack.yaml não encontrado!"
    exit 1
fi

log_success "Arquivos de configuração encontrados"


# ---------------------------
# Subindo infraestrutura
# ---------------------------
log_info "Subindo containers base..."
docker compose up -d

log_info "Aguardando Docker daemon no swarm1..."
TIMEOUT=60
ELAPSED=0
until docker exec lab-swarm1 docker info >/dev/null 2>&1; do 
    if [ $ELAPSED -ge $TIMEOUT ]; then
        log_error "Timeout aguardando swarm1"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done
log_success "Swarm1 está pronto"

log_info "Aguardando Docker daemon no swarm2..."
ELAPSED=0
until docker exec lab-swarm2 docker info >/dev/null 2>&1; do 
    if [ $ELAPSED -ge $TIMEOUT ]; then
        log_error "Timeout aguardando swarm2"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done
log_success "Swarm2 está pronto"

# ---------------------------
# Inicializando Swarm
# ---------------------------
log_info "Inicializando Swarm no swarm1..."
docker exec lab-swarm1 docker swarm init --advertise-addr 172.31.0.11 2>/dev/null || true

ELAPSED=0
until docker exec lab-swarm1 docker info | grep -q "Swarm: active"; do 
    if [ $ELAPSED -ge $TIMEOUT ]; then
        log_error "Timeout inicializando swarm"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done
log_success "Swarm inicializado"

log_info "Conectando worker (swarm2)..."
WORKER_TOKEN=$(docker exec lab-swarm1 docker swarm join-token -q worker)
docker exec lab-swarm2 docker swarm join --token $WORKER_TOKEN 172.31.0.11:2377 2>/dev/null || true
log_success "Worker conectado"


# ---------------------------
# Rede pública Traefik
# ---------------------------
log_info "Criando rede traefik-public..."
docker exec lab-swarm1 docker network create --driver overlay traefik-public 2>/dev/null || true
log_success "Rede traefik-public criada"

log_info "Criando rede devops-network..."
docker exec lab-swarm1 docker network create --driver overlay devops-network 2>/dev/null || true
log_success "Rede devops-network criada"

# ---------------------------
# Subindo Traefik
# ---------------------------
log_info "Fazendo deploy do Traefik stack..."
if docker exec lab-swarm1 docker stack deploy -c /stacks/traefik-stack.yaml traefik; then
    log_success "Stack Traefik deployado"
else
    log_error "Erro ao deployar stack Traefik"
    log_info "Verificando conteúdo do arquivo..."
    docker exec lab-swarm1 cat /tmp/traefik-stack.yaml
    exit 1
fi

# Aguardar Traefik estar pronto
sleep 5


# ---------------------------
# Deploy Portainer
# ---------------------------
log_info "Fazendo deploy do Portainer stack..."
if docker exec lab-swarm1 docker stack deploy -c /stacks/portainer-stack.yaml portainer; then
    log_success "Stack Portainer deployado"
else
    log_error "Erro ao deployar stack Portainer"
    log_info "Verificando conteúdo do arquivo..."
    docker exec lab-swarm1 cat /tmp/portainer-stack.yaml
    exit 1
fi

log_success "Portainer iniciado (http://localhost:9000)"


# ---------------------------
# Final
# ---------------------------
echo ""
echo -e "${GREEN}=============================================="
echo "✅ LAB DEVOPS CRIADO COM SUCESSO!"
echo -e "==============================================${NC}"
echo ""
echo -e "${BLUE}🌐 Traefik (HAProxy):${NC} http://localhost:8080"
echo -e "${BLUE}🌐 Portainer:${NC}        http://localhost:9000"
echo ""
echo -e "${BLUE}📋 Comandos úteis:${NC}"
echo "  • Ver logs:        docker compose logs -f"
echo "  • Parar lab:       docker compose down"
echo "  • Status swarm:    docker exec lab-swarm1 docker node ls"
echo "  • Lista stacks:    docker exec lab-swarm1 docker stack ls"
echo "  • Lista services:  docker exec lab-swarm1 docker service ls"
echo ""
echo -e "${GREEN}==============================================${NC}"
