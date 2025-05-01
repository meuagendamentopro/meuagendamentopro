@echo off
echo ===================================================
echo  CONFIGURACAO SQLITE SIMPLES
echo ===================================================
echo.

:: Verificar se o Node.js está instalado
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js nao encontrado. Por favor, instale o Node.js primeiro.
    echo Voce pode baixar em: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

:: Criar arquivo de configuração SQLite
echo Criando arquivo de configuração SQLite...

:: Criar diretório para o banco de dados
echo Criando diretorio para o banco de dados...
if not exist data mkdir data

:: Criar backup do arquivo original se for a primeira vez
if not exist server\db.ts.original (
    echo Fazendo backup do arquivo db.ts original...
    copy server\db.ts server\db.ts.original
) else (
    echo Backup do arquivo db.ts original já existe.
)

:: Criar novo arquivo db.ts com configuração SQLite
echo Criando arquivo db.ts para SQLite...
(
    echo import * as schema from '@shared/schema';
    echo import Database from 'better-sqlite3';
    echo import { drizzle } from 'drizzle-orm/better-sqlite3';
    echo import * as path from 'path';
    echo import * as fs from 'fs';
    echo.
    echo // Garante que o diretório de dados existe
    echo const DATA_DIR = path.join^(process.cwd^(^), 'data'^);
    echo if ^(!fs.existsSync^(DATA_DIR^)^) {
    echo   fs.mkdirSync^(DATA_DIR, { recursive: true }^);
    echo }
    echo.
    echo const DB_PATH = path.join^(DATA_DIR, 'agendamento_local.sqlite'^);
    echo console.log^(`Usando SQLite: ${DB_PATH}`^);
    echo.
    echo // Conectar ao banco de dados SQLite
    echo export const sqlite = new Database^(DB_PATH^);
    echo export const db = drizzle^(sqlite, { schema }^);
    echo export const pool = { end: ^(^) =^> sqlite.close^(^) }; // Para compatibilidade
    echo.
    echo // Função para fechar o banco de dados quando o servidor for encerrado
    echo export async function closeDb^(^) {
    echo   sqlite.close^(^);
    echo }
) > server\db.ts

echo Arquivo db.ts configurado para SQLite!
echo.

echo Instalando dependencias SQLite...
npm install better-sqlite3

echo.
echo Tudo pronto! Execute o sistema com 'npm run dev'
echo.
echo Pressione qualquer tecla para sair...
pause > nul