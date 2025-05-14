FROM node:16

WORKDIR /app

# Copiar apenas os arquivos de configuração primeiro
COPY package.json package-lock.json ./

# Instalar apenas as dependências de produção
RUN npm install --only=production

# Copiar o resto dos arquivos
COPY . .

# Criar diretório dist e copiar o index.html estático
RUN mkdir -p dist
COPY static-index.html dist/index.html

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
