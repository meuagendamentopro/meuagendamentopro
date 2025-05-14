FROM node:16-slim

WORKDIR /app

# Copiar apenas os arquivos necessários para o backend
COPY package.json package-lock.json ./

# Instalar apenas as dependências de produção
RUN npm install --production --no-optional --no-audit

# Copiar os arquivos do backend
COPY server ./server
COPY shared ./shared
COPY drizzle.config.ts ./

# Copiar os arquivos do frontend já construídos localmente
COPY dist ./dist

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
