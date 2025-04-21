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
import { Plus, Calendar, Search } from "lucide-react";
import { formatDate, formatTime, getToday, addDays } from "@/lib/dates";
import { getColorForStatus, getStatusTranslation, formatPhoneNumber } from "@/lib/utils";
import { Appointment, AppointmentStatus, Client, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
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
import AddAppointmentForm from "@/components/dashboard/add-appointment-form";

const AppointmentsPage: React.FC = () => {
  const providerId = 1; // Using default provider ID from storage
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { toast } = useToast();

  // Fetch appointments
  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useQuery({
    queryKey: ["/api/providers", providerId, "appointments"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/appointments`);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/providers", providerId, "services"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
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
        (service && service.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

  const handleUpdateStatus = async (appointmentId: number, newStatus: string) => {
    try {
      await apiRequest("PATCH", `/api/appointments/${appointmentId}/status`, {
        status: newStatus,
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
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
                          <div className="font-medium">{getClientName(appointment.clientId)}</div>
                          <div className="text-sm text-gray-500">{getClientPhone(appointment.clientId)}</div>
                        </TableCell>
                        <TableCell>{getServiceName(appointment.serviceId)}</TableCell>
                        <TableCell>
                          <div>{formatDate(appointmentDate)}</div>
                          <div className="text-sm text-gray-500">{formatTime(appointmentDate)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`bg-${statusColor}-100 text-${statusColor}-600 hover:bg-${statusColor}-100`}
                          >
                            {getStatusTranslation(appointment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAppointment(appointment)}
                            >
                              Editar
                            </Button>

                            {isPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-success-600 border-success-600 hover:bg-success-50"
                                onClick={() => handleUpdateStatus(appointment.id, AppointmentStatus.CONFIRMED)}
                              >
                                Confirmar
                              </Button>
                            )}

                            {isConfirmed && !isPast && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-600 hover:bg-red-50"
                                  >
                                    Cancelar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Não, manter</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700"
                                      onClick={() => handleUpdateStatus(appointment.id, AppointmentStatus.CANCELLED)}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          <AddAppointmentForm 
            providerId={providerId}
            initialDate={new Date()}
            onComplete={handleDialogClose}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <AddAppointmentForm 
              providerId={providerId}
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
