#!/bin/bash

echo "==================================================="
echo " CONFIGURACAO DO SISTEMA DE AGENDAMENTO COM SQLITE"
echo "==================================================="
echo 

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Por favor, instale o Node.js primeiro."
    echo "Você pode baixar em: https://nodejs.org/"
    exit 1
fi

echo "Node.js encontrado!"
echo

# Criar diretório para dados do SQLite se não existir
echo "Criando diretorio para o banco de dados SQLite..."
mkdir -p data

# Criar arquivo .env para SQLite
echo "Criando arquivo .env para SQLite..."
cat > .env << EOF
DATABASE_TYPE=sqlite
SESSION_SECRET=local_development_secret_key_1234567890
EOF

echo
echo "Arquivo .env criado com sucesso!"
echo

# Instalar dependências
echo "Instalando dependencias..."
npm install
if [ $? -ne 0 ]; then
    echo "Erro ao instalar dependencias."
    exit 1
fi

echo
echo "Dependencias instaladas com sucesso!"
echo

# Criar arquivo start-sqlite.sh para iniciar o sistema facilmente
echo "Criando script de inicializacao..."
cat > start-sqlite.sh << EOF
#!/bin/bash
echo "Iniciando sistema de agendamento com SQLite..."
export DATABASE_TYPE=sqlite
npm run dev
EOF

chmod +x start-sqlite.sh

# Criar arquivo stop-sqlite.sh para parar o sistema facilmente
echo "Criando script para parar o sistema..."
cat > stop-sqlite.sh << EOF
#!/bin/bash
echo "==================================================="
echo " PARANDO SISTEMA DE AGENDAMENTO LOCAL"
echo "==================================================="
echo
echo "Procurando processo do servidor..."
ps aux | grep -E 'node.*server\/index.ts|npm.*run dev' | grep -v grep
echo
echo "Encontre o PID (segundo número da esquerda) e execute:"
echo "kill -9 [NUMERO_PID]"
echo
EOF

chmod +x stop-sqlite.sh

echo
echo "==================================================="
echo " CONFIGURACAO COM SQLITE CONCLUIDA COM SUCESSO!"
echo "==================================================="
echo
echo "Para iniciar o sistema, execute o arquivo: ./start-sqlite.sh"
echo "Para parar o sistema, execute o arquivo: ./stop-sqlite.sh"
echo
echo "Dados de acesso padrao:"
echo " - Admin: usuario: admin, senha: password123"
echo " - Prestador: usuario: link, senha: password123"
echo