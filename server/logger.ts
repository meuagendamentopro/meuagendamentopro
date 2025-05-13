/**
 * Logger para aplicação
 */

// Níveis de log
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Função que registra logs no console com timestamp
export class Logger {
  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }
  
  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
  
  private log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        break;
    }
  }
}

// Exporta uma instância singleton do logger
export default new Logger();