# Guia de Deploy no Railway

Este guia contém instruções detalhadas para fazer o deploy do sistema de agendamento no Railway.

## Pré-requisitos

- Conta no [Railway](https://railway.app/)
- Repositório no GitHub com o código do projeto
- Variáveis de ambiente configuradas

## Passos para Deploy

### 1. Preparação do Repositório

O projeto já está configurado para o Railway com:

- `Procfile` para definir o comando de inicialização
- `railway.json` para configurar o build e deploy
- Scripts no `package.json` para build e migração do banco de dados

### 2. Criando um Projeto no Railway

1. Acesse [railway.app](https://railway.app/) e faça login
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Conecte sua conta GitHub se necessário
5. Selecione o repositório do projeto

### 3. Adicionando um Banco de Dados PostgreSQL

1. No projeto criado, clique em "New"
2. Selecione "Database"
3. Escolha "PostgreSQL"
4. Aguarde a criação do banco de dados

### 4. Configurando Variáveis de Ambiente

1. No seu projeto, vá para a aba "Variables"
2. Adicione as seguintes variáveis:
   - `NODE_ENV=production`
   - `SESSION_SECRET=` (um valor aleatório seguro)
   - `APP_URL=` (será preenchido com a URL do seu app após o primeiro deploy)
   - `SMTP_HOST=` (seu servidor SMTP)
   - `SMTP_PORT=` (porta do servidor SMTP)
   - `SMTP_USER=` (usuário do servidor SMTP)
   - `SMTP_PASS=` (senha do servidor SMTP)
   - `EMAIL_FROM=` (email de envio)
   - `MERCADOPAGO_ACCESS_TOKEN=` (seu token do MercadoPago)
   - `ENABLE_NOTIFICATIONS=true`

O Railway automaticamente adicionará a variável `DATABASE_URL` conectando seu serviço ao banco de dados PostgreSQL.

### 5. Deploy Inicial

1. O Railway iniciará automaticamente o deploy quando você configurar o projeto
2. Você pode acompanhar o progresso na aba "Deployments"
3. O processo executará:
   - `npm run build` (build do frontend e backend)
   - `npm run db:migrate` (migração do banco de dados)
   - `npm start` (inicialização do servidor)

### 6. Verificando o Deploy

1. Após o deploy ser concluído, clique no botão "View" para abrir sua aplicação
2. Verifique se o frontend e o backend estão funcionando corretamente
3. Teste o login e outras funcionalidades principais

### 7. Configurando um Domínio Personalizado (Opcional)

1. Vá para "Settings" > "Domains"
2. Você pode usar o domínio fornecido pelo Railway ou configurar um domínio personalizado

### 8. Monitoramento e Logs

1. Acesse a aba "Deployments" e depois "Logs" para ver os logs da aplicação
2. Monitore os logs para identificar possíveis erros

### 9. Solução de Problemas

Se encontrar problemas durante o deploy:

1. Verifique os logs para identificar erros específicos
2. Confirme que todas as variáveis de ambiente estão configuradas corretamente
3. Verifique se o banco de dados está conectado corretamente
4. Execute o script de diagnóstico localmente para identificar problemas:
   ```
   NODE_ENV=production DATABASE_URL=[seu-railway-db-url] npx tsx scripts/diagnostico-sistema.ts --verbose
   ```

## Estrutura do Projeto

O projeto está configurado para servir tanto o backend quanto o frontend a partir do mesmo serviço:

- O backend é uma API Express que serve o frontend a partir do diretório `dist`
- O frontend é construído com Vite e os arquivos são gerados no diretório `dist`
- A migração do banco de dados é executada durante o deploy

## Notas Importantes

- O Railway oferece um período gratuito limitado, após o qual você precisará de um plano pago
- Certifique-se de que seu banco de dados está devidamente protegido com senhas fortes
- Mantenha suas variáveis de ambiente seguras e não as compartilhe no código
- Configure backups regulares do seu banco de dados para evitar perda de dados
