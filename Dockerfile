FROM node:18-alpine

WORKDIR /app

# Instalar ferramentas adicionais para depuração e execução
RUN apk add --no-cache curl bash postgresql-client

# Copiar arquivos de configuração primeiro para aproveitar o cache de camadas
COPY package.json package-lock.json ./

# Usar npm install em vez de npm ci
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Verificar a estrutura de diretórios
RUN echo "Listando diretórios:" && ls -la
RUN echo "Verificando diretório shared:" && ls -la shared || echo "Diretório shared não encontrado"
RUN echo "Verificando arquivos do servidor:" && ls -la server || echo "Diretório server não encontrado"

# Construir a aplicação
RUN npm run build

# Executar script para copiar o frontend
RUN node copy-frontend.js

# Copiar arquivos do diretório client para dist
RUN if [ -d "client" ] && [ -d "dist" ]; then \
    echo "Copiando arquivos do cliente para dist..." && \
    cp -r client/* dist/ || echo "Falha ao copiar arquivos"; \
  fi

# Copiar arquivos estáticos para dist
RUN cp -f static-index.html dist/index.html || echo "Arquivo static-index.html não encontrado"

# Listar o conteúdo dos diretórios para verificar
RUN echo "Conteúdo do diretório raiz:" && ls -la
RUN echo "Conteúdo do diretório client:" && ls -la client || echo "Diretório client não encontrado"
RUN echo "Conteúdo do diretório dist:" && ls -la dist || echo "Diretório dist não encontrado"

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Verificar se o diretório dist existe
RUN ls -la dist || echo "Diretório dist não encontrado"

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
