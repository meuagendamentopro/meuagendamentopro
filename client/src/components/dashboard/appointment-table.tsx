import React, { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/dates";
import { getColorForStatus, getStatusTranslation } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { formatPhoneNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { AppointmentStatus } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageCircle } from "lucide-react";
import { AppointmentDetails } from "./appointment-details";

interface AppointmentTableProps {
  providerId: number;
  limit?: number;
  showTitle?: boolean;
  onAppointmentUpdated?: () => void;
}

const AppointmentTable: React.FC<AppointmentTableProps> = ({ 
  providerId, 
  limit = 5, 
  showTitle = true,
  onAppointmentUpdated
}) => {
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const { data: appointments, isLoading: appointmentsLoading, refetch } = useQuery({
    queryKey: ['/api/my-appointments'],
    queryFn: async () => {
      const res = await fetch('/api/my-appointments');
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    }
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    }
  });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch('/api/my-services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  // Fetch user details to check account type 
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('Failed to fetch user data');
      return res.json();
    }
  });

  // Get employees for company accounts
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
    enabled: currentUser?.accountType === 'company' // Only fetch if account is company type
  });

  const handleCancelAppointment = async (id: number, reason: string) => {
    try {
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason
      });
      refetch();
      if (onAppointmentUpdated) {
        onAppointmentUpdated();
      }
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleConfirmAppointment = async (id: number) => {
    try {
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CONFIRMED 
      });
      refetch();
      if (onAppointmentUpdated) {
        onAppointmentUpdated();
      }
    } catch (error) {
      console.error('Failed to confirm appointment:', error);
    }
  };

  const isLoading = appointmentsLoading || clientsLoading || servicesLoading || (currentUser?.accountType === 'company' && employeesLoading);

  const getClientName = (clientId: number) => {
    const client = clients?.find((c: { id: number; name: string }) => c.id === clientId);
    return client ? client.name : "";
  };

  const getClientPhone = (clientId: number) => {
    const client = clients?.find((c: { id: number; phone: string }) => c.id === clientId);
    if (!client) return "";
    
    // Se o número já tem código internacional (começa com +), exibir como está
    if (client.phone.startsWith('+')) {
      // Se for um número brasileiro com código internacional (+55), remover o código do país
      if (client.phone.startsWith('+55')) {
        const phoneWithoutCountryCode = client.phone.substring(3); // Remove o +55
        return formatPhoneNumber(phoneWithoutCountryCode);
      }
      return client.phone; // Outros números internacionais exibir como estão
    } else {
      const cleanPhone = client.phone.replace(/\D/g, '');
      
      // Verificar se é um número de Portugal (especificamente começa com 351 ou tem o formato (35))
      if ((client.phone.includes('(35)') && !client.phone.includes('(35)9')) || 
          (cleanPhone.startsWith('351') && cleanPhone.length >= 11)) {
        // Formatar como número de Portugal
        if (cleanPhone.startsWith('351')) {
          // Se já tem o código do país, formatar adequadamente
          const countryCode = cleanPhone.substring(0, 3); // 351
          const rest = cleanPhone.substring(3);
          
          // Formato português: +351 XXX XXX XXX
          return `+${countryCode} ${rest.substring(0, 3)} ${rest.substring(3, 6)} ${rest.substring(6)}`;
        } else {
          // Se está no formato (35) XXXXX-XXXX
          return `+351 ${cleanPhone.substring(2, 5)} ${cleanPhone.substring(5, 8)} ${cleanPhone.substring(8)}`;
        }
      } else {
        // Verificar se o número já começa com 55 (código do Brasil)
        if (cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
          // Remover o código do país e formatar apenas com DDD + número
          const phoneWithoutCountryCode = cleanPhone.substring(2);
          return formatPhoneNumber(phoneWithoutCountryCode);
        } else {
          // Se não tem o código do país, formatar normalmente
          return formatPhoneNumber(client.phone);
        }
      }
    }
  };
  
  // Cria URL do WhatsApp
  const getWhatsAppUrl = (clientId: number, appointmentId: number) => {
    if (!clients || !appointments) return "";
    
    const client = clients.find((c: { id: number; name: string; phone: string }) => c.id === clientId);
    const appointment = appointments.find((a: { id: number; date: string; serviceId: number }) => a.id === appointmentId);
    
    if (!client || !appointment) return "";
    
    // Tratar números internacionais
    let phoneForWhatsApp = "";
    if (client.phone.startsWith('+')) {
      // Se já tem código internacional, remover o + e usar como está
      phoneForWhatsApp = client.phone.substring(1); // Remove o + do início
    } else {
      // Detectar país pelo formato do número
      const cleanPhone = client.phone.replace(/\D/g, '');
      
      // Verificar se o número tem o formato (35) XXXXX-XXXX ou similar
      // Isso indica que é um número de Portugal com código 351
      if ((client.phone.includes('(35)') && !client.phone.includes('(35)9')) || 
          (cleanPhone.startsWith('351') && cleanPhone.length >= 11)) {
        // É um número de Portugal, usar o código 351
        if (cleanPhone.startsWith('351')) {
          phoneForWhatsApp = cleanPhone; // Já tem o código do país
        } else {
          // Adicionar o código 351 se não estiver presente
          phoneForWhatsApp = `351${cleanPhone.substring(2)}`;
        }
      } else {
        // Se não for identificado como outro país, verificar se já começa com 55 (Brasil)
        if (cleanPhone.startsWith('55')) {
          phoneForWhatsApp = cleanPhone; // Já tem o código do Brasil
        } else {
          phoneForWhatsApp = `55${cleanPhone}`; // Adicionar o código do Brasil
        }
      }
    }
    
    const appointmentDate = new Date(appointment.date);
    const formattedDate = formatDate(appointmentDate);
    const formattedTime = formatTime(appointmentDate);
    const serviceName = getServiceName(appointment.serviceId);
    
    const message = `Olá, ${client.name}. Seu agendamento para o dia ${formattedDate}, às ${formattedTime} para o serviço ${serviceName} foi confirmado com sucesso!`;
    
    return `https://wa.me/${phoneForWhatsApp}?text=${encodeURIComponent(message)}`;
  };

  const getServiceName = (serviceId: number) => {
    if (!services) return "";
    const service = services.find((s: any) => s.id === serviceId);
    return service ? service.name : "";
  };

  const getServiceDuration = (serviceId: number) => {
    if (!services) return "";
    const service = services.find((s: any) => s.id === serviceId);
    return service ? `${service.duration}min` : "";
  };

  // Get employee name by ID
  const getEmployeeName = (employeeId: number | null) => {
    if (!employeeId || !employees) return "";
    const employee = employees.find((e: any) => e.id === employeeId);
    return employee ? employee.name : "";
  };

  // Check if account is company type
  const isCompanyAccount = currentUser?.accountType === 'company';

  // Listener para atualizações automáticas via WebSocket
  useEffect(() => {
    const handleAppointmentCreated = (event: CustomEvent) => {
      console.log('📅 AppointmentTable: Novo agendamento detectado via WebSocket', event.detail);
      // Refetch imediato dos dados
      refetch();
    };

    const handleUpcomingAppointmentsUpdate = (event: CustomEvent) => {
      console.log('🔄 AppointmentTable: Atualizando próximos agendamentos', event.detail);
      // Refetch imediato dos dados
      refetch();
    };

    // Registrar listeners
    window.addEventListener('appointment-created', handleAppointmentCreated as EventListener);
    window.addEventListener('upcoming-appointments-update', handleUpcomingAppointmentsUpdate as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('appointment-created', handleAppointmentCreated as EventListener);
      window.removeEventListener('upcoming-appointments-update', handleUpcomingAppointmentsUpdate as EventListener);
    };
  }, [refetch]);

  // Filter appointments
  const filteredAppointments = React.useMemo(() => {
    if (!appointments) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return appointments
      .filter((appointment: any) => {
        if (appointment.status === AppointmentStatus.CANCELLED) {
          return false;
        }
        
        const appointmentDate = new Date(appointment.date);
        if (appointmentDate >= today && 
           (appointment.status === AppointmentStatus.PENDING || 
            appointment.status === AppointmentStatus.CONFIRMED)) {
          return true;
        }
        
        return false;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
  }, [appointments, limit]);

  const renderClientAvatar = (clientId: number) => {
    const clientName = getClientName(clientId);
    const initials = clientName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

    return (
      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
        <span className="text-sm font-medium text-gray-600">{initials}</span>
      </div>
    );
  };

  return (
    <>
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle>Próximos agendamentos</CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(limit)].map((_, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAppointments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  {isCompanyAccount && <TableHead>Funcionário</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment: any) => {
                  const appointmentDate = new Date(appointment.date);
                  const statusColor = getColorForStatus(appointment.status);

                  return (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <div className="flex items-center">
                          {renderClientAvatar(appointment.clientId)}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {getClientName(appointment.clientId)}
                            </div>
                            <div className="text-sm">
                              <a 
                                href={getWhatsAppUrl(appointment.clientId, appointment.id)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center text-primary hover:text-primary/80 transition-colors"
                              >
                                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                                {getClientPhone(appointment.clientId)}
                              </a>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {getServiceName(appointment.serviceId)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {getServiceDuration(appointment.serviceId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {formatDate(appointmentDate)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatTime(appointmentDate)}
                          {appointment.endTime && (
                            <> - {formatTime(new Date(appointment.endTime))}</>
                          )}
                        </div>
                      </TableCell>
                      {isCompanyAccount && (
                        <TableCell>
                          <div className="text-sm text-gray-900">
                            {getEmployeeName(appointment.employeeId) || "-"}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {appointment.status === AppointmentStatus.CANCELLED && appointment.cancellationReason ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`bg-${statusColor}-100 text-${statusColor}-600 hover:bg-${statusColor}-100 cursor-help`}
                                >
                                  {getStatusTranslation(appointment.status)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p><strong>Motivo:</strong> {appointment.cancellationReason}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`bg-${statusColor}-100 text-${statusColor}-600 hover:bg-${statusColor}-100`}
                          >
                            {getStatusTranslation(appointment.status)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-gray-600 hover:text-gray-900 mr-2"
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setShowDetails(true);
                          }}
                        >
                          Detalhes
                        </Button>

                        {appointment.status === AppointmentStatus.PENDING && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary-600 hover:text-primary-900 mr-2"
                            onClick={() => handleConfirmAppointment(appointment.id)}
                          >
                            Confirmar
                          </Button>
                        )}
                        
                        {(appointment.status === AppointmentStatus.CONFIRMED || 
                          appointment.status === AppointmentStatus.PENDING) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-danger-600 hover:text-danger-900"
                              >
                                Cancelar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                                <AlertDialogDescription className="pb-4">
                                  Tem certeza que deseja cancelar o agendamento de {getClientName(appointment.clientId)} para {getServiceName(appointment.serviceId)}?
                                </AlertDialogDescription>
                                
                                <div className="mt-4 space-y-2">
                                  <Label htmlFor="cancellationReason" className="text-left">
                                    Motivo do cancelamento
                                  </Label>
                                  <Input
                                    id="cancellationReason"
                                    placeholder="Explique o motivo do cancelamento"
                                    value={cancellationReason}
                                    onChange={(e) => setCancellationReason(e.target.value)}
                                  />
                                </div>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-6">
                                <AlertDialogCancel 
                                  onClick={() => setCancellationReason("")}
                                >
                                  Não, manter
                                </AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => {
                                    handleCancelAppointment(appointment.id, cancellationReason);
                                    setCancellationReason("");
                                  }}
                                >
                                  Sim, cancelar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Não há agendamentos futuros</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedAppointment(null);
            refetch();
            if (onAppointmentUpdated) {
              onAppointmentUpdated();
            }
          }}
          clients={clients}
          services={services}
          onStatusChange={(id, status, reason) => {
            if (status === AppointmentStatus.CANCELLED) {
              handleCancelAppointment(id, reason || "");
            } else if (status === AppointmentStatus.CONFIRMED) {
              handleConfirmAppointment(id);
            } else {
              apiRequest('PATCH', `/api/appointments/${id}/status`, { status })
                .then(() => {
                  refetch();
                  if (onAppointmentUpdated) {
                    onAppointmentUpdated();
                  }
                })
                .catch(error => {
                  console.error('Failed to update appointment status:', error);
                });
            }
          }}
        />
      )}
    </>
  );
};

export default AppointmentTable;