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
import { CheckCircle, XCircle } from "lucide-react";

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

  const isLoading = appointmentsLoading || clientsLoading || servicesLoading;

  // Filtrar apenas agendamentos futuros
  const filteredAppointments = appointments
    ? appointments
        .filter(appointment => 
          new Date(appointment.date) > new Date() && 
          appointment.status !== AppointmentStatus.CANCELLED
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, limit)
    : [];

  const handleConfirmAppointment = async (appointmentId: number) => {
    try {
      await apiRequest("PATCH", `/api/appointments/${appointmentId}/status`, {
        status: AppointmentStatus.CONFIRMED
      });
      refetch();
      if (onAppointmentUpdated) onAppointmentUpdated();
    } catch (error) {
      console.error("Error confirming appointment:", error);
    }
  };

  const handleCancelAppointment = async (appointmentId: number, reason: string) => {
    try {
      await apiRequest("PATCH", `/api/appointments/${appointmentId}/status`, {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason
      });
      refetch();
      if (onAppointmentUpdated) onAppointmentUpdated();
    } catch (error) {
      console.error("Error canceling appointment:", error);
    }
  };

  const getClientName = (clientId: number) => {
    if (!clients) return "Carregando...";
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Cliente não encontrado";
  };

  const getClientPhone = (clientId: number) => {
    if (!clients) return "";
    const client = clients.find(c => c.id === clientId);
    return client ? formatPhoneNumber(client.phone) : "";
  };

  const getServiceName = (serviceId: number) => {
    if (!services) return "Carregando...";
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : "Serviço não encontrado";
  };

  const getServiceDuration = (serviceId: number) => {
    if (!services) return 0;
    const service = services.find(s => s.id === serviceId);
    return service ? service.duration : 0;
  };

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Ações</TableHead>
                  <TableHead className="whitespace-nowrap">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap">Serviço</TableHead>
                  <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment) => {
                  const appointmentDate = new Date(appointment.date);
                  const statusColor = getColorForStatus(appointment.status);
                  
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <div className="flex items-center justify-start space-x-2">
                          {appointment.status === AppointmentStatus.PENDING && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => handleConfirmAppointment(appointment.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 p-0"
                                  >
                                    <CheckCircle className="h-5 w-5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Confirmar agendamento</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {appointment.status !== AppointmentStatus.CANCELLED && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 p-0"
                                >
                                  <XCircle className="h-5 w-5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja cancelar o agendamento de {getClientName(appointment.clientId)} para {formatDate(appointmentDate)} às {formatTime(appointmentDate)}?
                                  </AlertDialogDescription>
                                  <div className="mt-4">
                                    <Label htmlFor="reason" className="text-left block mb-2">
                                      Motivo do cancelamento
                                    </Label>
                                    <Input
                                      id="reason"
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
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {renderClientAvatar(appointment.clientId)}
                          <div>
                            <div className="font-medium">{getClientName(appointment.clientId)}</div>
                            <div className="text-sm text-gray-500">{getClientPhone(appointment.clientId)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getServiceName(appointment.serviceId)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{formatDate(appointmentDate)}</div>
                        <div className="text-sm text-gray-500">
                          {formatTime(appointmentDate)} - {formatTime(new Date(appointment.endTime))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`bg-${statusColor}-100 text-${statusColor}-800`}
                        >
                          {getStatusTranslation(appointment.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Não há agendamentos futuros</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AppointmentTable;