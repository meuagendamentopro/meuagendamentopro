import React, { useState, useEffect, Suspense } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Services from "@/pages/services";
import Appointments from "@/pages/appointments";
import Clients from "@/pages/clients";
import Booking from "@/pages/booking";
import AppointmentLookup from "@/pages/appointment-lookup";
import RescheduleAppointment from "@/pages/reschedule-appointment";
import Settings from "@/pages/settings";
import ProfilePage from "@/pages/profile-page";
import AuthPage from "@/pages/auth-page";
import EmailVerificationPage from "@/pages/email-verification-page";
import FinancialReport from "@/pages/financial-report";
import AdminPage from "@/pages/admin-page";
import UsersPage from "@/pages/admin/users-page";
import DatabasePage from "@/pages/admin/database-page";
import RenewSubscriptionPage from "@/pages/renew-subscription";
import SubscriptionHistoryPage from "@/pages/subscription-history";
import LandingPage from "@/pages/landing-page";
import TeamPage from "@/pages/team-page";
import { MaintenancePage } from "@/components/maintenance/maintenance-page";
import AdminLoginPage from "@/pages/admin-login-page";
import { MaintenanceProvider, useMaintenance } from "@/contexts/maintenance-context";
import MainNav from "@/components/layout/main-nav";
import MobileNav from "@/components/layout/mobile-nav";
import UserAvatar from "@/components/layout/user-avatar";
import WhatsAppPopup from "@/components/whatsapp-popup";
import { useNotifications } from "@/hooks/use-notifications";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AuthProvider } from "@/hooks/use-auth";
import { SessionCheckProvider } from "@/components/session-check-provider";
import { ProtectedRoute, AdminRoute } from "@/lib/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useLogoutDetector } from "@/hooks/use-logout-detector";
import { ImpersonationProvider } from "@/hooks/use-impersonation";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

