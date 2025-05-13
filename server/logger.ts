/**
 * Módulo de log para aplicação
 * Centraliza a lógica de logging e permite configuração consistente
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Define o nível com base no ambiente (produção usa INFO e acima)
const currentLevel = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

/**
 * Formata o timestamp para o log
 * @returns String formatada com a data e hora atual
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Formata a mensagem de log
 * @param level Nível de log
 * @param message Mensagem ou objeto a ser logado
 * @returns String formatada para log
 */
function formatLogMessage(level: string, message: any): string {
  const timestamp = getTimestamp();
  
  if (typeof message === 'object') {
    try {
      message = JSON.stringify(message);
    } catch (e) {
      message = '[Object não serializável]';
    }
  }
  
  return `[${timestamp}] [${level}] ${message}`;
}

export default {
  /**
   * Log de nível debug - para informações detalhadas (apenas em desenvolvimento)
   */
  debug: (message: any): void => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatLogMessage('DEBUG', message));
    }
  },
  
  /**
   * Log de nível info - para informações gerais de operação normal
   */
  info: (message: any): void => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(formatLogMessage('INFO', message));
    }
  },
  
  /**
   * Log de nível warn - para situações potencialmente problemáticas
   */
  warn: (message: any): void => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(formatLogMessage('WARN', message));
    }
  },
  
  /**
   * Log de nível error - para erros e exceções
   */
  error: (message: any, error?: Error): void => {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(formatLogMessage('ERROR', message));
      if (error && error.stack) {
        console.error(error.stack);
      }
    }
  }
};