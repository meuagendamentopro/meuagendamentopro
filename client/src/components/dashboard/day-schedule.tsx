import React from "react";
import { format, parseISO, isToday, addDays, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Edit,
  X,
  Filter,
  Clock
} from "lucide-react";
import { Appointment, AppointmentStatus, Client, Service } from "@shared/schema";
import { cn, generateTimeSlots } from "@/lib/utils";
import { formatTime } from "@/lib/dates";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AddAppointmentForm from "./add-appointment-form";

interface TimeSlotProps {
  time: string;
  children?: React.ReactNode;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ time, children }) => {
  return (
    <div className="flex group">
      <div className="flex-none w-20 text-right pr-4 text-sm text-gray-500 pt-1">
        {time}
      </div>
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
};

interface AppointmentItemProps {
  appointment: Appointment;
  client: { name: string; phone: string };
  service: { name: string; duration: number };
  onEdit: (id: number) => void;
  onCancel: (id: number) => void;
}

const AppointmentItem: React.FC<AppointmentItemProps> = ({ 
  appointment, 
  client, 
  service,
  onEdit,
  onCancel
}) => {
  let statusColor = "bg-primary-50 border-primary-500";
  let statusHover = "group-hover:bg-primary-100";
  let textColor = "text-primary-800";
  let nameColor = "text-primary-600";

  if (appointment.status === AppointmentStatus.CONFIRMED) {
    statusColor = "bg-success-50 border-success-500";
    statusHover = "group-hover:bg-success-100";
    textColor = "text-gray-800";
    nameColor = "text-gray-600";
  } else if (appointment.status === AppointmentStatus.PENDING) {
    statusColor = "bg-warning-50 border-warning-500";
    statusHover = "group-hover:bg-warning-100";
    textColor = "text-gray-800";
    nameColor = "text-gray-600";
  } else if (appointment.status === AppointmentStatus.CANCELLED) {
    statusColor = "bg-gray-50 border-gray-300";
    statusHover = "group-hover:bg-gray-100";
    textColor = "text-gray-800";
    nameColor = "text-gray-600";
  }

  return (
    <div className={cn(
      "p-3 border-l-4 rounded-r-md transition",
      statusColor,
      statusHover
    )}>
      <div className="flex justify-between">
        <div>
          <p className={cn("font-medium", textColor)}>{service.name}</p>
          <p className={cn("text-sm", nameColor)}>{client.name}</p>
        </div>
        <div className="flex space-x-2">
          <button 
            className="text-gray-400 hover:text-primary-600 transition"
            onClick={() => onEdit(appointment.id)}
          >
            <Edit className="h-4 w-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-gray-400 hover:text-danger-500 transition">
                <X className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar o agendamento de {client.name} para {service.name}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Não, manter</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => onCancel(appointment.id)}
                >
                  Sim, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

interface EmptySlotProps {
  time: Date;
  onAddAppointment: (time: Date) => void;
}

const EmptySlot: React.FC<EmptySlotProps> = ({ time, onAddAppointment }) => {
  const isPast = isBefore(time, new Date());

  return (
    <div 
      className={cn(
        "p-3 bg-gray-50 border-l-4 border-gray-200 rounded-r-md group-hover:bg-gray-100 transition min-h-[60px] flex items-center justify-center",
        isPast && "opacity-50"
      )}
    >
      <button 
        className="text-gray-400 hover:text-primary-600 text-xs font-medium uppercase tracking-wider"
        onClick={() => onAddAppointment(time)}
        disabled={isPast}
      >
        <CalendarIcon className="h-4 w-4 mr-1 inline" /> Adicionar
      </button>
    </div>
  );
};

interface DayScheduleProps {
  providerId: number;
}

const DaySchedule: React.FC<DayScheduleProps> = ({ providerId }) => {
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [addAppointmentTime, setAddAppointmentTime] = React.useState<Date | null>(null);
  const [editAppointmentId, setEditAppointmentId] = React.useState<number | null>(null);
  const [filterStartHour, setFilterStartHour] = React.useState<number>(0);
  const [filterEndHour, setFilterEndHour] = React.useState<number>(24);
  const [showFilterOptions, setShowFilterOptions] = React.useState<boolean>(false);
  
  // Buscar as configurações do profissional (utilizando a rota protegida)
  const { data: provider } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch(`/api/my-provider`);
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    }
  });

  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = 
    useQuery<Appointment[]>({
      queryKey: ['/api/my-appointments', selectedDate.toISOString().split('T')[0]],
      queryFn: async () => {
        // Usando yyyy-mm-dd sem o T para evitar problemas de fuso horário
        const localDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const res = await fetch(`/api/my-appointments?date=${localDate}`);
        if (!res.ok) throw new Error('Failed to fetch appointments');
        return res.json();
      }
    });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch(`/api/my-services`);
      if (!res.ok) throw new Error('Failed to fetch services');
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

  const handlePreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  const handleAddAppointment = (time: Date) => {
    setAddAppointmentTime(time);
  };

  const handleEditAppointment = (id: number) => {
    setEditAppointmentId(id);
  };

  const handleCancelAppointment = async (id: number) => {
    try {
      // Usando a rota protegida para atualizar o status do agendamento
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CANCELLED 
      });
      refetchAppointments();
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleCloseDialog = () => {
    setAddAppointmentTime(null);
    setEditAppointmentId(null);
    refetchAppointments();
  };

  // Create time slots based on filter settings
  const timeSlots = React.useMemo(() => {
    // Gerar slots com base nos filtros definidos pelo usuário
    return generateTimeSlots(filterStartHour, filterEndHour, 30);
  }, [filterStartHour, filterEndHour]);

  const isLoading = appointmentsLoading || servicesLoading || clientsLoading;
  
  // Find appointment for a specific time
  const findAppointmentForTime = (timeString: string) => {
    if (!appointments) return null;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Calcular o horário para comparação com agendamentos
    // Importante: na tela vemos "23:30" mas o horário está realmente armazenado como "2:30" após a compensação
    const result = appointments.find(apt => {
      const aptDate = new Date(apt.date);
      
      // Para horários depois das 21:00, precisamos ajustar a lógica de comparação
      // pois eles estão armazenados como horários iniciais do dia seguinte
      let displayHour = aptDate.getUTCHours();
      
      // Se o horário armazenado é entre 0 e 2 (madrugada), é provável que corresponda a um horário noturno
      if (displayHour >= 0 && displayHour < 3) {
        displayHour = displayHour + 21; // 0->21, 1->22, 2->23
      } else {
        displayHour = displayHour - 3; // Compensação normal para os outros horários
      }
      
      // Comparação com o horário ajustado para exibição na interface
      const matchesTime = 
        displayHour === hours && 
        aptDate.getUTCMinutes() === minutes;
      
      console.log(`Comparando slot ${timeString} com agendamento às ${displayHour}:${aptDate.getUTCMinutes()} (${aptDate.toLocaleString()})`);
      
      return matchesTime;
    });
    
    if (result) {
      console.log(`Encontrado agendamento para ${timeString}`);
    }
    
    return result;
  };

  // Get client and service for an appointment
  const getAppointmentDetails = (appointmentId: number) => {
    if (!clients || !services) return { client: null, service: null };
    
    const appointment = appointments?.find(a => a.id === appointmentId);
    if (!appointment) return { client: null, service: null };
    
    const client = clients.find((c: Client) => c.id === appointment.clientId);
    const service = services.find((s: Service) => s.id === appointment.serviceId);
    
    return { client, service };
  };

  const editAppointment = appointments?.find(a => a.id === editAppointmentId);
  const { client: editClient, service: editService } = editAppointmentId 
    ? getAppointmentDetails(editAppointmentId)
    : { client: null, service: null };

  return (
    <>
      <Card>
        <CardHeader className="px-6 pb-4 pt-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Agendamentos do dia</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" /> Filtrar Horários
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Filtrar horários</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm mb-2 text-gray-500">Hora inicial</p>
                      <Select 
                        value={filterStartHour.toString()} 
                        onValueChange={(value) => setFilterStartHour(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Hora inicial" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-sm mb-2 text-gray-500">Hora final</p>
                      <Select 
                        value={filterEndHour.toString()} 
                        onValueChange={(value) => setFilterEndHour(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Hora final" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 25 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i === 24 ? "24:00" : `${i.toString().padStart(2, '0')}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setFilterStartHour(0);
                        setFilterEndHour(24);
                      }}
                    >
                      Mostrar todos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (provider) {
                          setFilterStartHour(provider.workingHoursStart || 8);
                          setFilterEndHour(provider.workingHoursEnd || 18);
                        } else {
                          setFilterStartHour(8);
                          setFilterEndHour(18);
                        }
                      }}
                    >
                      Meus horários
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="inline-flex shadow-sm rounded-md">
              <Button
                variant="outline"
                size="sm"
                className="rounded-r-none"
                onClick={handlePreviousDay}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-l-0 border-r-0"
                onClick={handleTodayClick}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-l-none"
                onClick={handleNextDay}
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="flex">
                  <div className="flex-none w-20 text-right pr-4 h-6 bg-gray-200 rounded"></div>
                  <div className="flex-grow h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {timeSlots.map(time => {
                const appointment = findAppointmentForTime(time);
                
                // Calculate time as Date object for empty slots usando UTC
                const [hours, minutes] = time.split(':').map(Number);
                const slotTime = new Date(Date.UTC(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth(),
                  selectedDate.getDate(),
                  hours, minutes, 0
                ));
                
                if (appointment) {
                  const { client, service } = getAppointmentDetails(appointment.id);
                  if (!client || !service) return null;
                  
                  return (
                    <TimeSlot key={time} time={time}>
                      <AppointmentItem 
                        appointment={appointment}
                        client={client}
                        service={service}
                        onEdit={handleEditAppointment}
                        onCancel={handleCancelAppointment}
                      />
                    </TimeSlot>
                  );
                }
                
                return (
                  <TimeSlot key={time} time={time}>
                    <EmptySlot 
                      time={slotTime}
                      onAddAppointment={handleAddAppointment}
                    />
                  </TimeSlot>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Appointment Dialog */}
      <Dialog open={addAppointmentTime !== null} onOpenChange={() => setAddAppointmentTime(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Agendamento</DialogTitle>
            <DialogDescription>
              {addAppointmentTime && (
                <>
                  Data: {format(addAppointmentTime, "dd/MM/yyyy")} às {format(addAppointmentTime, "HH:mm")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {addAppointmentTime && (
            <AddAppointmentForm 
              providerId={providerId}
              initialDate={addAppointmentTime}
              onComplete={handleCloseDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={editAppointmentId !== null} onOpenChange={() => setEditAppointmentId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              {editAppointment && editClient && editService && (
                <>
                  {editClient.name} - {editService.name} - {formatTime(new Date(editAppointment.date))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {editAppointment && (
            <AddAppointmentForm 
              providerId={providerId}
              initialDate={new Date(editAppointment.date)}
              appointmentId={editAppointmentId}
              initialClientId={editAppointment.clientId}
              initialServiceId={editAppointment.serviceId}
              initialNotes={editAppointment.notes || ""}
              onComplete={handleCloseDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DaySchedule;
