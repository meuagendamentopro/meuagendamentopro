@echo off
echo ===================================================
echo  CONFIGURACAO DO SISTEMA DE AGENDAMENTO COM SQLITE
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

:: Criar diretório para dados do SQLite se não existir
echo Criando diretorio para o banco de dados SQLite...
if not exist data mkdir data

:: Criar arquivo .env para SQLite
echo Criando arquivo .env para SQLite...
(
    echo DATABASE_TYPE=sqlite
    echo SESSION_SECRET=local_development_secret_key_1234567890
) > .env

echo.
echo Arquivo .env criado com sucesso!
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

:: Criar arquivo start-sqlite.bat para iniciar o sistema facilmente
echo Criando script de inicializacao...
(
    echo @echo off
    echo echo Iniciando sistema de agendamento com SQLite...
    echo set "DATABASE_TYPE=sqlite"
    echo npm run dev
) > start-sqlite.bat

:: Criar arquivo stop-sqlite.bat para parar o sistema facilmente
echo Criando script para parar o sistema...
(
    echo @echo off
    echo ===================================================
    echo  PARANDO SISTEMA DE AGENDAMENTO LOCAL
    echo ===================================================
    echo.
    echo Procurando processo do servidor...
    echo.
    echo Para processos node.exe:
    echo.
    echo tasklist /fi "imagename eq node.exe"
    echo.
    echo Encontre o PID (número da segunda coluna) e execute:
    echo taskkill /PID [NUMERO_PID] /F
    echo.
    echo Para fechar este prompt, pressione qualquer tecla...
    echo.
    tasklist /fi "imagename eq node.exe"
    echo.
    pause
) > stop-sqlite.bat

echo.
echo ===================================================
echo  CONFIGURACAO COM SQLITE CONCLUIDA COM SUCESSO!
echo ===================================================
echo.
echo Para iniciar o sistema, execute o arquivo: start-sqlite.bat
echo Para parar o sistema, execute o arquivo: stop-sqlite.bat
echo.
echo Dados de acesso padrao:
echo  - Admin: usuario: admin, senha: password123
echo  - Prestador: usuario: link, senha: password123
echo.
echo Pressione qualquer tecla para sair...
pause > nul