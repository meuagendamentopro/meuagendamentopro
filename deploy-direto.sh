#!/bin/bash

# Deploy direto usando tsx (executa TypeScript diretamente)

LOG_FILE="/var/log/agendamento-deploy-direto.log"
ERROR_LOG="/var/log/agendamento-deploy-direto-errors.log"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Limpar logs anteriores
> "$LOG_FILE"
> "$ERROR_LOG"

log "🚀 DEPLOY DIRETO (SEM COMPILAÇÃO)"
log "================================="

cd /var/www/agendamento-pro

# 1. Verificar se tsx está instalado
log "🔍 Verificando tsx..."
if ! npm list tsx > /dev/null 2>&1; then
    log "📦 Instalando tsx..."
    if npm install tsx >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
        log "✅ tsx instalado"
    else
        log "❌ Erro ao instalar tsx"
        exit 1
    fi
else
    log "✅ tsx já está instalado"
fi

# 2. Parar processo antigo
log "🛑 Parando processo antigo..."
pm2 delete agendamento-pro >> "$LOG_FILE" 2>&1 || log "ℹ️ Nenhum processo anterior"

# 3. Iniciar aplicação diretamente com tsx
log "🚀 Iniciando aplicação com tsx..."
if pm2 start "npx tsx server/index.ts" --name agendamento-pro >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Aplicação iniciada com tsx"
else
    log "❌ Erro ao iniciar aplicação"
    pm2 logs agendamento-pro --lines 10 >> "$LOG_FILE" 2>&1
    exit 1
fi

# 4. Aguardar inicialização
log "⏳ Aguardando inicialização (10 segundos)..."
sleep 10

# 5. Verificar status
log "📊 Verificando status..."
pm2 status >> "$LOG_FILE" 2>&1

# 6. Testar aplicação
log "🧪 Testando aplicação..."
if curl -s --connect-timeout 15 http://localhost:3000 > /dev/null; then
    log "✅ Aplicação respondendo na porta 3000!"
else
    log "⚠️ Aplicação pode não estar respondendo ainda"
    log "📝 Verificando logs da aplicação..."
    pm2 logs agendamento-pro --lines 20 >> "$LOG_FILE" 2>&1
fi

# 7. Salvar configuração
log "💾 Salvando configuração PM2..."
pm2 save >> "$LOG_FILE" 2>&1

log "🎉 Deploy direto concluído!"
echo ""
echo "📊 Status atual:"
pm2 status

echo ""
echo "📝 Para verificar logs da aplicação:"
echo "pm2 logs agendamento-pro"

echo ""
echo "🌐 Teste no navegador:"
echo "http://meuagendamentopro.com.br" 