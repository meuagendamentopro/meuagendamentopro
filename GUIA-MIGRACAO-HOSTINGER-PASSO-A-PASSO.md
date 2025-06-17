# 🚀 GUIA PASSO-A-PASSO: MIGRAÇÃO PARA HOSTINGER KVM 2

## 📋 INFORMAÇÕES DO SEU VPS
- **IP:** 31.97.166.232
- **Plano:** KVM 2 (2 vCPUs, 8GB RAM, 100GB NVMe)
- **Sistema:** Ubuntu 22.04 LTS
- **Domínio:** meuagendamentopro.com.br

---

## 🔥 PASSO 1: CONECTAR E PREPARAR O VPS

### 1.1 - Conectar via SSH
```bash
ssh root@31.97.166.232
```

### 1.2 - Atualizar o sistema
```bash
apt update && apt upgrade -y
```

### 1.3 - Configurar timezone
```bash
timedatectl set-timezone America/Sao_Paulo
date
```

---

## 🗄️ PASSO 2: INSTALAR POSTGRESQL

### 2.1 - Instalar PostgreSQL
```bash
apt install postgresql postgresql-contrib -y
```

### 2.2 - Iniciar serviços
```bash
systemctl start postgresql
systemctl enable postgresql
systemctl status postgresql
```

### 2.3 - Configurar usuário e banco
```bash
sudo -u postgres psql
```

**Dentro do PostgreSQL, execute:**
```sql
CREATE USER agendamento WITH PASSWORD 'agendamento123';
CREATE DATABASE agendamento_pro OWNER agendamento;
GRANT ALL PRIVILEGES ON DATABASE agendamento_pro TO agendamento;
ALTER USER agendamento CREATEDB;
\q
```

### 2.4 - Testar conexão
```bash
psql -h localhost -U agendamento -d agendamento_pro -c "SELECT NOW();"
```

---

## 📦 PASSO 3: INSTALAR NODE.JS E FERRAMENTAS

### 3.1 - Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### 3.2 - Verificar instalação
```bash
node --version
npm --version
```

### 3.3 - Instalar PM2 e ferramentas globais
```bash
npm install -g pm2 typescript tsx
```

---

## 🌐 PASSO 4: INSTALAR E CONFIGURAR NGINX

### 4.1 - Instalar Nginx
```bash
apt install nginx -y
systemctl start nginx
systemctl enable nginx
```

### 4.2 - Configurar firewall
```bash
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable
```

---

## 📁 PASSO 5: PREPARAR DIRETÓRIO DO PROJETO

### 5.1 - Criar estrutura
```bash
mkdir -p /var/www/agendamento-pro
cd /var/www/agendamento-pro
```

### 5.2 - Sair do SSH temporariamente
```bash
exit
```

---

## 📤 PASSO 6: UPLOAD DOS ARQUIVOS (NO SEU COMPUTADOR)

### 6.1 - Navegar para o diretório do projeto
```powershell
cd "g:\Sistemas_Lincoln\meuagendamentopro\schedule_no_updated"
```

### 6.2 - Upload dos arquivos de configuração
```powershell
scp package.json root@31.97.166.232:/var/www/agendamento-pro/
scp package-lock.json root@31.97.166.232:/var/www/agendamento-pro/
scp vite.config.ts root@31.97.166.232:/var/www/agendamento-pro/
scp tailwind.config.ts root@31.97.166.232:/var/www/agendamento-pro/
scp tsconfig.json root@31.97.166.232:/var/www/agendamento-pro/
scp postcss.config.js root@31.97.166.232:/var/www/agendamento-pro/
scp drizzle.config.ts root@31.97.166.232:/var/www/agendamento-pro/
scp components.json root@31.97.166.232:/var/www/agendamento-pro/
```

### 6.3 - Upload dos diretórios principais
```powershell
scp -r client root@31.97.166.232:/var/www/agendamento-pro/
scp -r server root@31.97.166.232:/var/www/agendamento-pro/
scp -r shared root@31.97.166.232:/var/www/agendamento-pro/
scp -r public root@31.97.166.232:/var/www/agendamento-pro/
```

