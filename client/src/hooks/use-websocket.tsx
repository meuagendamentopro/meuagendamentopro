import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { queryClient } from '@/lib/queryClient';

// Adicionar tipagem para a propriedade global
declare global {
  interface Window {
    __WS_CONNECTED?: boolean;
    __WS_INSTANCE?: WebSocket;
    __WS_CONNECTION_HANDLERS?: Set<(status: boolean) => void>;
    __WS_ERROR_HANDLERS?: Set<(error: string | null) => void>;
    __WS_MESSAGE_HANDLERS?: Set<(data: any) => void>;
  }
}

type WebSocketProps = {
  onMessage?: (data: any) => void;
};

// Inicialização dos handlers globais na primeira carga da aplicação
if (!window.__WS_CONNECTION_HANDLERS) {
  window.__WS_CONNECTION_HANDLERS = new Set();
}
if (!window.__WS_ERROR_HANDLERS) {
  window.__WS_ERROR_HANDLERS = new Set();
}
if (!window.__WS_MESSAGE_HANDLERS) {
  window.__WS_MESSAGE_HANDLERS = new Set();
}

// Singleton WebSocket - única instância compartilhada entre todos os componentes
function createSingletonWebSocket(userId?: number) {
  // Se já existe uma conexão aberta, retorna
  if (window.__WS_INSTANCE && window.__WS_INSTANCE.readyState === WebSocket.OPEN) {
    console.log('Usando conexão WebSocket existente');
    
    // Se o usuário está logado e a conexão já existe, envia identificação
    if (userId && window.__WS_INSTANCE.readyState === WebSocket.OPEN) {
      try {
        const identifyMsg = JSON.stringify({
          type: 'identify',
          userId: userId
        });
        window.__WS_INSTANCE.send(identifyMsg);
        console.log(`Usuário ${userId} identificado no WebSocket (conexão existente)`);
      } catch (err) {
        console.error('Erro ao enviar identificação do usuário:', err);
      }
    }
    
    return;
  }

  // Variáveis para controle de reconexão
  let retryCount = 0;
  const maxRetry = 10;
  const baseRetryDelay = 1000; // 1 segundo
  const maxRetryDelay = 30000; // 30 segundos
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  
  // Função para calcular delay com backoff exponencial e jitter
  const getRetryDelay = () => {
    // Exponential backoff com jitter para evitar reconexões sincronizadas
    const expDelay = Math.min(baseRetryDelay * Math.pow(2, retryCount), maxRetryDelay);
    // Adiciona jitter (até 20%)
    const jitter = expDelay * 0.2 * Math.random();
    return expDelay + jitter;
  };
  
  // Limpar timer quando necessário
  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };
  
  // Função de reconexão
  const reconnect = () => {
    clearReconnectTimer();
    window.__WS_CONNECTED = false;
    
    if (retryCount < maxRetry) {
      const delay = getRetryDelay();
      console.log(`Tentando reconexão WebSocket em ${Math.round(delay/1000)}s (tentativa ${retryCount + 1} de ${maxRetry})`);
      
      reconnectTimer = setTimeout(() => {
        retryCount++;
        createSingletonWebSocket(userId);
      }, delay);
      
      // Notifica todos os handlers que estamos reconectando
      window.__WS_CONNECTION_HANDLERS?.forEach(handler => handler(false));
      window.__WS_ERROR_HANDLERS?.forEach(handler => handler('Reconectando...'));
    } else {
      console.error('Número máximo de tentativas de reconexão WebSocket atingido');
      const errorMsg = 'Não foi possível estabelecer conexão em tempo real. Atualizações podem estar atrasadas.';
      window.__WS_ERROR_HANDLERS?.forEach(handler => handler(errorMsg));
    }
  };
  
  try {
    // Determina o protocolo correto baseado na conexão atual
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Estabelecendo nova conexão WebSocket: ${wsUrl}`);
    
    // Fecha conexão existente se houver
    if (window.__WS_INSTANCE) {
      try {
        window.__WS_INSTANCE.close(1000, "Criando nova conexão");
      } catch (e) {
        console.error("Erro ao fechar conexão WebSocket existente:", e);
      }
    }
    
    // Limpa o ping interval existente
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    
    // Cria nova conexão
    const socket = new WebSocket(wsUrl);
    window.__WS_INSTANCE = socket;
    
    socket.onopen = () => {
      console.log('Conexão WebSocket estabelecida!');
      window.__WS_CONNECTED = true;
      retryCount = 0; // Reinicia contador de tentativas quando conecta
      
      // Notifica todos os handlers sobre a conexão bem-sucedida
      window.__WS_CONNECTION_HANDLERS?.forEach(handler => handler(true));
      window.__WS_ERROR_HANDLERS?.forEach(handler => handler(null));
      
      // Identifica o usuário atual se estiver autenticado
      if (userId) {
        try {
          const identifyMsg = JSON.stringify({
            type: 'identify',
            userId: userId
          });
          socket.send(identifyMsg);
          console.log(`Usuário ${userId} identificado no WebSocket`);
        } catch (err) {
          console.error('Erro ao enviar identificação do usuário:', err);
        }
      }
    };
    
    socket.onclose = (event) => {
      console.log(`Conexão WebSocket fechada: Código ${event.code}, Limpo: ${event.wasClean}`);
      window.__WS_CONNECTED = false;
      
      // Notifica todos os handlers
      window.__WS_CONNECTION_HANDLERS?.forEach(handler => handler(false));
      
      // Não tentar reconectar se o fechamento foi limpo/intencional
      if (!event.wasClean && navigator.onLine) {
        reconnect();
      }
    };
    
    socket.onerror = (event) => {
      console.error('Erro na conexão WebSocket:', event);
      const errorMsg = 'Falha na conexão em tempo real';
      window.__WS_ERROR_HANDLERS?.forEach(handler => handler(errorMsg));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Processa atualizações específicas
        if (data.type === 'appointment_updated' || data.type === 'appointment_created') {
          console.log(`Atualizando dados após ${data.type}`);
          
          // Força atualização imediata sem esperar pelo stale time
          const queryOptions = { 
            exact: false
          } as const;
          
          // Refetch para atualizar a lista de agendamentos
          queryClient.refetchQueries({
            queryKey: ['/api/providers', data.data.providerId, 'appointments'],
            ...queryOptions
          });
          
          // Refetch para my-appointments (dashboard do profissional)
          queryClient.refetchQueries({
            queryKey: ['/api/my-appointments'],
            ...queryOptions
          });
          
          // Refetch para a consulta específica do agendamento
          queryClient.refetchQueries({
            queryKey: ['/api/appointments', data.data.id],
            ...queryOptions
          });
          
          // Refetch para as notificações do usuário
          if (userId) {
            queryClient.refetchQueries({
              queryKey: ['/api/users', userId, 'notifications'],
              ...queryOptions
            });
          }
        }
        
        // Notifica todos os handlers de mensagem
        window.__WS_MESSAGE_HANDLERS?.forEach(handler => {
          try {
            handler(data);
          } catch (e) {
            console.error('Erro em um handler de mensagem WebSocket:', e);
          }
        });
      } catch (err) {
        console.error('Erro ao processar mensagem WebSocket:', err);
      }
    };
    
    // Ping para manter a conexão ativa
    pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
          console.error('Erro ao enviar ping WebSocket:', err);
        }
      }
    }, 30000); // 30 segundos
    
  } catch (err) {
    console.error('Erro ao criar conexão WebSocket:', err);
    window.__WS_ERROR_HANDLERS?.forEach(handler => 
      handler('Falha ao iniciar conexão em tempo real')
    );
  }
}

// Hook que utiliza a conexão singleton
export const useWebSocket = ({ onMessage }: WebSocketProps = {}) => {
  const [connected, setConnected] = useState(!!window.__WS_CONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { user } = useAuth();
  
  // Registra os handlers nos sets globais
  useEffect(() => {
    // Handler de status de conexão
    const connectionHandler = (status: boolean) => {
      setConnected(status);
      setIsReconnecting(!status && navigator.onLine);
    };
    
    // Handler de erros
    const errorHandler = (errorMsg: string | null) => {
      setError(errorMsg);
      setIsReconnecting(!!errorMsg && errorMsg.includes('Reconectando'));
    };
    
    // Handler de mensagens
    const messageHandler = (data: any) => {
      if (onMessage) {
        onMessage(data);
      }
    };
    
    // Registrar handlers
    window.__WS_CONNECTION_HANDLERS?.add(connectionHandler);
    window.__WS_ERROR_HANDLERS?.add(errorHandler);
    if (onMessage) {
      window.__WS_MESSAGE_HANDLERS?.add(messageHandler);
    }
    
    // Se já existe uma conexão, define o estado inicial
    setConnected(!!window.__WS_CONNECTED);
    
    // Cria ou usa a conexão singleton
    createSingletonWebSocket(user?.id);
    
    // Cleanup: remove os handlers quando o componente é desmontado
    return () => {
      window.__WS_CONNECTION_HANDLERS?.delete(connectionHandler);
      window.__WS_ERROR_HANDLERS?.delete(errorHandler);
      if (onMessage) {
        window.__WS_MESSAGE_HANDLERS?.delete(messageHandler);
      }
    };
  }, [onMessage, user]);
  
  // Função para reconectar manualmente
  const reconnectManually = useCallback(() => {
    setIsReconnecting(true);
    createSingletonWebSocket(user?.id);
  }, [user]);
  
  return {
    socket: window.__WS_INSTANCE || null,
    connected,
    error,
    isReconnecting,
    reconnect: reconnectManually
  };
};