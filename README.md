# 🐳 Laboratório Docker - Stack Manager

Sistema de gerenciamento de stacks Docker Swarm com interface web Flask.

## 📋 Descrição

Aplicação web para gerenciar stacks Docker e provisionar ambiente DevOps completo com:

- **Stack Manager** - Interface web para gerenciar stacks
- **Docker Swarm** (2 nós: 1 manager + 1 worker)
- **HAProxy** como load balancer
- **Traefik** como reverse proxy
- **Portainer** para gerenciamento visual
- **Jenkins** para CI/CD
- **SonarQube** para análise de código

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│          HAProxy (172.31.0.10)          │
│              Porta: 8080                │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┴──────────┐
    │                      │
┌───▼────────────┐   ┌────▼─────────────┐
│ Swarm Manager  │   │  Swarm Worker    │
│ (172.31.0.11)  │   │  (172.31.0.12)   │
│  Porta: 9000   │   │                  │
└────────────────┘   └──────────────────┘
```

## 🚀 Deploy - Modo Homologação (Linux)

### Pré-requisitos

- Docker Engine 20.10+
- Docker Compose V2
- Linux (Ubuntu/Debian/CentOS/RHEL)

### Deploy Rápido

```bash
# Dar permissão de execução
chmod +x deploy-homologacao.sh

# Executar deploy
./deploy-homologacao.sh
```

O script irá:
1. ✅ Verificar dependências (Docker e Docker Compose)
2. 🛑 Parar containers antigos (se existirem)
3. 🏗️ Construir a imagem Docker
4. 🚀 Subir o container em modo homologação
5. ✓ Validar que o serviço está rodando

### Acesso

**Stack Manager:** http://localhost:5000

### Comandos Úteis

```bash
# Ver logs em tempo real
docker compose -f docker-compose.homologacao.yml logs -f

# Parar o ambiente
docker compose -f docker-compose.homologacao.yml down

# Reiniciar
docker compose -f docker-compose.homologacao.yml restart

# Ver status
docker compose -f docker-compose.homologacao.yml ps
```

## 🔧 Modo Desenvolvimento Local

Se preferir rodar diretamente com Python (sem Docker):

```bash
# Dar permissão de execução
chmod +x start-homologacao.sh

# Executar
./start-homologacao.sh
```

## 🏗️ Laboratório DevOps Completo

Para subir o ambiente completo (Swarm + HAProxy + Stacks):

```bash
# Dar permissão
chmod +x subir_lab.sh destruir_lab.sh

# Subir laboratório
./subir_lab.sh
```

Este script irá:
1. Verificar dependências
2. Criar a estrutura de rede (172.31.0.0/24)
3. Subir HAProxy e containers Docker-in-Docker
4. Inicializar cluster Docker Swarm
5. Fazer deploy das stacks (Traefik, Portainer)

### Destruir o Laboratório

```bash
./destruir_lab.sh
```

## 🌐 Acessos

### Stack Manager (Homologação)
| Serviço        | URL                  | Porta |
|----------------|----------------------|-------|
| Stack Manager  | http://localhost:5000| 5000  |

### Laboratório Completo
| Serviço     | URL                  | Porta |
|-------------|----------------------|-------|
| HAProxy     | http://localhost:8080| 8080  |
| Portainer   | http://localhost:9000| 9000  |
| Traefik     | Via HAProxy          | -     |

## 📁 Estrutura do Projeto

```
.
├── app.py                              # Aplicação Flask principal
├── Dockerfile                          # Imagem Docker da aplicação
├── requirements.txt                    # Dependências Python
├── README.md                          # Este arquivo
│
├── deploy-homologacao.sh              # Deploy rápido em Linux
├── start-homologacao.sh               # Modo dev (Python direto)
├── docker-compose.homologacao.yml     # Docker Compose para homologação
│
├── templates/                         # Templates HTML
│   └── index.html
│
├── static/                            # Arquivos estáticos (CSS/JS)
│   ├── style.css
│   └── script.js
│
├── stacks/                            # Definições de stacks
│   ├── portainer-stack.yaml
│   └── traefik-stack.yaml
│
└── lab-devops/                        # Ambiente lab completo
    ├── docker-compose.yaml
    ├── subir_lab.sh
    ├── destruir_lab.sh
    └── haproxy/
        └── haproxy.cfg
```

## 🔧 Configuração

### Rede

O laboratório usa a rede `172.31.0.0/24` com IPs fixos:
- HAProxy: `172.31.0.10`
- Swarm Manager: `172.31.0.11`
- Swarm Worker: `172.31.0.12`

### Volumes

Os dados persistentes são armazenados em volumes Docker:
- `traefik_traefik_data`
- `portainer_portainer_data`
- `jenkins_jenkins_data`

## 🛠️ Comandos Úteis

### Stack Manager

```bash
# Ver logs do Stack Manager
docker compose -f docker-compose.homologacao.yml logs -f

# Rebuild completo
docker compose -f docker-compose.homologacao.yml down -v
docker compose -f docker-compose.homologacao.yml up -d --build
```

### Laboratório Swarm

```bash
# Verificar status do Swarm
docker exec lab-swarm1 docker node ls

# Listar serviços rodando
docker exec lab-swarm1 docker service ls

# Ver logs de um serviço
docker exec lab-swarm1 docker service logs <nome-do-serviço>
```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker compose -f docker-compose.homologacao.yml logs

# Verificar se porta 5000 está em uso
sudo netstat -tulpn | grep 5000
```

### Permissão negada no Docker socket

```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Fazer logout e login novamente
```

## 📝 Notas

- Stack Manager roda em modo staging (debug desabilitado)
- Containers Swarm rodam em modo privilegiado (Docker-in-Docker)
- HAProxy configurado para proxy das aplicações
- Healthcheck automático para Stack Manager

## 📄 Licença

Projeto de laboratório para fins educacionais.

**Desenvolvido para fins de laboratório e aprendizado DevOps** 🚀