### 6.4 - Upload do banco de dados
```powershell
scp agendamentos_bd.sql root@31.97.166.232:/var/www/agendamento-pro/
```

---

## ⚙️ PASSO 7: CONFIGURAR AMBIENTE NO VPS

### 7.1 - Conectar novamente ao VPS
```bash
ssh root@31.97.166.232
cd /var/www/agendamento-pro
```

### 7.2 - Criar arquivo .env
```bash
nano .env
```

**Conteúdo do .env:**
```env
# Configuração do Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agendamento_pro
DB_USER=agendamento
DB_PASSWORD=agendamento123
DATABASE_URL=postgres://agendamento:agendamento123@localhost:5432/agendamento_pro

# Ambiente
NODE_ENV=production

# Configurações adicionais (ajuste conforme necessário)
PORT=3000
```

### 7.3 - Importar banco de dados
```bash
psql -h localhost -U agendamento -d agendamento_pro < agendamentos_bd.sql
```

### 7.4 - Instalar dependências
```bash
npm install
```

### 7.5 - Build do projeto
```bash
npm run build
```

---

## 🚀 PASSO 8: CONFIGURAR PM2 E NGINX

### 8.1 - Iniciar aplicação com PM2
```bash
pm2 start dist/index.js --name "agendamento-pro"
pm2 save
pm2 startup
```

### 8.2 - Configurar Nginx
```bash
nano /etc/nginx/sites-available/agendamento-pro
```

**Conteúdo da configuração:**
```nginx
server {
    listen 80;
    server_name meuagendamentopro.com.br www.meuagendamentopro.com.br 31.97.166.232;

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
    }
}
```

### 8.3 - Ativar configuração
```bash
ln -s /etc/nginx/sites-available/agendamento-pro /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 🔒 PASSO 9: CONFIGURAR SSL (OPCIONAL MAS RECOMENDADO)

### 9.1 - Instalar Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### 9.2 - Obter certificado SSL
```bash
certbot --nginx -d meuagendamentopro.com.br -d www.meuagendamentopro.com.br
```

---

## ✅ PASSO 10: VERIFICAR FUNCIONAMENTO

### 10.1 - Verificar status dos serviços
```bash
pm2 status
systemctl status nginx
systemctl status postgresql
```

### 10.2 - Testar aplicação
```bash
curl http://localhost:3000
```

### 10.3 - Verificar logs
```bash
pm2 logs agendamento-pro
```

---

## 🎯 COMANDOS ÚTEIS PARA MANUTENÇÃO

```bash
# Reiniciar aplicação
pm2 restart agendamento-pro

# Ver logs em tempo real
pm2 logs agendamento-pro --lines 50

# Parar aplicação
pm2 stop agendamento-pro

# Reiniciar Nginx
systemctl restart nginx

# Backup do banco
pg_dump -h localhost -U agendamento agendamento_pro > backup_$(date +%Y%m%d).sql
```

---

## 🆘 RESOLUÇÃO DE PROBLEMAS COMUNS

### Erro de conexão com banco:
```bash
sudo -u postgres psql -c "ALTER USER agendamento PASSWORD 'agendamento123';"
```

### Erro de permissões:
```bash
chown -R www-data:www-data /var/www/agendamento-pro
chmod -R 755 /var/www/agendamento-pro
```

### Aplicação não inicia:
```bash
cd /var/www/agendamento-pro
npm run build
pm2 delete agendamento-pro
pm2 start dist/index.js --name "agendamento-pro"
```

---

## 🎉 FINALIZAÇÃO

Após completar todos os passos, sua aplicação estará rodando em:
- **HTTP:** http://31.97.166.232
- **HTTPS:** https://meuagendamentopro.com.br (se configurou SSL)

**Status esperado:**
- ✅ PostgreSQL rodando
- ✅ Node.js aplicação rodando via PM2
- ✅ Nginx fazendo proxy reverso
- ✅ SSL configurado (opcional)
