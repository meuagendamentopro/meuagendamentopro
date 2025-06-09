# Guia de Desenvolvimento Local

Este guia fornece instruções detalhadas para configurar um ambiente de desenvolvimento local completo para o Sistema de Agendamento, incluindo a configuração do banco de dados PostgreSQL.

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração do Ambiente](#configuração-do-ambiente)
3. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
4. [Execução do Projeto](#execução-do-projeto)
5. [Depuração](#depuração)
6. [Fluxo de Trabalho Recomendado](#fluxo-de-trabalho-recomendado)
7. [Configurações Avançadas](#configurações-avançadas)

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
  - [Download Node.js](https://nodejs.org/)
  - Verifique a instalação: `node --version`

- **PostgreSQL** (versão 14 ou superior)
  - [Download PostgreSQL](https://www.postgresql.org/download/)
  - Verifique a instalação: `psql --version`

- **Git** (opcional, para controle de versão)
  - [Download Git](https://git-scm.com/downloads)
  - Verifique a instalação: `git --version`

## Configuração do Ambiente

### 1. Clone ou baixe o repositório

```bash
# Usando Git
git clone [URL_DO_REPOSITORIO]
cd sistema-agendamento

# Ou baixe e extraia o arquivo ZIP manualmente
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
# Ambiente
NODE_ENV=development
PORT=3003

# Sessão
SESSION_SECRET=sua_chave_secreta_para_sessoes

# Configurações de e-mail (opcional para desenvolvimento)
GMAIL_USER=seu.email@gmail.com
GMAIL_APP_PASSWORD=sua_senha_de_app
```

> **Nota**: A variável DATABASE_URL será configurada mais tarde, após configurarmos o banco de dados local.

## Configuração do Banco de Dados

Há duas opções para configurar o banco de dados local:

### Opção 1: Configuração Automática (Recomendada)

Utilize o script de configuração automática:

```bash
# Dê permissão de execução ao script
chmod +x scripts/setup-local-db.sh

# Execute o script
./scripts/setup-local-db.sh
```

O script irá:
1. Verificar se o PostgreSQL está instalado
2. Solicitar as configurações do banco de dados (host, porta, nome, usuário, senha)
3. Criar o banco de dados (se não existir)
4. Migrar o esquema e dados iniciais
5. Criar usuários de teste
6. Fornecer a string de conexão para adicionar ao arquivo `.env`

### Opção 2: Configuração Manual

Se preferir configurar manualmente, siga estes passos:

#### 1. Crie um banco de dados

```bash
# Acesse o PostgreSQL
psql -U postgres

# Crie o banco de dados
CREATE DATABASE agendadb;

# Saia do psql
\q
```

#### 2. Configure o arquivo `.env`

Adicione a seguinte linha ao seu arquivo `.env`:

```
DATABASE_URL=postgres://postgres:sua_senha@localhost:5432/agendadb
```

Substitua `sua_senha` pela senha do usuário PostgreSQL.

#### 3. Execute o script de migração

```bash
# Crie as tabelas e estrutura inicial
npm run db:push

# OU use o script TypeScript diretamente
npx tsx scripts/db-push.ts
```

#### 4. (Opcional) Crie dados de teste

```bash
# Use o script de migração local
node scripts/migrate-to-local-db.js
```

## Execução do Projeto

Após a configuração do ambiente e do banco de dados, inicie o servidor de desenvolvimento:

```bash
npm run dev
```

O servidor será iniciado em `http://localhost:5000` (ou na porta especificada no arquivo `.env`).

### Contas de Teste

O sistema possui duas contas pré-configuradas para testes:

- **Administrador**:
  - Usuário: `admin`
  - Senha: `password123`

- **Profissional**:
  - Usuário: `link`
  - Senha: `password123`

## Depuração

### Depuração com Console

Adicione logs no código para depuração:

```javascript
// No backend
console.log('Depurando variável:', minhaVariavel);

// No frontend
console.log('Estado do componente:', estado);
```

### Depuração com VS Code

1. Instale a extensão "Debugger for Chrome" no VS Code
2. Crie um arquivo `.vscode/launch.json` com a configuração para depuração
3. Inicie o servidor com `npm run dev`
4. Pressione F5 no VS Code para iniciar a depuração

### Monitoramento do Banco de Dados

Para monitorar consultas SQL durante o desenvolvimento:

```bash
# No arquivo .env, adicione:
DEBUG_SQL=true
```

## Fluxo de Trabalho Recomendado

Para um desenvolvimento eficiente, recomendamos o seguinte fluxo de trabalho:

1. **Planejamento**: Defina claramente o que será implementado
2. **Esquema**: Atualize o esquema do banco em `shared/schema.ts` se necessário
3. **Backend**: Implemente as rotas de API em `server/routes.ts`
4. **Frontend**: Desenvolva os componentes e páginas em `client/`
5. **Testes**: Teste manualmente todas as funcionalidades
6. **Revisão**: Verifique se há problemas de performance ou segurança

## Configurações Avançadas

### Configuração de Servidor SMTP

Para testar o envio de e-mails, você pode usar:

1. **Conta Gmail** (atualizar variáveis GMAIL_USER e GMAIL_APP_PASSWORD)
2. **MailHog** para testes locais sem envio real
   ```bash
   # Instalar MailHog (Docker)
   docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
   
   # Configurar no .env
   MAIL_HOST=localhost
   MAIL_PORT=1025
   MAIL_USER=
   MAIL_PASS=
   ```

### Trabalhar com Time Zones

O sistema usa o fuso horário brasileiro (America/Sao_Paulo). Para testar diferentes fusos:

```javascript
// Simular outro fuso horário no código
const originalTimezone = process.env.TZ;
process.env.TZ = 'America/New_York';
// Seu código aqui
process.env.TZ = originalTimezone;
```

### Desenvolvimento com Múltiplos Dispositivos

Para testar em dispositivos móveis na rede local:

1. Descubra o IP local do seu computador:
   ```bash
   # No Linux/macOS
   ifconfig
   
   # No Windows
   ipconfig
   ```

2. Configure o servidor para aceitar conexões externas no arquivo `.env`:
   ```
   HOST=0.0.0.0
   ```

3. Acesse pelo navegador do dispositivo móvel usando:
   ```
   http://[SEU_IP_LOCAL]:5000
   ```

### Manutenção e Backup do Banco de Dados

É recomendável fazer backups regulares:

```bash
# Usar script de backup
chmod +x scripts/export-database.sh
./scripts/export-database.sh
```

---

Para mais informações ou solução de problemas, consulte:
- [README Principal](README.md)
- [Solução de Problemas PostgreSQL](postgresql-troubleshooting.md)
- [Configuração de Banco Local](local-database-setup.md)