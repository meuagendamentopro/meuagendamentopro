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

# Copiar o frontend para o diretório correto
RUN mkdir -p dist/client
RUN cp -r dist/* dist/client/ || echo "Nenhum arquivo para copiar"
RUN echo "<!DOCTYPE html><html><head><meta http-equiv='refresh' content='0;url=/client/'></head><body>Redirecionando...</body></html>" > dist/index.html

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta que a aplicação usa
EXPOSE 3000

# Verificar se o diretório dist existe
RUN ls -la dist || echo "Diretório dist não encontrado"

# Comando para iniciar o servidor
CMD ["node", "server/server.js"]
