#!/bin/bash

# Exibir informações sobre o ambiente
echo "Variáveis de ambiente:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL configurado: $([ -n "$DATABASE_URL" ] && echo 'sim' || echo 'não')"

# Exibir diretório atual
echo "Diretório atual: $(pwd)"
echo "Conteúdo do diretório:"
ls -la

# Criar diretório dist se não existir
mkdir -p dist

# Criar um arquivo index.html básico no diretório dist
cat > dist/index.html << 'EOL'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sistema de Agendamento</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #4a6cf7; }
    .card { background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    a { color: #4a6cf7; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Sistema de Agendamento</h1>
  <div class="card">
    <h2>API Funcionando</h2>
    <p>A API está funcionando corretamente. Acesse <a href="/api/health">/api/health</a> para verificar o status.</p>
    <p>Para acessar o sistema completo, use o frontend hospedado em: <a href="https://meuagendamentopro.vercel.app">https://meuagendamentopro.vercel.app</a></p>
  </div>
</body>
</html>
EOL

# Iniciar o servidor
node server/server.js
