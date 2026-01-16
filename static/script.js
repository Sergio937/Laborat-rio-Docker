// Estado da aplicação
let currentAction = null;
let autoRefresh = null;
let stacksChart = null;
let activityChart = null;
let securityRefreshInterval = null;

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
    
    // Se entrou na tela de segurança, carregar dados
    if (screenName === 'security') {
        loadSecurityData();
    }
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
                    ${(stack.urls && stack.urls.length > 0) || (stack.ports && stack.ports.length > 0) ? `
                        <div class="ports-list">
                            ${stack.urls && stack.urls.length > 0 ? stack.urls.map(url => `
                                <a href="${url}" target="_blank" class="port-link">
                                    🌐 ${url.replace('http://', '')}
                                </a>
                            `).join('') : ''}
                            ${stack.ports && stack.ports.length > 0 ? stack.ports.map(port => `
                                <a href="http://localhost:${port}" target="_blank" class="port-link">
                                    🌐 localhost:${port}
                                </a>
                            `).join('') : ''}
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
                    ${(stack.urls && stack.urls.length > 0) || (stack.ports && stack.ports.length > 0) ? `
                        <div class="ports-list-inline">
                            ${stack.urls && stack.urls.length > 0 ? stack.urls.map(url => `
                                <a href="${url}" target="_blank" class="port-link-small">
                                    🌐 ${url.replace('http://', '')}
                                </a>
                            `).join('') : ''}
                            ${stack.ports && stack.ports.length > 0 ? stack.ports.map(port => `
                                <a href="http://localhost:${port}" target="_blank" class="port-link-small">
                                    🌐 localhost:${port}
                                </a>
                            `).join('') : ''}
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
// ==============================================
// Security Functions
// ==============================================

function loadSecurityData() {
    console.log('Loading security data...');
    try {
        refreshSonarQube();
        refreshTrivy();
        loadScanHistory();
        
        // Auto-refresh a cada 30 segundos quando estiver na tela de segurança
        if (securityRefreshInterval) {
            clearInterval(securityRefreshInterval);
        }
        securityRefreshInterval = setInterval(() => {
            refreshSonarQube();
            refreshTrivy();
        }, 30000);
    } catch (error) {
        console.error('Error loading security data:', error);
    }
}

async function refreshSonarQube() {
    console.log('Refreshing SonarQube data...');
    const statusEl = document.getElementById('sonarqubeStatus');
    const dataEl = document.getElementById('sonarqubeData');
    
    if (!statusEl || !dataEl) {
        console.error('SonarQube elements not found!');
        return;
    }
    
    try {
        statusEl.innerHTML = '<span class="status-dot status-loading"></span><span>Conectando...</span>';
        
        const response = await fetch('/api/security/sonarqube');
        const data = await response.json();
        
        console.log('SonarQube response:', data);
        
        if (data.success) {
            statusEl.innerHTML = '<span class="status-dot status-online"></span><span>Online</span>';
            
            // Atualizar métricas principais
            document.getElementById('sonarBugs').textContent = data.bugs || '0';
            document.getElementById('sonarVulnerabilities').textContent = data.vulnerabilities || '0';
            document.getElementById('sonarCoverage').textContent = data.coverage ? `${data.coverage}%` : '-';
            
            // Exibir detalhes
            dataEl.innerHTML = `
                <div class="security-metrics">
                    <div class="metric-row">
                        <span class="metric-label">🐛 Bugs:</span>
                        <span class="metric-value ${data.bugs > 0 ? 'text-warning' : 'text-success'}">${data.bugs || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">🔴 Vulnerabilidades:</span>
                        <span class="metric-value ${data.vulnerabilities > 0 ? 'text-danger' : 'text-success'}">${data.vulnerabilities || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">⚠️ Code Smells:</span>
                        <span class="metric-value">${data.code_smells || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">📊 Cobertura:</span>
                        <span class="metric-value">${data.coverage ? data.coverage + '%' : 'N/A'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">📈 Qualidade:</span>
                        <span class="metric-value ${data.quality_gate === 'OK' ? 'text-success' : 'text-danger'}">${data.quality_gate || 'N/A'}</span>
                    </div>
                    ${data.projects && data.projects.length > 0 ? `
                        <div class="projects-list">
                            <strong>Projetos Analisados:</strong>
                            ${data.projects.map(p => `<span class="project-tag">${p}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>Offline</span>';
            dataEl.innerHTML = `<div class="error-message">⚠️ ${data.error || 'Não foi possível conectar ao SonarQube'}</div>`;
        }
    } catch (error) {
        statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>Erro</span>';
        dataEl.innerHTML = `<div class="error-message">❌ Erro ao conectar: ${error.message}</div>`;
    }
}

async function refreshTrivy() {
    console.log('Refreshing Trivy data...');
    const statusEl = document.getElementById('trivyStatus');
    const dataEl = document.getElementById('trivyData');
    
    if (!statusEl || !dataEl) {
        console.error('Trivy elements not found!');
        return;
    }
    
    try {
        statusEl.innerHTML = '<span class="status-dot status-loading"></span><span>Conectando...</span>';
        
        const response = await fetch('/api/security/trivy');
        const data = await response.json();
        
        console.log('Trivy response:', data);
        
        if (data.success) {
            statusEl.innerHTML = '<span class="status-dot status-online"></span><span>Online</span>';
            
            // Atualizar métrica principal
            const totalVulns = (data.critical || 0) + (data.high || 0) + (data.medium || 0) + (data.low || 0);
            document.getElementById('trivyVulnerabilities').textContent = totalVulns;
            
            // Exibir detalhes
            dataEl.innerHTML = `
                <div class="security-metrics">
                    <div class="metric-row">
                        <span class="metric-label">🔴 Críticas:</span>
                        <span class="metric-value text-danger">${data.critical || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">🟠 Altas:</span>
                        <span class="metric-value text-warning">${data.high || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">🟡 Médias:</span>
                        <span class="metric-value text-info">${data.medium || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">🟢 Baixas:</span>
                        <span class="metric-value text-success">${data.low || 0}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">📦 Total:</span>
                        <span class="metric-value">${totalVulns}</span>
                    </div>
                    ${data.last_scan ? `
                        <div class="metric-row">
                            <span class="metric-label">🕐 Último Scan:</span>
                            <span class="metric-value">${new Date(data.last_scan).toLocaleString('pt-BR')}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>Offline</span>';
            dataEl.innerHTML = `<div class="error-message">⚠️ ${data.error || 'Não foi possível conectar ao Trivy'}</div>`;
        }
    } catch (error) {
        statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>Erro</span>';
        dataEl.innerHTML = `<div class="error-message">❌ Erro ao conectar: ${error.message}</div>`;
    }
}

async function startTrivyScan() {
    if (!confirm('Iniciar scan de vulnerabilidades? Isso pode levar alguns minutos.')) {
        return;
    }
    
    try {
        logConsole('Iniciando scan do Trivy...', 'info');
        const response = await fetch('/api/security/trivy/scan', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            logConsole('✅ Scan iniciado com sucesso!', 'success');
            setTimeout(() => refreshTrivy(), 2000);
        } else {
            logConsole(`❌ Erro ao iniciar scan: ${data.error}`, 'error');
        }
    } catch (error) {
        logConsole(`❌ Erro: ${error.message}`, 'error');
    }
}

async function scanDockerImage() {
    const imageInput = document.getElementById('imageName');
    const imageName = imageInput.value.trim();
    
    if (!imageName) {
        alert('Por favor, digite o nome da imagem Docker');
        return;
    }
    
    const dataEl = document.getElementById('trivyData');
    const statusEl = document.getElementById('trivyStatus');
    
    try {
        statusEl.innerHTML = '<span class="status-dot status-loading"></span><span>Escaneando...</span>';
        dataEl.innerHTML = `
            <div class="scanning-message">
                <div class="spinner"></div>
                <p>🔍 Escaneando imagem: <strong>${imageName}</strong></p>
                <p>Isso pode levar alguns minutos...</p>
            </div>
        `;
        
        logConsole(`Iniciando scan da imagem: ${imageName}`, 'info');
        toggleConsoleModal();
        
        const response = await fetch('/api/security/trivy/scan-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusEl.innerHTML = '<span class="status-dot status-online"></span><span>Scan Concluído</span>';
            logConsole(`✅ Scan concluído para ${imageName}`, 'success');
            
            // Processar resultados
            displayTrivyResults(data.results, imageName);
            
            // Atualizar métrica principal
            const totalVulns = (data.results.critical || 0) + (data.results.high || 0) + 
                              (data.results.medium || 0) + (data.results.low || 0);
            document.getElementById('trivyVulnerabilities').textContent = totalVulns;
            
        } else {
            statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>Erro no Scan</span>';
            dataEl.innerHTML = `<div class="error-message">❌ ${data.error}</div>`;
            logConsole(`❌ Erro no scan: ${data.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Scan error:', error);
        statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>Erro</span>';
        dataEl.innerHTML = `<div class="error-message">❌ Erro: ${error.message}</div>`;
        logConsole(`❌ Erro ao escanear: ${error.message}`, 'error');
    }
}

function displayTrivyResults(results, imageName) {
    const dataEl = document.getElementById('trivyData');
    
    const critical = results.critical || 0;
    const high = results.high || 0;
    const medium = results.medium || 0;
    const low = results.low || 0;
    const total = critical + high + medium + low;
    
    let statusClass = 'text-success';
    let statusText = 'Seguro ✅';
    
    if (critical > 0) {
        statusClass = 'text-danger';
        statusText = 'Crítico ❌';
    } else if (high > 0) {
        statusClass = 'text-warning';
        statusText = 'Atenção ⚠️';
    } else if (medium > 0) {
        statusClass = 'text-info';
        statusText = 'Revisar 📋';
    }
    
    dataEl.innerHTML = `
        <div class="scan-results">
            <div class="scan-header">
                <h4>📦 ${imageName}</h4>
                <span class="${statusClass} scan-status">${statusText}</span>
            </div>
            
            <div class="security-metrics">
                <div class="metric-row ${critical > 0 ? 'alert-critical' : ''}">
                    <span class="metric-label">🔴 Críticas:</span>
                    <span class="metric-value text-danger">${critical}</span>
                </div>
                <div class="metric-row ${high > 0 ? 'alert-high' : ''}">
                    <span class="metric-label">🟠 Altas:</span>
                    <span class="metric-value text-warning">${high}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">🟡 Médias:</span>
                    <span class="metric-value text-info">${medium}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">🟢 Baixas:</span>
                    <span class="metric-value text-success">${low}</span>
                </div>
                <div class="metric-row total-row">
                    <span class="metric-label">📊 Total:</span>
                    <span class="metric-value"><strong>${total}</strong></span>
                </div>
            </div>
            
            ${results.vulnerabilities && results.vulnerabilities.length > 0 ? `
                <div class="vulnerabilities-list">
                    <h4>🔍 Vulnerabilidades Encontradas:</h4>
                    ${results.vulnerabilities.slice(0, 10).map(v => `
                        <div class="vulnerability-item severity-${v.severity.toLowerCase()}">
                            <div class="vuln-header">
                                <span class="vuln-id">${v.id}</span>
                                <span class="vuln-severity ${v.severity.toLowerCase()}">${v.severity}</span>
                            </div>
                            <div class="vuln-details">
                                <strong>${v.title || v.id}</strong>
                                <p>${v.description || 'Sem descrição'}</p>
                                ${v.fixed_version ? `<p class="fix-available">✅ Fix: ${v.fixed_version}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${results.vulnerabilities.length > 10 ? `
                        <p class="more-vulns">... e mais ${results.vulnerabilities.length - 10} vulnerabilidades</p>
                    ` : ''}
                </div>
            ` : '<p class="no-vulns">✅ Nenhuma vulnerabilidade encontrada!</p>'}
        </div>
    `;
}

async function loadScanHistory() {
    const historyEl = document.getElementById('scanHistory');
    
    try {
        const response = await fetch('/api/security/history');
        const data = await response.json();
        
        if (data.success && data.scans && data.scans.length > 0) {
            historyEl.innerHTML = data.scans.map(scan => `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-type">${scan.type === 'sonar' ? '📊 SonarQube' : '🔍 Trivy'}</span>
                        <span class="history-date">${new Date(scan.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="history-details">
                        ${scan.summary || 'Scan concluído'}
                    </div>
                </div>
            `).join('');
        } else {
            historyEl.innerHTML = '<div class="loading">Nenhum scan encontrado</div>';
        }
    } catch (error) {
        historyEl.innerHTML = '<div class="error-message">Erro ao carregar histórico</div>';
    }
}

// Função para scan rápido de imagens predefinidas
function quickScan(imageName) {
    document.getElementById('imageName').value = imageName;
    scanDockerImage();
}

// Função para limpar resultados do Trivy
function clearTrivyResults() {
    const dataEl = document.getElementById('trivyData');
    const statusEl = document.getElementById('trivyStatus');
    const imageInput = document.getElementById('imageName');
    
    dataEl.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <p>Aguardando scan de imagem...</p>
            <small>Digite o nome de uma imagem acima e clique em "Escanear Imagem"</small>
        </div>
    `;
    
    statusEl.innerHTML = '<span class="status-dot status-loading"></span><span>Conectado ao lab-swarm1</span>';
    imageInput.value = '';
    
    // Resetar métrica
    document.getElementById('trivyVulnerabilities').textContent = '-';
    
    logConsole('🗑️ Resultados do Trivy limpos', 'info');
}

// Cleanup ao sair
window.addEventListener('beforeunload', () => {
    if (autoRefresh) {
        clearInterval(autoRefresh);
    }
});
