#!/bin/bash

echo "🔧 CORRIGINDO POSTGRESQL..."

# 1. Verificar status do PostgreSQL
echo "📊 Status atual do PostgreSQL:"
systemctl status postgresql

echo ""
echo "🔍 Verificando se o processo está rodando:"
ps aux | grep postgres

echo ""
echo "🗂️ Verificando arquivos de configuração:"
ls -la /etc/postgresql/*/main/

echo ""
echo "📁 Verificando diretório de dados:"
ls -la /var/lib/postgresql/

echo ""
echo "🔄 Tentando reiniciar PostgreSQL..."
systemctl stop postgresql
systemctl start postgresql

echo ""
echo "📊 Status após reinicialização:"
systemctl status postgresql

echo ""
echo "🧪 Testando conexão:"
sudo -u postgres psql -c "SELECT version();"

echo ""
echo "🔧 Se ainda não funcionar, vamos reconfigurar..."
echo "Execute os comandos abaixo se necessário:"
echo ""
echo "# Reconfigurar PostgreSQL:"
echo "sudo pg_dropcluster --stop 14 main"
echo "sudo pg_createcluster --start 14 main"
echo ""
echo "# Ou reinstalar completamente:"
echo "sudo apt remove --purge postgresql postgresql-contrib -y"
echo "sudo apt autoremove -y"
echo "sudo apt install postgresql postgresql-contrib -y" 