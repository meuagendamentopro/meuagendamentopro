@echo off
echo ===================================================
echo  INICIANDO SISTEMA DE AGENDAMENTO LOCAL
echo ===================================================
echo.

:: Verificar se o PostgreSQL está instalado
set PGBIN=
set PGPATH=

:: Verificar se está no PATH
where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo PostgreSQL encontrado no PATH!
    set PGBIN=psql
    goto PGFOUND
)

:: Procurar em locais comuns de instalação do PostgreSQL
echo Procurando PostgreSQL em locais comuns...

:: Procurar versões de 9 a 17 (cobrindo versões comuns)
for %%v in (17 16 15 14 13 12 11 10 9) do (
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
echo AVISO: PostgreSQL nao encontrado no sistema.
echo O sistema pode nao funcionar corretamente se o PostgreSQL nao estiver disponivel.
echo Tente executar setup-local.bat primeiro.
echo.
echo Pressione qualquer tecla para continuar mesmo assim, ou CTRL+C para cancelar...
pause >nul
goto PGNOTFOUND

:PGFOUND
echo PostgreSQL encontrado!
echo.

:: Adicionar o PostgreSQL ao PATH temporariamente
if not "%PGPATH%"=="" (
    echo Adicionando %PGPATH% ao PATH temporariamente...
    set "PATH=%PGPATH%;%PATH%"
)

:PGNOTFOUND

:: Verificar se o arquivo .env existe
if not exist .env (
    echo AVISO: Arquivo .env nao encontrado.
    echo O sistema pode nao funcionar corretamente sem as configurações do banco de dados.
    echo Tente executar setup-local.bat primeiro.
    echo.
    echo Pressione qualquer tecla para continuar mesmo assim, ou CTRL+C para cancelar...
    pause >nul
    
    :: Criar um arquivo .env básico mesmo assim
    echo Criando arquivo .env básico...
    (
        echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agendamento_local
        echo PGUSER=postgres
        echo PGPASSWORD=postgres
        echo PGDATABASE=agendamento_local
        echo PGPORT=5432
        echo PGHOST=localhost
        echo SESSION_SECRET=local_development_secret_key_1234567890
    ) > .env
    echo Arquivo .env criado.
)

:: Iniciar o servidor
echo.
echo Iniciando servidor...
echo.
echo Para encerrar, pressione Ctrl+C e depois 'S' quando solicitado.
echo.
echo Ou use o script stop-local.bat para parar o servidor.
echo.

:: Criar um arquivo que indica que o servidor está rodando
echo %time% > .server-running

:: Iniciar o servidor
npm run dev

:: Remover o arquivo de servidor rodando ao encerrar
del /q .server-running 2>nul

echo.
echo Servidor encerrado.
echo.