FROM node:16-slim

WORKDIR /app

# Copiar apenas os arquivos de configuração primeiro
COPY package.json package-lock.json ./

# Instalar apenas as dependências de produção
RUN npm install --production --no-optional --no-audit

# Copiar apenas os arquivos necessários para o backend
COPY server ./server
COPY shared ./shared
COPY drizzle.config.ts ./

# Criar diretório dist para arquivos estáticos
RUN mkdir -p dist

# Criar um arquivo HTML simples para a página inicial
RUN echo '<!DOCTYPE html><html><head><title>API do Sistema de Agendamento</title><style>body{font-family:sans-serif;margin:40px;line-height:1.6}h1{color:#4a6cf7}</style></head><body><h1>API do Sistema de Agendamento</h1><p>A API está funcionando. Acesse <a href="/api/health">/api/health</a> para verificar o status.</p></body></html>' > dist/index.html

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
