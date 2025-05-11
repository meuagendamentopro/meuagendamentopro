#!/bin/bash

# Script para configurar um banco de dados PostgreSQL local
# Este script vai:
# 1. Verificar se o PostgreSQL está instalado
# 2. Criar um banco de dados chamado "agendadb"
# 3. Executar o script de migração

# Cores para saída
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configurando banco de dados PostgreSQL local para o sistema de agendamento...${NC}"

# Verificar se o PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}PostgreSQL não encontrado. Por favor, instale o PostgreSQL primeiro.${NC}"
    echo "Em sistemas baseados em Debian/Ubuntu, você pode instalá-lo com:"
    echo "sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

echo -e "${GREEN}PostgreSQL encontrado!${NC}"

# Verificar se o banco de dados já existe
DB_EXISTS=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='agendadb'" 2>/dev/null)

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${YELLOW}Banco de dados 'agendadb' já existe.${NC}"
    
    # Perguntar se deve sobrescrever
    read -p "Deseja limpar e recriar o banco de dados? (s/N): " RECREATE
    if [[ $RECREATE =~ ^[Ss]$ ]]; then
        echo "Recriando banco de dados..."
        psql -U postgres -c "DROP DATABASE agendadb" 2>/dev/null
        psql -U postgres -c "CREATE DATABASE agendadb" 2>/dev/null
        echo -e "${GREEN}Banco de dados recriado com sucesso!${NC}"
    else
        echo "Mantendo banco de dados existente."
    fi
else
    echo "Criando banco de dados 'agendadb'..."
    psql -U postgres -c "CREATE DATABASE agendadb" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Banco de dados criado com sucesso!${NC}"
    else
        echo -e "${RED}Erro ao criar banco de dados. Verifique se você tem permissões adequadas.${NC}"
        echo "Talvez você precise executar como outro usuário PostgreSQL:"
        echo "sudo -u postgres createdb agendadb"
        exit 1
    fi
fi

# Configurar variáveis de ambiente para o script de migração
echo -e "${YELLOW}Configurando variáveis de ambiente temporárias...${NC}"
export LOCAL_DB_HOST=localhost
export LOCAL_DB_PORT=5432
export LOCAL_DB_NAME=agendadb
export LOCAL_DB_USER=postgres

# Solicitar a senha do PostgreSQL
read -sp "Digite a senha do usuário 'postgres' do PostgreSQL: " PG_PASSWORD
echo
export LOCAL_DB_PASSWORD=$PG_PASSWORD

# Executar o script de migração
echo -e "${YELLOW}Executando script de migração...${NC}"
npx tsx scripts/migrate-to-local-db.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Migração concluída com sucesso!${NC}"
    echo
    echo -e "${YELLOW}Para usar o banco local, adicione a seguinte linha ao seu arquivo .env:${NC}"
    echo "DATABASE_URL=postgres://postgres:$PG_PASSWORD@localhost:5432/agendadb"
    echo
    echo -e "${YELLOW}Credenciais de acesso:${NC}"
    echo "- Usuário Admin: admin / password123"
    echo "- Usuário Link: link / password123"
else
    echo -e "${RED}Ocorreu um erro durante a migração.${NC}"
    echo "Verifique o log acima para mais detalhes."
fi