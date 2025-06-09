# 🚀 Script de Migração do Banco de Dados

Este script verifica e cria automaticamente todas as tabelas e colunas necessárias para o **Sistema de Gerenciamento de Equipe** no seu ambiente de produção.

## 📋 O que o script faz

✅ **Verifica tabelas existentes** - Não afeta dados existentes  
✅ **Cria tabelas faltantes** - Apenas se não existirem  
✅ **Adiciona colunas faltantes** - Sem afetar colunas existentes  
✅ **Cria índices de performance** - Para otimizar consultas  
✅ **100% Seguro** - Não remove nem modifica dados existentes  

### Tabelas que serão verificadas/criadas:

1. **`users`** - Adiciona coluna `accountType` (individual/company)
2. **`employees`** - Tabela completa de funcionários
3. **`employeeServices`** - Relacionamento funcionário-serviços
4. **`appointments`** - Adiciona coluna `employeeId`

## 🛠️ Como usar

### 1. **Preparar o ambiente**

```bash
# Instalar dependências (se não tiver)
npm install pg dotenv

# OU usando yarn
yarn add pg dotenv
```

### 2. **Configurar banco de dados**

Crie um arquivo `.env` na raiz do projeto:

```bash
# Copie o arquivo de exemplo
cp env-example.txt .env
```

Edite o arquivo `.env` com os dados do seu banco de produção:

```env
DB_HOST=seu-servidor-producao.com
DB_PORT=5432
DB_NAME=seu_banco_producao
DB_USER=seu_usuario
DB_PASSWORD=sua_senha_segura
NODE_ENV=production
```

### 3. **Executar a migração**

```bash
# Executar o script
node migration-script.js
```

## 📺 Exemplo de execução

```
🚀 INICIANDO MIGRAÇÃO DO BANCO DE DADOS
=====================================

📋 Configuração do banco de dados:
   Host: meu-servidor.com
   Port: 5432
   Database: agendamento_prod
   User: postgres

⚠️  Deseja prosseguir com a migração? (s/N): s

🔍 Verificando estrutura do banco de dados...

📋 Verificando tabela: users
   ✅ Tabela 'users' existe
   ✅ Coluna 'id' existe
   ✅ Coluna 'name' existe
   ⚠️  Coluna 'accountType' não existe - adicionando...
   ✅ Coluna 'accountType' adicionada à tabela 'users'

📋 Verificando tabela: employees
   ⚠️  Tabela 'employees' não existe - criando...
   ✅ Tabela 'employees' criada com sucesso
   ✅ Índice criado: idx_employees_company_user_id

📋 Verificando tabela: employeeServices
   ⚠️  Tabela 'employeeServices' não existe - criando...
   ✅ Tabela 'employeeServices' criada com sucesso

🔧 Verificações adicionais...
   ⚠️  Adicionando coluna employeeId à tabela appointments...
   ✅ Coluna 'employeeId' adicionada à tabela 'appointments'

🎉 MIGRAÇÃO CONCLUÍDA!
=====================
📊 Total de alterações realizadas: 4

✅ Seu banco de dados foi atualizado com sucesso!
✅ Todas as tabelas e colunas necessárias estão disponíveis
✅ O sistema de gerenciamento de equipe está pronto para uso
```

## 🔒 Segurança

- ✅ **Não remove dados** - Apenas adiciona estruturas
- ✅ **Não modifica dados existentes** - Preserva tudo
- ✅ **Transações seguras** - Rollback em caso de erro
- ✅ **Confirmação do usuário** - Pede confirmação antes de executar
- ✅ **Logs detalhados** - Mostra exatamente o que está fazendo

## 🚨 Importante

1. **Faça backup** do seu banco antes de executar (recomendado)
2. **Teste primeiro** em um ambiente de desenvolvimento
3. **Verifique as credenciais** no arquivo `.env`
4. **Execute em horário de baixo tráfego** (recomendado)

## 🆘 Solução de problemas

### Erro de conexão
```
❌ Erro durante a migração: connection refused
```
**Solução:** Verifique host, porta, usuário e senha no `.env`

### Erro de permissão
```
❌ Erro ao criar tabela: permission denied
```
**Solução:** Verifique se o usuário tem permissões de CREATE TABLE

### Erro de SSL
```
❌ Erro: SSL connection required
```
**Solução:** Configure `NODE_ENV=production` no `.env`

## 📞 Suporte

Se encontrar algum problema:

1. Verifique os logs de erro detalhados
2. Confirme as configurações do `.env`
3. Teste a conexão com o banco manualmente
4. Execute primeiro em ambiente de teste

## ✅ Após a migração

Depois que o script executar com sucesso:

1. ✅ Seu sistema estará pronto para gerenciar equipes
2. ✅ Usuários poderão alterar tipo de conta para "empresa"
3. ✅ Funcionalidades de funcionários estarão disponíveis
4. ✅ Agendamentos simultâneos funcionarão corretamente

---

**🎉 Pronto! Seu sistema de agendamento agora suporta gerenciamento de equipe!** 