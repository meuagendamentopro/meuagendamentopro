# 🚀 SETUP COMPLETO VPS - SISTEMA DE AGENDAMENTO

## 📋 INFORMAÇÕES INICIAIS
- **Domínio:** meuagendamentopro.com.br
- **IP do VPS:** (será fornecido pela Hostinger)
- **Sistema:** Ubuntu 22.04 LTS
- **Plano:** KVM 2 (2 vCPUs, 8GB RAM, 100GB NVMe)

---

## 🔧 PASSO 1: CONFIGURAÇÃO INICIAL DO VPS

### 1.1 - Conectar ao VPS
```bash
ssh root@SEU_IP_AQUI
```

### 1.2 - Atualizar Sistema
```bash
apt update && apt upgrade -y
```

### 1.3 - Configurar Timezone
```bash
timedatectl set-timezone America/Sao_Paulo
```

---

## 🗄️ PASSO 2: INSTALAR E CONFIGURAR POSTGRESQL

### 2.1 - Instalar PostgreSQL
```bash
apt install postgresql postgresql-contrib -y
```

### 2.2 - Iniciar e Habilitar PostgreSQL
```bash
systemctl start postgresql
systemctl enable postgresql
```

### 2.3 - Configurar Usuário e Banco
```bash
# Entrar como usuário postgres
sudo -u postgres psql

# Dentro do PostgreSQL, executar:
CREATE USER agendamento WITH PASSWORD 'agendamento123';
CREATE DATABASE agendamento_pro OWNER agendamento;
GRANT ALL PRIVILEGES ON DATABASE agendamento_pro TO agendamento;
ALTER USER agendamento CREATEDB;
\q
```

### 2.4 - Testar Conexão
```bash
psql -h localhost -U agendamento -d agendamento_pro -c "SELECT NOW();"
```

---

## 🌐 PASSO 3: INSTALAR NGINX

### 3.1 - Instalar Nginx
```bash
apt install nginx -y
```

### 3.2 - Iniciar e Habilitar Nginx
```bash
systemctl start nginx
systemctl enable nginx
```

### 3.3 - Configurar Firewall (se necessário)
```bash
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable
```

---

## 📦 PASSO 4: INSTALAR NODE.JS E NPM

### 4.1 - Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### 4.2 - Verificar Instalação
```bash
node --version
npm --version
```

### 4.3 - Instalar PM2 Globalmente
```bash
npm install -g pm2
```

---

## 🖥️ PASSO 5: INSTALAR PGADMIN (INTERFACE GRÁFICA)

### 5.1 - Instalar Apache2
```bash
apt install apache2 -y
```

### 5.2 - Configurar Apache na Porta 8080
```bash
# Editar configuração do Apache
nano /etc/apache2/ports.conf
```

**Alterar de:**
```
Listen 80
```

**Para:**
```
Listen 8080
```

### 5.3 - Configurar Site Apache
```bash
nano /etc/apache2/sites-available/000-default.conf
```

**Alterar primeira linha de:**
```
<VirtualHost *:80>
```

**Para:**
```
<VirtualHost *:8080>
```

### 5.4 - Instalar pgAdmin
```bash
# Instalar dependências
apt install python3-pip python3-dev libpq-dev -y

# Instalar pgAdmin
pip3 install pgadmin4

# Configurar pgAdmin
/usr/local/bin/pgadmin4
```

**Durante a configuração, forneça:**
- Email: admin@meuagendamentopro.com.br
- Senha: admin123 (ou sua preferência)

### 5.5 - Configurar pgAdmin como serviço web
```bash
# Criar arquivo de configuração
mkdir -p /var/lib/pgadmin
mkdir -p /var/log/pgadmin

# Configurar pgAdmin
/usr/local/lib/python3.10/dist-packages/pgadmin4/setup.py
```

### 5.6 - Reiniciar Apache
```bash
systemctl restart apache2
systemctl enable apache2
```

---

## 📁 PASSO 6: PREPARAR DIRETÓRIO DO PROJETO

### 6.1 - Criar Diretório
```bash
mkdir -p /var/www/agendamento-pro
cd /var/www/agendamento-pro
```

### 6.2 - Definir Permissões
```bash
chown -R root:root /var/www/agendamento-pro
chmod -R 755 /var/www/agendamento-pro
```

---

## 📤 PASSO 7: UPLOAD DO CÓDIGO

### 7.1 - Via WinSCP (Recomendado)
1. Baixe WinSCP: https://winscp.net/eng/download.php
2. Conecte: IP do VPS, usuário `root`, sua senha
3. Navegue até `/var/www/agendamento-pro/`
4. Arraste os arquivos do projeto

