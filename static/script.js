// Estado da aplicação
let currentAction = null;
let autoRefresh = null;
let stacksChart = null;
let activityChart = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadAvailableStacks();
    refreshStatus();
    initDashboardCharts();
    
    // Auto-refresh a cada 10 segundos
    autoRefresh = setInterval(() => {
        refreshStatus();
        updateDashboardMetrics();
    }, 10000);
    
    // Carregar estado da sidebar
    loadSidebarState();
});

// Sidebar Functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.querySelector('.main-wrapper');
    
    sidebar.classList.toggle('collapsed');
    mainWrapper.classList.toggle('expanded');
    
    // Para mobile, adicionar classe show
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('show');
    }
    
    // Salvar estado no localStorage
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

function loadSidebarState() {
    // No mobile, sempre começa colapsado
    if (window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.add('collapsed');
        document.querySelector('.main-wrapper').classList.add('expanded');
        return;
    }
    
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        document.getElementById('sidebar').classList.add('collapsed');
        document.querySelector('.main-wrapper').classList.add('expanded');
    }
}

// Screen Navigation
function switchScreen(screenName) {
    // Remove active de todas as telas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Remove active de todos os itens de navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Ativa a tela selecionada
    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Adiciona active no item de navegação clicado
    event.target.closest('.nav-item').classList.add('active');
    
    // Fecha sidebar no mobile após navegação
    if (window.innerWidth <= 1024) {
        toggleSidebar();
    }
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Console Modal
function toggleConsoleModal() {
    const modal = document.getElementById('consoleModal');
    modal.classList.toggle('active');
}

function clearConsole() {
    const consoleEl = document.getElementById('console');
    consoleEl.innerHTML = '<p class="console-info">Console limpo. Aguardando comandos...</p>';
}

// Carregar stacks disponíveis
async function loadAvailableStacks() {
    try {
        const response = await fetch('/api/stacks');
        const stacks = await response.json();
        
        const container = document.getElementById('availableStacksList');
        
        if (stacks.length === 0) {
            container.innerHTML = '<p class="loading">Nenhum stack disponível</p>';
            return;
        }
        
        container.innerHTML = stacks.map(stack => `
            <div class="stack-card">
                <h3>📦 ${capitalizeFirst(stack.name)}</h3>
                <div class="services">
                    <strong>${stack.services.length}</strong> serviço(s)
                    ${stack.services.length > 0 ? `
                        <div class="services-list">
                            ${stack.services.map(s => `<span class="service-tag">${s}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${stack.ports && stack.ports.length > 0 ? `
                        <div class="ports-list">
                            ${stack.ports.map(port => `
                                <a href="http://localhost:${port}" target="_blank" class="port-link">
                                    🌐 localhost:${port}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="actions">
                    <button onclick="deployStack('${stack.name}')" class="btn btn-success">
                        <span class="icon">🚀</span> Deploy
                    </button>
                    <button onclick="viewStackYaml('${stack.name}')" class="btn btn-secondary">
                        <span class="icon">✏️</span> Editar YAML
                    </button>
                    <button onclick="removeStack('${stack.name}')" class="btn btn-danger">
                        <span class="icon">🗑️</span> Remover
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar stacks:', error);
        logConsole('Erro ao carregar stacks disponíveis', 'error');
    }
}

// Atualizar status dos stacks ativos
async function refreshStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        const container = document.getElementById('activeStacksList');
        
        if (!data.running_stacks || data.running_stacks.length === 0) {
            container.innerHTML = '<p class="loading">Nenhum stack ativo no momento</p>';
            return;
        }
        
        container.innerHTML = data.running_stacks.map(stack => `
            <div class="active-stack-item">
                <div class="stack-info-left">
                    <h4>✅ ${capitalizeFirst(stack.name)}</h4>
                    <div class="info">${stack.services} serviço(s) rodando</div>
                    ${stack.ports && stack.ports.length > 0 ? `
                        <div class="ports-list-inline">
                            ${stack.ports.map(port => `
                                <a href="http://localhost:${port}" target="_blank" class="port-link-small">
                                    🌐 localhost:${port}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <button onclick="removeStack('${stack.name}')" class="btn btn-danger">
                    <span class="icon">🗑️</span> Remover
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        const container = document.getElementById('activeStacksList');
        container.innerHTML = '<p class="loading">⚠️ Erro ao conectar com o Docker. O lab está rodando?</p>';
    }
}

// Criar Nova Stack
function showCreateStackModal() {
    document.getElementById('createStackModal').classList.add('active');
}

function closeCreateStackModal() {
    document.getElementById('createStackModal').classList.remove('active');
    document.getElementById('createStackForm').reset();
    // Reset env vars to single row
    document.getElementById('envVars').innerHTML = `
        <div class="env-var-row">
            <input type="text" placeholder="CHAVE" class="env-key">
            <input type="text" placeholder="valor" class="env-value">
            <button type="button" onclick="addEnvVar()" class="btn-icon">➕</button>
        </div>
    `;
}

function addEnvVar() {
    const envVarsContainer = document.getElementById('envVars');
    const newRow = document.createElement('div');
    newRow.className = 'env-var-row';
    newRow.innerHTML = `
        <input type="text" placeholder="CHAVE" class="env-key">
        <input type="text" placeholder="valor" class="env-value">
        <button type="button" onclick="removeEnvVar(this)" class="btn-icon remove">❌</button>
    `;
    envVarsContainer.appendChild(newRow);
}

function removeEnvVar(button) {
    button.parentElement.remove();
}

function toggleDatabaseConfig() {
    const checkbox = document.getElementById('includeDatabase');
    const config = document.getElementById('databaseConfig');
    config.style.display = checkbox.checked ? 'block' : 'none';
}

function toggleCICDConfig() {
    const checkbox = document.getElementById('enableCICD');
    const config = document.getElementById('cicdConfig');
    config.style.display = checkbox.checked ? 'block' : 'none';
}

async function createNewStack(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const stackData = {
        name: formData.get('stackName'),
        image: formData.get('dockerImage'),
        network: formData.get('network') || 'devops-network',
        healthCheck: formData.get('healthCheck') || null,
        useTraefik: formData.get('useTraefik') === 'on',
        traefikDomain: formData.get('traefikDomain') || null,
        envVars: {}
    };
    
    // Adicionar portas apenas se foram preenchidas
    const containerPort = formData.get('containerPort');
    const publicPort = formData.get('publicPort');
    const replicas = formData.get('replicas');
    
    if (containerPort) stackData.containerPort = parseInt(containerPort);
    if (publicPort) stackData.publicPort = parseInt(publicPort);
    if (replicas) stackData.replicas = parseInt(replicas);
    
    // Coletar variáveis de ambiente
    const envRows = document.querySelectorAll('.env-var-row');
    envRows.forEach(row => {
        const key = row.querySelector('.env-key').value.trim();
        const value = row.querySelector('.env-value').value.trim();
        if (key && value) {
            stackData.envVars[key] = value;
        }
    });
    
    // Adicionar configuração de banco de dados se selecionado
    if (formData.get('includeDatabase') === 'on') {
        stackData.includeDatabase = true;
        stackData.database = {
            type: formData.get('databaseType'),
            name: formData.get('dbName'),
            user: formData.get('dbUser'),
            password: formData.get('dbPassword')
        };
    }
    
    // Adicionar configuração de CI/CD se selecionado
    if (formData.get('enableCICD') === 'on') {
        stackData.enableCICD = true;
        stackData.cicd = {
            gitCloneUrl: formData.get('gitCloneUrl'),
            gitBranch: formData.get('gitBranch') || 'main',
            buildCommand: formData.get('buildCommand') || '',
            dockerfilePath: formData.get('dockerfilePath') || 'Dockerfile',
            dockerRegistry: formData.get('dockerRegistry') || ''
        };
    }
    
    logConsole(`➕ Criando nova stack "${stackData.name}"...`, 'info');
    disableButtons();
    
    try {
        const response = await fetch('/api/create-stack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stackData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            logConsole(`✅ Stack "${stackData.name}" criada e deployed com sucesso!`, 'success');
            logConsole(`📄 Arquivo criado: ${result.file}`, 'info');
            
            // Mostrar informações das portas atribuídas
            if (result.info) {
                logConsole(`🔍 Porta do container: ${result.info.containerPort}`, 'info');
                logConsole(`🌐 Porta pública: ${result.info.publicPort}`, 'info');
                logConsole(`🔗 Acesse em: ${result.info.url}`, 'success');
            }
            
            if (result.deploy_output) {
                logConsole(`📦 Deploy: ${result.deploy_output}`, 'info');
            }
            
            // Mostrar informações da pipeline Jenkins se foi criada
            if (result.jenkins) {
                if (result.jenkins.success) {
                    logConsole(`🔄 Pipeline Jenkins criada: ${result.jenkins.job_name}`, 'success');
                    logConsole(`🔗 Acesse a pipeline em: ${result.jenkins.job_url}`, 'info');
                } else {
                    logConsole(`⚠️ Aviso Jenkins: ${result.jenkins.error}`, 'warning');
                }
            }
            
            closeCreateStackModal();
            
            // Recarregar listas
            await loadAvailableStacks();
            await refreshStatus();
        } else {
            logConsole(`❌ Erro ao criar stack: ${result.error}`, 'error');
        }
        
    } catch (error) {
        logConsole(`❌ Erro ao comunicar com o servidor: ${error.message}`, 'error');
    } finally {
        enableButtons();
    }
}

// Toggle Traefik config visibility
document.addEventListener('DOMContentLoaded', function() {
    const useTraefikCheckbox = document.getElementById('useTraefik');
    const traefikConfig = document.getElementById('traefikConfig');
    
    if (useTraefikCheckbox) {
        useTraefikCheckbox.addEventListener('change', function() {
            if (this.checked) {
                traefikConfig.style.display = 'block';
            } else {
                traefikConfig.style.display = 'none';
            }
        });
    }
});

// Deploy de um stack
async function deployStack(stackName) {
    showModal(
        'Deploy de Stack',
        `Deseja fazer o deploy do stack "${stackName}"?`,
        async () => {
            logConsole(`🚀 Iniciando deploy do stack "${stackName}"...`, 'info');
            disableButtons();
            
            try {
                const response = await fetch('/api/deploy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ stack: stackName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    logConsole(`✅ Stack "${stackName}" deployado com sucesso!`, 'success');
                    if (result.output) {
                        logConsole(result.output, 'info');
                    }
                    setTimeout(refreshStatus, 2000);
                } else {
                    logConsole(`❌ Erro ao deployar stack "${stackName}"`, 'error');
                    if (result.error) {
                        logConsole(result.error, 'error');
                    }
                }
                
            } catch (error) {
                logConsole(`❌ Erro ao comunicar com o servidor: ${error.message}`, 'error');
            } finally {
                enableButtons();
            }
        }
    );
}

// Remover um stack
async function removeStack(stackName) {
    showModal(
        'Remover Stack',
        `Deseja remover o stack "${stackName}"? Esta ação irá parar todos os serviços e deletar o arquivo YAML.`,
        async () => {
            logConsole(`🗑️ Removendo stack "${stackName}"...`, 'warning');
            disableButtons();
            
            try {
                const response = await fetch('/api/remove', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ stack: stackName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    logConsole(`✅ Stack "${stackName}" removido com sucesso!`, 'success');
                    if (result.output) {
                        logConsole(result.output, 'info');
                    }
                    // Recarregar ambas as listas
                    await loadAvailableStacks();
                    await refreshStatus();
                } else {
                    logConsole(`❌ Erro ao remover stack "${stackName}"`, 'error');
                    if (result.error) {
                        logConsole(result.error, 'error');
                    }
                }
                
            } catch (error) {
                logConsole(`❌ Erro ao comunicar com o servidor: ${error.message}`, 'error');
            } finally {
                enableButtons();
            }
        }
    );
}

// Ver YAML de uma stack
async function viewStackYaml(stackName) {
    try {
        const response = await fetch(`/api/stack-yaml/${stackName}`);
        const result = await response.json();
        
        if (result.success) {
            showYamlEditor(stackName, result.yaml);
        } else {
            logConsole(`❌ Erro ao carregar YAML: ${result.error}`, 'error');
        }
    } catch (error) {
        logConsole(`❌ Erro ao carregar YAML: ${error.message}`, 'error');
    }
}

// Variável global para armazenar o nome da stack sendo editada
let currentEditingStack = null;

// Mostrar editor de YAML
function showYamlEditor(stackName, yamlContent) {
    const modal = document.getElementById('yamlEditorModal');
    const title = document.getElementById('yamlEditorTitle');
    const textarea = document.getElementById('yamlEditorContent');
    
    currentEditingStack = stackName;
    title.textContent = `📝 Editar YAML da Stack: ${stackName}`;
    textarea.value = yamlContent;
    
    modal.style.display = 'block';
}

// Fechar editor de YAML
function closeYamlEditor() {
    const modal = document.getElementById('yamlEditorModal');
    modal.style.display = 'none';
    currentEditingStack = null;
}

// Salvar e fazer redeploy do YAML editado
async function saveAndDeployYaml() {
    if (!currentEditingStack) {
        logConsole('❌ Erro: Nenhuma stack selecionada', 'error');
        return;
    }
    
    const textarea = document.getElementById('yamlEditorContent');
    const yamlContent = textarea.value;
    
    logConsole(`💾 Salvando e reaplicando stack "${currentEditingStack}"...`, 'info');
    disableButtons();
    
    try {
        const response = await fetch('/api/update-stack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stack: currentEditingStack,
                yaml: yamlContent
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            logConsole(`✅ Stack "${currentEditingStack}" atualizada e redeployada com sucesso!`, 'success');
            if (result.output) {
                logConsole(result.output, 'info');
            }
            closeYamlEditor();
            await loadAvailableStacks();
            await refreshStatus();
        } else {
            logConsole(`❌ Erro ao atualizar stack: ${result.error}`, 'error');
        }
        
    } catch (error) {
        logConsole(`❌ Erro ao comunicar com o servidor: ${error.message}`, 'error');
    } finally {
        enableButtons();
    }
}

// Escapar HTML para exibição segura
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Confirmação para iniciar lab
function confirmStartLab() {
    showModal(
        '🚀 Iniciar Lab Completo',
        'Deseja iniciar todo o ambiente do lab? Isso pode levar alguns minutos.',
        startLab
    );
}

// Confirmação para destruir lab
function confirmDestroyLab() {
    showModal(
        '⚠️ Destruir Lab',
        'ATENÇÃO: Esta ação irá destruir todo o ambiente do lab, incluindo todos os stacks e volumes. Deseja continuar?',
        destroyLab
    );
}

// Iniciar todo o lab
async function startLab() {
    logConsole('🚀 Iniciando lab completo... Por favor, aguarde.', 'info');
    disableButtons();
    
    try {
        const response = await fetch('/api/lab/start', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            logConsole('✅ Lab iniciado com sucesso!', 'success');
            if (result.output) {
                logConsole(result.output, 'info');
            }
            setTimeout(refreshStatus, 3000);
            updateDashboardMetrics();
        } else {
            logConsole('❌ Erro ao iniciar o lab', 'error');
            if (result.error) {
                logConsole(result.error, 'error');
            }
        }
        
    } catch (error) {
        logConsole(`❌ Erro ao comunicar com o servidor: ${error.message}`, 'error');
    } finally {
        enableButtons();
    }
}

// Destruir todo o lab
async function destroyLab() {
    logConsole('💥 Destruindo lab... Por favor, aguarde.', 'warning');
    disableButtons();
    
    try {
        const response = await fetch('/api/lab/destroy', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            logConsole('✅ Lab destruído com sucesso!', 'success');
            if (result.output) {
                logConsole(result.output, 'info');
            }
            setTimeout(() => {
                refreshStatus();
                updateDashboardMetrics();
            }, 2000);
        } else {
            logConsole('❌ Erro ao destruir o lab', 'error');
            if (result.error) {
                logConsole(result.error, 'error');
            }
        }
        
    } catch (error) {
        logConsole(`❌ Erro ao comunicar com o servidor: ${error.message}`, 'error');
    } finally {
        enableButtons();
    }
}

// Modal
function showModal(title, message, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
    currentAction = onConfirm;
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
    currentAction = null;
}

function confirmAction() {
    if (currentAction) {
        currentAction();
        closeModal();
    }
}

// Console
function logConsole(message, type = 'info') {
    const console = document.getElementById('console');
    const timestamp = new Date().toLocaleTimeString();
    const p = document.createElement('p');
    p.className = `console-${type}`;
    p.textContent = `[${timestamp}] ${message}`;
    console.appendChild(p);
    console.scrollTop = console.scrollHeight;
}

// Utilidades
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function disableButtons() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = true;
    });
}

function enableButtons() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = false;
    });
}

// Dashboard Charts and Metrics
function initDashboardCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                labels: {
                    color: '#94a3b8',
                    font: {
                        family: "'JetBrains Mono', monospace",
                        size: 12
                    }
                }
            }
        }
    };
    
    // Stacks Status Chart (Doughnut)
    const stacksCtx = document.getElementById('stacksChart');
    if (stacksCtx) {
        stacksChart = new Chart(stacksCtx, {
            type: 'doughnut',
            data: {
                labels: ['Ativos', 'Disponíveis'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: [
                        'rgba(20, 184, 166, 0.8)',
                        'rgba(100, 116, 139, 0.3)'
                    ],
                    borderColor: [
                        'rgba(20, 184, 166, 1)',
                        'rgba(100, 116, 139, 0.5)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                ...chartOptions,
                cutout: '70%'
            }
        });
    }
    
    // Activity Chart (Bar)
    const activityCtx = document.getElementById('activityChart');
    if (activityCtx) {
        activityChart = new Chart(activityCtx, {
            type: 'bar',
            data: {
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                datasets: [{
                    label: 'Deploys',
                    data: [12, 19, 8, 15, 22, 8, 5],
                    backgroundColor: 'rgba(20, 184, 166, 0.6)',
                    borderColor: 'rgba(20, 184, 166, 1)',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: "'JetBrains Mono', monospace"
                            }
                        },
                        grid: {
                            color: 'rgba(100, 116, 139, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: "'JetBrains Mono', monospace"
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    updateDashboardMetrics();
}

async function updateDashboardMetrics() {
    try {
        // Buscar dados das stacks
        const [stacksResponse, activeResponse] = await Promise.all([
            fetch('/api/stacks'),
            fetch('/api/status')
        ]);
        
        const stacks = await stacksResponse.json();
        const activeData = await activeResponse.json();
        
        // Contar stacks ativos
        const activeStacks = activeData.stacks ? activeData.stacks.length : 0;
        const totalStacks = stacks.length;
        
        // Contar total de serviços
        let totalServices = 0;
        stacks.forEach(stack => {
            totalServices += stack.services.length;
        });
        
        // Atualizar cards de métricas
        document.getElementById('totalStacks').textContent = totalStacks;
        document.getElementById('activeStacks').textContent = activeStacks;
        document.getElementById('totalServices').textContent = totalServices;
        
        // Atualizar gráfico de stacks
        if (stacksChart) {
            stacksChart.data.datasets[0].data = [activeStacks, totalStacks - activeStacks];
            stacksChart.update('none');
        }
        
    } catch (error) {
        console.error('Erro ao atualizar métricas:', error);
    }
}

// Cleanup ao sair
window.addEventListener('beforeunload', () => {
    if (autoRefresh) {
        clearInterval(autoRefresh);
    }
});
