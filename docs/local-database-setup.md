# Configuração de Banco de Dados Local (PostgreSQL)

Este documento contém instruções para configurar um banco de dados PostgreSQL local para o sistema de agendamento, permitindo que você execute a aplicação completamente offline ou em ambiente de desenvolvimento.

## Pré-requisitos

1. PostgreSQL instalado localmente
   - [Download PostgreSQL](https://www.postgresql.org/download/)
   - Para Ubuntu/Debian: `sudo apt-get install postgresql postgresql-contrib`
   - Para macOS (com Homebrew): `brew install postgresql`
   - Para Windows: Use o instalador do site oficial

2. Node.js e npm instalados
   - Recomendamos a versão 18 ou superior do Node.js

## Método 1: Script automático (Recomendado)

Disponibilizamos scripts que automatizam todo o processo de configuração:

### 1.1 Usando o script shell (Linux/macOS)

1. Abra o terminal na pasta raiz do projeto
2. Dê permissão de execução ao script:
   ```bash
   chmod +x scripts/setup-local-db.sh
   ```
3. Execute o script:
   ```bash
   ./scripts/setup-local-db.sh
   ```
4. Siga as instruções na tela (o script solicitará a senha do PostgreSQL)

### 1.2 Usando o script JavaScript (Qualquer plataforma)

1. Abra o terminal na pasta raiz do projeto
2. Execute o script com Node.js:
   ```bash
   node scripts/migrate-to-local-db.js
   ```
3. O script instalará automaticamente quaisquer dependências necessárias e executará a migração

## Método 2: Configuração manual

Se preferir configurar manualmente, siga estes passos:

1. Crie um banco de dados PostgreSQL chamado `agendadb`:
   ```bash
   # Como usuário postgres ou superusuário
   createdb agendadb
   
   # OU usando o psql
   psql -U postgres
   CREATE DATABASE agendadb;
   \q
   ```

2. Defina as variáveis de ambiente necessárias:
   ```bash
   export LOCAL_DB_HOST=localhost
   export LOCAL_DB_PORT=5432
   export LOCAL_DB_NAME=agendadb
   export LOCAL_DB_USER=postgres
   export LOCAL_DB_PASSWORD=sua_senha_postgres
   ```

3. Execute o script de migração:
   ```bash
   npx tsx scripts/migrate-to-local-db.ts
   ```

## Uso do banco de dados local

Após a configuração, para usar o banco de dados local em vez do banco de dados remoto:

1. Adicione a string de conexão ao seu arquivo `.env`:
   ```
   DATABASE_URL=postgres://postgres:sua_senha_postgres@localhost:5432/agendadb
   ```

2. Reinicie a aplicação para que ela carregue as novas variáveis de ambiente

## Credenciais padrão

O script de migração configura automaticamente contas de teste:

- **Administrador**: 
  - Usuário: `admin`
  - Senha: `password123`

- **Usuário regular**: 
  - Usuário: `link`
  - Senha: `password123`

## Solução de problemas

### Erro de permissão ao criar banco de dados

Se você encontrar erros de permissão ao criar o banco de dados, tente:

```bash
sudo -u postgres createdb agendadb
```

### Erro de conexão ao banco de dados

Verifique se:
- O serviço PostgreSQL está em execução
- As credenciais estão corretas
- A porta 5432 (padrão do PostgreSQL) está disponível

Para verificar o status do PostgreSQL:
```bash
sudo service postgresql status  # Ubuntu/Debian
brew services info postgresql   # macOS
```

### Outros erros

Se você encontrar outros problemas durante a migração, verifique os logs do script para mensagens de erro específicas. A maioria dos erros está relacionada a permissões ou configurações do PostgreSQL.

## Backup e restauração

Para fazer backup do banco de dados local:

```bash
pg_dump -U postgres -d agendadb > backup.sql
```

Para restaurar a partir de um backup:

```bash
psql -U postgres -d agendadb < backup.sql
```