### 7.2 - Arquivos Necessários
```
📁 /var/www/agendamento-pro/
├── 📁 client/
├── 📁 server/
├── 📁 shared/
├── 📁 public/
├── 📄 package.json
├── 📄 package-lock.json
├── 📄 vite.config.ts
├── 📄 tailwind.config.ts
├── 📄 tsconfig.json
├── 📄 postcss.config.js
├── 📄 drizzle.config.ts
├── 📄 components.json
└── 📄 .env
```

### 7.3 - Criar Arquivo .env
```bash
nano /var/www/agendamento-pro/.env
```

**Conteúdo:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://agendamento:agendamento123@localhost:5432/agendamento_pro
PORT=3000
APP_URL=http://meuagendamentopro.com.br
SESSION_SECRET=meuagendamentopro_chave_secreta_super_segura_2024_vps_producao
```

---

## 🚀 PASSO 8: INSTALAR E EXECUTAR APLICAÇÃO

### 8.1 - Instalar Dependências
```bash
cd /var/www/agendamento-pro
npm install
```

### 8.2 - Fazer Build do Frontend
```bash
npx vite build
```

### 8.3 - Instalar tsx para executar TypeScript
```bash
npm install tsx
```

### 8.4 - Iniciar Aplicação com PM2
```bash
pm2 start "npx tsx server/index.ts" --name agendamento-pro
pm2 save
pm2 startup
```

---

## 🌐 PASSO 9: CONFIGURAR NGINX COMO PROXY

### 9.1 - Configurar Nginx
```bash
nano /etc/nginx/sites-available/default
```

**Substituir todo conteúdo por:**
```nginx
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
```

### 9.2 - Testar e Reiniciar Nginx
```bash
nginx -t
systemctl restart nginx
```

---

## 🗄️ PASSO 10: IMPORTAR BANCO DE DADOS

### 10.1 - Se tiver backup SQL
```bash
psql -h localhost -U agendamento -d agendamento_pro < /caminho/para/backup.sql
```

### 10.2 - Ou criar tabelas via aplicação
A aplicação criará as tabelas automaticamente na primeira execução.

---

## 🔧 PASSO 11: CONFIGURAR DNS

### 11.1 - No Registro.br
1. Acesse https://registro.br
2. Vá em "Meus Domínios"
3. Clique em "meuagendamentopro.com.br"
4. Configure DNS:
   - **Tipo A:** @ → IP_DO_VPS
   - **Tipo A:** www → IP_DO_VPS

---

## ✅ PASSO 12: VERIFICAÇÕES FINAIS

### 12.1 - Testar Aplicação
```bash
curl http://localhost:3000
pm2 status
pm2 logs agendamento-pro
```

### 12.2 - Testar pgAdmin
```bash
curl http://localhost:8080
```

### 12.3 - Testar Nginx
```bash
systemctl status nginx
curl http://localhost
```

### 12.4 - Testar PostgreSQL
```bash
systemctl status postgresql
psql -h localhost -U agendamento -d agendamento_pro -c "SELECT NOW();"
```

---

## 🌐 ACESSOS FINAIS

- **Site Principal:** http://meuagendamentopro.com.br
- **pgAdmin:** http://meuagendamentopro.com.br/pgadmin4
- **SSH:** ssh root@IP_DO_VPS

### Credenciais pgAdmin:
- **Email:** admin@meuagendamentopro.com.br
- **Senha:** admin123

### Credenciais Banco:
- **Host:** localhost
- **Porta:** 5432
- **Usuário:** agendamento
- **Senha:** agendamento123
- **Database:** agendamento_pro

---

## 🆘 COMANDOS ÚTEIS

### Gerenciar Aplicação:
```bash
pm2 status
pm2 restart agendamento-pro
pm2 logs agendamento-pro
pm2 stop agendamento-pro
```

### Gerenciar Serviços:
```bash
systemctl status nginx
systemctl restart nginx
systemctl status postgresql
systemctl restart postgresql
systemctl status apache2
systemctl restart apache2
```

### Logs:
```bash
tail -f /var/log/nginx/agendamento_access.log
tail -f /var/log/nginx/agendamento_error.log
```

---

## 🔒 SEGURANÇA (OPCIONAL)

### Instalar SSL com Let's Encrypt:
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d meuagendamentopro.com.br -d www.meuagendamentopro.com.br
```

---

## 📞 SUPORTE

Se encontrar problemas:
1. Verifique logs: `pm2 logs agendamento-pro`
2. Verifique status: `pm2 status`
3. Teste conexões: `curl http://localhost:3000`
4. Envie logs específicos para análise 