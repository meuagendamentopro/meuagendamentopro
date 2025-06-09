#!/bin/bash

echo "🚀 INSTALAÇÃO RÁPIDA - MIGRAÇÃO DO BANCO DE DADOS"
echo "================================================"
echo

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

echo
echo "🔧 Configuração necessária:"
echo "1. Copie env-example.txt para .env"
echo "2. Edite .env com os dados do seu banco de produção"
echo "3. Execute: npm run check (para verificar)"
echo "4. Execute: npm run migrate (para migrar)"
echo

echo "📖 Para instruções detalhadas, consulte: MIGRATION-README.md"
