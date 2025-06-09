# 🚀 Deploy no Railway - Meu Agendamento PRO

Este guia te ajudará a hospedar seu sistema de agendamento no Railway mantendo a funcionalidade local.

## 📋 Pré-requisitos

- [x] Sistema funcionando localmente
- [x] Conta no [Railway](https://railway.app)
- [x] Conta no GitHub
- [x] Git configurado

## 🔧 Preparação Local

### 1. Exportar Banco de Dados Local

```bash
# Exportar dados do banco local para migração
npm run export-db
```

Este comando irá:
- ✅ Conectar ao seu banco PostgreSQL local
- ✅ Exportar todas as tabelas e dados
- ✅ Gerar arquivo `railway-migration.sql`
- ✅ Criar instruções de migração

### 2. Preparar Build para Produção

```bash
# Preparar tudo para o Railway
npm run railway:prepare
```

## 🌐 Configuração no Railway

### 1. Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Conecte seu repositório: `https://github.com/meuagendamentopro/meuagendamentopro`

### 2. Adicionar PostgreSQL

1. No seu projeto Railway, clique em "New Service"
2. Selecione "Database" → "PostgreSQL"
3. Aguarde a criação do banco
4. Anote a `DATABASE_URL` gerada

### 3. Configurar Variáveis de Ambiente

No painel do Railway, vá em "Variables" e adicione:

```env
NODE_ENV=production
SESSION_SECRET=sua_chave_secreta_muito_segura_aqui
APP_URL=https://seu-app.railway.app
```

> **Importante:** A `DATABASE_URL` é configurada automaticamente pelo Railway quando você adiciona PostgreSQL.

### 4. Migrar Dados do Banco Local

```bash
# Conectar ao banco do Railway e importar dados
psql "sua_database_url_do_railway" -f railway-migration.sql
```

**Exemplo:**
```bash
psql "postgresql://postgres:senha@host:5432/railway" -f railway-migration.sql
```

## 🚀 Deploy

### Deploy Automático

O Railway fará deploy automático sempre que você fizer push para o GitHub:

```bash
git add .
git commit -m "Deploy para Railway"
git push origin main
```

### Deploy Manual

Se preferir, você pode fazer deploy manual:

1. No painel Railway, clique em "Deploy"
2. Aguarde o build completar
3. Acesse sua aplicação na URL fornecida

## ✅ Verificação Pós-Deploy

Após o deploy, verifique se tudo está funcionando:

### 1. Acesso à Aplicação
- [ ] Aplicação carrega corretamente
- [ ] Interface está responsiva
- [ ] Não há erros no console

### 2. Funcionalidades de Login
- [ ] Login de admin funciona (`admin` / `password123`)
- [ ] Login de profissional funciona (`link` / `password123`)
- [ ] Sessões são mantidas

### 3. Funcionalidades do Sistema
- [ ] Cadastro de clientes
- [ ] Agendamento de serviços
- [ ] Visualização de agenda
- [ ] Relatórios funcionam
- [ ] Links de agendamento funcionam

### 4. Banco de Dados
- [ ] Dados foram migrados corretamente
- [ ] Novos registros são salvos
- [ ] Relacionamentos funcionam

## 🔄 Desenvolvimento Contínuo

### Trabalhar Localmente

```bash
# Continuar desenvolvimento local
npm run dev
```

### Sincronizar com Railway

```bash
# Fazer alterações localmente
git add .
git commit -m "Nova funcionalidade"
git push origin main
# Deploy automático no Railway
```

## 🛠️ Troubleshooting

### Problema: Aplicação não inicia
**Solução:**
1. Verifique os logs no Railway
2. Confirme se `DATABASE_URL` está configurada
3. Verifique se o build foi bem-sucedido

### Problema: Banco de dados vazio
**Solução:**
1. Execute novamente a migração:
   ```bash
   psql "sua_database_url_do_railway" -f railway-migration.sql
   ```

### Problema: Erro de conexão
**Solução:**
1. Verifique se o PostgreSQL está ativo no Railway
2. Confirme a `DATABASE_URL` nas variáveis de ambiente

### Problema: Sessões não funcionam
**Solução:**
1. Verifique se `SESSION_SECRET` está configurada
2. Confirme se é uma string segura e única

## 📊 Monitoramento

### Logs do Railway
- Acesse "Deployments" → "View Logs"
- Monitore erros e performance

### Métricas
- CPU e memória no painel Railway
- Tempo de resposta da aplicação

## 🔒 Segurança em Produção

### Variáveis Sensíveis
- ✅ `SESSION_SECRET` - Use uma chave forte e única
- ✅ `DATABASE_URL` - Nunca exponha publicamente
- ✅ Configurações de email - Se usar notificações

### Backup do Banco
```bash
# Fazer backup regular do banco Railway
pg_dump "sua_database_url_do_railway" > backup-$(date +%Y%m%d).sql
```

## 📞 Suporte

Se encontrar problemas:

1. **Logs do Railway:** Primeiro lugar para verificar erros
2. **Documentação Railway:** [docs.railway.app](https://docs.railway.app)
3. **GitHub Issues:** Reporte problemas no repositório

## 🎉 Pronto!

Seu sistema de agendamento agora está:
- ✅ Funcionando localmente para desenvolvimento
- ✅ Hospedado no Railway para produção
- ✅ Com banco de dados migrado
- ✅ Deploy automático configurado

**URLs importantes:**
- 🏠 **Local:** http://localhost:3003
- 🌐 **Produção:** https://seu-app.railway.app
- 📊 **Railway Dashboard:** https://railway.app/dashboard 