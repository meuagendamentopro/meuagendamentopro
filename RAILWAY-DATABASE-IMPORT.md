# 🚀 Guia de Importação do Banco de Dados para o Railway

## 📋 Situação Atual
- ✅ Site funcionando no Railway
- ❌ Apenas 2 tabelas criadas (`active_sessions`, `session`)
- 🎯 Objetivo: Importar todas as 17 tabelas com dados

## 🔧 Método 1: Script Automático (Recomendado)

### Passo 1: Obter a URL do Banco Railway
1. Acesse o [Railway Dashboard](https://railway.app)
2. Clique no seu projeto
3. Clique no serviço **PostgreSQL** (Postgres-0JGH)
4. Vá na aba **"Variables"**
5. Copie o valor da variável `DATABASE_URL`

### Passo 2: Executar a Importação
```bash
# Substitua pela sua URL real do Railway
RAILWAY_DATABASE_URL="postgresql://postgres:senha@host:port/database" npm run import-railway
```

### Exemplo Completo:
```bash
RAILWAY_DATABASE_URL="postgresql://postgres:abc123@monorail.proxy.rlwy.net:12345/railway" npm run import-railway
```

## 🔧 Método 2: Via Railway Dashboard

### Passo 1: Acessar o Terminal do Banco
1. No Railway Dashboard, clique no serviço PostgreSQL
2. Vá na aba **"Data"**
3. Clique em **"Connect"**

### Passo 2: Limpar Tabelas Existentes (se necessário)
```sql
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS session CASCADE;
```

### Passo 3: Copiar e Colar o SQL
1. Abra o arquivo `railway-migration.sql`
2. Copie todo o conteúdo
3. Cole no terminal do Railway
4. Execute

## 🔧 Método 3: Via psql Local

### Pré-requisitos
- PostgreSQL instalado localmente
- Comando `psql` disponível

### Comando:
```bash
psql "postgresql://postgres:senha@host:port/database" -f railway-migration.sql
```

## 📊 Verificação da Importação

Após a importação, você deve ter estas 17 tabelas:

1. ✅ `active_sessions` - Sessões ativas dos usuários
2. ✅ `appointments` - Agendamentos
3. ✅ `clients` - Clientes
4. ✅ `clinical_notes` - Notas clínicas
5. ✅ `employee_services` - Serviços dos funcionários
6. ✅ `employees` - Funcionários
7. ✅ `notifications` - Notificações
8. ✅ `provider_clients` - Relação provedor-cliente
9. ✅ `providers` - Provedores de serviço
10. ✅ `services` - Serviços oferecidos
11. ✅ `session` - Sessões do sistema
12. ✅ `subscription_plans` - Planos de assinatura
13. ✅ `subscription_transactions` - Transações de assinatura
14. ✅ `system_settings` - Configurações do sistema
15. ✅ `time_exclusions` - Exclusões de horário
16. ✅ `user_session_tokens` - Tokens de sessão
17. ✅ `users` - Usuários do sistema

## 🎯 Dados Importados

O arquivo `railway-migration.sql` contém:
- **186 KB** de dados
- **3 usuários** (incluindo admin)
- **3 clientes**
- **2 funcionários**
- **2 serviços**
- **3 agendamentos**
- **45 notificações**
- **8 planos de assinatura**
- **Configurações do sistema**

## ⚠️ Troubleshooting

### Erro: "relation already exists"
```sql
-- Execute antes da importação:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### Erro: "permission denied"
- Verifique se a URL do banco está correta
- Confirme que o usuário tem permissões de escrita

### Erro: "connection refused"
- Verifique se o serviço PostgreSQL está rodando no Railway
- Confirme a URL de conexão

## 🔐 Usuários Disponíveis Após Importação

1. **Admin Principal**
   - Email: `lincolnmaxwel2@hotmail.com`
   - Senha: (definida no sistema local)

2. **Admin Teste**
   - Email: `admin@meuagendamentopro.com.br`
   - Senha: (definida no sistema local)

3. **Usuário Teste**
   - Email: `teste@meuagendamentopro.com.br`
   - Senha: (definida no sistema local)

## ✅ Próximos Passos

Após a importação bem-sucedida:

1. **Testar Login** - Acesse o site e faça login
2. **Verificar Dados** - Confirme se todos os dados estão presentes
3. **Configurar Variáveis** - Ajuste as variáveis de ambiente se necessário
4. **Backup** - Considere fazer backup do banco Railway

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Railway
2. Confirme a URL de conexão
3. Teste a conectividade com o banco
4. Execute o script de verificação

---

**Arquivo gerado automaticamente em:** 2025-06-09
**Tamanho do arquivo SQL:** 186 KB
**Total de tabelas:** 17 