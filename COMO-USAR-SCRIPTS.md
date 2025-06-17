# 🚀 Como Usar os Scripts Automatizados

## 📋 Scripts Criados

1. **`deploy-completo.sh`** - Deploy completo com logs detalhados
2. **`configurar-nginx.sh`** - Configuração automática do Nginx

## 🔧 Como Executar

### 1. Dar Permissão aos Scripts
```bash
cd /var/www/agendamento-pro
chmod +x deploy-completo.sh
chmod +x configurar-nginx.sh
```

### 2. Executar Deploy Completo
```bash
./deploy-completo.sh
```

### 3. Configurar Nginx (se necessário)
```bash
./configurar-nginx.sh
```

## 📊 O que o Script de Deploy Faz

✅ **Verificações Iniciais:**
- Verifica se está no diretório correto
- Verifica versões do Node.js e npm
- Verifica arquivo .env
- Verifica estrutura do projeto

✅ **Build e Deploy:**
- Faz build do servidor backend
- Verifica se os arquivos foram gerados
- Testa conexão com banco de dados
- Para processos antigos
- Inicia nova aplicação com PM2

✅ **Configurações:**
- Salva configuração PM2
- Configura inicialização automática
- Verifica Nginx
- Testa aplicação

## 📝 Logs Gerados

- **Logs completos:** `/var/log/agendamento-deploy.log`
- **Logs de erro:** `/var/log/agendamento-deploy-errors.log`

## 🆘 Se Der Erro

### 1. Verificar Logs
```bash
# Ver logs completos
cat /var/log/agendamento-deploy.log

# Ver apenas erros
cat /var/log/agendamento-deploy-errors.log

# Ver últimos erros
tail -20 /var/log/agendamento-deploy-errors.log
```

### 2. Comandos Úteis para Troubleshooting
```bash
# Status da aplicação
pm2 status

# Logs da aplicação
pm2 logs agendamento-pro

# Reiniciar aplicação
pm2 restart agendamento-pro

# Testar aplicação
curl http://localhost:3000

# Status do Nginx
systemctl status nginx

# Status do PostgreSQL
systemctl status postgresql
```

### 3. Enviar Logs para Análise
Se der erro, copie e cole o conteúdo destes arquivos:
- `/var/log/agendamento-deploy-errors.log`
- Últimas 50 linhas de `/var/log/agendamento-deploy.log`

## 🎯 Resultado Esperado

Após executar com sucesso:
- ✅ Aplicação rodando na porta 3000
- ✅ PM2 gerenciando o processo
- ✅ Nginx configurado como proxy
- ✅ Acesso via http://meuagendamentopro.com.br
- ✅ pgAdmin funcionando em /pgadmin4

## 🔄 Para Atualizações Futuras

Sempre que fizer alterações no código:
1. Faça upload dos novos arquivos
2. Execute: `./deploy-completo.sh`
3. O script fará novo build e reiniciará automaticamente

## 📞 Suporte

Se encontrar erros:
1. Execute os scripts
2. Copie os logs de erro
3. Envie para análise com a mensagem específica do erro 