@echo off
echo ===================================================
echo  CONFIGURACAO DO SISTEMA DE AGENDAMENTO LOCAL
echo ===================================================
echo.

:: Verificar se o PostgreSQL está instalado
where pg_ctl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL nao encontrado. Por favor, instale o PostgreSQL primeiro.
    echo Voce pode baixar em: https://www.postgresql.org/download/windows/
    echo.
    echo Apos a instalacao, adicione o diretorio bin do PostgreSQL ao PATH e execute este script novamente.
    echo Exemplo: C:\Program Files\PostgreSQL\14\bin
    pause
    exit /b 1
)

echo PostgreSQL encontrado!
echo.

:: Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js nao encontrado. Por favor, instale o Node.js primeiro.
    echo Voce pode baixar em: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

:: Instalar dependências
echo Instalando dependencias...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo Erro ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo Dependencias instaladas com sucesso!
echo.

:: Criar o banco de dados PostgreSQL local
echo Criando banco de dados local...

set DB_NAME=agendamento_local
set DB_USER=postgres
set DB_PASSWORD=postgres
set DB_PORT=5432
set DB_HOST=localhost

:: Verifica se o banco de dados já existe
psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = '%DB_NAME%'" | findstr /r /c:"1 row" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Criando banco de dados %DB_NAME%...
    psql -U postgres -c "CREATE DATABASE %DB_NAME%"
) else (
    echo Banco de dados %DB_NAME% ja existe.
)

:: Criar arquivo .env com as configurações do banco de dados
echo Criando arquivo .env com configuracoes...
(
    echo DATABASE_URL=postgresql://%DB_USER%:%DB_PASSWORD%@%DB_HOST%:%DB_PORT%/%DB_NAME%
    echo PGUSER=%DB_USER%
    echo PGPASSWORD=%DB_PASSWORD%
    echo PGDATABASE=%DB_NAME%
    echo PGPORT=%DB_PORT%
    echo PGHOST=%DB_HOST%
    echo SESSION_SECRET=local_development_secret_key_1234567890
) > .env

echo.
echo Arquivo .env criado com sucesso!
echo.

:: Executar o push do schema para o banco de dados
echo Criando tabelas e estrutura do banco de dados...
npm run db:push
if %ERRORLEVEL% NEQ 0 (
    echo Erro ao criar estrutura do banco de dados.
    pause
    exit /b 1
)

echo.
echo Banco de dados configurado com sucesso!
echo.

:: Criar arquivo start-local.bat para iniciar o sistema facilmente
echo Criando script de inicializacao...
(
    echo @echo off
    echo echo Iniciando sistema de agendamento local...
    echo npm run dev
) > start-local.bat

echo.
echo ===================================================
echo  CONFIGURACAO CONCLUIDA COM SUCESSO!
echo ===================================================
echo.
echo Para iniciar o sistema, execute o arquivo: start-local.bat
echo.
echo Dados de acesso padrao:
echo  - Admin: usuario: admin, senha: password123
echo  - Prestador: usuario: link, senha: password123
echo.
echo Pressione qualquer tecla para sair...
pause > nul
