import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Services from "@/pages/services";
import Appointments from "@/pages/appointments";
import Clients from "@/pages/clients";
import Booking from "@/pages/booking";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import FinancialReport from "@/pages/financial-report";
import AdminPage from "@/pages/admin-page";
import MainNav from "@/components/layout/main-nav";
import MobileNav from "@/components/layout/mobile-nav";
import UserAvatar from "@/components/layout/user-avatar";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";

function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  
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
      }
    }
  });
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* MAIN NAVIGATION */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-primary-600 text-xl font-bold">AgendaPro</span>
              </div>
              
              <MainNav />
            </div>
            
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <button 
                type="button" 
                className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <span className="sr-only">Ver notificações</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              </button>

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
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Rota pública para autenticação */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Rota pública para agendamento de clientes */}
      <Route path="/booking" component={Booking} />
      
      {/* Rotas protegidas que exigem autenticação */}
      <ProtectedRoute 
        path="/" 
        element={
          <MainLayout>
            <Dashboard />
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
        path="/admin" 
        element={
          <MainLayout>
            <AdminPage />
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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
