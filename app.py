#!/usr/bin/env python3
"""
Stack Manager - Frontend para gerenciamento de stacks Docker
"""
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import subprocess
import os
import json
import yaml
import time
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configurações
STACKS_DIR = 'stacks'
SCRIPT_SUBIR = './subir_lab.sh'
SCRIPT_DESTRUIR = './destruir_lab.sh'
HAPROXY_CFG = 'lab-devops/haproxy/haproxy.cfg'
DOCKER_COMPOSE = 'lab-devops/docker-compose.yaml'

# Configurações do Jenkins
JENKINS_URL = os.getenv('JENKINS_URL', 'http://localhost:8083')
JENKINS_USER = os.getenv('JENKINS_USER', 'admin')
JENKINS_TOKEN = os.getenv('JENKINS_TOKEN', '')

def create_jenkins_pipeline(stack_name, cicd_config):
    """Cria uma pipeline no Jenkins para CI/CD do stack"""
    try:
        git_url = cicd_config.get('gitCloneUrl')
        git_branch = cicd_config.get('gitBranch', 'main')
        build_command = cicd_config.get('buildCommand', '')
        dockerfile_path = cicd_config.get('dockerfilePath', 'Dockerfile')
        docker_registry = cicd_config.get('dockerRegistry', '')
        
        # Definir nome da imagem
        if docker_registry:
            image_name = f"{docker_registry}/{stack_name}:latest"
        else:
            image_name = f"{stack_name}:latest"
        
        # Criar Jenkinsfile como script de pipeline
        jenkinsfile_content = f"""
pipeline {{
    agent any
    
    environment {{
        STACK_NAME = '{stack_name}'
        IMAGE_NAME = '{image_name}'
        DOCKER_REGISTRY = '{docker_registry}'
    }}
    
    stages {{
        stage('Clone Repository') {{
            steps {{
                git branch: '{git_branch}', url: '{git_url}'
            }}
        }}
        
        {f'''stage('Build Application') {{
            steps {{
                sh '{build_command}'
            }}
        }}''' if build_command else ''}
        
        stage('Build Docker Image') {{
            steps {{
                script {{
                    docker.build("${{IMAGE_NAME}}", "-f {dockerfile_path} .")
                }}
            }}
        }}
        
        {f'''stage('Push to Registry') {{
            steps {{
                script {{
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-credentials') {{
                        docker.image("${{IMAGE_NAME}}").push()
                    }}
                }}
            }}
        }}''' if docker_registry else ''}
        
        stage('Deploy to Swarm') {{
            steps {{
                sh '''
                    docker exec lab-swarm1 docker service update --image ${{IMAGE_NAME}} ${{STACK_NAME}}_${{STACK_NAME}} || \\
                    docker exec lab-swarm1 docker stack deploy -c /stacks/${{STACK_NAME}}-stack.yaml ${{STACK_NAME}}
                '''
            }}
        }}
    }}
    
    post {{
        success {{
            echo '✅ Deploy realizado com sucesso!'
        }}
        failure {{
            echo '❌ Falha no deploy!'
        }}
    }}
}}
"""
        
        # Configuração do job no formato XML
        job_config = f"""<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Pipeline CI/CD para {stack_name}</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <hudson.triggers.SCMTrigger>
          <spec>H/5 * * * *</spec>
          <ignorePostCommitHooks>false</ignorePostCommitHooks>
        </hudson.triggers.SCMTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps">
    <script>{jenkinsfile_content}</script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>"""
        
        # Criar job no Jenkins via API
        job_name = f"{stack_name}-pipeline"
        create_url = f"{JENKINS_URL}/createItem?name={job_name}"
        
        headers = {
            'Content-Type': 'application/xml',
        }
        
        # Tentar criar o job
        if JENKINS_TOKEN:
            response = requests.post(
                create_url,
                auth=(JENKINS_USER, JENKINS_TOKEN),
                headers=headers,
                data=job_config,
                timeout=10
            )
        else:
            # Sem autenticação (para ambiente de dev)
            response = requests.post(
                create_url,
                headers=headers,
                data=job_config,
                timeout=10
            )
        
        if response.status_code in [200, 201]:
            return {
                'success': True,
                'job_name': job_name,
                'job_url': f"{JENKINS_URL}/job/{job_name}",
                'message': f'Pipeline {job_name} criada com sucesso no Jenkins'
            }
        else:
            return {
                'success': False,
                'error': f'Erro ao criar job no Jenkins: {response.status_code} - {response.text}'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': f'Erro ao criar pipeline no Jenkins: {str(e)}'
        }

