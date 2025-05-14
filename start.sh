#!/bin/sh

# Exibir informações do ambiente
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL: $DATABASE_URL"
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

# Verificar se o arquivo drizzle.config.ts existe
if [ -f "drizzle.config.ts" ]; then
  echo "Arquivo drizzle.config.ts encontrado"
  cat drizzle.config.ts
else
  echo "AVISO: Arquivo drizzle.config.ts não encontrado!"
fi

# Verificar se o arquivo schema.ts existe
if [ -f "shared/schema.ts" ]; then
  echo "Arquivo schema.ts encontrado"
else
  echo "AVISO: Arquivo schema.ts não encontrado!"
  find . -name "schema.ts"
fi

# Iniciar a aplicação diretamente sem tentar migrações
echo "Iniciando a aplicação..."
node dist/index.js
