@echo off
echo ===================================================
echo  CONFIGURACAO DO SISTEMA DE AGENDAMENTO LOCAL
echo ===================================================
echo.

:: Verificar se o PostgreSQL está instalado
set PGBIN=

:: Verificar se está no PATH
where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo PostgreSQL encontrado no PATH!
    set PGBIN=psql
    goto PGFOUND
)

:: Procurar em locais comuns de instalação do PostgreSQL
echo Procurando PostgreSQL em locais comuns...

:: Procurar versões de 9 a 16 (cobrindo versões comuns)
for %%v in (16 15 14 13 12 11 10 9) do (
    if exist "C:\Program Files\PostgreSQL\%%v\bin\psql.exe" (
        echo PostgreSQL %%v encontrado em C:\Program Files\PostgreSQL\%%v\bin
        set "PGBIN=C:\Program Files\PostgreSQL\%%v\bin\psql.exe"
        set "PGPATH=C:\Program Files\PostgreSQL\%%v\bin"
        goto PGFOUND
    )
)

:: Verificar outros locais possíveis
if exist "C:\Program Files\PostgreSQL\bin\psql.exe" (
    echo PostgreSQL encontrado em C:\Program Files\PostgreSQL\bin
    set "PGBIN=C:\Program Files\PostgreSQL\bin\psql.exe"
    set "PGPATH=C:\Program Files\PostgreSQL\bin"
    goto PGFOUND
)

:: PostgreSQL não encontrado
echo PostgreSQL nao encontrado. Por favor, instale o PostgreSQL primeiro.
echo Voce pode baixar em: https://www.postgresql.org/download/windows/
echo.
echo Apos a instalacao, adicione o diretorio bin do PostgreSQL ao PATH e execute este script novamente.
echo Exemplo: C:\Program Files\PostgreSQL\14\bin
pause
exit /b 1

:PGFOUND

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
if "%PGBIN%"=="psql" (
    psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'agendamento_local'" | findstr /r /c:"1 row" >nul
    if %ERRORLEVEL% NEQ 0 (
        echo Criando banco de dados %DB_NAME%...
        psql -U postgres -c "CREATE DATABASE %DB_NAME%"
    ) else (
        echo Banco de dados %DB_NAME% ja existe.
    )
) else (
    "%PGBIN%" -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'agendamento_local'" | findstr /r /c:"1 row" >nul
    if %ERRORLEVEL% NEQ 0 (
        echo Criando banco de dados %DB_NAME%...
        "%PGBIN%" -U postgres -c "CREATE DATABASE %DB_NAME%"
    ) else (
        echo Banco de dados %DB_NAME% ja existe.
    )
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

:: Adicionando o caminho do PostgreSQL ao PATH temporariamente, se necessário
if not "%PGPATH%"=="" (
    echo Adicionando %PGPATH% ao PATH temporariamente...
    set "PATH=%PGPATH%;%PATH%"
)

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

if not "%PGPATH%"=="" (
    (
        echo @echo off
        echo echo Iniciando sistema de agendamento local...
        echo echo Adicionando %PGPATH% ao PATH temporariamente...
        echo set "PATH=%PGPATH%;%%PATH%%"
        echo npm run dev
    ) > start-local.bat
) else (
    (
        echo @echo off
        echo echo Iniciando sistema de agendamento local...
        echo npm run dev
    ) > start-local.bat
)

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
