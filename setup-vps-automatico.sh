#!/bin/bash

# Script de Setup Automático VPS - Sistema de Agendamento
# Execute como root: bash setup-vps-automatico.sh

set -e  # Parar em caso de erro

LOG_FILE="/var/log/setup-vps.log"
ERROR_LOG="/var/log/setup-vps-errors.log"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Função para log de erro
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$ERROR_LOG" | tee -a "$LOG_FILE"
}

# Limpar logs anteriores
> "$LOG_FILE"
> "$ERROR_LOG"

log "🚀 INICIANDO SETUP AUTOMÁTICO DO VPS"
log "===================================="

# 1. Atualizar sistema
log "📦 Atualizando sistema..."
apt update && apt upgrade -y >> "$LOG_FILE" 2>> "$ERROR_LOG"
log "✅ Sistema atualizado"

# 2. Configurar timezone
log "🕐 Configurando timezone..."
timedatectl set-timezone America/Sao_Paulo
log "✅ Timezone configurado: $(timedatectl show --property=Timezone --value)"

# 3. Instalar PostgreSQL
log "🗄️ Instalando PostgreSQL..."
apt install postgresql postgresql-contrib -y >> "$LOG_FILE" 2>> "$ERROR_LOG"
systemctl start postgresql
systemctl enable postgresql
log "✅ PostgreSQL instalado e iniciado"

# 4. Configurar banco de dados
log "⚙️ Configurando banco de dados..."
sudo -u postgres psql << EOF >> "$LOG_FILE" 2>> "$ERROR_LOG"
CREATE USER agendamento WITH PASSWORD 'agendamento123';
CREATE DATABASE agendamento_pro OWNER agendamento;
GRANT ALL PRIVILEGES ON DATABASE agendamento_pro TO agendamento;
ALTER USER agendamento CREATEDB;
\q
EOF
log "✅ Banco de dados configurado"

# 5. Instalar Nginx
log "🌐 Instalando Nginx..."
apt install nginx -y >> "$LOG_FILE" 2>> "$ERROR_LOG"
systemctl start nginx
systemctl enable nginx
log "✅ Nginx instalado e iniciado"

# 6. Instalar Node.js
log "📦 Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >> "$LOG_FILE" 2>> "$ERROR_LOG"
apt-get install -y nodejs >> "$LOG_FILE" 2>> "$ERROR_LOG"
log "✅ Node.js instalado: $(node --version)"

# 7. Instalar PM2
log "🔧 Instalando PM2..."
npm install -g pm2 >> "$LOG_FILE" 2>> "$ERROR_LOG"
log "✅ PM2 instalado"

# 8. Instalar Apache2 para pgAdmin
log "🖥️ Instalando Apache2..."
apt install apache2 -y >> "$LOG_FILE" 2>> "$ERROR_LOG"

# Configurar Apache na porta 8080
sed -i 's/Listen 80/Listen 8080/' /etc/apache2/ports.conf
sed -i 's/<VirtualHost \*:80>/<VirtualHost *:8080>/' /etc/apache2/sites-available/000-default.conf

systemctl restart apache2
systemctl enable apache2
log "✅ Apache2 configurado na porta 8080"

# 9. Instalar pgAdmin
log "🖥️ Instalando pgAdmin..."
apt install python3-pip python3-dev libpq-dev -y >> "$LOG_FILE" 2>> "$ERROR_LOG"
pip3 install pgadmin4 >> "$LOG_FILE" 2>> "$ERROR_LOG"

# Criar diretórios para pgAdmin
mkdir -p /var/lib/pgadmin
mkdir -p /var/log/pgadmin
chown -R www-data:www-data /var/lib/pgadmin
chown -R www-data:www-data /var/log/pgadmin

log "✅ pgAdmin instalado"

# 10. Configurar firewall
log "🔒 Configurando firewall..."
ufw allow 'Nginx Full' >> "$LOG_FILE" 2>> "$ERROR_LOG"
ufw allow OpenSSH >> "$LOG_FILE" 2>> "$ERROR_LOG"
ufw --force enable >> "$LOG_FILE" 2>> "$ERROR_LOG"
log "✅ Firewall configurado"

# 11. Criar diretório do projeto
log "📁 Criando diretório do projeto..."
mkdir -p /var/www/agendamento-pro
chown -R root:root /var/www/agendamento-pro
chmod -R 755 /var/www/agendamento-pro
log "✅ Diretório criado: /var/www/agendamento-pro"

# 12. Configurar Nginx
log "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name meuagendamentopro.com.br www.meuagendamentopro.com.br;

    # Logs
    access_log /var/log/nginx/agendamento_access.log;
    error_log /var/log/nginx/agendamento_error.log;

    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # pgAdmin
    location /pgadmin4 {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

nginx -t >> "$LOG_FILE" 2>> "$ERROR_LOG"
systemctl restart nginx
log "✅ Nginx configurado"

# 13. Criar arquivo .env modelo
log "📄 Criando arquivo .env modelo..."
cat > /var/www/agendamento-pro/.env << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://agendamento:agendamento123@localhost:5432/agendamento_pro
PORT=3000
APP_URL=http://meuagendamentopro.com.br
SESSION_SECRET=meuagendamentopro_chave_secreta_super_segura_2024_vps_producao
EOF
log "✅ Arquivo .env criado"

# 14. Verificações finais
log "✅ Verificando instalações..."
log "Node.js: $(node --version)"
log "NPM: $(npm --version)"
log "PostgreSQL: $(systemctl is-active postgresql)"
log "Nginx: $(systemctl is-active nginx)"
log "Apache2: $(systemctl is-active apache2)"

# 15. Testar conexão com banco
log "🧪 Testando conexão com banco..."
if psql -h localhost -U agendamento -d agendamento_pro -c "SELECT NOW();" >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ Conexão com banco funcionando"
else
    log_error "Falha na conexão com banco"
fi

log "=================================================="
log "🎉 SETUP DO VPS CONCLUÍDO COM SUCESSO!"
log "=================================================="

echo ""
echo "🎉 SETUP CONCLUÍDO!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Faça upload do código para: /var/www/agendamento-pro/"
echo "2. Execute: cd /var/www/agendamento-pro && npm install"
echo "3. Execute: npx vite build"
echo "4. Execute: pm2 start \"npx tsx server/index.ts\" --name agendamento-pro"
echo ""
echo "🌐 ACESSOS:"
echo "• Site: http://SEU_IP (depois http://meuagendamentopro.com.br)"
echo "• pgAdmin: http://SEU_IP/pgadmin4"
echo ""
echo "🗄️ BANCO DE DADOS:"
echo "• Host: localhost"
echo "• Porta: 5432"
echo "• Usuário: agendamento"
echo "• Senha: agendamento123"
echo "• Database: agendamento_pro"
echo ""
echo "📝 LOGS:"
echo "• Setup: $LOG_FILE"
echo "• Erros: $ERROR_LOG"
echo ""

if [ -s "$ERROR_LOG" ]; then
    echo "⚠️ ATENÇÃO: Alguns erros foram encontrados!"
    echo "Verifique: $ERROR_LOG"
fi 