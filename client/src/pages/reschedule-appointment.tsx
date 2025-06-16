import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, User, ArrowLeft, Check } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime, getNextDays, getDayName, isSameDay, combineDateAndTime } from '@/lib/dates';

// Função específica para corrigir fuso horário na tela de reagendamento
const formatTimeLocal = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    console.error('Data inválida fornecida para formatTimeLocal:', date);
    return 'Hora inválida';
  }
  
  // Usar horário local para evitar diferença de fuso horário na tela de reagendamento
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
import { generateTimeSlots } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Appointment {
  id: number;
  date: string;
  endTime: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  servicePrice: number;
  employeeName?: string;
  providerId: number;
  serviceId: number;
  employeeId?: number;
  rescheduleCount: number;
}

const RescheduleAppointment: React.FC = () => {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableTimes, setAvailableTimes] = useState<Array<{time: string, available: boolean}>>([]);
  const [loadingTimes, setLoadingTimes] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState(false);
  const [newAppointmentData, setNewAppointmentData] = useState<any>(null);
  const [bookingUrl, setBookingUrl] = useState<string>('');

  // Buscar dados do agendamento
  const { data: appointment, isLoading: appointmentLoading, error: appointmentError } = useQuery({
    queryKey: [`/api/appointments/details/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/details/${id}`);
      if (!res.ok) {
        throw new Error('Agendamento não encontrado');
      }
      return res.json();
    },
    enabled: !!id,
  });

  // Buscar dados do provider
  const { data: provider } = useQuery({
    queryKey: [`/api/providers/${appointment?.providerId}`],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${appointment.providerId}`);
      if (!res.ok) throw new Error('Failed to fetch provider details');
      return res.json();
    },
    enabled: !!appointment?.providerId,
  });

  // Determinar URL de booking quando os dados do provider chegarem
  useEffect(() => {
    if (provider && provider.bookingLink) {
      console.log('🔍 Provider completo:', provider);
      console.log('🔍 Provider bookingLink original:', provider.bookingLink);
      
      let finalBookingUrl = '';
      
      // Determinar a URL de booking baseada no referrer ou usar o bookingLink
      const referrer = document.referrer;
      console.log('🔍 Document referrer:', referrer);
      
      if (referrer && referrer.includes('/booking/')) {
        // Se veio de uma página de booking específica, extrair apenas o path após /booking/
        const bookingMatch = referrer.match(/\/booking\/([^?#\/]+)/);
        if (bookingMatch && bookingMatch[1]) {
          const cleanPath = bookingMatch[1].trim();
          if (cleanPath && cleanPath !== 'booking') { // Evitar duplicação
            finalBookingUrl = `/booking/${cleanPath}`;
            console.log('✅ URL de booking detectada do referrer:', finalBookingUrl);
          }
        }
      }
      
      // Se não conseguiu detectar do referrer, usar o bookingLink do provider
      if (!finalBookingUrl && provider.bookingLink) {
        console.log('🔍 Construindo URL do provider.bookingLink:', provider.bookingLink);
        
        // Verificar se o bookingLink já é uma URL completa ou apenas o path
        if (provider.bookingLink.startsWith('/booking/')) {
          // Se já começa com /booking/, usar diretamente
          finalBookingUrl = provider.bookingLink;
          console.log('✅ BookingLink já é URL completa:', finalBookingUrl);
        } else if (provider.bookingLink.startsWith('/')) {
          // Se começa com /, mas não é /booking/, adicionar /booking
          finalBookingUrl = `/booking${provider.bookingLink}`;
          console.log('✅ BookingLink com /booking adicionado:', finalBookingUrl);
        } else {
          // Se não começa com /, adicionar /booking/ diretamente
          finalBookingUrl = `/booking/${provider.bookingLink}`;
          console.log('✅ BookingLink simples:', finalBookingUrl);
        }
      }
      
      // Se ainda não tem URL, usar fallback com providerId
      if (!finalBookingUrl && appointment?.providerId) {
        finalBookingUrl = `/?providerId=${appointment.providerId}`;
        console.log('⚠️ URL de booking fallback:', finalBookingUrl);
      }
      
      console.log('🎯 URL final definida:', finalBookingUrl);
      setBookingUrl(finalBookingUrl);
    } else if (appointment?.providerId) {
      // Fallback final se não tiver provider
      const fallbackUrl = `/?providerId=${appointment.providerId}`;
      setBookingUrl(fallbackUrl);
      console.log('⚠️ URL de booking fallback final:', fallbackUrl);
    }
  }, [provider, appointment]);

  // Verificar disponibilidade para uma data específica usando o endpoint de reagendamento
  const checkAvailability = async (date: Date) => {
    if (!appointment) return;

    try {
      setAvailableTimes([]);
      setLoadingTimes(true);

      // Usar o endpoint específico de reagendamento
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const availabilityUrl = `/api/appointments/availability?providerId=${appointment.providerId}&date=${dateString}&excludeAppointmentId=${appointment.id}${appointment.employeeId ? `&employeeId=${appointment.employeeId}` : ''}`;
      
      console.log(`Verificando disponibilidade para ${dateString} com URL: ${availabilityUrl}`);
      
      const res = await fetch(availabilityUrl);
      
      if (!res.ok) {
        throw new Error(`Erro na requisição: ${res.status}`);
      }
      
      const data = await res.json();
      console.log(`Resposta de disponibilidade:`, data);
      
      if (data.message === "Dia não útil") {
        setAvailableTimes([]);
        setLoadingTimes(false);
        
        toast({
          title: "Dia não disponível",
          description: "O profissional não atende no dia selecionado. Por favor, escolha outro dia.",
          variant: "destructive",
        });
        
        return;
      }
      
      // Salvar todos os slots (disponíveis e ocupados)
      if (data.slots && Array.isArray(data.slots)) {
        setAvailableTimes(data.slots);
        
        // Selecionar primeiro horário disponível se não houver seleção
        const availableSlots = data.slots.filter((slot: any) => slot.available);
        if (availableSlots.length > 0 && (!selectedTime || !availableSlots.some((slot: any) => slot.time === selectedTime))) {
          setSelectedTime(availableSlots[0].time);
        } else if (availableSlots.length === 0) {
          setSelectedTime("");
        }
      } else {
        setAvailableTimes([]);
        setSelectedTime("");
      }

      console.log("Slots recebidos:", data.slots);
      setLoadingTimes(false);
    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar horários disponíveis",
        variant: "destructive",
      });
      setLoadingTimes(false);
    }
  };

  // Verificar disponibilidade quando a data muda
  useEffect(() => {
    if (selectedDate && appointment) {
      checkAvailability(selectedDate);
    }
  }, [selectedDate, appointment]);

  // Função para reagendar
  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime || !appointment) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma data e horário",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/appointments/reschedule/${appointment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newDate: selectedDate.toISOString().split('T')[0], // Enviar apenas a data (YYYY-MM-DD)
          newTime: selectedTime, // Enviar o horário separadamente (HH:MM)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao reagendar');
      }

      const responseData = await response.json();

      // Salvar dados do novo agendamento
      setNewAppointmentData({
        date: selectedDate,
        time: selectedTime,
        originalDate: appointment.date,
        originalTime: formatTimeLocal(appointment.date)
      });

      // Mostrar tela de sucesso
      setRescheduleSuccess(true);
    } catch (error) {
      console.error('Erro ao reagendar:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao reagendar agendamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gerar próximos 14 dias (mesma lógica do booking)
  const nextDays = getNextDays(14);

  if (appointmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Calendar className="h-8 w-8 text-primary-500 mx-auto" />
          </div>
          <p className="text-gray-500">Carregando agendamento...</p>
        </div>
      </div>
    );
  }

  if (appointmentError || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 mb-4">Agendamento não encontrado</p>
            <Button onClick={() => navigate('/appointment-lookup')}>
              Voltar à Consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de sucesso do reagendamento
  if (rescheduleSuccess && newAppointmentData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Reagendamento Realizado com Sucesso!
            </h1>
            <p className="text-gray-600">
              Seu agendamento foi reagendado conforme solicitado
            </p>
          </div>

          {/* Detalhes do reagendamento */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Calendar className="h-5 w-5" />
                Detalhes do Reagendamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Cliente:</span>
                    <p className="text-gray-900">{appointment.clientName || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Funcionário:</span>
                    <p className="text-gray-900">{appointment.employeeName || 'Não especificado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Serviço:</span>
                    <p className="text-gray-900">{appointment.serviceName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Valor:</span>
                    <p className="text-gray-900">R$ {appointment.servicePrice.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-50 p-3 rounded-lg">
                      <span className="font-medium text-red-700">Data/Horário Anterior:</span>
                      <p className="text-red-900">
                        {formatDate(newAppointmentData.originalDate)} às {newAppointmentData.originalTime}
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <span className="font-medium text-green-700">Nova Data/Horário:</span>
                      <p className="text-green-900">
                        {formatDate(newAppointmentData.date)} às {newAppointmentData.time}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aviso sobre limite de reagendamentos */}
          <Card className="mb-8 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100">
                    <span className="text-amber-600 font-bold text-sm">!</span>
                  </div>
                </div>
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">⚠️ Importante:</p>
                  <p>
                    Este agendamento já foi reagendado e <strong>não poderá ser reagendado novamente</strong>. 
                    Caso precise fazer alterações, entre em contato diretamente com o profissional.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botão de ação */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                const finalUrl = bookingUrl || `/?providerId=${appointment.providerId}`;
                console.log('Navegando para URL final:', finalUrl);
                navigate(finalUrl);
              }}
              className="px-8"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => {
              const finalUrl = bookingUrl || `/?providerId=${appointment.providerId}`;
              console.log('🎯 Navegando para URL final (tela principal):', finalUrl);
              navigate(finalUrl);
            }}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Reagendar Atendimento
          </h1>
          <p className="text-gray-600">
            Escolha uma nova data e horário para seu agendamento
          </p>
        </div>

        {/* Detalhes do agendamento atual */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Agendamento Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Cliente:</span> {appointment.clientName || 'Não informado'}
              </div>
              <div>
                <span className="font-medium">Funcionário:</span> {appointment.employeeName || 'Não especificado'}
              </div>
              <div>
                <span className="font-medium">Serviço:</span> {appointment.serviceName}
              </div>
              <div>
                <span className="font-medium">Valor:</span> R$ {appointment.servicePrice.toFixed(2)}
              </div>
              <div>
                <span className="font-medium">Data atual:</span> {formatDate(appointment.date)}
              </div>
              <div>
                <span className="font-medium">Horário atual:</span> {formatTimeLocal(appointment.date)} - {formatTimeLocal(appointment.endTime)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações sobre filtros */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">ℹ️ Filtros aplicados:</p>
              <ul className="space-y-1">
                <li>• Apenas dias úteis (conforme configuração do profissional)</li>
                {appointment.employeeName && (
                  <li>• Horário de almoço do funcionário {appointment.employeeName} excluído</li>
                )}
                <li>• Horários já ocupados removidos automaticamente</li>
                <li>• Horários passados do dia atual não são exibidos</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Seleção de data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Escolha a Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {nextDays.map((date, index) => {
                  const isToday = isSameDay(date, new Date());
                  const isSelected = isSameDay(date, selectedDate);
                  
                  return (
                    <button
                      key={index}
                      type="button"
                      className={cn(
                        "focus:outline-none border rounded px-3 py-2 flex flex-col items-center",
                        isSelected 
                          ? "border-primary-500 bg-primary-50" 
                          : "border-gray-200 hover:border-primary-500 hover:bg-primary-50"
                      )}
                      onClick={() => setSelectedDate(date)}
                    >
                      <span className="text-xs text-gray-500">
                        {isToday ? "Hoje" : getDayName(date)}
                      </span>
                      <span className="text-sm font-medium">
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Seleção de horário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Escolha o Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-gray-500 text-center py-8">
                  Selecione uma data primeiro
                </p>
              ) : loadingTimes ? (
                <div className="text-center py-4">
                  <Clock className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-500" />
                  <p className="text-sm text-gray-500">Verificando disponibilidade...</p>
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Clock className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Nenhum horário disponível para esta data</p>
                  <p className="text-xs mt-1">Tente selecionar outra data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {availableTimes.map((slot) => {
                      // Verificar se este é o horário atual do agendamento E se estamos na data original
                      const currentAppointmentTime = formatTimeLocal(appointment.date);
                      const currentAppointmentDate = new Date(appointment.date);
                      const isCurrentTime = slot.time === currentAppointmentTime && isSameDay(selectedDate, currentAppointmentDate);
                      
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available || isCurrentTime}
                          className={cn(
                            "px-3 py-2 text-sm border rounded focus:outline-none relative",
                            isCurrentTime
                              ? "border-purple-400 bg-purple-100 text-purple-700 cursor-not-allowed"
                              : !slot.available
                              ? "border-red-300 bg-red-50 text-red-600 cursor-not-allowed"
                              : selectedTime === slot.time
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-gray-200 hover:border-primary-500 hover:bg-primary-50"
                          )}
                          onClick={() => slot.available && !isCurrentTime && setSelectedTime(slot.time)}
                        >
                          {slot.time}
                          {isCurrentTime && (
                            <span className="absolute -top-1 -right-1 text-xs bg-purple-500 text-white px-1 rounded-full">
                              ●
                            </span>
                          )}
                          {!slot.available && !isCurrentTime && (
                            <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white px-1 rounded-full">
                              ✕
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Legenda */}
                  <div className="flex items-center justify-center gap-3 text-xs text-gray-600 pt-2 border-t flex-wrap">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border border-gray-200 rounded bg-white"></div>
                      <span>Disponível</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border border-primary-500 rounded bg-primary-50"></div>
                      <span>Selecionado</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border border-purple-400 rounded bg-purple-100"></div>
                      <span>Horário Atual</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border border-red-300 rounded bg-red-50"></div>
                      <span>Ocupado</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Botão de confirmação */}
        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleReschedule}
            disabled={
              !selectedDate || 
              !selectedTime || 
              isSubmitting || 
              loadingTimes || 
              !availableTimes.some(slot => slot.time === selectedTime && slot.available) ||
              (selectedTime === formatTimeLocal(appointment.date) && isSameDay(selectedDate, new Date(appointment.date))) // Só bloquear o horário atual na data original
            }
            size="lg"
            className="px-8"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Reagendando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmar Reagendamento
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleAppointment; 