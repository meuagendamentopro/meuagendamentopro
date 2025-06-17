#!/bin/bash

echo "🔧 REINSTALAÇÃO COMPLETA DO POSTGRESQL"
echo "======================================"

# 1. Parar todos os serviços PostgreSQL
echo "🛑 Parando serviços PostgreSQL..."
systemctl stop postgresql
systemctl stop postgresql@14-main
pkill -f postgres

# 2. Remover PostgreSQL completamente
echo "🗑️ Removendo PostgreSQL completamente..."
apt remove --purge postgresql postgresql-* -y
apt autoremove -y
apt autoclean

# 3. Limpar todos os dados e configurações
echo "🧹 Limpando dados antigos..."
rm -rf /var/lib/postgresql/
rm -rf /etc/postgresql/
rm -rf /var/log/postgresql/
rm -rf /var/run/postgresql/

# 4. Limpar usuário postgres se existir
echo "👤 Verificando usuário postgres..."
if id "postgres" &>/dev/null; then
    echo "Usuário postgres existe, mantendo..."
else
    echo "Criando usuário postgres..."
    useradd -r -s /bin/bash -d /var/lib/postgresql postgres
fi

# 5. Atualizar repositórios
echo "📦 Atualizando repositórios..."
apt update

# 6. Reinstalar PostgreSQL
echo "⬇️ Reinstalando PostgreSQL..."
apt install postgresql postgresql-contrib -y

# 7. Verificar se foi instalado
echo "✅ Verificando instalação..."
dpkg -l | grep postgresql

# 8. Verificar se o cluster foi criado
echo "🔍 Verificando clusters..."
sudo -u postgres pg_lsclusters

# 9. Se não houver cluster, criar um
echo "🏗️ Criando cluster se necessário..."
if ! sudo -u postgres pg_lsclusters | grep -q "14.*main"; then
    echo "Criando cluster principal..."
    sudo -u postgres pg_createcluster 14 main --start
fi

# 10. Iniciar PostgreSQL
echo "🚀 Iniciando PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# 11. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 12. Verificar status
echo "📊 Verificando status..."
systemctl status postgresql --no-pager

# 13. Verificar processos
echo "🔍 Verificando processos..."
ps aux | grep postgres | grep -v grep

# 14. Verificar socket
echo "🔌 Verificando socket..."
ls -la /var/run/postgresql/

# 15. Testar conexão
echo "🧪 Testando conexão..."
cd /tmp  # Mudar para diretório acessível
if sudo -u postgres psql -c "SELECT version();"; then
    echo "✅ PostgreSQL funcionando!"
    
    # 16. Configurar usuário e banco
    echo "⚙️ Configurando usuário e banco..."
    sudo -u postgres psql << EOF
CREATE USER agendamento WITH PASSWORD 'agendamento123';
CREATE DATABASE agendamento_pro OWNER agendamento;
GRANT ALL PRIVILEGES ON DATABASE agendamento_pro TO agendamento;
ALTER USER agendamento CREATEDB;
\q
EOF
    
    echo "✅ Usuário e banco configurados!"
    
    # 17. Testar conexão com novo usuário
    echo "🧪 Testando conexão com usuário agendamento..."
    if PGPASSWORD=agendamento123 psql -h localhost -U agendamento -d agendamento_pro -c "SELECT NOW();"; then
        echo "✅ Conexão com usuário agendamento funcionando!"
    else
        echo "⚠️ Problema na conexão com usuário agendamento"
    fi
    
else
    echo "❌ PostgreSQL ainda não está funcionando"
    echo "📝 Logs do PostgreSQL:"
    journalctl -u postgresql --no-pager -n 20
fi

echo ""
echo "🎉 REINSTALAÇÃO CONCLUÍDA!"
echo ""
echo "📋 INFORMAÇÕES:"
echo "• Usuário: agendamento"
echo "• Senha: agendamento123"
echo "• Database: agendamento_pro"
echo "• Host: localhost"
echo "• Porta: 5432" 