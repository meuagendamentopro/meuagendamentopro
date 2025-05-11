import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Search, RefreshCw, Pencil, Check, X } from "lucide-react";
import { formatDate, formatTime, getToday, addDays } from "@/lib/dates";
import { getColorForStatus, getStatusTranslation, formatPhoneNumber } from "@/lib/utils";
import { Appointment, AppointmentStatus, Client, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AddAppointmentForm from "@/components/dashboard/add-appointment-form";

const AppointmentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const { toast } = useToast();

  // Obter dados do provider atual
  const { data: provider } = useQuery({
    queryKey: ["/api/my-provider"],
    queryFn: async () => {
      const res = await fetch("/api/my-provider");
      if (!res.ok) throw new Error("Failed to fetch provider data");
      return res.json();
    }
  });
  
  const providerId = provider?.id;

  // Fetch appointments usando a rota protegida
  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useQuery({
    queryKey: ["/api/my-appointments", statusFilter],
    queryFn: async () => {
      const url = new URL("/api/my-appointments", window.location.origin);
      // Adicionar o filtro de status à consulta
      if (statusFilter !== "all") {
        url.searchParams.append("status", statusFilter);
      }
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
    enabled: !!providerId // Só executa a query quando o providerId estiver disponível
  });

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  // Fetch services usando a rota protegida
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/my-services"],
    queryFn: async () => {
      const res = await fetch("/api/my-services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    enabled: !!providerId // Só executa a query quando o providerId estiver disponível
  });

  // Filter appointments
  const filteredAppointments = React.useMemo(() => {
    if (!appointments) return [];

    return appointments.filter((appointment: Appointment) => {
      const client = clients?.find((c: Client) => c.id === appointment.clientId);
      const service = services?.find((s: Service) => s.id === appointment.serviceId);
      
      // Text search filter
      const matchesSearch =
        !searchTerm ||
        (client && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client && client.phone.includes(searchTerm)) ||
        (service && service.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        // Search in cancellation reason if available
        (appointment.cancellationReason && appointment.cancellationReason.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;

      // Date filter
      let matchesDate = true;
      
      // Criar uma nova data apenas com ano, mês e dia para evitar problemas de fuso horário
      const appointmentDateObj = new Date(appointment.date);
      const appointmentDate = new Date(
        appointmentDateObj.getFullYear(),
        appointmentDateObj.getMonth(),
        appointmentDateObj.getDate()
      );
      
      const today = getToday();
      
      if (dateFilter === "today") {
        // Comparar apenas ano, mês e dia
        matchesDate = 
          appointmentDate.getFullYear() === today.getFullYear() &&
          appointmentDate.getMonth() === today.getMonth() &&
          appointmentDate.getDate() === today.getDate();
      } else if (dateFilter === "tomorrow") {
        const tomorrow = addDays(today, 1);
        matchesDate = 
          appointmentDate.getFullYear() === tomorrow.getFullYear() &&
          appointmentDate.getMonth() === tomorrow.getMonth() &&
          appointmentDate.getDate() === tomorrow.getDate();
      } else if (dateFilter === "week") {
        const weekLater = addDays(today, 7);
        // Para comparação de intervalo, ainda podemos usar >= e <= já que resetamos as horas
        matchesDate = appointmentDate >= today && appointmentDate <= weekLater;
      }

      return matchesSearch && matchesStatus && matchesDate;
    }).sort((a: Appointment, b: Appointment) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [appointments, clients, services, searchTerm, statusFilter, dateFilter]);

  const handleAddAppointment = () => {
    setIsAddDialogOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsEditDialogOpen(true);
  };

  const handleUpdateStatus = async (appointmentId: number, newStatus: string, reason?: string) => {
    try {
      await apiRequest("PATCH", `/api/appointments/${appointmentId}/status`, {
        status: newStatus,
        ...(newStatus === AppointmentStatus.CANCELLED && reason ? { cancellationReason: reason } : {})
      });
      refetchAppointments();
      toast({
        title: "Status atualizado",
        description: `O status do agendamento foi atualizado para ${getStatusTranslation(newStatus)}.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do agendamento.",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setSelectedAppointment(null);
    refetchAppointments();
  };

  const getClientName = (clientId: number) => {
    if (!clients) return "";
    const client = clients.find((c: Client) => c.id === clientId);
    return client ? client.name : "";
  };

  const getClientPhone = (clientId: number) => {
    if (!clients) return "";
    const client = clients.find((c: Client) => c.id === clientId);
    return client ? formatPhoneNumber(client.phone) : "";
  };

  const getServiceName = (serviceId: number) => {
    if (!services) return "";
    const service = services.find((s: Service) => s.id === serviceId);
    return service ? service.name : "";
  };

  const isLoading = appointmentsLoading || clientsLoading || servicesLoading;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Agendamentos" 
        description="Gerencie todos os seus agendamentos"
      >
        <Button onClick={handleAddAppointment}>
          <Plus className="h-4 w-4 mr-2" /> Novo agendamento
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, telefone ou serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex space-x-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value={AppointmentStatus.PENDING}>Aguardando</SelectItem>
                  <SelectItem value={AppointmentStatus.CONFIRMED}>Confirmados</SelectItem>
                  <SelectItem value={AppointmentStatus.COMPLETED}>Concluídos</SelectItem>
                  <SelectItem value={AppointmentStatus.CANCELLED}>Cancelados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="tomorrow">Amanhã</SelectItem>
                  <SelectItem value="week">Próximos 7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Appointments Table */}
          {isLoading ? (
            <div className="py-8 text-center">Carregando agendamentos...</div>
          ) : !filteredAppointments.length ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum agendamento encontrado</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== "all" || dateFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Comece a adicionar agendamentos para vê-los aqui"}
              </p>
              <Button onClick={handleAddAppointment}>
                <Plus className="h-4 w-4 mr-2" /> Novo agendamento
              </Button>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <Table className="w-full min-w-0 table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%] sm:w-[20%]">Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell w-[20%]">Serviço</TableHead>
                    <TableHead className="w-[25%] sm:w-[15%]">Data/Hora</TableHead>
                    <TableHead className="hidden sm:table-cell w-[15%]">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Observações</TableHead>
                    <TableHead className="w-[50%] sm:w-[30%] md:w-[20%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appointment: Appointment) => {
                    const appointmentDate = new Date(appointment.date);
                    const statusColor = getColorForStatus(appointment.status);
                    const isPending = appointment.status === AppointmentStatus.PENDING;
                    const isConfirmed = appointment.status === AppointmentStatus.CONFIRMED;
                    const isPast = appointmentDate < new Date();

                    return (
                      <TableRow key={appointment.id}>
                        <TableCell>
                          <div className="font-medium truncate max-w-[110px] sm:max-w-full">{getClientName(appointment.clientId)}</div>
                          <div className="text-sm text-gray-500 truncate max-w-[110px] sm:max-w-full">{getClientPhone(appointment.clientId)}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell truncate">{getServiceName(appointment.serviceId)}</TableCell>
                        <TableCell>
                          <div className="truncate max-w-[110px] sm:max-w-full">{formatDate(appointmentDate)}</div>
                          <div className="text-sm text-gray-500 truncate max-w-[110px] sm:max-w-full">{formatTime(appointmentDate)}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
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
                      <TableCell className="hidden md:table-cell">
                        {appointment.status === AppointmentStatus.CANCELLED && appointment.cancellationReason ? (
                          <span className="text-sm italic">
                            <span className="font-medium">Motivo do cancelamento:</span> {appointment.cancellationReason}
                          </span>
                        ) : appointment.notes ? (
                          <span className="text-sm">{appointment.notes}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAppointment(appointment)}
                              className="p-1 h-8 w-8 sm:h-9 sm:w-auto sm:p-2"
                            >
                              <span className="hidden sm:inline">Editar</span>
                              <Pencil className="h-4 w-4 sm:hidden" />
                            </Button>

                            {isPending && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-success-600 hover:bg-success-50 p-1 h-8 w-8 sm:h-9 sm:w-auto sm:p-2"
                                onClick={() => handleUpdateStatus(appointment.id, AppointmentStatus.CONFIRMED)}
                              >
                                <span className="hidden sm:inline">Confirmar</span>
                                <Check className="h-4 w-4 sm:hidden" />
                              </Button>
                            )}

                            {isConfirmed && !isPast && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 p-1 h-8 w-8 sm:h-9 sm:w-auto sm:p-2"
                                  >
                                    <span className="hidden sm:inline">Cancelar</span>
                                    <X className="h-4 w-4 sm:hidden" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                                    <AlertDialogDescription className="pb-4">
                                      Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
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
                                        handleUpdateStatus(appointment.id, AppointmentStatus.CANCELLED, cancellationReason);
                                        setCancellationReason("");
                                      }}
                                    >
                                      Sim, cancelar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {isConfirmed && isPast && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-primary-600 border-primary-600 hover:bg-primary-50"
                                onClick={() => handleUpdateStatus(appointment.id, AppointmentStatus.COMPLETED)}
                              >
                                Marcar como concluído
                              </Button>
                            )}
                            
                            {/* Botão de Reagendar para agendamentos cancelados */}
                            {appointment.status === AppointmentStatus.CANCELLED && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-indigo-600 border-indigo-600 hover:bg-indigo-50 ml-2"
                                onClick={() => {
                                  // Preencher os dados do agendamento atual para reagendamento
                                  setSelectedAppointment(appointment);
                                  setIsAddDialogOpen(true);
                                }}
                              >
                                Reagendar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Appointment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          {provider && (
            <AddAppointmentForm 
              providerId={provider.id}
              initialDate={selectedAppointment ? new Date(selectedAppointment.date) : new Date()}
              initialClientId={selectedAppointment?.clientId}
              initialServiceId={selectedAppointment?.serviceId}
              initialNotes={selectedAppointment?.notes || ""}
              onComplete={handleDialogClose}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          {selectedAppointment && provider && (
            <AddAppointmentForm 
              providerId={provider.id}
              initialDate={new Date(selectedAppointment.date)}
              appointmentId={selectedAppointment.id}
              initialClientId={selectedAppointment.clientId}
              initialServiceId={selectedAppointment.serviceId}
              initialNotes={selectedAppointment.notes || ""}
              onComplete={handleDialogClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsPage;
