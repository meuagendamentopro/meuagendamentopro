FROM node:16-slim

WORKDIR /app

# Copiar arquivos de configuração
COPY package.json package-lock.json ./
COPY drizzle.config.ts ./
COPY start.sh ./

# Garantir que o script de inicialização seja executável
RUN chmod +x start.sh

# Instalar apenas as dependências de produção
RUN npm install --production --no-optional --no-audit

# Copiar código da aplicação
COPY server ./server
COPY shared ./shared

# Criar diretório para arquivos estáticos
RUN mkdir -p dist

# Criar um arquivo HTML simples para a página inicial
RUN echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>API de Agendamento</title><style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}h1{color:#4a6cf7}</style></head><body><h1>API de Agendamento</h1><p>API funcionando. Verifique o status em <a href="/api/health">/api/health</a>.</p><p>Frontend disponível em: <a href="https://meuagendamentopro.vercel.app">https://meuagendamentopro.vercel.app</a></p></body></html>' > dist/index.html

# Definir variáveis de ambiente
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta
EXPOSE 3000

# Iniciar usando o script de inicialização
CMD ["bash", "start.sh"]
