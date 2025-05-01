#!/bin/bash

echo "==================================================="
echo " CONFIGURACAO DO SISTEMA DE AGENDAMENTO LOCAL"
echo "==================================================="
echo 

# Verificar se o PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL não encontrado. Por favor, instale o PostgreSQL primeiro."
    echo "Para Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "Para Mac: brew install postgresql"
    echo "Para outras distribuições, consulte: https://www.postgresql.org/download/"
    exit 1
fi

echo "PostgreSQL encontrado!"
echo

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Por favor, instale o Node.js primeiro."
    echo "Você pode baixar em: https://nodejs.org/"
    exit 1
fi

echo "Node.js encontrado!"
echo

# Instalar dependências
echo "Instalando dependências..."
npm install
if [ $? -ne 0 ]; then
    echo "Erro ao instalar dependências."
    exit 1
fi

echo
echo "Dependências instaladas com sucesso!"
echo

# Criar o banco de dados PostgreSQL local
echo "Criando banco de dados local..."

DB_NAME="agendamento_local"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_PORT="5432"
DB_HOST="localhost"

# Verificar se o banco de dados já existe (supondo que o usuário postgres existe)
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "Banco de dados $DB_NAME já existe."
else
    echo "Criando banco de dados $DB_NAME..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    # Alternativamente, se for Mac ou não tiver sudo configurado para postgres:
    # createdb $DB_NAME
fi

# Criar arquivo .env com as configurações do banco de dados
echo "Criando arquivo .env com configurações..."
cat > .env << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
PGUSER=$DB_USER
PGPASSWORD=$DB_PASSWORD
PGDATABASE=$DB_NAME
PGPORT=$DB_PORT
PGHOST=$DB_HOST
SESSION_SECRET=local_development_secret_key_1234567890
EOF

echo
echo "Arquivo .env criado com sucesso!"
echo

# Executar o push do schema para o banco de dados
echo "Criando tabelas e estrutura do banco de dados..."
npm run db:push
if [ $? -ne 0 ]; then
    echo "Erro ao criar estrutura do banco de dados."
    exit 1
fi

echo
echo "Banco de dados configurado com sucesso!"
echo

# Criar arquivo start-local.sh para iniciar o sistema facilmente
echo "Criando script de inicialização..."
cat > start-local.sh << EOF
#!/bin/bash
echo "Iniciando sistema de agendamento local..."
npm run dev
EOF

chmod +x start-local.sh

echo
echo "==================================================="
echo " CONFIGURACAO CONCLUIDA COM SUCESSO!"
echo "==================================================="
echo
echo "Para iniciar o sistema, execute o comando: ./start-local.sh"
echo
echo "Dados de acesso padrão:"
echo " - Admin: usuário: admin, senha: password123"
echo " - Prestador: usuário: link, senha: password123"
echo
