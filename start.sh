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

# Verificar se o build foi gerado corretamente
echo "Verificando arquivos do frontend:"
ls -la dist

# Verificar se o index.html existe
if [ -f "dist/index.html" ]; then
  echo "Frontend encontrado em dist/index.html"
else
  echo "AVISO: index.html não encontrado em dist/"
fi

# Iniciar o servidor
echo "Iniciando o servidor..."
exec node server/server.js