def get_available_stacks():
    """Lista todos os stacks disponíveis"""
    stacks = []
    if os.path.exists(STACKS_DIR):
        for file in os.listdir(STACKS_DIR):
            if file.endswith('.yaml') or file.endswith('.yml'):
                stack_name = file.replace('-stack.yaml', '').replace('.yaml', '')
                stack_info = {
                    'name': stack_name,
                    'file': file,
                    'path': os.path.join(STACKS_DIR, file),
                    'ports': []
                }
                
                # Tentar ler informações do arquivo YAML
                try:
                    with open(stack_info['path'], 'r') as f:
                        content = yaml.safe_load(f)
                        if content and 'services' in content:
                            stack_info['services'] = list(content['services'].keys())
                            
                            # Extrair portas expostas
                            for service_name, service_config in content['services'].items():
                                if 'ports' in service_config:
                                    for port in service_config['ports']:
                                        # Novo formato: dict com target/published/mode
                                        if isinstance(port, dict):
                                            if 'published' in port:
                                                stack_info['ports'].append(str(port['published']))
                                        # Formato antigo: string "host:container"
                                        elif isinstance(port, str) and ':' in port:
                                            public_port = port.split(':')[0]
                                            stack_info['ports'].append(public_port)
                                        # Formato simples: apenas número
                                        elif isinstance(port, (int, str)):
                                            stack_info['ports'].append(str(port))
                        else:
                            stack_info['services'] = []
                except:
                    stack_info['services'] = []
                
                stacks.append(stack_info)
    
    return sorted(stacks, key=lambda x: x['name'])

