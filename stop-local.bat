@echo off
echo ===================================================
echo  PARANDO SISTEMA DE AGENDAMENTO LOCAL
echo ===================================================
echo.

:: Verificar se o servidor está em execução
if not exist .server-running (
    echo O servidor não parece estar em execução.
    echo Se achar que isso é um erro, verifique os processos do sistema.
    goto END
)

:: Encontrar o processo node.exe que está executando o servidor
echo Procurando processo do servidor...

:: Método 1: Encontrar o PID do processo node.exe
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| find "PID:"') do (
    set SERVER_PID=%%a
    goto FOUND_SERVER
)

:: Se não encontrou por node.exe, tentar por npm.cmd
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq npm.cmd" /fo list ^| find "PID:"') do (
    set SERVER_PID=%%a
    goto FOUND_SERVER
)

:: Se ainda não encontrou, procurar nos processos relacionados ao node
for /f "tokens=1,2" %%a in ('wmic process where "caption like '%%node%%'" get processid ^| findstr /r "[0-9]"') do (
    set SERVER_PID=%%a
    goto FOUND_SERVER
)

echo Não foi possível encontrar o processo do servidor automaticamente.
echo.
echo Você pode tentar encerrá-lo manualmente pelo Gerenciador de Tarefas.
echo Procure por processos "node.exe" ou "npm.cmd".
echo.
echo Pressione qualquer tecla para encerrar...
pause >nul
goto END

:FOUND_SERVER
echo Servidor encontrado com PID: %SERVER_PID%
echo Encerrando o servidor...

:: Encerrar o processo
taskkill /PID %SERVER_PID% /F

:: Verificar se o encerramento foi bem-sucedido
if %ERRORLEVEL% EQU 0 (
    echo Servidor encerrado com sucesso!
    del /q .server-running 2>nul
) else (
    echo Falha ao encerrar o servidor.
    echo Tente encerrá-lo manualmente pelo Gerenciador de Tarefas.
)

:END
echo.
echo Pressione qualquer tecla para sair...
pause >nul