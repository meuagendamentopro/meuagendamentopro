# Deploy Simplificado - Sem Comandos Complexos

## Opção 1: Upload via WinSCP (Recomendado)

### 1. Baixar WinSCP
- Acesse: https://winscp.net/eng/download.php
- Baixe e instale o WinSCP

### 2. Conectar ao VPS
- Abra o WinSCP
- **Protocolo**: SFTP
- **Servidor**: 31.97.166.232
- **Usuário**: root
- **Senha**: (sua senha do VPS)
- Clique em "Login"

### 3. Preparar arquivos localmente
No seu computador, crie uma pasta temporária e copie estes arquivos/pastas:
```
📁 projeto-upload/
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
└── 📄 .env (criar conforme abaixo)
```

### 4. Criar arquivo .env
Crie um arquivo chamado `.env` com este conteúdo:
```
NODE_ENV=production
DATABASE_URL=postgresql://agendamento:agendamento123@localhost:5432/agendamento_pro
PORT=3000
APP_URL=http://meuagendamentopro.com.br
SESSION_SECRET=meuagendamentopro_chave_secreta_super_segura_2024_vps_producao
```

### 5. Upload via WinSCP
- No WinSCP, navegue até `/var/www/`
- Crie a pasta `agendamento-pro` se não existir
- Arraste todos os arquivos da pasta `projeto-upload` para `/var/www/agendamento-pro/`

## Opção 2: Comandos Individuais Simples

Se preferir usar comandos, execute UM POR VEZ:

### Conectar e preparar:
```bash
ssh root@31.97.166.232
```
(Digite a senha quando solicitado)

```bash
mkdir -p /var/www/agendamento-pro
cd /var/www/agendamento-pro
```

### Sair e fazer uploads (execute no seu computador):
```bash
exit
```

Agora, UM COMANDO POR VEZ:
```bash
scp package.json root@31.97.166.232:/var/www/agendamento-pro/
```
(Digite a senha)

```bash
scp package-lock.json root@31.97.166.232:/var/www/agendamento-pro/
```
(Digite a senha)

E assim por diante...

## Opção 3: Criar arquivo .env diretamente no VPS

Se conseguir conectar via SSH:
```bash
ssh root@31.97.166.232
cd /var/www/agendamento-pro
nano .env
```

Cole este conteúdo:
```
NODE_ENV=production
DATABASE_URL=postgresql://agendamento:agendamento123@localhost:5432/agendamento_pro
PORT=3000
APP_URL=http://meuagendamentopro.com.br
SESSION_SECRET=meuagendamentopro_chave_secreta_super_segura_2024_vps_producao
```

Salve com `Ctrl+X`, depois `Y`, depois `Enter`.

## Após o Upload (qualquer opção):

```bash
ssh root@31.97.166.232
cd /var/www/agendamento-pro
ls -la
npm install
npm run build
pm2 start dist/index.js --name agendamento-pro
pm2 save
```

## Se der erro de "command not found":

### Para npm:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### Para pm2:
```bash
npm install -g pm2
```

## Configurar Nginx:
```bash
nano /etc/nginx/sites-available/default
```

Substitua todo o conteúdo por:
```nginx
server {
    listen 80;
    server_name meuagendamentopro.com.br www.meuagendamentopro.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /pgadmin4 {
        proxy_pass http://localhost:8080/pgadmin4;
        proxy_set_header Host $host;
    }
}
```

Salvar e reiniciar:
```bash
nginx -t
systemctl restart nginx
```

## Testar:
```bash
pm2 status
curl http://localhost:3000
```

Acesse: http://meuagendamentopro.com.br 