def get_docker_stack_status():
    """Verifica status dos stacks no Docker Swarm"""
    try:
        # Usar docker exec para acessar o Swarm
        result = subprocess.run(
            ['docker', 'exec', 'lab-swarm1', 'docker', 'stack', 'ls'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) > 1:  # Tem header + dados
                stacks = []
                # Buscar informações de portas dos stacks disponíveis
                available_stacks = get_available_stacks()
                available_dict = {s['name']: s for s in available_stacks}
                
                for line in lines[1:]:  # Pula o header
                    parts = line.split()
                    if parts:
                        stack_name = parts[0]
                        stack_data = {
                            'name': stack_name,
                            'services': parts[1] if len(parts) > 1 else 'N/A'
                        }
                        
                        # Adicionar portas se disponível
                        if stack_name in available_dict:
                            stack_data['ports'] = available_dict[stack_name].get('ports', [])
                        else:
                            stack_data['ports'] = []
                        
                        stacks.append(stack_data)
                return stacks
        return []
    except:
        return []

def run_bash_command(command):
    """Executa comando bash e retorna output"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutos timeout
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Comando excedeu o tempo limite de 5 minutos',
            'returncode': -1
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'returncode': -1
        }

def find_next_available_port(start_port=8084):
    """Encontra a próxima porta disponível"""
    try:
        # Ler docker-compose.yaml para ver portas já mapeadas
        used_ports = set()
        
        with open(DOCKER_COMPOSE, 'r') as f:
            compose_content = yaml.safe_load(f)
        
        if 'services' in compose_content and 'haproxy' in compose_content['services']:
            ports = compose_content['services']['haproxy'].get('ports', [])
            for port_mapping in ports:
                if isinstance(port_mapping, str) and ':' in port_mapping:
                    public_port = int(port_mapping.split(':')[0])
                    used_ports.add(public_port)
        
        # Ler stacks existentes
        for stack in get_available_stacks():
            used_ports.update(int(p) for p in stack['ports'])
        
        # Encontrar próxima porta disponível
        next_port = start_port
        while next_port in used_ports:
            next_port += 1
        
        return next_port
    except:
        return start_port

def detect_container_port(image_name):
    """Detecta porta padrão baseada na imagem"""
    # Mapa de imagens conhecidas e suas portas padrão
    port_map = {
        'nginx': 80,
        'grafana': 3000,
        'jenkins': 8080,
        'portainer': 9000,
        'postgres': 5432,
        'mysql': 3306,
        'redis': 6379,
        'mongodb': 27017,
        'rabbitmq': 5672,
        'sonarqube': 9000,
        'node': 3000,
        'httpd': 80,
        'apache': 80,
        'tomcat': 8080,
        'wildfly': 8080,
    }
    
    # Verificar se alguma palavra-chave está no nome da imagem
    image_lower = image_name.lower()
    for key, port in port_map.items():
        if key in image_lower:
            return port
    
    # Porta padrão genérica
    return 8080

def update_haproxy_config(stack_name, ports):
    """Atualiza configuração do HAProxy com novas portas"""
    try:
        # 1. Atualizar haproxy.cfg
        with open(HAPROXY_CFG, 'r') as f:
            config = f.read()
        
        # Para cada porta pública
        for port in ports:
            frontend_name = f"{stack_name}_{port}"
            backend_name = f"{stack_name}_{port}_backend"
            
            # Verificar se já existe configuração para esta porta
            if f"bind *:{port}" in config:
                continue
            
            # Adicionar frontend (antes da primeira linha "backend")
            frontend_config = f"""
frontend {frontend_name}
    bind *:{port}
    default_backend {backend_name}
"""
            # Inserir antes do primeiro backend
            backend_pos = config.find('\nbackend ')
            if backend_pos != -1:
                config = config[:backend_pos] + frontend_config + config[backend_pos:]
            else:
                config += frontend_config
            
            # Adicionar backend no final
            backend_config = f"""
backend {backend_name}
    balance roundrobin
    server swarm1 172.31.0.11:{port} check
    server swarm2 172.31.0.12:{port} check
"""
            config += backend_config
        
        # Salvar nova configuração do haproxy.cfg
        with open(HAPROXY_CFG, 'w') as f:
            f.write(config)
        
        # 2. Atualizar docker-compose.yaml para expor as portas
        with open(DOCKER_COMPOSE, 'r') as f:
            compose_content = yaml.safe_load(f)
        
        # Adicionar portas no serviço haproxy
        if 'services' in compose_content and 'haproxy' in compose_content['services']:
            current_ports = compose_content['services']['haproxy'].get('ports', [])
            
            for port in ports:
                port_mapping = f"{port}:{port}"
                if port_mapping not in current_ports:
                    current_ports.append(port_mapping)
            
            compose_content['services']['haproxy']['ports'] = sorted(current_ports)
            
            # Salvar docker-compose.yaml atualizado
            with open(DOCKER_COMPOSE, 'w') as f:
                yaml.dump(compose_content, f, default_flow_style=False, sort_keys=False)
        
        # 3. Recriar HAProxy para aplicar mudanças
        reload_result = run_bash_command('docker compose -f lab-devops/docker-compose.yaml up -d --force-recreate haproxy')
        
        return reload_result['success']
    
    except Exception as e:
        print(f"Erro ao atualizar HAProxy: {e}")
        return False

def remove_haproxy_config(stack_name):
    """Remove configuração do HAProxy para um stack"""
    try:
        with open(HAPROXY_CFG, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        skip_until_next_section = False
        
        for i, line in enumerate(lines):
            # Se encontrar frontend ou backend do stack, pular esta seção
            if f"frontend {stack_name}_" in line or f"backend {stack_name}_" in line:
                skip_until_next_section = True
                continue
            
            # Parar de pular quando encontrar próxima seção
            if skip_until_next_section and (line.startswith('frontend ') or line.startswith('backend ')):
                skip_until_next_section = False
            
            if not skip_until_next_section:
                new_lines.append(line)
        
        # Salvar configuração limpa
        with open(HAPROXY_CFG, 'w') as f:
            f.writelines(new_lines)
        
        # Recarregar HAProxy
        reload_result = run_bash_command('docker compose -f lab-devops/docker-compose.yaml restart haproxy')
        
        return reload_result['success']
    
    except Exception as e:
        print(f"Erro ao remover configuração HAProxy: {e}")
        return False

@app.route('/')
def index():
    """Página principal"""
    return render_template('index.html')

@app.route('/api/stacks')
def api_stacks():
    """API: Lista stacks disponíveis"""
    stacks = get_available_stacks()
    return jsonify(stacks)

@app.route('/api/status')
def api_status():
    """API: Status dos stacks em execução"""
    running_stacks = get_docker_stack_status()
    return jsonify({
        'running_stacks': running_stacks,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/deploy', methods=['POST'])
def api_deploy():
    """API: Deploy de um stack específico"""
    data = request.json
    stack_name = data.get('stack')
    
    if not stack_name:
        return jsonify({'success': False, 'error': 'Stack name required'}), 400
    
    # Verificar se o stack existe
    stacks = get_available_stacks()
    stack_info = next((s for s in stacks if s['name'] == stack_name), None)
    
    if not stack_info:
        return jsonify({'success': False, 'error': 'Stack not found'}), 404
    
    # Deploy individual do stack
    stack_file = f"stacks/{stack_name}-stack.yaml"
    command = f'docker exec lab-swarm1 docker stack deploy -c /stacks/{stack_name}-stack.yaml {stack_name}'
    
    result = run_bash_command(command)
    
    # Se deploy foi bem sucedido, atualizar HAProxy
    if result['success'] and stack_info['ports']:
        update_haproxy_config(stack_name, stack_info['ports'])
    
    return jsonify({
        'success': result['success'],
        'output': result['stdout'],
        'error': result['stderr']
    })

@app.route('/api/remove', methods=['POST'])
def api_remove():
    """API: Remove um stack específico"""
    data = request.json
    stack_name = data.get('stack')
    
    if not stack_name:
        return jsonify({'success': False, 'error': 'Stack name required'}), 400
    
    command = f'docker exec lab-swarm1 docker stack rm {stack_name}'
    result = run_bash_command(command)
    
    # Se remoção foi bem sucedida, remover do HAProxy e deletar o arquivo
    if result['success']:
        remove_haproxy_config(stack_name)
        
        # Deletar o arquivo YAML
        yaml_file = f'./stacks/{stack_name}-stack.yaml'
        try:
            if os.path.exists(yaml_file):
                os.remove(yaml_file)
                result['stdout'] += f'\nArquivo {yaml_file} removido com sucesso.'
        except Exception as e:
            result['stderr'] += f'\nErro ao remover arquivo: {str(e)}'
    
    return jsonify({
        'success': result['success'],
        'output': result['stdout'],
        'error': result['stderr']
    })

@app.route('/api/stack-yaml/<stack_name>', methods=['GET'])
def api_get_stack_yaml(stack_name):
    """API: Retorna o conteúdo YAML de uma stack"""
    yaml_file = f'./stacks/{stack_name}-stack.yaml'
    
    try:
        if not os.path.exists(yaml_file):
            return jsonify({'success': False, 'error': f'Arquivo {yaml_file} não encontrado'}), 404
        
        with open(yaml_file, 'r', encoding='utf-8') as f:
            yaml_content = f.read()
        
        return jsonify({
            'success': True,
            'yaml': yaml_content
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/update-stack', methods=['POST'])
def api_update_stack():
    """API: Atualiza o YAML de uma stack e faz redeploy"""
    data = request.json
    stack_name = data.get('stack')
    yaml_content = data.get('yaml')
    
    if not stack_name or not yaml_content:
        return jsonify({'success': False, 'error': 'Stack name and YAML content required'}), 400
    
    yaml_file = f'./stacks/{stack_name}-stack.yaml'
    
    try:
        # Salvar o novo conteúdo YAML no host
        # (O volume está mapeado, então o arquivo fica disponível no swarm automaticamente)
        with open(yaml_file, 'w', encoding='utf-8') as f:
            f.write(yaml_content)
        
        # Remover stack antiga
        remove_command = f'docker exec lab-swarm1 docker stack rm {stack_name}'
        run_bash_command(remove_command)
        
        # Aguardar remoção completa
        time.sleep(3)
        
        # Fazer redeploy com o novo YAML
        # O arquivo já está disponível em /stacks/ via volume mount read-only
        deploy_command = f'docker exec lab-swarm1 docker stack deploy -c /stacks/{stack_name}-stack.yaml {stack_name}'
        deploy_result = run_bash_command(deploy_command)
        
        if deploy_result['success']:
            return jsonify({
                'success': True,
                'output': f'Stack {stack_name} atualizada e redeployada com sucesso!\n{deploy_result["stdout"]}'
            })
        else:
            return jsonify({
                'success': False,
                'error': deploy_result['stderr']
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/lab/start', methods=['POST'])
def api_lab_start():
    """API: Inicia todo o lab"""
    command = 'bash ./subir_lab.sh'
    result = run_bash_command(command)
    
    return jsonify({
        'success': result['success'],
        'output': result['stdout'],
        'error': result['stderr']
    })

@app.route('/api/lab/destroy', methods=['POST'])
def api_lab_destroy():
    """API: Destrói todo o lab"""
    command = 'bash ./destruir_lab.sh'
    result = run_bash_command(command)
    
    return jsonify({
        'success': result['success'],
        'output': result['stdout'],
        'error': result['stderr']
    })

@app.route('/api/create-stack', methods=['POST'])
def api_create_stack():
    """API: Cria uma nova stack personalizada"""
    data = request.json
    
    # Validar dados obrigatórios MÍNIMOS
    required_fields = ['name', 'image']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'success': False, 'error': f'Campo obrigatório: {field}'}), 400
    
    stack_name = data['name']
    image = data['image']
    
    # Validar nome do stack
    if not stack_name.replace('-', '').replace('_', '').isalnum():
        return jsonify({'success': False, 'error': 'Nome inválido. Use apenas letras, números e hífen'}), 400
    
    # Auto-detectar porta do container se não especificada
    container_port = data.get('containerPort')
    if not container_port:
        container_port = detect_container_port(image)
        print(f"🔍 Porta do container detectada: {container_port} para imagem {image}")
    
    # Auto-atribuir porta pública se não especificada
    public_port = data.get('publicPort')
    if not public_port:
        public_port = find_next_available_port()
        print(f"🔍 Porta pública disponível: {public_port}")
    
    # Valores padrão para campos opcionais
    replicas = data.get('replicas', 1)
    
    # Criar data completa com valores auto-detectados
    complete_data = {
        'name': stack_name,
        'image': image,
        'containerPort': container_port,
        'publicPort': public_port,
        'replicas': replicas,
        'network': data.get('network', 'devops-network'),
        'healthCheck': data.get('healthCheck'),
        'envVars': data.get('envVars', {}),
        'useTraefik': data.get('useTraefik', False),
        'traefikDomain': data.get('traefikDomain'),
        'includeDatabase': data.get('includeDatabase', False),
        'database': data.get('database', {}),
        'enableCICD': data.get('enableCICD', False),
        'cicd': data.get('cicd', {})
    }
    
    # Gerar conteúdo do YAML
    stack_yaml = generate_stack_yaml(complete_data)
    
    # Salvar arquivo
    stack_file_path = os.path.join(STACKS_DIR, f'{stack_name}-stack.yaml')
    
    try:
        with open(stack_file_path, 'w') as f:
            f.write(stack_yaml)
        
        # Automaticamente fazer deploy do stack criado
        deploy_command = f'docker exec lab-swarm1 docker stack deploy -c /stacks/{stack_name}-stack.yaml {stack_name}'
        deploy_result = run_bash_command(deploy_command)
        
        # Atualizar HAProxy com a porta pública
        ports = [str(complete_data['publicPort'])]
        update_haproxy_config(stack_name, ports)
        
        response_data = {
            'success': True,
            'file': stack_file_path,
            'message': f'Stack {stack_name} criada e deployed com sucesso',
            'deploy_output': deploy_result['stdout'],
            'info': {
                'containerPort': complete_data['containerPort'],
                'publicPort': complete_data['publicPort'],
                'url': f"http://localhost:{complete_data['publicPort']}"
            }
        }
        
        # Criar pipeline no Jenkins se CI/CD estiver habilitado
        if complete_data['enableCICD'] and complete_data['cicd'].get('gitCloneUrl'):
            jenkins_result = create_jenkins_pipeline(stack_name, complete_data['cicd'])
            response_data['jenkins'] = jenkins_result
            if jenkins_result['success']:
                response_data['message'] += f" | Pipeline Jenkins criada: {jenkins_result['job_name']}"
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Erro ao salvar arquivo: {str(e)}'
        }), 500

def generate_stack_yaml(data):
    """Gera o conteúdo YAML da stack baseado nos dados fornecidos"""
    stack_name = data['name']
    image = data['image']
    container_port = data['containerPort']
    public_port = data['publicPort']
    replicas = data['replicas']
    network = data.get('network', 'devops-network')
    health_check = data.get('healthCheck')
    env_vars = data.get('envVars', {})
    use_traefik = data.get('useTraefik', False)
    traefik_domain = data.get('traefikDomain')
    include_database = data.get('includeDatabase', False)
    database_config = data.get('database', {})
    
    # Se tiver banco de dados, adicionar variáveis de ambiente de conexão
    if include_database and database_config:
        db_type = database_config.get('type', 'mariadb')
        db_name = database_config.get('name', stack_name)
        db_user = database_config.get('user', stack_name)
        db_password = database_config.get('password', 'password123')
        
        # Adicionar variáveis de ambiente conforme o tipo de banco
        db_service_name = f"{stack_name}_database"
        
        if db_type in ['mariadb', 'mysql']:
            env_vars.update({
                'DB_HOST': db_service_name,
                'DB_PORT': '3306',
                'DB_NAME': db_name,
                'DB_USER': db_user,
                'DB_PASSWORD': db_password
            })
        elif db_type == 'postgres':
            env_vars.update({
                'POSTGRES_HOST': db_service_name,
                'POSTGRES_PORT': '5432',
                'POSTGRES_DB': db_name,
                'POSTGRES_USER': db_user,
                'POSTGRES_PASSWORD': db_password
            })
        elif db_type == 'mongodb':
            env_vars.update({
                'MONGO_HOST': db_service_name,
                'MONGO_PORT': '27017',
                'MONGO_DB': db_name,
                'MONGO_USER': db_user,
                'MONGO_PASSWORD': db_password
            })
    
    # Construir seção de environment
    env_section = ""
    if env_vars:
        env_section = "    environment:\n"
        for key, value in env_vars.items():
            env_section += f"      - {key}={value}\n"
    
    # Construir health check
    health_section = ""
    if health_check:
        health_section = f"""    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:{container_port}{health_check}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
"""
    
    # Construir labels do Traefik
    traefik_labels = ""
    if use_traefik and traefik_domain:
        traefik_labels = f"""        - "traefik.enable=true"
        - "traefik.http.routers.{stack_name}.rule=Host(`{traefik_domain}`)"
        - "traefik.http.routers.{stack_name}.entrypoints=web"
        - "traefik.http.services.{stack_name}.loadbalancer.server.port={container_port}"
"""
    
    # Template YAML do serviço principal
    yaml_content = f"""version: "3.9"

services:
  {stack_name}:
    image: {image}
    networks:
      - {network}
    ports:
      - target: {container_port}
        published: {public_port}
        mode: host
{env_section}{health_section}    deploy:
      mode: replicated
      replicas: {replicas}
      placement:
        constraints:
          - node.role == worker
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      labels:
{traefik_labels}        - "app={stack_name}"
        - "environment=homologacao"
"""
    
    # Adicionar serviço de banco de dados se solicitado
    if include_database and database_config:
        db_type = database_config.get('type', 'mariadb')
        db_name = database_config.get('name', stack_name)
        db_user = database_config.get('user', stack_name)
        db_password = database_config.get('password', 'password123')
        db_service_name = f"{stack_name}_database"
        
        # Configuração específica por tipo de banco
        if db_type == 'mariadb':
            db_service = f"""
  {db_service_name}:
    image: mariadb:latest
    networks:
      - {network}
    environment:
      - MYSQL_ROOT_PASSWORD=root123
      - MYSQL_DATABASE={db_name}
      - MYSQL_USER={db_user}
      - MYSQL_PASSWORD={db_password}
    volumes:
      - {stack_name}_db_data:/var/lib/mysql
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == worker
      restart_policy:
        condition: on-failure
"""
        elif db_type == 'mysql':
            db_service = f"""
  {db_service_name}:
    image: mysql:8
    networks:
      - {network}
    environment:
      - MYSQL_ROOT_PASSWORD=root123
      - MYSQL_DATABASE={db_name}
      - MYSQL_USER={db_user}
      - MYSQL_PASSWORD={db_password}
    volumes:
      - {stack_name}_db_data:/var/lib/mysql
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == worker
      restart_policy:
        condition: on-failure
"""
        elif db_type == 'postgres':
            db_service = f"""
  {db_service_name}:
    image: postgres:15
    networks:
      - {network}
    environment:
      - POSTGRES_DB={db_name}
      - POSTGRES_USER={db_user}
      - POSTGRES_PASSWORD={db_password}
    volumes:
      - {stack_name}_db_data:/var/lib/postgresql/data
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == worker
      restart_policy:
        condition: on-failure
"""
        elif db_type == 'mongodb':
            db_service = f"""
  {db_service_name}:
    image: mongo:6
    networks:
      - {network}
    environment:
      - MONGO_INITDB_ROOT_USERNAME={db_user}
      - MONGO_INITDB_ROOT_PASSWORD={db_password}
      - MONGO_INITDB_DATABASE={db_name}
    volumes:
      - {stack_name}_db_data:/data/db
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == worker
      restart_policy:
        condition: on-failure
"""
        else:
            db_service = ""
        
        yaml_content += db_service
        
        # Adicionar volumes e networks
        yaml_content += f"""
volumes:
  {stack_name}_db_data:

networks:
  {network}:
    external: true
"""
    else:
        # Sem banco de dados, só adicionar networks
        yaml_content += f"""
networks:
  {network}:
    external: true
"""
    
    return yaml_content

if __name__ == '__main__':
    print("🚀 Stack Manager iniciando...")
    print("📁 Stacks disponíveis:")
    for stack in get_available_stacks():
        print(f"   - {stack['name']} ({len(stack.get('services', []))} serviços)")
    print("\n🌐 Acesse: http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
