#!/bin/bash

echo "==================================================="
echo " CONFIGURACAO SQLITE SIMPLES"
echo "==================================================="
echo 

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Por favor, instale o Node.js primeiro."
    echo "Você pode baixar em: https://nodejs.org/"
    exit 1
fi

echo "Node.js encontrado!"
echo

# Criar arquivo de configuração SQLite
echo "Criando arquivo de configuração SQLite..."

# Criar diretório para o banco de dados
echo "Criando diretorio para o banco de dados..."
mkdir -p data

# Criar backup do arquivo original se for a primeira vez
if [ ! -f server/db.ts.original ]; then
    echo "Fazendo backup do arquivo db.ts original..."
    cp server/db.ts server/db.ts.original
else
    echo "Backup do arquivo db.ts original já existe."
fi

# Criar novo arquivo db.ts com configuração SQLite
echo "Criando arquivo db.ts para SQLite..."
cat > server/db.ts << 'EOF'
import * as schema from '@shared/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Garante que o diretório de dados existe
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'agendamento_local.sqlite');
console.log(`Usando SQLite: ${DB_PATH}`);

// Conectar ao banco de dados SQLite
export const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });
export const pool = { end: () => sqlite.close() }; // Para compatibilidade

// Função para fechar o banco de dados quando o servidor for encerrado
export async function closeDb() {
  sqlite.close();
}
EOF

echo "Arquivo db.ts configurado para SQLite!"
echo

echo "Instalando dependencias SQLite..."
npm install better-sqlite3

echo
echo "Tudo pronto! Execute o sistema com 'npm run dev'"
echo
echo "Pressione ENTER para sair..."
read