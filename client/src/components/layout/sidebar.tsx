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

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const [location] = useLocation();

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
            {secondaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
              >
                <a
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                    item.active
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 flex-shrink-0 h-6 w-6",
                      item.active
                        ? "text-gray-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && <span>{item.name}</span>}
                </a>
              </Link>
            ))}
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
