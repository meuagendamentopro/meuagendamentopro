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

  // Função para estabelecer a conexão WebSocket
  const connect = useCallback(() => {
    try {
      setError(null);
      // Determina o protocolo correto baseado na conexão atual
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Conectando ao WebSocket: ${wsUrl}`);
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        console.log('Conexão WebSocket estabelecida!');
        setConnected(true);
        
        // Identifica o usuário atual se estiver autenticado
        if (user) {
          const identifyMsg = JSON.stringify({
            type: 'identify',
            userId: user.id
          });
          newSocket.send(identifyMsg);
          console.log(`Usuário ${user.id} identificado no WebSocket`);
        }
      };
      
      newSocket.onclose = () => {
        console.log('Conexão WebSocket fechada');
        setConnected(false);
        
        // Tenta reconectar após um intervalo
        setTimeout(() => {
          if (newSocket.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 5000);
      };
      
      newSocket.onerror = (event) => {
        console.error('Erro na conexão WebSocket:', event);
        setError('Falha na conexão em tempo real');
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensagem WebSocket recebida:', data);
          
          // Processa atualizações específicas
          if (data.type === 'appointment_updated') {
            // Invalida a consulta para atualizar a lista de agendamentos
            queryClient.invalidateQueries({
              queryKey: ['/api/providers', data.data.providerId, 'appointments']
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
      
      // Limpa a conexão quando o componente é desmontado
      return () => {
        newSocket.close();
      };
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