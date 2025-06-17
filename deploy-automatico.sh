#!/bin/bash

echo "🚀 Iniciando deploy automático do sistema de agendamento..."

# Ir para o diretório correto
cd /var/www/agendamento-pro

# Fazer build do backend
echo "📦 Fazendo build do servidor..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verificar se o build foi criado
if [ -f "dist/index.js" ]; then
    echo "✅ Build do servidor criado com sucesso!"
else
    echo "❌ Erro: Build do servidor falhou!"
    exit 1
fi

# Parar processo antigo se existir
echo "🛑 Parando processos antigos..."
pm2 delete agendamento-pro 2>/dev/null || true

# Iniciar aplicação
echo "🚀 Iniciando aplicação..."
pm2 start dist/index.js --name agendamento-pro

# Salvar configuração PM2
echo "💾 Salvando configuração PM2..."
pm2 save

# Configurar PM2 para iniciar automaticamente
echo "⚙️ Configurando inicialização automática..."
pm2 startup

# Verificar status
echo "📊 Status da aplicação:"
pm2 status

# Testar aplicação
echo "🧪 Testando aplicação..."
sleep 3
curl -s http://localhost:3000 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Aplicação está respondendo na porta 3000!"
else
    echo "⚠️ Aplicação pode não estar respondendo. Verificando logs..."
    pm2 logs agendamento-pro --lines 10
fi

echo "🎉 Deploy concluído!"
echo "📝 Para verificar logs: pm2 logs agendamento-pro"
echo "🌐 Acesse: http://meuagendamentopro.com.br" 