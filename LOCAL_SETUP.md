# Executando o Sistema de Agendamento Localmente

Este documento explica como configurar e executar o sistema de agendamento com um banco de dados PostgreSQL local.

## Requisitos

1. **PostgreSQL** - Instale o PostgreSQL em sua máquina
2. **Node.js** - Instale o Node.js v16 ou superior

## Configuração Automática

Escolha a opção adequada para seu sistema operacional:

### Windows

1. Execute o arquivo `setup-local.bat` como administrador
2. Após a configuração, use `start-local.bat` para iniciar o sistema

### Linux/Mac

1. Dê permissão de execução ao script: `chmod +x setup-local.sh`
2. Execute o script: `./setup-local.sh`
3. Após a configuração, use `./start-local.sh` para iniciar o sistema

## Configuração Manual

Se a configuração automática não funcionar, siga estes passos manuais:

1. Instale as dependências: `npm install`
2. Crie um banco de dados PostgreSQL chamado `agendamento_local`
3. Crie um arquivo `.env` na raiz do projeto com:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agendamento_local
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=agendamento_local
PGPORT=5432
PGHOST=localhost
SESSION_SECRET=local_development_secret_key_1234567890
```

4. Execute `npm run db:push` para criar as tabelas no banco de dados
5. Inicie o sistema com `npm run dev`

## Acessando o Sistema

Após iniciar o servidor, acesse:

- **URL**: http://localhost:5000

### Usuários Padrão

- **Admin**
  - Usuário: `admin`
  - Senha: `password123`

- **Prestador de Serviço**
  - Usuário: `link`
  - Senha: `password123`

## Solução de Problemas

### Erro ao conectar ao banco de dados

- Verifique se o PostgreSQL está em execução
- Confirme que as credenciais no arquivo `.env` estão corretas
- Certifique-se de que o banco de dados `agendamento_local` foi criado

### Outros problemas

- Verifique os logs do servidor para identificar erros específicos
- Consulte a documentação do PostgreSQL ou Node.js conforme necessário
