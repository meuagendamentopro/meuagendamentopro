/**
 * Logger simples para o sistema
 * Centraliza os logs e permite configuração por nível
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Define o nível de log com base no ambiente
const currentLevel = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

/**
 * Função para formatar a data/hora atual
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Registra uma mensagem de erro
 */
function error(message: string, ...args: any[]): void {
  if (currentLevel >= LOG_LEVELS.ERROR) {
    console.error(`[${getTimestamp()}] [ERROR] ${message}`, ...args);
  }
}

/**
 * Registra uma mensagem de aviso
 */
function warn(message: string, ...args: any[]): void {
  if (currentLevel >= LOG_LEVELS.WARN) {
    console.warn(`[${getTimestamp()}] [WARN] ${message}`, ...args);
  }
}

/**
 * Registra uma mensagem informativa
 */
function info(message: string, ...args: any[]): void {
  if (currentLevel >= LOG_LEVELS.INFO) {
    console.info(`[${getTimestamp()}] [INFO] ${message}`, ...args);
  }
}

/**
 * Registra uma mensagem de depuração
 */
function debug(message: string, ...args: any[]): void {
  if (currentLevel >= LOG_LEVELS.DEBUG) {
    console.debug(`[${getTimestamp()}] [DEBUG] ${message}`, ...args);
  }
}

export default {
  error,
  warn,
  info,
  debug
};