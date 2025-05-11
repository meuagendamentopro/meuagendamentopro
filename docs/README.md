# Sistema de Agendamento - Documentação

Bem-vindo à documentação do Sistema de Agendamento! Este documento fornece uma visão geral do sistema, instruções para configuração e desenvolvimento, e dicas para solução de problemas comuns.

## Índice

1. [Introdução](#introdução)
2. [Requisitos do Sistema](#requisitos-do-sistema)
3. [Instalação e Configuração](#instalação-e-configuração)
   - [Banco de Dados](#banco-de-dados)
   - [Variáveis de Ambiente](#variáveis-de-ambiente)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Funcionalidades Principais](#funcionalidades-principais)
6. [Desenvolvimento Local](#desenvolvimento-local)
7. [Solução de Problemas](#solução-de-problemas)
8. [Informações Adicionais](#informações-adicionais)

## Introdução

O Sistema de Agendamento é uma plataforma completa para gerenciamento de serviços, clientes e agendamentos para profissionais e empresas de diferentes setores. A plataforma permite que profissionais gerenciem seus serviços e horários disponíveis, enquanto clientes podem agendar serviços de forma fácil e intuitiva através de links personalizados.

### Principais Recursos:

- Agendamento online com links personalizados
- Gestão de serviços e preços
- Controle de horários e disponibilidade
- Cadastro e gestão de clientes
- Notificações via WhatsApp e email
- Relatórios financeiros
- Painel administrativo completo
- Suporte a múltiplos profissionais

## Requisitos do Sistema

Para executar o Sistema de Agendamento, você precisará:

- Node.js 18.x ou superior
- PostgreSQL 14.x ou superior
- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- Conexão com a internet (para algumas funcionalidades)

## Instalação e Configuração

### Configuração Rápida

1. Clone o repositório do projeto
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente (veja abaixo)
4. Inicie o servidor de desenvolvimento: `npm run dev`

### Banco de Dados

O sistema utiliza PostgreSQL como banco de dados. Você pode:

1. Usar um banco PostgreSQL em nuvem (recomendado para produção)
2. Configurar um banco de dados local (ideal para desenvolvimento)

Para configuração local, consulte o [Guia de Configuração de Banco Local](local-database-setup.md).

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
# Banco de Dados
DATABASE_URL=postgres://usuario:senha@host:porta/nomedobanco

# Configuração do Servidor
PORT=5000
SESSION_SECRET=gere_uma_chave_secreta_forte

# Email (opcional)
GMAIL_USER=seu.email@gmail.com
GMAIL_APP_PASSWORD=sua_senha_de_app

# SendGrid (opcional)
SENDGRID_API_KEY=sua_api_key_sendgrid
```

## Estrutura do Projeto

O projeto segue uma arquitetura de aplicação full-stack moderna:

```
/
├── client/            # Frontend React
│   ├── components/    # Componentes reutilizáveis
│   ├── hooks/         # Hooks personalizados
│   ├── lib/           # Funções utilitárias
│   ├── pages/         # Páginas principais
│
├── server/            # Backend Node.js
│   ├── db.ts          # Configuração da conexão com o banco
│   ├── routes.ts      # Rotas da API
│   ├── auth.ts        # Lógica de autenticação
│   ├── storage.ts     # Interface de acesso aos dados
│
├── shared/            # Código compartilhado entre frontend e backend
│   ├── schema.ts      # Definição do schema e tipos
│
├── scripts/           # Scripts utilitários
├── docs/              # Documentação
```

## Funcionalidades Principais

### Para Profissionais:

- **Dashboard**: Visão geral de agendamentos diários, semanais e mensais
- **Serviços**: Cadastro e gerenciamento de serviços oferecidos
- **Clientes**: Base de dados de clientes com histórico de agendamentos
- **Financeiro**: Relatórios e controle financeiro
- **Configurações**: Personalização de horários de trabalho, feriados e link de agendamento

### Para Clientes:

- **Agendamento Online**: Interface intuitiva para marcação de serviços
- **Confirmação**: Notificações por WhatsApp ou email
- **Histórico**: Visualização de serviços agendados e anteriores

## Desenvolvimento Local

Para desenvolvimento local recomendamos:

1. Configurar um banco de dados local seguindo [este guia](local-database-setup.md)
2. Executar o servidor em modo de desenvolvimento: `npm run dev`
3. O sistema estará disponível em: http://localhost:5000

### Conta Demo

Para fins de teste, o sistema cria automaticamente duas contas:

- **Administrador**: 
  - Usuário: `admin`
  - Senha: `password123`

- **Profissional**: 
  - Usuário: `link`
  - Senha: `password123`

## Solução de Problemas

### Problemas Comuns

#### Erro de conexão com o banco de dados
- Verifique se a URL do banco de dados está correta
- Confirme que o PostgreSQL está em execução
- Verifique se as credenciais estão corretas

#### Rotas não encontradas (404)
- Certifique-se de que o servidor está em execução
- Verifique se a URL está correta
- Confira os logs do servidor para erros

#### Problemas com fusos horários
- O sistema usa o fuso horário brasileiro (GMT-3)
- Verifique a configuração de timezone no seu computador

## Informações Adicionais

### Arquivos de Configuração

- `.env`: Variáveis de ambiente
- `drizzle.config.ts`: Configuração do ORM
- `vite.config.ts`: Configuração do servidor de desenvolvimento

### Scripts Úteis

- `npm run dev`: Inicia o servidor de desenvolvimento
- `npm run build`: Compila o projeto para produção
- `npm run db:push`: Atualiza o esquema do banco de dados
- `npm run db:migrate-local`: Migra dados para um banco local

### Suporte

Para obter suporte, entre em contato através dos canais oficiais ou abra uma issue no repositório.