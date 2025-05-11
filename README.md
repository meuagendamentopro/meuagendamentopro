# Sistema de Agendamento

Sistema profissional para gerenciamento de agendamentos, serviços e clientes para profissionais de qualquer área.

![Sistema de Agendamento](./generated-icon.png)

## 🌟 Funcionalidades

- ✅ Agendamentos em tempo real
- ✅ Gerenciamento de clientes
- ✅ Cadastro de serviços personalizados
- ✅ Links de agendamento compartilháveis
- ✅ Notificações via WhatsApp (clicáveis)
- ✅ Painel administrativo completo
- ✅ Relatórios financeiros
- ✅ Suporte a múltiplos profissionais
- ✅ Interface responsiva (Desktop e Mobile)

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Acessar sistema
# http://localhost:5000
```

### Credenciais para teste

- **Admin**: 
  - Usuário: `admin`
  - Senha: `password123`

- **Profissional**: 
  - Usuário: `link`
  - Senha: `password123`

## 📋 Pré-requisitos

- Node.js 18 ou superior
- PostgreSQL 14 ou superior
- Navegador moderno (Chrome, Firefox, Edge)

## 🗄️ Banco de Dados

Por padrão, o sistema usa um banco de dados PostgreSQL.

### Configuração Rápida (Ambiente Local)

Para configurar rapidamente um banco de dados local:

```bash
# Dar permissão de execução ao script
chmod +x scripts/setup-local-db.sh

# Executar script
./scripts/setup-local-db.sh
```

O script irá:
1. Verificar pré-requisitos
2. Criar um banco PostgreSQL local
3. Configurar as tabelas necessárias
4. Inserir dados iniciais para teste

### Migração de Dados

Para migrar dados de outro banco PostgreSQL:

```bash
node scripts/migrate-to-local-db.js
```

## 📱 WhatsApp e Notificações

O sistema suporta envio de mensagens para WhatsApp através de links clicáveis.
Para notificações automáticas, configure:

```
# No arquivo .env
GMAIL_USER=seu.email@gmail.com
GMAIL_APP_PASSWORD=sua_senha_de_app
```

## 🛠️ Estrutura do Projeto

```
/
├── client/            # Frontend (React)
├── server/            # Backend (Express)
├── shared/            # Módulos compartilhados
├── scripts/           # Scripts utilitários
└── docs/              # Documentação
```

## 📚 Documentação

Para informações detalhadas, consulte:

- [Guia de Desenvolvimento Local](./docs/desenvolvimento-local.md)
- [Configuração do Banco de Dados](./docs/local-database-setup.md)
- [Solução de Problemas PostgreSQL](./docs/postgresql-troubleshooting.md)
- [Documentação Completa](./docs/README.md)

## 🔧 Scripts Úteis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Compila projeto para produção
- `npm run db:push` - Atualiza esquema do banco de dados
- `node scripts/check-database-connection.js` - Verifica conexão com banco
- `./scripts/export-database.sh` - Exporta backup do banco de dados

## 🌐 Desenvolvimento Local

Para desenvolvimento local completo, use:

```bash
# Verificar conexão com o banco
node scripts/check-database-connection.js

# Iniciar servidor de desenvolvimento
npm run dev
```

## 🤝 Contribuições

Contribuições são bem-vindas! Para contribuir:

1. Crie um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.