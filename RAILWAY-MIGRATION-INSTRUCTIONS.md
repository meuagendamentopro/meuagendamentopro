# Instruções para Migração do Banco de Dados para Railway

## Passos para migrar os dados:

### 1. No Railway:
1. Crie um novo projeto no Railway
2. Adicione um serviço PostgreSQL
3. Anote a DATABASE_URL fornecida pelo Railway

### 2. Execute a migração:
```bash
# Conecte ao banco do Railway e execute o arquivo SQL
psql "sua_database_url_do_railway" -f railway-migration.sql
```

### 3. Configure as variáveis de ambiente no Railway:
- NODE_ENV=production
- DATABASE_URL=(fornecida automaticamente pelo PostgreSQL do Railway)
- SESSION_SECRET=sua_chave_secreta_muito_segura
- APP_URL=https://seu-app.railway.app

### 4. Faça o deploy:
```bash
# Conecte seu repositório GitHub ao Railway
# O deploy será automático
```

## Arquivo gerado:
- `railway-migration.sql` - Contém todos os dados do banco local

## Verificação:
Após o deploy, acesse sua aplicação no Railway e verifique se:
- ✅ Login funciona
- ✅ Dados estão presentes
- ✅ Agendamentos funcionam
- ✅ Todas as funcionalidades estão operacionais

## Troubleshooting:
Se houver problemas, verifique:
1. Se todas as variáveis de ambiente estão configuradas
2. Se o banco PostgreSQL está conectado
3. Se não há erros nos logs do Railway
