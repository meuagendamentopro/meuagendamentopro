import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  LayoutDashboard,
  Settings,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  FileText,
  CreditCard,
  Menu,
  X,
  Upload,
  Image,
  Scissors,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const [location] = useLocation();
  const { unreadCount, unreadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Consulta para buscar as configurações do sistema
  const { data: systemSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Erro ao buscar configurações do sistema');
      }
      const data = await response.json();
      console.log('Configurações do sistema carregadas:', data);
      return data;
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
    refetchOnWindowFocus: true, // Atualizar quando a janela ganhar foco
  });
  
  // Mutation para fazer upload do logo
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/system-settings/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload do logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Logo atualizado com sucesso!",
      });
      setIsLogoDialogOpen(false);
      refetchSettings();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Função para lidar com a seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Criar URL para preview
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
    }
  };
  
  // Função para fazer upload do logo
  const handleLogoUpload = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };
  
  // Limpar URLs de objeto ao fechar o diálogo
  useEffect(() => {
    if (!isLogoDialogOpen && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setLogoFile(null);
    }
  }, [isLogoDialogOpen, previewUrl]);
  
  // Verificar se o usuário é administrador
  const isAdmin = user?.role === 'admin';
  
  // Função para lidar com o clique na notificação
  const handleNotificationClick = (notification: any) => {
    // Marcar a notificação como lida
    markAsRead(notification.id);
  };

  const navItems = [
    {
      href: "/",
      name: "Dashboard",
      icon: LayoutDashboard,
      active: location === "/",
    },
    {
      href: "/appointments",
      name: "Agendamentos",
      icon: Calendar,
      active: location === "/appointments",
    },
    {
      href: "/clients",
      name: "Clientes",
      icon: Users,
      active: location === "/clients",
    },
    {
      href: "/services",
      name: "Serviços",
      icon: Scissors,
      active: location === "/services",
    },
  ];

  const secondaryNavItems = [
    {
      href: "/notifications",
      name: "Notificações",
      icon: Bell,
      active: location === "/notifications",
    },
    {
      href: "/messages",
      name: "Mensagens",
      icon: MessageSquare,
      active: location === "/messages",
    },
    {
      href: "/settings",
      name: "Configurações",
      icon: Settings,
      active: location === "/settings",
    },
    {
      href: "/subscription-history",
      name: "Histórico de Assinaturas",
      icon: Calendar,
      active: location === "/subscription-history",
    },
  ];

  return (
    <div className={cn("h-full flex flex-col bg-white border-r border-gray-200", 
      collapsed ? "w-[70px]" : "w-[250px]")}>
      <div className="p-4 flex items-center justify-between">
        {systemSettings?.logoUrl ? (
          <div className="flex items-center">
            <img 
              src={`${systemSettings.logoUrl}?t=${new Date().getTime()}`} 
              alt="Logo" 
              className={cn(
                "h-16 object-contain", 
                collapsed ? "max-w-[80px]" : "max-w-[480px]"
              )}
              onError={(e) => {
                console.error('Erro ao carregar logo na sidebar:', systemSettings.logoUrl);
                const target = e.target as HTMLImageElement;
                target.onerror = null; // Prevenir loop infinito
              }}
            />
          </div>
        ) : (
          <div className="flex items-center">
            <span className={cn("text-primary-600 text-xl font-bold", 
              collapsed ? "hidden" : "block")}>
              Meu Agendamento PRO
            </span>
            {collapsed && <span className="text-primary-600 text-xl font-bold">M</span>}
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-2 flex items-center" 
          onClick={() => setIsLogoDialogOpen(true)}
        >
          <Image className="h-4 w-4 mr-2" />
          <span>Logo</span>
        </Button>
      </div>
      <div className="px-2 flex-1 overflow-auto">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
            >
              <a
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                  item.active
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 flex-shrink-0 h-6 w-6",
                    item.active
                      ? "text-primary-600"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}
                  aria-hidden="true"
                />
                {!collapsed && <span>{item.name}</span>}
              </a>
            </Link>
          ))}
        </nav>

        <div className="mt-10">
          <p className={cn("px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider",
            collapsed ? "hidden" : "block")}>
            Configurações
          </p>
          <nav className="mt-2 space-y-1">
            {/* Notificações com contador */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer w-full text-left",
                    location === "/notifications"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <div className="relative">
                    <Bell
                      className={cn(
                        "mr-3 flex-shrink-0 h-6 w-6",
                        location === "/notifications"
                          ? "text-gray-500"
                          : "text-gray-400 group-hover:text-gray-500"
                      )}
                      aria-hidden="true"
                    />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && <span>Notificações</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 rounded-md border bg-popover shadow-md" align="start">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-800">Notificações</h3>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs hover:bg-gray-200 transition-colors"
                      onClick={() => markAllAsRead()}
                    >
                      Marcar todas como lidas
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[300px]">
                  {unreadNotifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 flex flex-col items-center">
                      <Bell className="h-10 w-10 text-gray-300 mb-2" />
                      <p>Nenhuma notificação não lida</p>
                    </div>
                  ) : (
                    <div>
                      {unreadNotifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                              {notification.title.includes("Novo") && (
                                <span className="h-2 w-2 rounded-full bg-blue-500 inline-block"></span>
                              )}
                              {notification.title.includes("confirmado") && (
                                <span className="h-2 w-2 rounded-full bg-green-500 inline-block"></span>
                              )}
                              {notification.title.includes("cancelado") && (
                                <span className="h-2 w-2 rounded-full bg-red-500 inline-block"></span>
                              )}
                              {notification.title}
                            </h4>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                              {new Date(notification.createdAt).toLocaleDateString('pt-BR')} às {new Date(notification.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1.5">{notification.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Configurações */}
            <Link href="/settings">
              <a
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                  location === "/settings"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Settings
                  className={cn(
                    "mr-3 flex-shrink-0 h-6 w-6",
                    location === "/settings"
                      ? "text-gray-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}
                  aria-hidden="true"
                />
                {!collapsed && <span>Configurações</span>}
              </a>
            </Link>
          </nav>
        </div>
      </div>
      
      <div className="p-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full flex items-center justify-center"
          onClick={() => window.open("/booking", "_blank")}
        >
          <Calendar className="h-4 w-4 mr-2" />
          {!collapsed && <span>Link de Agendamento</span>}
        </Button>
      </div>
      
      {/* Diálogo para upload de logo */}
      <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Logo</DialogTitle>
            <DialogDescription>
              Faça upload de uma nova imagem para ser usada como logo do sistema.
              Formatos suportados: JPEG, PNG, GIF, SVG e WebP.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center gap-4">
              {previewUrl && (
                <div className="border rounded p-2 flex justify-center">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="h-16 object-contain" 
                  />
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <label 
                  htmlFor="logo-upload" 
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar arquivo
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleLogoUpload} 
              disabled={!logoFile || uploadLogoMutation.isPending}
            >
              {uploadLogoMutation.isPending ? "Enviando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sidebar;
