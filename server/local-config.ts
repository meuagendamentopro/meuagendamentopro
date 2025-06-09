// Configurações locais para desenvolvimento
export const localConfig = {
  database: {
    url: 'postgres://postgres:linday1818@localhost:5432/agendamento'
  },
  server: {
    port: 3003
  },
  session: {
    secret: 'sua_chave_secreta_aqui'
  },
  app: {
    url: 'http://localhost:3003'
  }
};
