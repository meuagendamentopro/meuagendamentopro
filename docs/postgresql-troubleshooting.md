# Solução de Problemas do PostgreSQL

Este guia ajuda a resolver problemas comuns durante a configuração e uso do PostgreSQL com o Sistema de Agendamento, particularmente focado na migração para ambientes de desenvolvimento local.

## Índice

1. [Problemas de Instalação](#problemas-de-instalação)
2. [Problemas de Conexão](#problemas-de-conexão)
3. [Problemas de Permissão](#problemas-de-permissão)
4. [Problemas de Migração](#problemas-de-migração)
5. [Problemas de Performance](#problemas-de-performance)
6. [Comandos Úteis](#comandos-úteis)

## Problemas de Instalação

### PostgreSQL não encontrado após instalação

**Sintoma**: Comandos como `psql` ou `createdb` retornam "comando não encontrado".

**Solução**:

1. Verifique se o PostgreSQL está no PATH:
   ```bash
   # No Linux/macOS
   echo $PATH
   
   # No Windows (PowerShell)
   $env:Path
   ```

2. Adicione o PostgreSQL ao PATH:
   ```bash
   # No Linux/macOS
   export PATH=/usr/local/pgsql/bin:$PATH
   # ou
   export PATH=/usr/lib/postgresql/<versão>/bin:$PATH
   
   # No Windows
   # Adicione C:\Program Files\PostgreSQL\<versão>\bin ao PATH do sistema
   ```

### Serviço PostgreSQL não inicia

**Sintoma**: O serviço do PostgreSQL não inicia ou falha durante a inicialização.

**Solução**:

1. Verifique os logs:
   ```bash
   # No Linux
   sudo tail -n 100 /var/log/postgresql/postgresql-<versão>-main.log
   
   # No macOS
   tail -n 100 /usr/local/var/log/postgres.log
   
   # No Windows
   # Verifique o Visualizador de Eventos > Logs de Aplicativos e Serviços
   ```

2. Reinicie o serviço:
   ```bash
   # No Linux
   sudo systemctl restart postgresql
   
   # No macOS
   brew services restart postgresql
   
   # No Windows
   # Use o Gerenciador de Serviços e reinicie "PostgreSQL"
   ```

## Problemas de Conexão

### Erro "could not connect to server"

**Sintoma**: Mensagens de erro como "could not connect to server" ou "Connection refused".

**Solução**:

1. Verifique se o servidor está rodando:
   ```bash
   # No Linux
   sudo systemctl status postgresql
   
   # No macOS
   brew services list | grep postgres
   
   # No Windows
   # Verifique no Gerenciador de Serviços se "PostgreSQL" está em execução
   ```

2. Verifique a configuração de conexão:
   ```bash
   # Teste a conexão com parâmetros explícitos
   psql -h localhost -p 5432 -U postgres
   ```

3. Verifique as configurações em `pg_hba.conf`:
   ```bash
   # No Linux
   sudo nano /etc/postgresql/<versão>/main/pg_hba.conf
   
   # No macOS
   nano /usr/local/var/postgres/pg_hba.conf
   
   # Adicione ou modifique:
   # host  all  all  127.0.0.1/32  md5
   # host  all  all  ::1/128       md5
   ```

### Erro "role postgres does not exist"

**Sintoma**: Mensagem de erro indicando que o usuário postgres não existe.

**Solução**:

1. Crie o usuário postgres:
   ```bash
   # No Linux
   sudo -u postgres psql
   
   # No macOS
   createuser -s postgres
   
   # Dentro do psql
   CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'sua_senha';
   ```

## Problemas de Permissão

### Erro "permission denied"

**Sintoma**: Erros como "permission denied for database" ou "permission denied for schema".

**Solução**:

1. Conceda permissões ao usuário:
   ```sql
   -- Como superusuário do PostgreSQL
   GRANT ALL PRIVILEGES ON DATABASE agendadb TO seu_usuario;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO seu_usuario;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO seu_usuario;
   ```

2. Use o superusuário (temporariamente) para operações que requerem permissões elevadas:
   ```bash
   PGPASSWORD=sua_senha psql -U postgres -h localhost -d agendadb
   ```

### Erro ao criar banco de dados

**Sintoma**: Não é possível criar um banco de dados com seu usuário.

**Solução**:

1. Crie o banco de dados como superusuário:
   ```bash
   sudo -u postgres createdb agendadb
   ```

2. Conceda permissões:
   ```sql
   -- Como superusuário
   GRANT ALL PRIVILEGES ON DATABASE agendadb TO seu_usuario;
   ```

## Problemas de Migração

### Erro "relation does not exist"

**Sintoma**: Durante a migração, ocorrem erros relacionados a tabelas não existentes.

**Solução**:

1. Execute o script de criação de esquema:
   ```bash
   npx tsx scripts/db-push.ts
   ```

2. Verifique se as tabelas foram criadas:
   ```sql
   -- No psql
   \dt
   
   -- Liste tabelas específicas
   \dt users
   ```

### Erros de tipo durante a migração

**Sintoma**: Erros indicando incompatibilidade de tipos durante a inserção de dados.

**Solução**:

1. Verifique a estrutura da tabela:
   ```sql
   -- No psql
   \d+ nome_da_tabela
   ```

2. Ajuste os dados antes da inserção:
   ```sql
   -- Exemplo: converter para o tipo correto
   UPDATE tabela SET campo = CAST(campo AS tipo_correto);
   ```

3. Em casos mais complexos, edite o script de migração para corrigir os tipos.

## Problemas de Performance

### Consultas lentas

**Sintoma**: Operações de banco de dados estão muito lentas.

**Solução**:

1. Verifique os índices:
   ```sql
   -- Liste índices existentes
   \di
   
   -- Crie índices para chaves frequentemente consultadas
   CREATE INDEX idx_nome ON tabela(coluna);
   ```

2. Analise a tabela para atualizar estatísticas:
   ```sql
   ANALYZE tabela;
   ```

### Banco de dados muito grande

**Sintoma**: O banco de dados ocupa muito espaço e as operações estão lentas.

**Solução**:

1. Limpe dados desnecessários:
   ```sql
   -- Com cuidado! Isso exclui dados permanentemente
   DELETE FROM tabela WHERE condição;
   ```

2. Otimize o banco de dados:
   ```sql
   VACUUM FULL ANALYZE;
   ```

## Comandos Úteis

### Verificar Status do PostgreSQL

```bash
# No Linux
sudo systemctl status postgresql

# No macOS
brew services list | grep postgres
```

### Backup e Restauração

```bash
# Backup de banco de dados
pg_dump -U postgres -d agendadb > backup.sql

# Restaurar banco de dados
psql -U postgres -d agendadb < backup.sql
```

### Conectar ao PostgreSQL

```bash
# Conexão básica
psql -U postgres

# Conexão a banco específico
psql -U postgres -d agendadb

# Conexão com parâmetros completos
psql -h localhost -p 5432 -U postgres -d agendadb
```

### Definir senha para usuário postgres

```bash
# Conecte ao psql como superusuário
psql -U postgres

# Altere a senha
ALTER USER postgres WITH PASSWORD 'nova_senha';
```

### Listar bancos e tabelas

```bash
# Listar bancos de dados
\l

# Listar tabelas no banco atual
\dt

# Descrever tabela específica
\d+ nome_tabela
```

### Monitorar conexões ativas

```sql
SELECT * FROM pg_stat_activity;
```

### Reiniciar sequências

Se você precisar redefinir os contadores de ID automáticos:

```sql
-- Reiniciar para o próximo ID após o máximo atual
SELECT setval(pg_get_serial_sequence('nome_tabela', 'id'), 
  (SELECT MAX(id) FROM nome_tabela), true);
```