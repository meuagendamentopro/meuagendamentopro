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
import { MessageCircle, AlertCircle, Check } from "lucide-react";
import { AppointmentDetails } from "./appointment-details";
import { useWhatsAppNotifications } from "@/components/whatsapp-notification-provider";

const AppointmentTable = ({ 
  providerId, 
  limit = 5, 
  showTitle = true,
  onAppointmentUpdated
}) => {
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Hook para notificações WhatsApp
  const { showCancellationNotification, showNewAppointmentNotification } = useWhatsAppNotifications();
  
  const { data: appointments, isLoading: appointmentsLoading, refetch } = useQuery({
    queryKey: ['/api/providers', providerId, 'appointments'],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}/appointments`);
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
    queryKey: ['/api/providers', providerId, 'services'],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  const handleCancelAppointment = async (id, reason) => {
    try {
      // Buscar detalhes do agendamento antes de cancelar
      const appointment = appointments?.find((a) => a.id === id);
      
      // Atualizar status para cancelado
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason
      });
      
      // Se temos o agendamento, buscar detalhes necessários e mostrar notificação WhatsApp
      if (appointment && clients && services) {
        const client = clients.find((c) => c.id === appointment.clientId);
        const service = services.find((s) => s.id === appointment.serviceId);
        
        if (client && service) {
          // Aguardar um pouco para permitir que o WebSocket atualize os dados
          setTimeout(() => {
            showCancellationNotification({
              ...appointment,
              clientName: client.name,
              clientPhone: client.phone,
              serviceName: service.name
            });
          }, 500);
        }
      }
      
      // Atualizar interface
      refetch();
      if (onAppointmentUpdated) {
        onAppointmentUpdated();
      }
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleConfirmAppointment = async (id) => {
    try {
      // Buscar detalhes do agendamento antes de confirmar
      const appointment = appointments?.find((a) => a.id === id);
      
      // Atualizar status para confirmado
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CONFIRMED 
      });
      
      // Se temos o agendamento, buscar detalhes necessários e mostrar notificação WhatsApp
      if (appointment && clients && services) {
        const client = clients.find((c) => c.id === appointment.clientId);
        const service = services.find((s) => s.id === appointment.serviceId);
        
        if (client && service) {
          // Aguardar um pouco para permitir que o WebSocket atualize os dados
          setTimeout(() => {
            showNewAppointmentNotification({
              ...appointment,
              clientName: client.name,
              clientPhone: client.phone,
              serviceName: service.name
            });
          }, 500);
        }
      }
      
      // Atualizar interface
      refetch();
      if (onAppointmentUpdated) {
        onAppointmentUpdated();
      }
    } catch (error) {
      console.error('Failed to confirm appointment:', error);
    }
  };

  const isLoading = appointmentsLoading || clientsLoading || servicesLoading;

  const getClientName = (clientId) => {
    if (!clients) return "";
    const client = clients.find((c) => c.id === clientId);
    return client ? client.name : "";
  };

  const getClientPhone = (clientId) => {
    if (!clients) return "";
    const client = clients.find((c) => c.id === clientId);
    return client ? formatPhoneNumber(client.phone) : "";
  };
  
  // Cria URL do WhatsApp
  const getWhatsAppUrl = (clientId, appointmentId) => {
    if (!clients || !appointments) return "";
    
    const client = clients.find((c) => c.id === clientId);
    const appointment = appointments.find((a) => a.id === appointmentId);
    
    if (!client || !appointment) return "";
    
    const cleanPhone = client.phone.replace(/\D/g, '');
    const appointmentDate = new Date(appointment.date);
    const formattedDate = formatDate(appointmentDate);
    const formattedTime = formatTime(appointmentDate);
    const serviceName = getServiceName(appointment.serviceId);
    
    const message = `Olá, ${client.name}. Seu agendamento para o dia ${formattedDate}, às ${formattedTime} para o serviço ${serviceName} foi confirmado com sucesso!`;
    
    return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const getServiceName = (serviceId) => {
    if (!services) return "";
    const service = services.find((s) => s.id === serviceId);
    return service ? service.name : "";
  };

  const getServiceDuration = (serviceId) => {
    if (!services) return "";
    const service = services.find((s) => s.id === serviceId);
    return service ? `${service.duration}min` : "";
  };

  // Filter appointments
  const filteredAppointments = React.useMemo(() => {
    if (!appointments) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return appointments
      .filter((a) => {
        const date = new Date(a.date);
        // Filtrar agendamentos futuros que não estão cancelados
        return date >= today && a.status !== AppointmentStatus.CANCELLED;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      })
      .slice(0, limit);
  }, [appointments, limit]);

  // Renderiza avatar do cliente
  const renderClientAvatar = (clientId) => {
    if (!clients) return null;
    
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;
    
    const initials = client.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

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
                            <div className="font-medium">
                              {getClientName(appointment.clientId)}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <MessageCircle className="h-3 w-3 mr-1" />
                              {getClientPhone(appointment.clientId)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {getServiceName(appointment.serviceId)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getServiceDuration(appointment.serviceId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
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
                        <div className="flex items-center justify-end space-x-2">
                          {/* Botão para enviar WhatsApp */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                  onClick={() => {
                                    const client = clients?.find((c) => c.id === appointment.clientId);
                                    const service = services?.find((s) => s.id === appointment.serviceId);
                                    
                                    if (client && service) {
                                      if (appointment.status === AppointmentStatus.CANCELLED) {
                                        showCancellationNotification({
                                          ...appointment,
                                          clientName: client.name,
                                          clientPhone: client.phone,
                                          serviceName: service.name
                                        });
                                      } else {
                                        showNewAppointmentNotification({
                                          ...appointment,
                                          clientName: client.name,
                                          clientPhone: client.phone,
                                          serviceName: service.name
                                        });
                                      }
                                    }
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Enviar WhatsApp</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {/* Botão de detalhes */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setShowDetails(true);
                            }}
                          >
                            Detalhes
                          </Button>
                        </div>

                        <div className="flex justify-end mt-2">
                          {appointment.status === AppointmentStatus.PENDING && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-primary-600 hover:text-primary-900 mr-2 flex items-center"
                              onClick={() => handleConfirmAppointment(appointment.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
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
                                  className="text-danger-600 hover:text-danger-900 flex items-center"
                                >
                                  <AlertCircle className="h-4 w-4 mr-1" />
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
                        </div>
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