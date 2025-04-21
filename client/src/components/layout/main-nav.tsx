import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const MainNav: React.FC = () => {
  const [location] = useLocation();

  const navItems = [
    { href: "/", name: "Dashboard", active: location === "/" },
    { href: "/appointments", name: "Agendamentos", active: location === "/appointments" },
    { href: "/clients", name: "Clientes", active: location === "/clients" },
    { href: "/services", name: "Serviços", active: location === "/services" },
    { href: "/settings", name: "Configurações", active: location === "/settings" },
  ];

  return (
    <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            item.active
              ? "border-primary-500 text-gray-900"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
            "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
          )}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
};

export default MainNav;
