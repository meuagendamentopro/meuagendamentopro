@echo off
echo ===================================================
echo  RESTAURANDO CONFIGURACAO ORIGINAL (POSTGRESQL)
echo ===================================================
echo.

:: Verificar se existe o backup
if not exist server\db.ts.original (
    echo ERRO: Arquivo de backup server\db.ts.original nao encontrado.
    echo Não é possível restaurar a configuração original.
    pause
    exit /b 1
)

:: Restaurar o arquivo original
echo Restaurando configuracao original (PostgreSQL)...
copy /Y server\db.ts.original server\db.ts

echo.
echo Configuracao PostgreSQL restaurada com sucesso!
echo.
echo Pressione qualquer tecla para sair...
pause > nul