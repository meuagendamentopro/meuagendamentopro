#!/bin/bash

echo "==================================================="
echo " PARANDO SISTEMA DE AGENDAMENTO LOCAL"
echo "==================================================="
echo 

# Verificar se o servidor está em execução
if [ ! -f .server-running ]; then
    echo "O servidor não parece estar em execução."
    echo "Se achar que isso é um erro, verifique os processos do sistema."
    echo
    echo "Pressione ENTER para sair..."
    read
    exit 0
fi

# Encontrar o processo node que está executando o servidor
echo "Procurando processo do servidor..."

# Procurar processos node executando o servidor
NODE_PIDS=$(ps aux | grep -E 'node.*server\/index.ts|npm.*run dev' | grep -v grep | awk '{print $2}')

if [ -z "$NODE_PIDS" ]; then
    echo "Não foi possível encontrar o processo do servidor automaticamente."
    echo
    echo "Você pode tentar encerrá-lo manualmente com os comandos:"
    echo "  ps aux | grep node"
    echo "  kill -9 <PID>"
    echo
    echo "Pressione ENTER para encerrar..."
    read
    exit 1
fi

# Encerrar todos os processos encontrados
echo "Servidor(es) encontrado(s) com PID(s): $NODE_PIDS"
echo "Encerrando o(s) servidor(es)..."

for pid in $NODE_PIDS; do
    kill -9 $pid 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "Processo $pid encerrado com sucesso!"
    else
        echo "Falha ao encerrar o processo $pid."
    fi
done

# Remover o arquivo de servidor rodando
rm -f .server-running

echo
echo "Servidor(es) encerrado(s)."
echo
echo "Pressione ENTER para sair..."
read