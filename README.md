# 🐳 Laboratório Docker

Ambiente de laboratório DevOps completo usando Docker Swarm, HAProxy e diversas ferramentas de CI/CD.

## 📋 Descrição

Este laboratório provisiona um ambiente DevOps completo com:

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

## 🚀 Como Usar

### Pré-requisitos

- Docker
- Docker Compose

### Subir o Laboratório

```bash
./subir_lab.sh
```

Este script irá:
1. Verificar dependências
2. Criar a estrutura de rede (172.31.0.0/24)
3. Subir HAProxy e containers Docker-in-Docker
4. Inicializar cluster Docker Swarm
5. Fazer deploy das stacks:
   - Traefik
   - Portainer
   - Jenkins
   - SonarQube

### Destruir o Laboratório

```bash
./destruir_lab.sh
```

Este script irá:
1. Desmontar o cluster Swarm
2. Remover volumes
3. Parar e remover todos os containers
4. Limpar recursos do Docker

## 🌐 Acessos

| Serviço     | URL                  | Porta |
|-------------|----------------------|-------|
| HAProxy     | http://localhost:8080| 8080  |
| Portainer   | http://localhost:9000| 9000  |
| Traefik     | Via HAProxy          | -     |
| Jenkins     | Via HAProxy          | -     |
| SonarQube   | Via HAProxy          | -     |

## 📁 Estrutura do Projeto

```
.
├── destruir_lab.sh              # Script para destruir o laboratório
├── subir_lab.sh                 # Script para criar o laboratório
├── lab-devops/
│   ├── docker-compose.yaml      # Definição dos serviços base
│   └── haproxy/
│       └── haproxy.cfg          # Configuração do HAProxy
└── stacks/
    ├── jenkins-stack.yaml       # Stack do Jenkins
    ├── portainer-stack.yaml     # Stack do Portainer
    ├── sonarqube-stack.yaml     # Stack do SonarQube
    └── traefik-stack.yaml       # Stack do Traefik
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

### Verificar status do Swarm

```bash
docker exec lab-swarm1 docker node ls
```

### Listar serviços rodando

```bash
docker exec lab-swarm1 docker service ls
```

### Ver logs de um serviço

```bash
docker exec lab-swarm1 docker service logs <nome-do-serviço>
```

## 📝 Notas

- Os containers Swarm rodam em modo privilegiado (Docker-in-Docker)
- O HAProxy está configurado para fazer proxy das aplicações do Swarm
- Todos os serviços têm restart policy `unless-stopped`

## 🤝 Contribuições

Sinta-se à vontade para contribuir com melhorias!

## 📄 Licença

Este projeto é livre para uso educacional e de desenvolvimento.

---

**Desenvolvido para fins de laboratório e aprendizado DevOps** 🚀