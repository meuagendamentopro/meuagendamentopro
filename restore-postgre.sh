#!/bin/bash

echo "==================================================="
echo " RESTAURANDO CONFIGURACAO ORIGINAL (POSTGRESQL)"
echo "==================================================="
echo

# Verificar se existe o backup
if [ ! -f server/db.ts.original ]; then
    echo "ERRO: Arquivo de backup server/db.ts.original nao encontrado."
    echo "Não é possível restaurar a configuração original."
    exit 1
fi

# Restaurar o arquivo original
echo "Restaurando configuracao original (PostgreSQL)..."
cp -f server/db.ts.original server/db.ts

echo
echo "Configuracao PostgreSQL restaurada com sucesso!"
echo
echo "Pressione ENTER para sair..."
read