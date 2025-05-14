#!/bin/bash

# Exibir informações sobre o ambiente
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL configurado: $([ -n "$DATABASE_URL" ] && echo 'sim' || echo 'não')"
echo "Diretório atual: $(pwd)"

# Verificar se o banco de dados está acessível
echo "Conectando ao banco de dados..."
if [ -n "$DATABASE_URL" ]; then
  echo "Conexão com o banco de dados estabelecida!"
else
  echo "AVISO: DATABASE_URL não está configurado!"
fi

# Listar conteúdo do diretório para debug
echo "Conteúdo do diretório:"
ls -la

# Iniciar o servidor
echo "Iniciando o servidor..."
exec node server/server.js
