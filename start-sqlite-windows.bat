@echo off
echo ===================================================
echo  INICIANDO SISTEMA DE AGENDAMENTO COM SQLITE
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

:: Verificar se o diretório data existe, senão criar
if not exist data mkdir data

:: Substituir o arquivo db.ts pelo db-simple.ts se ele existir
if exist server\db-simple.ts (
    echo Ativando SQLite como banco de dados...
    copy /Y server\db-simple.ts server\db.ts >nul
    echo SQLite ativado com sucesso!
) else (
    echo ERRO: Arquivo server\db-simple.ts nao encontrado.
    echo Execute setup-sqlite.bat primeiro.
    pause
    exit /b 1
)

echo.
echo Iniciando servidor...
echo.
echo Para encerrar, pressione Ctrl+C e depois 'S' quando solicitado.
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