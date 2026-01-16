#!/bin/bash
set -e

# ===============================
# VERIFICA SISTEMA OPERACIONAL
# ===============================
if [ "$(uname)" != "Linux" ]; then
    echo -e "\033[0;31m✗ Este script só pode ser executado em sistemas Linux.\033[0m"
    exit 1
fi

# ===============================
#  CORES E LOG
# ===============================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error()   { echo -e "${RED}✗${NC} $1"; }

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ===============================
# DEPENDÊNCIAS
# ===============================
log_info "Verificando dependências..."

if ! command_exists docker; then
    log_error "Docker não encontrado"
    exit 1
fi

if ! command_exists docker compose; then
    log_error "Docker Compose não encontrado"
    exit 1
fi

# ===============================
# SUBINDO BASE (lab-devops)
# ===============================
log_info "Subindo infraestrutura base (lab-devops)..."

if [ ! -d "lab-devops" ]; then
    log_error "Diretório lab-devops não encontrado!"
    exit 1
fi

cd lab-devops

log_info "Executando docker compose up -d..."
docker compose up -d
log_success "Infraestrutura base iniciada"

# ===============================
# AGUARDAR CONTAINERS DO SWARM
# ===============================
log_info "Aguardando containers lab-swarm1 e lab-swarm2..."

TIMEOUT=60
ELAPSED=0

until docker ps | grep -q lab-swarm1 && docker ps | grep -q lab-swarm2; do
    if [ $ELAPSED -ge $TIMEOUT ]; then
        log_error "Timeout aguardando lab-swarm containers"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

log_success "Containers swarm ativos"

cd ..

# ===============================
# VERIFICA ARQUIVOS NECESSÁRIOS
# ===============================
log_info "Verificando estrutura do lab..."

[ ! -d "stacks" ] && log_error "Diretório stacks não encontrado" && exit 1

cd lab-devops

[ ! -f "haproxy/haproxy.cfg" ] && log_error "haproxy.cfg não encontrado" && exit 1
[ ! -f "../stacks/traefik-stack.yaml" ] && log_error "traefik-stack.yaml não encontrado" && exit 1
[ ! -f "../stacks/portainer-stack.yaml" ] && log_error "portainer-stack.yaml não encontrado" && exit 1

log_success "Estrutura validada"

# ===============================
# AGUARDAR DOCKER DAEMON INTERNO
# ===============================
log_info "Aguardando Docker interno do swarm1..."
until docker exec lab-swarm1 docker info >/dev/null 2>&1; do sleep 2; done
log_success "Docker swarm1 pronto"

log_info "Aguardando Docker interno do swarm2..."
until docker exec lab-swarm2 docker info >/dev/null 2>&1; do sleep 2; done
log_success "Docker swarm2 pronto"

# ===============================
# INICIALIZAR SWARM
# ===============================
log_info "Inicializando Docker Swarm..."

docker exec lab-swarm1 docker swarm init --advertise-addr 172.31.0.11 2>/dev/null || true

until docker exec lab-swarm1 docker info | grep -q "Swarm: active"; do sleep 2; done
log_success "Swarm inicializado"

log_info "Conectando worker..."

WORKER_TOKEN=$(docker exec lab-swarm1 docker swarm join-token -q worker)
docker exec lab-swarm2 docker swarm join --token $WORKER_TOKEN 172.31.0.11:2377 2>/dev/null || true

log_success "Worker conectado"

# ===============================
# REDES OVERLAY
# ===============================
log_info "Criando redes overlay..."

docker exec lab-swarm1 docker network create --driver overlay traefik-public 2>/dev/null || true
docker exec lab-swarm1 docker network create --driver overlay devops-network 2>/dev/null || true

log_success "Redes criadas"

# ===============================
# DEPLOY STACKS
# ===============================
deploy_stack () {
    STACK_NAME=$1
    FILE_PATH=$2
    log_info "Deploy stack $STACK_NAME..."
    echo "DEBUG: docker exec lab-swarm1 docker stack deploy -c /stacks/$FILE_PATH $STACK_NAME"
    echo "DEBUG: Listando arquivos em /stacks dentro do lab-swarm1:"
    docker exec lab-swarm1 ls -l /stacks/
    docker exec lab-swarm1 docker stack deploy -c /stacks/$FILE_PATH $STACK_NAME
    log_success "Stack $STACK_NAME deployada"
}

deploy_stack traefik traefik-stack.yaml
deploy_stack portainer portainer-stack.yaml
deploy_stack jenkins jenkins-stack.yaml
deploy_stack sonarqube sonarqube-stack.yaml
deploy_stack trivy trivy-stack.yaml

# ===============================
# FINAL
# ===============================
echo ""
echo -e "${GREEN}=============================================="
echo "🚀 LAB DEVOPS INICIADO COM SUCESSO!"
echo -e "==============================================${NC}"
echo ""
echo -e "${BLUE}🌐 Portainer:${NC}   http://localhost:9000"
echo -e "${BLUE}🌐 Jenkins:${NC}     http://localhost:8080/jenkins"
echo -e "${BLUE}🌐 SonarQube:${NC}   http://localhost:8080/sonarqube"
echo ""
echo -e "${BLUE}📌 Para destruir tudo:${NC}"
echo "cd lab-devops && docker compose down"
echo ""
echo -e "${GREEN}==============================================${NC}"
log_success "Script finalizado"
