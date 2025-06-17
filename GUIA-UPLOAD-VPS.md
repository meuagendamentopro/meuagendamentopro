# Guia para Upload do Projeto para o VPS

## Passo 1: Preparar o VPS
Execute estes comandos no VPS (conecte via SSH):

```bash
# Conectar ao VPS
ssh root@31.97.166.232

# Criar diretório do projeto
mkdir -p /var/www/agendamento-pro

# Limpar diretório se já existir
rm -rf /var/www/agendamento-pro/*

# Sair do SSH temporariamente
exit
```

## Passo 2: Upload dos Arquivos (Execute no seu computador)

### 2.1 - Arquivos de Configuração
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

### 2.2 - Arquivo de Ambiente
```powershell
scp vps.env root@31.97.166.232:/var/www/agendamento-pro/.env
```

### 2.3 - Diretórios do Projeto
```powershell
scp -r client root@31.97.166.232:/var/www/agendamento-pro/
scp -r server root@31.97.166.232:/var/www/agendamento-pro/
scp -r shared root@31.97.166.232:/var/www/agendamento-pro/
scp -r public root@31.97.166.232:/var/www/agendamento-pro/
```

## Passo 3: Configurar o Projeto no VPS
Conecte novamente ao VPS e execute:

```bash
# Conectar ao VPS
ssh root@31.97.166.232

# Ir para o diretório do projeto
cd /var/www/agendamento-pro

# Verificar se os arquivos foram enviados
ls -la

# Instalar dependências
npm install

# Fazer build do projeto
npm run build

# Verificar se o build foi criado
ls -la dist/

# Configurar PM2 para gerenciar o processo
pm2 start dist/index.js --name agendamento-pro

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar automaticamente
pm2 startup

# Verificar status
pm2 status
```

## Passo 4: Configurar Nginx
```bash
# Editar configuração do Nginx
nano /etc/nginx/sites-available/default

# Substituir o conteúdo por:
```

```nginx
server {
    listen 80;
    server_name meuagendamentopro.com.br www.meuagendamentopro.com.br;

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
    }

    # Configuração para pgAdmin (manter existente)
    location /pgadmin4 {
        proxy_pass http://localhost:8080/pgadmin4;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Testar configuração do Nginx
nginx -t

# Reiniciar Nginx
systemctl restart nginx

# Verificar status
systemctl status nginx
```

## Passo 5: Verificar se está funcionando
```bash
# Verificar se a aplicação está rodando
pm2 status

# Verificar logs se houver problemas
pm2 logs agendamento-pro

# Testar conexão local
curl http://localhost:3000

# Verificar se o Nginx está funcionando
curl http://localhost
```

## Passo 6: Testar no Navegador
Acesse: http://meuagendamentopro.com.br

## Comandos Úteis para Troubleshooting

### Verificar logs da aplicação:
```bash
pm2 logs agendamento-pro
```

### Reiniciar aplicação:
```bash
pm2 restart agendamento-pro
```

### Verificar status dos serviços:
```bash
systemctl status nginx
systemctl status postgresql
pm2 status
```

### Verificar conexão com banco:
```bash
cd /var/www/agendamento-pro
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://agendamento:agendamento123@localhost:5432/agendamento_pro'
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Erro:', err);
  else console.log('Conectado! Hora atual:', res.rows[0]);
  pool.end();
});
"
```

## Notas Importantes:
1. Certifique-se de que todos os comandos scp sejam executados no diretório do projeto
2. Digite a senha do VPS quando solicitado
3. Se houver erros de permissão, use `sudo` antes dos comandos
4. Mantenha o pgAdmin funcionando na rota `/pgadmin4` 