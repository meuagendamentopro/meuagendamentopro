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
  X
} from "lucide-react";
import { Appointment, AppointmentStatus } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/dates";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  
  // Buscar as configurações do profissional
  const { data: provider } = useQuery({
    queryKey: ['/api/providers', providerId],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}`);
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    }
  });

  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = 
    useQuery<Appointment[]>({
      queryKey: ['/api/providers', providerId, 'appointments', selectedDate.toISOString().split('T')[0]],
      queryFn: async ({ queryKey }) => {
        const res = await fetch(`/api/providers/${providerId}/appointments?date=${selectedDate.toISOString().split('T')[0]}`);
        if (!res.ok) throw new Error('Failed to fetch appointments');
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

  // Create time slots based on provider working hours
  const timeSlots = React.useMemo(() => {
    const slots = [];
    // Usar as configurações do profissional ou valores padrão
    const startHour = provider?.workingHoursStart || 8;
    const endHour = provider?.workingHoursEnd || 18;
    
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      // Adicionar slot de 30 minutos se não estiver no fim do dia
      if (hour < endHour) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, [provider]);

  const isLoading = appointmentsLoading || servicesLoading || clientsLoading;
  
  // Find appointment for a specific time
  const findAppointmentForTime = (timeString: string) => {
    if (!appointments) return null;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    const targetTime = new Date(selectedDate);
    targetTime.setHours(hours, minutes, 0, 0);
    
    return appointments.find(apt => {
      const aptTime = new Date(apt.date);
      return aptTime.getHours() === hours && aptTime.getMinutes() === minutes;
    });
  };

  // Get client and service for an appointment
  const getAppointmentDetails = (appointmentId: number) => {
    if (!clients || !services) return { client: null, service: null };
    
    const appointment = appointments?.find(a => a.id === appointmentId);
    if (!appointment) return { client: null, service: null };
    
    const client = clients.find(c => c.id === appointment.clientId);
    const service = services.find(s => s.id === appointment.serviceId);
    
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
                
                // Calculate time as Date object for empty slots
                const [hours, minutes] = time.split(':').map(Number);
                const slotTime = new Date(selectedDate);
                slotTime.setHours(hours, minutes, 0, 0);
                
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
