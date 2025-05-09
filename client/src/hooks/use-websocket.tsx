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
    __TOAST_TRIGGER?: (props: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
    __WEBSOCKET_HANDLERS?: Record<string, (event: MessageEvent) => void>;
    dispatchEvent(event: Event): boolean;
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
  const maxRetry = 3; // Reduzido de 10 para 3
  const baseRetryDelay = 5000; // Aumentado de 1s para 5s
  const maxRetryDelay = 30000; // 30 segundos
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  
  // Função para calcular delay com backoff exponencial e jitter
  const getRetryDelay = () => {
    // Exponential backoff com jitter para evitar reconexões sincronizadas
    const expDelay = Math.min(baseRetryDelay * Math.pow(1.5, retryCount), maxRetryDelay);
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
      
      // Só notifica na primeira tentativa para não poluir a interface
      if (retryCount === 0) {
        window.__WS_ERROR_HANDLERS?.forEach(handler => 
          handler('Tentando reconectar. Atualizações em tempo real podem estar atrasadas.')
        );
      }
    } else {
      console.log('Número máximo de tentativas de reconexão WebSocket atingido');
      
      // Desiste quietamente após tentativas para não incomodar o usuário
      // A aplicação continuará funcionando normalmente, só não terá atualizações em tempo real
      window.__WS_ERROR_HANDLERS?.forEach(handler => handler(null));
      
      // Uma última tentativa será feita após um intervalo longo (2 minutos)
      reconnectTimer = setTimeout(() => {
        retryCount = 0; // Reinicia o contador para permitir novas tentativas
        createSingletonWebSocket(userId);
      }, 120000); // 2 minutos
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
      
      // Limpar ping interval quando a conexão é fechada
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      // Notifica todos os handlers
      window.__WS_CONNECTION_HANDLERS?.forEach(handler => handler(false));
      
      // Tenta reconectar para qualquer fechamento não limpo (incluindo código 1006)
      // e apenas se o navegador estiver online
      if (navigator.onLine) {
        reconnect();
      }
    };
    
    socket.onerror = (event) => {
      console.error('Erro na conexão WebSocket:', event);
      
      // Em caso de erro, marca a conexão como perdida
      window.__WS_CONNECTED = false;
      
      // Limpar ping interval quando ocorre erro na conexão
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      // Um erro provavelmente já vai acionar o evento onclose, então não notificamos
      // os handlers aqui para evitar notificações duplicadas
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Força atualização imediata sem esperar pelo stale time
        const queryOptions = { 
          exact: false
        } as const;

        // Processa atualizações específicas
        if (data.type === 'notification_created') {
          console.log(`Recebida notificação via WebSocket:`, data);
          
          // Extrair dados da notificação com tratamento de erros
          const notificationData = data.data || data;
          const notification = notificationData.notification;
          const notificationUserId = notificationData.userId;
          
          console.log(`Notificação recebida para usuário ${notificationUserId}, usuário atual: ${userId}`);
          
          // Atualizar imediatamente as notificações se for para o usuário atual
          if (userId && userId === notificationUserId) {
            console.log(`Atualizando notificações para usuário ${userId}`);
            // Força atualização imediata
            queryClient.invalidateQueries({
              queryKey: ['/api/notifications'],
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/notifications/unread'],
            });
            
            // Mostra o toast imediatamente
            if (window.__TOAST_TRIGGER && notification) {
              window.__TOAST_TRIGGER({
                title: notification.title || 'Nova notificação',
                description: notification.message || 'Você tem uma nova notificação',
              });
            }
          }
        }
        else if (data.type === 'appointment_updated' || data.type === 'appointment_created') {
          console.log(`Atualizando dados após ${data.type}`);
          
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
          
          // Aciona todos os handlers de websocket registrados (DaySchedule, etc.)
          if (window.__WEBSOCKET_HANDLERS) {
            Object.keys(window.__WEBSOCKET_HANDLERS).forEach(key => {
              try {
                const handler = window.__WEBSOCKET_HANDLERS![key];
                if (typeof handler === 'function') {
                  handler({
                    data: JSON.stringify(data)
                  } as unknown as MessageEvent);
                }
              } catch (e) {
                console.error(`Erro ao chamar handler de websocket ${key}:`, e);
              }
            });
          }
          
          // Refetch para as notificações do usuário
          if (userId) {
            // Atualiza as notificações não lidas e todas as notificações
            queryClient.refetchQueries({
              queryKey: ['/api/notifications'],
              ...queryOptions
            });
            queryClient.refetchQueries({
              queryKey: ['/api/notifications/unread'],
              ...queryOptions
            });
          }
        }
        
        // Código de notificação já tratado acima
          
        // Força uma atualização da página do dashboard quando um novo agendamento é criado
        if (data.type === 'appointment_created') {
          // Verifica se estamos na página de dashboard
          const currentPath = window.location.pathname;
          if (currentPath === '/' || currentPath.includes('/dashboard')) {
            console.log('Detectado novo agendamento, atualizando a página do dashboard...');
            
            // Mostra uma notificação toast antes de atualizar
            try {
              // Se o toast já estiver disponível no escopo global, usamos ele
              if (window.__TOAST_TRIGGER) {
                window.__TOAST_TRIGGER({
                  title: 'Novo agendamento recebido!',
                  description: 'Atualizando dados da agenda...',
                });
              }
            } catch (e) {
              console.error('Erro ao mostrar toast:', e);
            }
            
            // Aguarda 1 segundo para que o toast seja exibido antes de atualizar
            setTimeout(() => {
              // Recarrega apenas os dados da agenda ao invés da página toda
              // Isso mantém o estado atual da interface mas atualiza os dados
              queryClient.refetchQueries({ queryKey: ['/api/my-appointments'] });
              
              // Atualiza a interface para refletir as mudanças
              window.dispatchEvent(new CustomEvent('appointment-created', { 
                detail: data.data 
              }));
            }, 1000);
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