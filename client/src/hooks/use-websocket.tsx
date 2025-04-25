import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { queryClient } from '@/lib/queryClient';

type WebSocketProps = {
  onMessage?: (data: any) => void;
};

export const useWebSocket = ({ onMessage }: WebSocketProps = {}) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Função para estabelecer a conexão WebSocket com retry exponencial
  const connect = useCallback(() => {
    try {
      setError(null);
      // Determina o protocolo correto baseado na conexão atual
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Conectando ao WebSocket: ${wsUrl}`);
      const newSocket = new WebSocket(wsUrl);
      
      // Variáveis para controle de reconexão
      let retryCount = 0;
      const maxRetry = 10;
      const baseRetryDelay = 1000; // 1 segundo
      const maxRetryDelay = 30000; // 30 segundos
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      
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
        
        if (retryCount < maxRetry) {
          const delay = getRetryDelay();
          console.log(`Tentando reconexão WebSocket em ${Math.round(delay/1000)}s (tentativa ${retryCount + 1} de ${maxRetry})`);
          
          reconnectTimer = setTimeout(() => {
            retryCount++;
            connect();
          }, delay);
        } else {
          console.error('Número máximo de tentativas de reconexão WebSocket atingido');
          setError('Não foi possível estabelecer conexão em tempo real. Atualizações podem estar atrasadas.');
        }
      };
      
      newSocket.onopen = () => {
        console.log('Conexão WebSocket estabelecida!');
        setConnected(true);
        retryCount = 0; // Reinicia contador de tentativas quando conecta
        
        // Identifica o usuário atual se estiver autenticado
        if (user) {
          try {
            const identifyMsg = JSON.stringify({
              type: 'identify',
              userId: user.id
            });
            newSocket.send(identifyMsg);
            console.log(`Usuário ${user.id} identificado no WebSocket`);
          } catch (err) {
            console.error('Erro ao enviar identificação do usuário:', err);
          }
        }
      };
      
      newSocket.onclose = (event) => {
        console.log(`Conexão WebSocket fechada: Código ${event.code}, Limpo: ${event.wasClean}`);
        setConnected(false);
        
        // Não tentar reconectar se o fechamento foi limpo/intencional
        if (!event.wasClean && navigator.onLine) {
          reconnect();
        }
      };
      
      newSocket.onerror = (event) => {
        console.error('Erro na conexão WebSocket:', event);
        setError('Falha na conexão em tempo real');
      };
      
      // Adicionar ping para manter conexão ativa
      const pingInterval = setInterval(() => {
        if (newSocket.readyState === WebSocket.OPEN) {
          try {
            newSocket.send(JSON.stringify({ type: 'ping' }));
          } catch (err) {
            console.error('Erro ao enviar ping WebSocket:', err);
          }
        }
      }, 30000); // 30 segundos
      
      // Limpar temporizadores quando o hook é desmontado
      return () => {
        clearInterval(pingInterval);
        clearReconnectTimer();
        
        if (newSocket) {
          // Tenta fechar de forma limpa
          try {
            if (newSocket.readyState === WebSocket.OPEN) {
              newSocket.close(1000, "Fechamento normal");
            }
          } catch (err) {
            console.error('Erro ao fechar WebSocket:', err);
          }
        }
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensagem WebSocket recebida:', data);
          
          // Processa atualizações específicas
          if (data.type === 'appointment_updated' || data.type === 'appointment_created') {
            console.log(`Atualizando dados após ${data.type}`);
            
            // Invalida a consulta para atualizar a lista de agendamentos
            queryClient.invalidateQueries({
              queryKey: ['/api/providers', data.data.providerId, 'appointments']
            });
            
            // Invalida a consulta my-appointments (dashboard do profissional)
            queryClient.invalidateQueries({
              queryKey: ['/api/my-appointments']
            });
            
            // Invalidar a consulta específica do agendamento
            queryClient.invalidateQueries({
              queryKey: ['/api/appointments', data.data.id]
            });
            
            // Invalidar as notificações do usuário
            if (user) {
              queryClient.invalidateQueries({
                queryKey: ['/api/users', user.id, 'notifications']
              });
            }
          }
          
          // Passa a mensagem para o handler externo se fornecido
          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
        }
      };
      
      setSocket(newSocket);
    } catch (err) {
      console.error('Erro ao criar conexão WebSocket:', err);
      setError('Falha ao iniciar conexão em tempo real');
      return undefined;
    }
  }, [user, onMessage]);
  
  // Estabelece a conexão quando o hook é montado
  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connect]);
  
  return {
    socket,
    connected,
    error
  };
};