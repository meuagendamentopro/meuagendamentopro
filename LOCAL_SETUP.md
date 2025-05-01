# Executando o Sistema de Agendamento Localmente

Este documento explica como configurar e executar o sistema de agendamento com um banco de dados PostgreSQL local.

## Requisitos

1. **PostgreSQL** - Instale o PostgreSQL em sua máquina
   - Windows: Baixe em https://www.postgresql.org/download/windows/
   - Ubuntu/Debian: `sudo apt-get install postgresql postgresql-contrib`
   - Mac: `brew install postgresql`

   **Importante para Windows:** Após a instalação, verifique se o diretório bin do PostgreSQL (ex: `C:\Program Files\PostgreSQL\14\bin`) está no PATH do sistema ou adicione manualmente.

2. **Node.js** - Instale o Node.js v16 ou superior
   - Baixe em https://nodejs.org/

## Configuração Automática

Escolha a opção adequada para seu sistema operacional:

### Windows

1. Execute o arquivo `setup-local.bat` como administrador
2. Após a configuração, use `start-local.bat` para iniciar o sistema
3. Para parar o sistema, use `stop-local.bat`

### Linux/Mac

1. Dê permissão de execução aos scripts: 
   ```
   chmod +x setup-local.sh
   chmod +x start-local.sh
   chmod +x stop-local.sh
   ```

2. Execute o script de configuração: `./setup-local.sh`
3. Após a configuração, use `./start-local.sh` para iniciar o sistema
4. Para parar o sistema, use `./stop-local.sh`

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
  - No Windows: verifique os serviços do sistema (services.msc) e certifique-se que o serviço 'postgresql-x64-XX' está em execução
  - No Linux: `sudo service postgresql status` ou `sudo systemctl status postgresql`
  - No Mac: `brew services list | grep postgres`

- Confirme que as credenciais no arquivo `.env` estão corretas
  - Por padrão, o usuário e senha são 'postgres' e 'postgres'
  - Se você definiu outras credenciais durante a instalação, atualize o arquivo .env

- Certifique-se de que o banco de dados `agendamento_local` foi criado
  - No Windows: use pgAdmin (interface gráfica que vem com o PostgreSQL)
  - Via linha de comando: `psql -U postgres -c "SELECT datname FROM pg_database WHERE datname='agendamento_local';"`

### Problema com a ferramenta psql não encontrada

- No Windows, verifique se o diretório de instalação do PostgreSQL está no PATH do sistema
  - Locais comuns: `C:\Program Files\PostgreSQL\17\bin` (onde 17 é a versão, o script suporta versões 9-17)
  - Adicionar ao PATH: Painel de Controle > Sistema > Configurações avançadas do sistema > Variáveis de ambiente

- Como alternativa, você pode executar os comandos diretamente usando o caminho completo:
  - `"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE agendamento_local;"`

### Problemas ao iniciar ou parar o sistema

#### Windows
- Se o script `start-local.bat` não conseguir iniciar o servidor:
  - Verifique se o Node.js está instalado e no PATH do sistema
  - Verifique se o PostgreSQL está em execução e acessível
  - Tente executar manualmente: `npm install` seguido de `npm run dev`

- Se o script `stop-local.bat` não conseguir parar o servidor:
  - Encerre o processo pelo Gerenciador de Tarefas (Task Manager)
  - Procure por processos chamados `node.exe` ou `npm.cmd`

#### Linux/Mac
- Se o script `start-local.sh` não conseguir iniciar o servidor:
  - Verifique as permissões de execução: `chmod +x start-local.sh`
  - Tente manualmente: `npm install` seguido de `npm run dev`

- Se o script `stop-local.sh` não conseguir parar o servidor:
  - Encontre o processo manualmente: `ps aux | grep node`
  - Encerre o processo: `kill -9 [PID]`

### Outros problemas

- Verifique os logs do servidor para identificar erros específicos
- Se ocorrer erro de conexão recusada (connection refused), verifique se a porta 5432 está disponível
- Certifique-se de que o arquivo .env está na raiz do projeto
- Se o banco de dados estiver inacessível, verifique se o serviço do PostgreSQL está em execução
- O sistema utiliza a porta 5000 por padrão, certifique-se de que ela está disponível
- Consulte a documentação do PostgreSQL ou Node.js conforme necessário
