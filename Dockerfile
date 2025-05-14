FROM node:18-alpine

WORKDIR /app

# Instalar ferramentas adicionais para depuração
RUN apk add --no-cache curl

# Copiar arquivos de configuração primeiro para aproveitar o cache de camadas
COPY package.json package-lock.json ./

# Usar npm install em vez de npm ci
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Construir a aplicação
RUN npm run build

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Verificar se o diretório dist existe
RUN ls -la dist || echo "Diretório dist não encontrado"

# Comando para iniciar a aplicação (incluindo migrações)
CMD ["npm", "start"]
