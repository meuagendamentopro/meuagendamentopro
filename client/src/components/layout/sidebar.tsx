import React from "react";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  Users,
  Scissors,
  LayoutDashboard,
  Settings,
  Bell,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  const { unreadNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

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
  ];

  return (
    <div className={cn("h-full flex flex-col bg-white border-r border-gray-200", 
      collapsed ? "w-[70px]" : "w-[250px]")}>
      <div className="p-4 flex items-center">
        <span className={cn("text-primary-600 text-xl font-bold", 
          collapsed ? "hidden" : "block")}>
          AgendaPro
        </span>
        {collapsed && <span className="text-primary-600 text-xl font-bold">A</span>}
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
                <div
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
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
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-medium">Notificações</h3>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => markAllAsRead()}
                    >
                      Marcar todas como lidas
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[300px]">
                  {unreadNotifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Nenhuma notificação não lida
                    </div>
                  ) : (
                    <div className="divide-y">
                      {unreadNotifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className="p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex justify-between">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            <span className="text-xs text-gray-500">
                              {format(new Date(notification.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
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
    </div>
  );
};

export default Sidebar;
