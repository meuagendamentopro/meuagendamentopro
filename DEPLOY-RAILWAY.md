# Deploy no Railway - Meu Agendamento PRO

## Passo a Passo para Deploy

### 1. Preparação
- ✅ Projeto configurado para Railway
- ✅ Servidor ajustado para produção (host 0.0.0.0)
- ✅ Variáveis de ambiente documentadas

### 2. Deploy no Railway

1. **Acesse [railway.app](https://railway.app)**
2. **Faça login com GitHub**
3. **Clique em "New Project"**
4. **Selecione "Deploy from GitHub repo"**
5. **Escolha este repositório**

### 3. Configurar PostgreSQL

1. **No dashboard do projeto, clique em "Add Service"**
2. **Selecione "Database" → "PostgreSQL"**
3. **Railway criará automaticamente o banco**

### 4. Configurar Variáveis de Ambiente

No painel do seu serviço web, vá em **Variables** e adicione:

```
NODE_ENV=production
SESSION_SECRET=sua-chave-secreta-super-segura-com-pelo-menos-32-caracteres
EMAIL_USER=contato@meuagendamentopro.com.br
EMAIL_PASSWORD=sua-senha-do-email
```

**Importante:** A variável `DATABASE_URL` será criada automaticamente pelo Railway quando você adicionar o PostgreSQL.

### 5. Deploy Automático

- Railway fará o deploy automaticamente
- Cada push no GitHub acionará um novo deploy
- Logs disponíveis em tempo real no dashboard

### 6. Domínio Personalizado (Opcional)

1. **No dashboard, vá em "Settings"**
2. **Clique em "Domains"**
3. **Adicione seu domínio personalizado**

## Comandos Úteis

```bash
# Build local (para testar)
npm run build

# Iniciar em produção (local)
npm start

# Verificar logs no Railway
# Use o dashboard web do Railway
```

## Estrutura de Custos Estimada

- **Aplicação Web:** ~$5/mês
- **PostgreSQL:** ~$5/mês
- **Total:** ~$10/mês

## Troubleshooting

### Erro de Conexão com Banco
- Verifique se o PostgreSQL foi adicionado ao projeto
- Confirme se a `DATABASE_URL` está sendo injetada automaticamente

### Erro de Build
- Verifique os logs de build no Railway
- Confirme se todas as dependências estão no `package.json`

### Erro de Porta
- Railway injeta automaticamente a variável `PORT`
- O código já está configurado para usar `process.env.PORT` 