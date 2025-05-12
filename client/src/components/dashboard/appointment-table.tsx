import React, { useState } from "react";
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
import { MessageCircle, CreditCard } from "lucide-react";
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
    queryKey: ['/api/providers', providerId, 'appointments'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/appointments`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    }
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    }
  });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/providers', providerId, 'services'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  const handleCancelAppointment = async (id: number, cancellationReason: string) => {
    try {
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CANCELLED,
        cancellationReason
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

  const isLoading = appointmentsLoading || clientsLoading || servicesLoading;

  const getClientName = (clientId: number) => {
    if (!clients) return "";
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "";
  };

  const getClientPhone = (clientId: number) => {
    if (!clients) return "";
    const client = clients.find(c => c.id === clientId);
    return client ? formatPhoneNumber(client.phone) : "";
  };
  
  // Cria URL do WhatsApp com mensagem pré-definida
  const getWhatsAppUrl = (clientId: number, appointmentId: number) => {
    if (!clients || !appointments) return "";
    
    const client = clients.find(c => c.id === clientId);
    const appointment = appointments.find(a => a.id === appointmentId);
    
    if (!client || !appointment) return "";
    
    // Remove qualquer caractere não numérico do telefone
    const cleanPhone = client.phone.replace(/\D/g, '');
    
    // Pega os detalhes do agendamento
    const appointmentDate = new Date(appointment.date);
    const formattedDate = formatDate(appointmentDate);
    const formattedTime = formatTime(appointmentDate);
    const serviceName = getServiceName(appointment.serviceId);
    
    // Cria a mensagem pré-definida
    const message = `Olá, ${client.name}. Seu agendamento para o dia ${formattedDate}, às ${formattedTime} para o serviço ${serviceName} foi confirmado com sucesso!`;
    
    // Codifica a mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    
    // Retorna a URL do WhatsApp com a mensagem pré-definida
    return `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
  };

  const getServiceName = (serviceId: number) => {
    if (!services) return "";
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : "";
  };

  const getServiceDuration = (serviceId: number) => {
    if (!services) return "";
    const service = services.find(s => s.id === serviceId);
    return service ? `${service.duration}min` : "";
  };

  // Filter appointments for today or later, and limit
  // Mostramos apenas agendamentos PENDENTES e CONFIRMADOS (não mostramos os CANCELADOS)
  const filteredAppointments = React.useMemo(() => {
    if (!appointments) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return appointments
      .filter(appointment => {
        // Remover todos os agendamentos cancelados
        if (appointment.status === AppointmentStatus.CANCELLED) {
          return false;
        }
        
        // Incluir apenas agendamentos futuros pendentes ou confirmados
        const appointmentDate = new Date(appointment.date);
        if (appointmentDate >= today && 
           (appointment.status === AppointmentStatus.PENDING || 
            appointment.status === AppointmentStatus.CONFIRMED)) {
          return true;
        }
        
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
  }, [appointments, limit]);

  const renderClientAvatar = (clientId: number) => {
    const clientName = getClientName(clientId);
    const initials = clientName
      .split(" ")
      .map(n => n[0])
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appointment) => {
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
    
    {/* Componente de detalhes do agendamento */}
    {selectedAppointment && (
      <AppointmentDetails
        appointment={selectedAppointment}
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false);
          setSelectedAppointment(null);
          // Atualizar a lista de agendamentos
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
            // Para outros status, usamos a mesma lógica
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
  );
};

export default AppointmentTable;
