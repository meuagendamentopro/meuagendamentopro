#!/bin/bash

# Deploy alternativo sem bundle completo (economiza RAM)

LOG_FILE="/var/log/agendamento-deploy-simples.log"
ERROR_LOG="/var/log/agendamento-deploy-simples-errors.log"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Limpar logs anteriores
> "$LOG_FILE"
> "$ERROR_LOG"

log "🚀 DEPLOY ALTERNATIVO (SEM BUNDLE COMPLETO)"
log "============================================="

cd /var/www/agendamento-pro

# 1. Compilar TypeScript sem bundle
log "📦 Compilando TypeScript sem bundle..."
if npx tsc --outDir dist-temp >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Compilação TypeScript OK"
else
    log "❌ Erro na compilação TypeScript"
    exit 1
fi

# 2. Copiar arquivo principal
log "📋 Copiando arquivo principal..."
cp dist-temp/server/index.js dist/index.js
log "✅ Arquivo copiado"

# 3. Parar processo antigo
log "🛑 Parando processo antigo..."
pm2 delete agendamento-pro >> "$LOG_FILE" 2>&1 || log "ℹ️ Nenhum processo anterior"

# 4. Iniciar aplicação
log "🚀 Iniciando aplicação..."
if pm2 start dist/index.js --name agendamento-pro >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Aplicação iniciada"
else
    log "❌ Erro ao iniciar aplicação"
    pm2 logs agendamento-pro --lines 10 >> "$LOG_FILE" 2>&1
    exit 1
fi

# 5. Aguardar e testar
log "⏳ Aguardando inicialização..."
sleep 5

if curl -s --connect-timeout 10 http://localhost:3000 > /dev/null; then
    log "✅ Aplicação respondendo na porta 3000!"
else
    log "❌ Aplicação não está respondendo"
    pm2 logs agendamento-pro --lines 10 >> "$LOG_FILE" 2>&1
fi

# 6. Salvar configuração
log "💾 Salvando configuração PM2..."
pm2 save >> "$LOG_FILE" 2>&1

log "🎉 Deploy alternativo concluído!"
pm2 status

# Limpar arquivos temporários
rm -rf dist-temp 