# 🚀 Guia Rápido - Deploy no Railway

## ✅ Status Atual
- [x] Sistema funcionando localmente
- [x] Banco de dados exportado (`railway-migration.sql`)
- [x] Build de produção criado
- [x] Configurações do Railway prontas

## 🎯 Próximos Passos

### 1. Commit e Push para GitHub
```bash
git add .
git commit -m "Preparação para deploy no Railway"
git push origin main
```

### 2. Configurar Railway
1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Conecte: `https://github.com/meuagendamentopro/meuagendamentopro`

### 3. Adicionar PostgreSQL
1. No projeto Railway: "New Service" → "Database" → "PostgreSQL"
2. Aguarde a criação
3. Copie a `DATABASE_URL`

### 4. Configurar Variáveis
No Railway, vá em "Variables" e adicione:
```
NODE_ENV=production
SESSION_SECRET=sua_chave_secreta_muito_segura_aqui
APP_URL=https://seu-app.railway.app
```

### 5. Migrar Dados
```bash
# Substitua pela sua DATABASE_URL do Railway
psql "postgresql://postgres:senha@host:port/database" -f railway-migration.sql
```

### 6. Deploy Automático
O Railway fará deploy automaticamente após conectar o GitHub!

## 📋 Checklist Final
- [ ] Repositório GitHub atualizado
- [ ] Railway conectado ao GitHub
- [ ] PostgreSQL adicionado no Railway
- [ ] Variáveis de ambiente configuradas
- [ ] Dados migrados para o banco Railway
- [ ] Deploy concluído
- [ ] Aplicação funcionando

## 🔗 Links Importantes
- **Local:** http://localhost:3003
- **Railway:** https://seu-app.railway.app
- **GitHub:** https://github.com/meuagendamentopro/meuagendamentopro

## 🆘 Problemas?
Consulte o arquivo `RAILWAY-DEPLOY.md` para instruções detalhadas. 