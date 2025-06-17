#!/bin/bash

# Script para configurar Nginx automaticamente

echo "🌐 Configurando Nginx para o sistema de agendamento..."

# Backup da configuração atual
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup da configuração atual criado"

# Criar nova configuração
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name meuagendamentopro.com.br www.meuagendamentopro.com.br;

    # Logs
    access_log /var/log/nginx/agendamento_access.log;
    error_log /var/log/nginx/agendamento_error.log;

    # Proxy para a aplicação Node.js
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

    # Configuração para pgAdmin (manter existente)
    location /pgadmin4 {
        proxy_pass http://localhost:8080/pgadmin4;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts para pgAdmin
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

echo "✅ Nova configuração do Nginx criada"

# Testar configuração
echo "🧪 Testando configuração do Nginx..."
if nginx -t; then
    echo "✅ Configuração do Nginx está válida"
    
    # Reiniciar Nginx
    echo "🔄 Reiniciando Nginx..."
    systemctl restart nginx
    
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx reiniciado com sucesso"
        echo "🌐 Configuração concluída!"
        echo ""
        echo "📝 Informações:"
        echo "• Acesso principal: http://meuagendamentopro.com.br"
        echo "• pgAdmin: http://meuagendamentopro.com.br/pgadmin4"
        echo "• Logs de acesso: /var/log/nginx/agendamento_access.log"
        echo "• Logs de erro: /var/log/nginx/agendamento_error.log"
    else
        echo "❌ Erro ao reiniciar Nginx"
        systemctl status nginx
        exit 1
    fi
else
    echo "❌ Erro na configuração do Nginx"
    echo "Restaurando backup..."
    cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default
    exit 1
fi 