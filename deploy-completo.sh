#!/bin/bash

# Script de Deploy Completo com Logs Detalhados
# Criado para facilitar troubleshooting

LOG_FILE="/var/log/agendamento-deploy.log"
ERROR_LOG="/var/log/agendamento-deploy-errors.log"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Função para log de erro
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$ERROR_LOG" | tee -a "$LOG_FILE"
}

# Função para executar comando com log
run_cmd() {
    local cmd="$1"
    local description="$2"
    
    log "🔄 $description"
    log "Executando: $cmd"
    
    if eval "$cmd" >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
        log "✅ $description - SUCESSO"
        return 0
    else
        log_error "$description - FALHOU"
        log_error "Comando: $cmd"
        return 1
    fi
}

# Limpar logs anteriores
> "$LOG_FILE"
> "$ERROR_LOG"

log "🚀 INICIANDO DEPLOY AUTOMÁTICO DO SISTEMA DE AGENDAMENTO"
log "=================================================="

# 1. Verificar se estamos no diretório correto
log "📁 Verificando diretório atual..."
if [ ! -f "/var/www/agendamento-pro/package.json" ]; then
    log_error "Arquivo package.json não encontrado em /var/www/agendamento-pro/"
    exit 1
fi

cd /var/www/agendamento-pro
log "✅ Diretório correto: $(pwd)"

# 2. Verificar Node.js e npm
log "🔍 Verificando versões..."
node --version >> "$LOG_FILE" 2>&1
npm --version >> "$LOG_FILE" 2>&1
log "Node.js: $(node --version)"
log "NPM: $(npm --version)"

# 3. Verificar arquivo .env
log "⚙️ Verificando configurações..."
if [ -f ".env" ]; then
    log "✅ Arquivo .env encontrado"
    log "Conteúdo do .env:"
    cat .env >> "$LOG_FILE"
else
    log_error "Arquivo .env não encontrado!"
    exit 1
fi

# 4. Verificar estrutura do projeto
log "📂 Verificando estrutura do projeto..."
for dir in "client" "server" "shared" "public"; do
    if [ -d "$dir" ]; then
        log "✅ Diretório $dir encontrado"
    else
        log_error "Diretório $dir não encontrado!"
        exit 1
    fi
done

# 5. Fazer build do backend
log "📦 Iniciando build do servidor..."
if ! run_cmd "npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist" "Build do servidor"; then
    log_error "Build do servidor falhou!"
    log "Verificando se o arquivo server/index.ts existe..."
    ls -la server/ >> "$LOG_FILE" 2>&1
    exit 1
fi

# 6. Verificar se o build foi criado
log "🔍 Verificando arquivos gerados..."
if [ -f "dist/index.js" ]; then
    log "✅ Arquivo dist/index.js criado com sucesso"
    log "Tamanho do arquivo: $(ls -lh dist/index.js | awk '{print $5}')"
else
    log_error "Arquivo dist/index.js não foi criado!"
    log "Conteúdo do diretório dist:"
    ls -la dist/ >> "$LOG_FILE" 2>&1
    exit 1
fi

# 7. Verificar se PM2 está instalado
log "🔍 Verificando PM2..."
if ! command -v pm2 &> /dev/null; then
    log "⚠️ PM2 não encontrado, instalando..."
    if ! run_cmd "npm install -g pm2" "Instalação do PM2"; then
        log_error "Falha ao instalar PM2!"
        exit 1
    fi
fi

# 8. Parar processos antigos
log "🛑 Parando processos antigos..."
pm2 delete agendamento-pro >> "$LOG_FILE" 2>&1 || log "ℹ️ Nenhum processo anterior encontrado"

# 9. Testar conexão com banco de dados
log "🗄️ Testando conexão com banco de dados..."
if ! run_cmd "node -e \"
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://agendamento:agendamento123@localhost:5432/agendamento_pro'
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro de conexão:', err.message);
    process.exit(1);
  } else {
    console.log('Conexão OK! Hora atual:', res.rows[0].now);
    process.exit(0);
  }
  pool.end();
});
\"" "Teste de conexão com banco"; then
    log_error "Falha na conexão com banco de dados!"
    log "Verificando status do PostgreSQL..."
    systemctl status postgresql >> "$LOG_FILE" 2>&1
    exit 1
fi

# 10. Iniciar aplicação
log "🚀 Iniciando aplicação..."
if ! run_cmd "pm2 start dist/index.js --name agendamento-pro" "Inicialização da aplicação"; then
    log_error "Falha ao iniciar aplicação!"
    exit 1
fi

# 11. Aguardar inicialização
log "⏳ Aguardando inicialização (5 segundos)..."
sleep 5

# 12. Verificar status
log "📊 Verificando status da aplicação..."
pm2 status >> "$LOG_FILE" 2>&1

# 13. Verificar logs da aplicação
log "📝 Verificando logs da aplicação..."
pm2 logs agendamento-pro --lines 10 >> "$LOG_FILE" 2>&1

# 14. Testar aplicação
log "🧪 Testando aplicação na porta 3000..."
if curl -s --connect-timeout 10 http://localhost:3000 > /dev/null; then
    log "✅ Aplicação está respondendo na porta 3000!"
else
    log_error "Aplicação não está respondendo na porta 3000!"
    log "Verificando se a porta está em uso..."
    netstat -tlnp | grep :3000 >> "$LOG_FILE" 2>&1
    log "Logs recentes da aplicação:"
    pm2 logs agendamento-pro --lines 20 >> "$LOG_FILE" 2>&1
fi

# 15. Salvar configuração PM2
log "💾 Salvando configuração PM2..."
run_cmd "pm2 save" "Salvamento da configuração PM2"

# 16. Configurar inicialização automática
log "⚙️ Configurando inicialização automática..."
pm2 startup >> "$LOG_FILE" 2>&1

# 17. Verificar Nginx
log "🌐 Verificando configuração do Nginx..."
if systemctl is-active --quiet nginx; then
    log "✅ Nginx está ativo"
    if nginx -t >> "$LOG_FILE" 2>&1; then
        log "✅ Configuração do Nginx está válida"
    else
        log_error "Configuração do Nginx tem erros!"
    fi
else
    log_error "Nginx não está ativo!"
    systemctl status nginx >> "$LOG_FILE" 2>&1
fi

# 18. Resumo final
log "=================================================="
log "🎉 DEPLOY CONCLUÍDO!"
log "=================================================="
log "📊 Status final:"
pm2 status >> "$LOG_FILE" 2>&1

log ""
log "📝 INFORMAÇÕES IMPORTANTES:"
log "• Logs do deploy: $LOG_FILE"
log "• Logs de erro: $ERROR_LOG"
log "• Verificar aplicação: curl http://localhost:3000"
log "• Verificar logs da app: pm2 logs agendamento-pro"
log "• Reiniciar aplicação: pm2 restart agendamento-pro"
log "• Acesso web: http://meuagendamentopro.com.br"
log ""

# Mostrar resumo na tela
echo ""
echo "🎉 DEPLOY CONCLUÍDO!"
echo "📝 Logs salvos em: $LOG_FILE"
echo "❌ Erros salvos em: $ERROR_LOG"
echo "🌐 Teste: http://meuagendamentopro.com.br"
echo ""
echo "📊 Status atual:"
pm2 status

if [ -s "$ERROR_LOG" ]; then
    echo ""
    echo "⚠️ ATENÇÃO: Foram encontrados erros durante o deploy!"
    echo "Verifique o arquivo: $ERROR_LOG"
    echo ""
    echo "Últimos erros:"
    tail -10 "$ERROR_LOG"
fi 