import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CheckCircle, Users, DollarSign } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import StatCard from "@/components/dashboard/stat-card";
import DaySchedule from "@/components/dashboard/day-schedule";
import AppointmentTable from "@/components/dashboard/appointment-table";
import ServicesList from "@/components/dashboard/services-list";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Appointment, AppointmentStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const Dashboard: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState({
    todayAppointments: 0,
    completedThisWeek: 0,
    newClientsThisMonth: 0,
    monthlyRevenue: 0,
  });
  
  // Fetch provider details for the logged in user
  const { data: myProvider, isLoading: providerLoading } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch('/api/my-provider');
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    }
  });
  
  // Fetch booking link for the logged in user
  const { data: bookingLinkData } = useQuery({
    queryKey: ['/api/my-booking-link'],
    queryFn: async () => {
      const res = await fetch('/api/my-booking-link');
      if (!res.ok) throw new Error('Failed to fetch booking link');
      return res.json();
    },
    enabled: !!myProvider // Only fetch if we have the provider
  });
  
  // Determinar Provider ID para as consultas subsequentes
  const providerId = myProvider?.id;

  // Fetch all appointments
  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useQuery({
    queryKey: ['/api/providers', providerId, 'appointments'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/appointments`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    },
    enabled: !!providerId // Só executar se temos providerId
  });

  // Fetch all clients
  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
    enabled: !!providerId // Só executar se temos providerId
  });

  // Fetch all services
  const { data: services } = useQuery({
    queryKey: ['/api/providers', providerId, 'services'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    enabled: !!providerId // Só executar se temos providerId
  });

  // Calculate dashboard stats
  useEffect(() => {
    if (appointments && clients && services) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Count today's appointments
      const todayAppts = appointments.filter((appt: Appointment) => {
        const apptDate = new Date(appt.date);
        apptDate.setHours(0, 0, 0, 0);
        return apptDate.getTime() === today.getTime();
      }).length;
      
      // Count completed appointments this week
      const completedWeek = appointments.filter((appt: Appointment) => {
        const apptDate = new Date(appt.date);
        return apptDate >= oneWeekAgo && appt.status === AppointmentStatus.COMPLETED;
      }).length;
      
      // Count new clients this month (based on createdAt of first appointment)
      // For demo purposes, we'll just count all clients since we don't have created dates
      const clientsThisMonth = clients.length;
      
      // Calculate monthly revenue (completed appointments * service price)
      let revenue = 0;
      appointments.forEach((appt: Appointment) => {
        const apptDate = new Date(appt.date);
        if (apptDate >= firstDayOfMonth && appt.status === AppointmentStatus.COMPLETED) {
          const service = services.find((s: any) => s.id === appt.serviceId);
          if (service) {
            revenue += service.price;
          }
        }
      });
      
      setStats({
        todayAppointments: todayAppts,
        completedThisWeek: completedWeek,
        newClientsThisMonth: clientsThisMonth,
        monthlyRevenue: revenue,
      });
    }
  }, [appointments, clients, services]);
  
  const handleAppointmentUpdated = () => {
    refetchAppointments();
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description="Visão geral de agendamentos e desempenho"
      />
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Agendamentos hoje" 
          value={stats.todayAppointments.toString()} 
          icon={Calendar} 
          color="primary"
        />
        <StatCard 
          title="Concluídos esta semana" 
          value={stats.completedThisWeek.toString()} 
          icon={CheckCircle} 
          color="success"
        />
        <StatCard 
          title="Novos clientes (mês)" 
          value={stats.newClientsThisMonth.toString()} 
          icon={Users} 
          color="warning"
        />
        <StatCard 
          title="Faturamento (mês)" 
          value={formatCurrency(stats.monthlyRevenue)} 
          icon={DollarSign} 
          color="gray"
        />
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Calendar */}
        <div className="lg:col-span-2 space-y-6">
          <DaySchedule providerId={providerId} />
          <AppointmentTable 
            providerId={providerId} 
            onAppointmentUpdated={handleAppointmentUpdated}
          />
        </div>
        
        {/* Right Column - Add Appointment, Services, Booking Link */}
        <div className="space-y-6">
          {/* Compartilhamento Card */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Compartilhe seu link de agendamento
              </h3>
              {bookingLinkData ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-3">Clientes podem agendar direto por este link:</p>
                  <div className="flex">
                    <Input 
                      type="text" 
                      readOnly 
                      value={bookingLinkData.fullUrl} 
                      className="flex-1 rounded-r-none bg-gray-100"
                    />
                    <Button 
                      variant="outline" 
                      className="rounded-l-none"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingLinkData.fullUrl);
                        toast({
                          title: "Link copiado!",
                          description: "Link de agendamento copiado para a área de transferência.",
                        });
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </Button>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Seu link personalizado:</span> {myProvider?.bookingLink || "Não configurado"}
                    </p>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <Button size="sm" className="bg-[#25D366] hover:bg-[#20bd5a]" onClick={() => {
                      const url = `https://wa.me/?text=${encodeURIComponent(`Faça seu agendamento online: ${bookingLinkData.fullUrl}`)}`;
                      window.open(url, '_blank');
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle mr-1"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                      WhatsApp
                    </Button>
                    <Button size="sm" variant="outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-qr-code mr-1"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
                      QR Code
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin">
                    <Calendar className="h-6 w-6 text-primary-500" />
                  </div>
                  <span className="ml-2 text-sm text-gray-500">Carregando seu link...</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Services Card */}
          <ServicesList providerId={providerId} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
