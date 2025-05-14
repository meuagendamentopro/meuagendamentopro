#!/bin/sh

# Exibir informações do ambiente
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "Diretório atual: $(pwd)"
echo "Conteúdo do diretório:"
ls -la

# Verificar se o diretório dist existe
if [ -d "dist" ]; then
  echo "Diretório dist encontrado"
  ls -la dist
else
  echo "ERRO: Diretório dist não encontrado!"
  exit 1
fi

# Tentar executar as migrações
echo "Executando migrações do banco de dados..."
npx drizzle-kit push:pg || echo "Aviso: Migrações podem ter falhado, continuando mesmo assim"

# Iniciar a aplicação
echo "Iniciando a aplicação..."
node dist/index.js
