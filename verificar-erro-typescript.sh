#!/bin/bash

echo "🔍 Verificando erro de compilação TypeScript..."

cd /var/www/agendamento-pro

echo "📋 Verificando logs de erro:"
if [ -f "/var/log/agendamento-deploy-simples-errors.log" ]; then
    echo "=== ERROS ENCONTRADOS ==="
    cat /var/log/agendamento-deploy-simples-errors.log
    echo "========================="
else
    echo "❌ Arquivo de erro não encontrado"
fi

echo ""
echo "🔧 Testando compilação TypeScript manualmente..."
npx tsc --noEmit --skipLibCheck

echo ""
echo "📂 Verificando tsconfig.json..."
cat tsconfig.json

echo ""
echo "📦 Verificando se todas as dependências estão instaladas..."
npm list --depth=0 2>/dev/null | grep -E "(typescript|@types)" || echo "Dependências TypeScript não encontradas" 