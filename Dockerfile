FROM node:16-slim

WORKDIR /app

# Copiar arquivos de configuração
COPY package.json package-lock.json ./
COPY vite.config.ts tsconfig.json index.html ./
COPY drizzle.config.ts ./
COPY start.sh ./

# Garantir que o script de inicialização seja executável
RUN chmod +x start.sh

# Instalar dependências (incluindo as de desenvolvimento para build)
RUN npm install

# Copiar todo o código-fonte
COPY server ./server
COPY shared ./shared
COPY src ./src
COPY public ./public

# Construir o frontend usando Vite
RUN npm run build

# Ver o conteúdo do diretório dist após o build para debug
RUN ls -la dist

# Definir variáveis de ambiente
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta
EXPOSE 3000

# Iniciar usando o script de inicialização
CMD ["bash", "start.sh"]
