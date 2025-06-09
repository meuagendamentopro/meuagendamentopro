# 🔍 Como Verificar Logs do Railway

## 1. Acessar Logs do Railway
1. Acesse [railway.app](https://railway.app)
2. Vá no seu projeto
3. Clique no serviço web
4. Vá na aba **"Deployments"**
5. Clique no deploy mais recente
6. Clique em **"View Logs"**

## 2. Procurar por Erros
Procure por:
- ❌ Erros de conexão com banco
- ❌ Erros de autenticação
- ❌ Erros de migração
- ❌ Variáveis de ambiente faltando

## 3. Logs Importantes
- `🚀 Iniciando migração do banco de dados...`
- `✅ Conectado ao banco de dados`
- `📝 Criando tabelas...`
- `🎉 Migração concluída!`
- `Servidor rodando na porta...`

## 4. Possíveis Problemas
- DATABASE_URL não configurada
- Migração não executada
- Tabelas não criadas
- Erro de autenticação 