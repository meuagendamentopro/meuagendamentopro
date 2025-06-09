import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook que detecta quando o usuário foi deslogado e redireciona automaticamente
 * para a página de autenticação. Funciona tanto para logout manual quanto para
 * sessões invalidadas.
 */
export function useLogoutDetector() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const previousUserRef = useRef(user);
  const hasShownLogoutToast = useRef(false);

  useEffect(() => {
    const currentPath = window.location.pathname;
    const isPublicRoute = currentPath === '/auth' || 
                         currentPath.startsWith('/booking') || 
                         currentPath.startsWith('/verify-email') ||
                         currentPath === '/renew-subscription';

    // Se estamos em uma rota pública, não fazer nada
    if (isPublicRoute) {
      previousUserRef.current = user;
      return;
    }

    // Se ainda está carregando, aguardar
    if (isLoading) {
      return;
    }

    // Detectar se o usuário foi deslogado
    const wasLoggedIn = previousUserRef.current !== null;
    const isLoggedIn = user !== null;
    
    if (wasLoggedIn && !isLoggedIn) {
      // Usuário foi deslogado
      console.log('Logout detectado, redirecionando para /auth');
      
      // Mostrar toast apenas uma vez
      if (!hasShownLogoutToast.current) {
        hasShownLogoutToast.current = true;
        toast({
          title: 'Sessão encerrada',
          description: 'Você foi desconectado. Redirecionando para o login...',
          variant: 'destructive',
          duration: 3000,
        });
      }
      
      // Redirecionar imediatamente
      navigate('/auth');
      
      // Reset do flag após o redirecionamento
      setTimeout(() => {
        hasShownLogoutToast.current = false;
      }, 1000);
    } else if (!wasLoggedIn && !isLoggedIn) {
      // Usuário nunca esteve logado, redirecionar silenciosamente
      console.log('Usuário não autenticado, redirecionando para /auth');
      navigate('/auth');
    }

    // Atualizar a referência do usuário anterior
    previousUserRef.current = user;
  }, [user, isLoading, navigate, toast]);
} 