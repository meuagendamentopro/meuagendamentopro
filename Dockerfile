FROM node:16

WORKDIR /app

# Copiar apenas os arquivos de configuração primeiro
COPY package.json package-lock.json ./

# Instalar todas as dependências (incluindo as de desenvolvimento para build)
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Construir o frontend React
RUN npm run build

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
