#!/bin/bash

echo "==================================================="
echo " INICIANDO SISTEMA DE AGENDAMENTO LOCAL"
echo "==================================================="
echo 

# Verificar se o PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "AVISO: PostgreSQL não encontrado no sistema."
    echo "O sistema pode não funcionar corretamente se o PostgreSQL não estiver disponível."
    echo "Tente executar setup-local.sh primeiro."
    echo 
    read -p "Pressione ENTER para continuar mesmo assim, ou CTRL+C para cancelar..."
else
    echo "PostgreSQL encontrado!"
    echo
    # Não é necessário adicionar ao PATH, pois já está disponível no sistema
fi

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "AVISO: Arquivo .env não encontrado."
    echo "O sistema pode não funcionar corretamente sem as configurações do banco de dados."
    echo "Tente executar setup-local.sh primeiro."
    echo
    read -p "Pressione ENTER para continuar mesmo assim, ou CTRL+C para cancelar..."
    
    # Criar um arquivo .env básico mesmo assim
    echo "Criando arquivo .env básico..."
    cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agendamento_local
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=agendamento_local
PGPORT=5432
PGHOST=localhost
SESSION_SECRET=local_development_secret_key_1234567890
EOF
    echo "Arquivo .env criado."
fi

# Iniciar o servidor
echo
echo "Iniciando servidor..."
echo
echo "Para encerrar, pressione Ctrl+C."
echo
echo "Ou use o script stop-local.sh para parar o servidor."
echo

# Criar um arquivo que indica que o servidor está rodando
echo $(date) > .server-running

# Capturar o encerramento para limpar
trap "rm -f .server-running; echo -e '\nServidor encerrado.'; exit 0" SIGINT SIGTERM

# Iniciar o servidor
npm run dev

# Remover o arquivo de servidor rodando ao encerrar (caso não tenha sido capturado pelo trap)
rm -f .server-running

echo
echo "Servidor encerrado."
echo