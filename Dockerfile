FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de configuração primeiro para aproveitar o cache de camadas
COPY package.json package-lock.json ./

# Usar npm install em vez de npm ci
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Construir a aplicação
RUN npm run build

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para iniciar a aplicação (incluindo migrações)
CMD ["npm", "start"]