// Estender a interface Window para incluir nossa propriedade global
declare global {
  interface Window {
    __SESSION_INVALIDATED_LOGGED?: boolean;
  }
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { unreadNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  
  // Consulta para buscar as configurações do sistema
  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Erro ao buscar configurações do sistema');
      }
      const data = await response.json();
      return data;
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
    refetchOnWindowFocus: true, // Atualizar quando a janela ganhar foco
  });
  
  // Verificar pagamentos pendentes quando o usuário estiver logado
  const { data: pendingPaymentsCheck, refetch: checkPendingPayments } = useQuery({
    queryKey: ['pendingPaymentsCheck'],
    queryFn: async () => {
      const response = await fetch('/api/subscription/check-pending-payments');
      if (!response.ok) {
        if (response.status === 401) {
          // Não é um erro, apenas não está autenticado
          return { checked: 0, updated: 0, confirmed: 0 };
        }
        throw new Error('Erro ao verificar pagamentos pendentes');
      }
      return await response.json();
    },
    enabled: !!user, // Só executa se o usuário estiver logado
    refetchOnMount: true, // Verifica quando o componente é montado
    refetchOnWindowFocus: true, // Verifica quando a janela ganha foco
    refetchInterval: 60000, // Verifica a cada 1 minuto
  });
  
  // Efeito para mostrar notificação quando pagamentos forem confirmados
  useEffect(() => {
    if (pendingPaymentsCheck?.confirmed > 0) {
      toast({
        title: "Pagamento confirmado",
        description: `${pendingPaymentsCheck.confirmed} pagamento(s) foi(foram) confirmado(s) com sucesso.`,
        variant: "default",
      });
      
      // Forçar atualização dos dados do usuário
      queryClient.invalidateQueries({ queryKey: ['user'] });
      
      // Forçar atualização do histórico de assinaturas
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/history'] });
    }
  }, [pendingPaymentsCheck, toast]);
  
  // Integra o WebSocket para atualizações em tempo real
  const { connected, error } = useWebSocket({
    onMessage: (data) => {
      // Exibe uma notificação quando um agendamento for atualizado
      if (data.type === 'appointment_updated') {
        const appointment = data.data;
        
        let title = "Agendamento atualizado";
        let description = `O agendamento #${appointment.id} foi atualizado.`;
        
        if (appointment.status === 'confirmed') {
          title = "Agendamento confirmado";
          description = `O agendamento #${appointment.id} foi confirmado.`;
        } else if (appointment.status === 'cancelled') {
          title = "Agendamento cancelado";
          description = `O agendamento #${appointment.id} foi cancelado.`;
        } else if (appointment.status === 'completed') {
          title = "Agendamento concluído";
          description = `O agendamento #${appointment.id} foi marcado como concluído.`;
        }
        
        toast({
          title,
          description,
          variant: appointment.status === 'cancelled' ? "destructive" : "default",
        });
      } else if (data.type === 'appointment_created') {
        const appointment = data.data;
        
        // Exibe uma notificação quando um novo agendamento for criado
        toast({
          title: "Novo agendamento recebido!",
          description: `Um novo agendamento foi criado para o dia ${new Date(appointment.date).toLocaleDateString()}.`,
        });
      }
    }
  });
  
  // Registra o toast como um gatilho global para permitir que outros componentes o utilizem
  useEffect(() => {
    window.__TOAST_TRIGGER = toast;
    return () => {
      window.__TOAST_TRIGGER = undefined;
    };
  }, [toast]);
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Estado para controlar a visibilidade do menu na rolagem
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  
  // Efeito para controlar a visibilidade do menu na rolagem
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      
      // Determina se o usuário está rolando para cima ou para baixo
      const isScrollingUp = prevScrollPos > currentScrollPos;
      
      // Adiciona um pequeno limiar para evitar oscilações em pequenas rolagens
      const scrollThreshold = 10;
      const hasScrolledEnough = Math.abs(prevScrollPos - currentScrollPos) > scrollThreshold;
      
      // Atualiza a visibilidade com base na direção da rolagem
      if (hasScrolledEnough) {
        setVisible(isScrollingUp);
      }
      
      // Define se a página foi rolada para aplicar estilos diferentes
      setScrolled(currentScrollPos > 20);
      
      // Atualiza a posição de rolagem anterior
      setPrevScrollPos(currentScrollPos);
    };
    
    // Adiciona o evento de rolagem
    window.addEventListener('scroll', handleScroll);
    
    // Remove o evento ao desmontar o componente
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [prevScrollPos]);
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* WhatsApp Popup */}
      {user && <WhatsAppPopup />}
      
      {/* MAIN NAVIGATION */}
      <nav 
        className={`bg-white ${scrolled ? 'shadow-md' : 'shadow-sm'} transition-all duration-300 ease-in-out ${visible ? 'sticky top-0 z-50 translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}
        style={{ position: 'sticky', top: 0, zIndex: 50 }}
      >
        <div className="max-w-[95%] xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                {systemSettings?.logoUrl ? (
                  <img 
                    src={`${systemSettings.logoUrl}?t=${new Date().getTime()}`} 
                    alt="Logo" 
                    className="h-16 object-contain max-w-[600px]"
                    onError={(e) => {
                      console.error('Erro ao carregar logo no topo:', systemSettings.logoUrl);
                      const target = e.target as HTMLImageElement;
                      target.onerror = null; // Prevenir loop infinito
                      target.style.display = 'none';
                      // Mostrar texto alternativo
                      const parent = target.parentElement;
                      if (parent) {
                        const span = document.createElement('span');
                        span.className = 'text-primary-600 text-xl font-bold';
                        span.textContent = 'Meu Agendamento PRO';
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span className="text-primary-600 text-xl font-bold">Meu Agendamento PRO</span>
                )}
              </div>
              
              <MainNav />
            </div>
            
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {/* Popover para notificações */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <span className="sr-only">Ver notificações</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                    </svg>
                    
                    {/* Contador de notificações */}
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] sm:w-[320px] md:w-[360px] p-0 rounded-lg border bg-white shadow-xl" align="end" sideOffset={5}>
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                          </svg>
                          Notificações
                          {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </h3>
                      </div>
                      
                      {unreadCount > 0 && (
                        <div className="w-full">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={markAllAsRead}
                            className="w-full text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-100 transition-colors"
                          >
                            Marcar todas como lidas
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-[350px] w-full">
                    {unreadNotifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                        <div className="bg-gray-50 p-4 rounded-full mb-3">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="24" 
                            height="24" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="h-10 w-10 text-gray-400"
                          >
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Não há notificações não lidas</p>
                        <p className="text-xs text-gray-400 mt-1">As novas notificações aparecerão aqui</p>
                      </div>
                    ) : (
                      <div>
                        {unreadNotifications.map((notification) => {
                          // Determinar o tipo de notificação e definir cores e ícones
                          let bgColor = "bg-gray-50";
                          let iconColor = "text-gray-500";
                          let icon = (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                            </svg>
                          );
                          
                          if (notification.title.includes("Novo")) {
                            bgColor = "bg-blue-50";
                            iconColor = "text-blue-600";
                            icon = (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 8v8"/>
                                <path d="M8 12h8"/>
                              </svg>
                            );
                          } else if (notification.title.includes("confirmado")) {
                            bgColor = "bg-green-50";
                            iconColor = "text-green-600";
                            icon = (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                              </svg>
                            );
                          } else if (notification.title.includes("cancelado")) {
                            bgColor = "bg-red-50";
                            iconColor = "text-red-600";
                            icon = (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                              </svg>
                            );
                          }
                          
                          return (
                            <div 
                              key={notification.id}
                              className={`p-4 border-b border-gray-100 hover:bg-opacity-80 cursor-pointer transition-all ${bgColor}`}
                              onClick={() => markAsRead(notification.id)}
                            >
                              <div className="flex items-start gap-2 w-full overflow-hidden">
                                <div className={`mt-1 ${iconColor}`}>
                                  {icon}
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-col w-full overflow-hidden">
                                    <div className="flex flex-col w-full">
                                      <div className="flex justify-between items-center w-full">
                                        <h4 className="text-sm font-semibold text-gray-800 truncate max-w-[70%]">
                                          {notification.title}
                                        </h4>
                                        <span className="text-xs text-gray-500 flex-shrink-0 font-medium">
                                          {format(new Date(notification.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-600 mt-1 break-words line-clamp-2">{notification.message}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="p-2 border-t border-gray-100 bg-gray-50">
                    <PopoverClose asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="w-full text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 flex items-center justify-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        Fechar
                      </Button>
                    </PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>

              {user && (
                <div className="flex items-center space-x-2">
                  <UserAvatar 
                    name={user.name}
                    email={user.username}
                    imageUrl={user.avatarUrl || undefined}
                  />
                  <button
                    onClick={handleLogout}
                    className="ml-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                    disabled={logoutMutation.isPending}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
            
            <MobileNav />
          </div>
        </div>
      </nav>

      {/* PAGE CONTENT CONTAINER */}
      <main className="flex-1 max-w-[95%] xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner de simulação */}
        <ImpersonationBanner />
        {children}
      </main>
      
      {/* Footer com direitos reservados */}
      <footer className="w-full py-4 bg-gray-100 border-t mt-auto">
        <div className="max-w-[95%] xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Meu Agendamento PRO - Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}

function Router() {
  // Hook para detectar logout e redirecionar automaticamente
  useLogoutDetector();
  
  const { isMaintenance, isLoading } = useMaintenance();
  const [location] = useLocation();
  
  // Rotas que são acessíveis mesmo em modo de manutenção
  const allowedInMaintenance = [
    '/',
    '/auth',
    '/verify-email',
    '/maintenance', // Adiciona a rota de manutenção explicitamente
    '/admin-login' // Rota especial para login de administradores durante manutenção
  ];
  
  // Verifica se a rota atual está na lista de rotas permitidas
  const isAllowedInMaintenance = allowedInMaintenance.some(route => 
    location === route || location.startsWith(`${route}/`)
  );

  // Se estiver carregando, mostra um loader
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Se estiver em manutenção e a rota não estiver na lista de permitidas, redireciona para a página de manutenção
  if (isMaintenance && !isAllowedInMaintenance) {
    // Se já estiver na página de manutenção, não faz nada
    if (location === '/maintenance') {
      return <MaintenancePage />;
    }
    // Redireciona para a página de manutenção
    return <Redirect to="/maintenance" />;
  }

  return (
    <Switch>
      {/* Página inicial pública (landing page) */}
      <Route path="/" component={LandingPage} />
      
      {/* Rotas públicas para autenticação */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/verify-email/:token" component={EmailVerificationPage} />
      <Route path="/maintenance" component={MaintenancePage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      
      {/* Rota para renovação de assinatura */}
      <Route path="/renew-subscription" component={RenewSubscriptionPage} />
      
      {/* Rotas públicas para agendamento de clientes (ambos formatos) */}
      <Route path="/booking" component={Booking} />
      <Route path="/booking/:linkId" component={Booking} />
      
      {/* Rotas públicas para consulta e reagendamento */}
      <Route path="/appointment-lookup" component={AppointmentLookup} />
      <Route path="/reschedule-appointment/:id" component={RescheduleAppointment} />
      
      {/* Rotas protegidas que exigem autenticação */}
      <ProtectedRoute 
        path="/dashboard" 
        element={
          <MainLayout>
            <Dashboard />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/profile" 
        element={
          <MainLayout>
            <ProfilePage />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/services" 
        element={
          <MainLayout>
            <Services />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/appointments" 
        element={
          <MainLayout>
            <Appointments />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/clients" 
        element={
          <MainLayout>
            <Clients />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/settings" 
        element={
          <MainLayout>
            <Settings />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/financial" 
        element={
          <MainLayout>
            <FinancialReport />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/team" 
        element={
          <MainLayout>
            <TeamPage />
          </MainLayout>
        } 
      />
      
      <ProtectedRoute 
        path="/subscription-history" 
        element={
          <MainLayout>
            <SubscriptionHistoryPage />
          </MainLayout>
        } 
      />
      
      <AdminRoute 
        path="/admin" 
        element={
          <MainLayout>
            <AdminPage />
          </MainLayout>
        } 
      />
      
      <AdminRoute 
        path="/admin/users" 
        element={
          <MainLayout>
            <UsersPage />
          </MainLayout>
        } 
      />
      
      <AdminRoute 
        path="/admin/database" 
        element={
          <MainLayout>
            <DatabasePage />
          </MainLayout>
        } 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ImpersonationProvider>
            {/* Componente que verifica a validade da sessão periodicamente */}
            <SessionCheckWithAuth />
            <MaintenanceProvider>
              <SessionInvalidatedHandler />
              <Router />
              <Toaster />
            </MaintenanceProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Componente que conecta o SessionCheckProvider com o contexto de autenticação
function SessionCheckWithAuth() {
  const { user } = useAuth();
  return <SessionCheckProvider isLoggedIn={!!user}>{null}</SessionCheckProvider>;
}

// Componente para lidar com a invalidação de sessão
function SessionInvalidatedHandler() {
  const { logoutMutation, user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Interceptar todas as respostas de fetch para detectar sessão invalidada
  useEffect(() => {
    if (!user) return;
    
    // Interceptar o fetch original
    const originalFetch = window.fetch;
    
    window.fetch = async function(input, init) {
      try {
        // Ignorar requisições para recursos estáticos e verificações de sessão
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input instanceof Request ? input.url : '';
        
        // Ignorar recursos estáticos e evitar loops infinitos com a verificação de sessão
        const skipInterception = 
          url.includes('/api/session/check') || 
          url.endsWith('.png') || 
          url.endsWith('.jpg') || 
          url.endsWith('.svg') || 
          url.endsWith('.css') || 
          url.endsWith('.js') || 
          url.endsWith('.ico');
        
        if (skipInterception) {
          return originalFetch(input, init);
        }
        
        // Fazer a requisição original
        const response = await originalFetch(input, init);
        
        // Se for uma resposta 401, verificar se é por sessão invalidada
        if (response.status === 401) {
          try {
            // Clonar a resposta para não consumir o corpo original
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            
            if (data.code === 'SESSION_INVALIDATED') {
              // Evitar logs excessivos no console
              if (!window.__SESSION_INVALIDATED_LOGGED) {
                console.log('Sessão invalidada detectada em resposta HTTP:', data);
                window.__SESSION_INVALIDATED_LOGGED = true;
                
                // Resetar o flag após 5 segundos
                setTimeout(() => {
                  window.__SESSION_INVALIDATED_LOGGED = false;
                }, 5000);
              }
              
              // Disparar o evento de sessão invalidada
              const event = new CustomEvent('sessionInvalidated', { 
                detail: { message: data.message } 
              });
              window.dispatchEvent(event);
            }
          } catch (e) {
            // Ignorar erros ao tentar ler o JSON
          }
        }
        
        return response;
      } catch (error) {
        // Evitar logar erros de abortamento de requisições (comuns e esperados)
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Silenciar erros de abortamento
        } else {
          console.error('Erro na requisição fetch interceptada:', error);
        }
        throw error;
      }
    };
    
    // Verificar a sessão imediatamente e periodicamente
    const checkSession = async () => {
      // Verificar se o usuário ainda está logado antes de fazer a verificação
      if (!user) return;
      
      // Verificar se já foi detectada uma sessão invalidada
      if (window.__SESSION_INVALIDATED_LOGGED) return;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Timeout de 3 segundos
        
        const response = await originalFetch('/api/session/check', {
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          try {
            const data = await response.json();
            if (data.code === 'SESSION_INVALIDATED') {
              // Evitar logs excessivos
              if (!window.__SESSION_INVALIDATED_LOGGED) {
                console.log('Sessão invalidada detectada na verificação periódica:', data);
                window.__SESSION_INVALIDATED_LOGGED = true;
              }
              
              // Disparar o evento de sessão invalidada
              const event = new CustomEvent('sessionInvalidated', { 
                detail: { message: data.message } 
              });
              window.dispatchEvent(event);
            }
          } catch (e) {
            // Ignorar erros ao tentar ler o JSON
          }
        }
      } catch (error) {
        // Ignorar erros de abortamento (timeout)
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Silenciar erros de timeout
        } else {
          console.error('Erro ao verificar sessão:', error);
        }
      }
    };
    
    // Verificar a sessão imediatamente
    checkSession();
    
    // Configurar verificador periódico (a cada 60 segundos - reduzido para diminuir carga)
    const intervalId = setInterval(checkSession, 60000);
    
    // Restaurar o fetch original e limpar o intervalo quando o componente for desmontado
    return () => {
      window.fetch = originalFetch;
      clearInterval(intervalId);
    };
  }, [user]);
  
  // Listener para o evento de sessão invalidada
  useEffect(() => {
    // Função para lidar com o evento de sessão invalidada
    const handleSessionInvalidated = (event: CustomEvent<{ message: string }>) => {
      console.log('Evento de sessão invalidada recebido:', event.detail);
      
      // Atualizar o estado da aplicação para refletir que o usuário está deslogado
      queryClient.setQueryData(["/api/user"], null);
      
      // Redirecionar IMEDIATAMENTE (prioridade máxima)
      navigate('/auth');
      
      // Mostrar toast após o redirecionamento
      toast({
        title: "Sessão encerrada",
        description: event.detail.message,
        variant: "destructive",
        duration: 3000,
      });
      
      // Fazer logout em background (sem aguardar)
        fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
      }).catch(() => {
        // Ignorar erros, pois já redirecionamos
        console.log('Logout em background falhou, mas usuário já foi redirecionado');
      });
    };
    
    // Adicionar o listener para o evento personalizado
    window.addEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);
    
    // Remover o listener quando o componente for desmontado
    return () => {
      window.removeEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);
    };
  }, [logoutMutation, navigate, toast]);
  
  return null;
}

export default App;
