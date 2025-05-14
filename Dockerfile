FROM node:16-alpine

WORKDIR /app

# Instalar ferramentas adicionais para depuração e execução
RUN apk add --no-cache curl bash

# Copiar todos os arquivos do projeto
COPY . .

# Criar diretório dist se não existir
RUN mkdir -p dist

# Copiar arquivo HTML estático para o diretório dist
RUN cp -f static-index.html dist/index.html || echo "Arquivo static-index.html não encontrado"

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
