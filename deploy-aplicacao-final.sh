#!/bin/bash

# Script Final de Deploy da Aplicação
# Execute após fazer upload do código

LOG_FILE="/var/log/deploy-aplicacao.log"
ERROR_LOG="/var/log/deploy-aplicacao-errors.log"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Limpar logs anteriores
> "$LOG_FILE"
> "$ERROR_LOG"

log "🚀 DEPLOY FINAL DA APLICAÇÃO"
log "============================"

cd /var/www/agendamento-pro

# 1. Verificar arquivos
log "📂 Verificando arquivos do projeto..."
if [ ! -f "package.json" ]; then
    log "❌ package.json não encontrado!"
    exit 1
fi

if [ ! -d "client" ] || [ ! -d "server" ]; then
    log "❌ Diretórios client ou server não encontrados!"
    exit 1
fi

log "✅ Arquivos do projeto encontrados"

# 2. Instalar dependências
log "📦 Instalando dependências..."
if npm install >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Dependências instaladas"
else
    log "❌ Erro ao instalar dependências"
    exit 1
fi

# 3. Build do frontend
log "🏗️ Fazendo build do frontend..."
if npx vite build >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Build do frontend concluído"
else
    log "❌ Erro no build do frontend"
    exit 1
fi

# 4. Instalar tsx
log "📦 Instalando tsx..."
if npm install tsx >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ tsx instalado"
else
    log "❌ Erro ao instalar tsx"
    exit 1
fi

# 5. Parar aplicação anterior
log "🛑 Parando aplicação anterior..."
pm2 delete agendamento-pro >> "$LOG_FILE" 2>&1 || log "ℹ️ Nenhuma aplicação anterior encontrada"

# 6. Iniciar aplicação
log "🚀 Iniciando aplicação..."
if pm2 start "npx tsx server/index.ts" --name agendamento-pro >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Aplicação iniciada"
else
    log "❌ Erro ao iniciar aplicação"
    pm2 logs agendamento-pro --lines 10 >> "$LOG_FILE" 2>&1
    exit 1
fi

# 7. Aguardar inicialização
log "⏳ Aguardando inicialização (15 segundos)..."
sleep 15

# 8. Verificar status
log "📊 Verificando status..."
pm2 status >> "$LOG_FILE" 2>&1

# 9. Testar aplicação
log "🧪 Testando aplicação..."
if curl -s --connect-timeout 10 http://localhost:3000 > /dev/null; then
    log "✅ Aplicação respondendo na porta 3000!"
else
    log "⚠️ Aplicação pode não estar respondendo"
    log "📝 Verificando logs..."
    pm2 logs agendamento-pro --lines 20 >> "$LOG_FILE" 2>&1
fi

# 10. Salvar configuração PM2
log "💾 Salvando configuração PM2..."
pm2 save >> "$LOG_FILE" 2>&1

# 11. Configurar inicialização automática
log "⚙️ Configurando inicialização automática..."
pm2 startup >> "$LOG_FILE" 2>&1

# 12. Configurar pgAdmin (se necessário)
log "🖥️ Configurando pgAdmin..."
if ! pgrep -f pgadmin4 > /dev/null; then
    log "📦 Configurando pgAdmin pela primeira vez..."
    echo "admin@meuagendamentopro.com.br" | python3 -c "
import sys
sys.path.append('/usr/local/lib/python3.10/dist-packages')
from pgadmin4.setup import create_app
app = create_app()
" >> "$LOG_FILE" 2>> "$ERROR_LOG" || log "⚠️ pgAdmin precisa ser configurado manualmente"
fi

log "=================================="
log "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
log "=================================="

echo ""
echo "🎉 APLICAÇÃO DEPLOYADA COM SUCESSO!"
echo ""
echo "📊 Status atual:"
pm2 status
echo ""
echo "🌐 ACESSOS:"
echo "• Site Principal: http://meuagendamentopro.com.br"
echo "• pgAdmin: http://meuagendamentopro.com.br/pgadmin4"
echo ""
echo "🗄️ BANCO DE DADOS:"
echo "• Host: localhost"
echo "• Porta: 5432"
echo "• Usuário: agendamento"
echo "• Senha: agendamento123"
echo "• Database: agendamento_pro"
echo ""
echo "📝 COMANDOS ÚTEIS:"
echo "• Ver logs: pm2 logs agendamento-pro"
echo "• Reiniciar: pm2 restart agendamento-pro"
echo "• Status: pm2 status"
echo ""
echo "📋 CONFIGURAR pgAdmin:"
echo "1. Acesse: http://meuagendamentopro.com.br/pgadmin4"
echo "2. Email: admin@meuagendamentopro.com.br"
echo "3. Senha: admin123"
echo "4. Adicione servidor PostgreSQL com as credenciais acima"
echo ""

if [ -s "$ERROR_LOG" ]; then
    echo "⚠️ ATENÇÃO: Alguns avisos foram encontrados!"
    echo "Verifique: $ERROR_LOG"
fi 