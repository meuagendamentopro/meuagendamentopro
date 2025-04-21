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
import MainNav from "@/components/layout/main-nav";
import MobileNav from "@/components/layout/mobile-nav";
import UserAvatar from "@/components/layout/user-avatar";

function MainLayout({ children }: { children: React.ReactNode }) {
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

              <UserAvatar 
                name="Carlos Silva" 
                email="carlos@example.com" 
                imageUrl="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
              />
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
      <Route path="/booking" component={Booking} />
      
      <Route path="/">
        <MainLayout>
          <Dashboard />
        </MainLayout>
      </Route>
      
      <Route path="/services">
        <MainLayout>
          <Services />
        </MainLayout>
      </Route>
      
      <Route path="/appointments">
        <MainLayout>
          <Appointments />
        </MainLayout>
      </Route>
      
      <Route path="/clients">
        <MainLayout>
          <Clients />
        </MainLayout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
