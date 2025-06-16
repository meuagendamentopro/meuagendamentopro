import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, User, Phone, DollarSign, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/phone-input';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentData {
  id: number;
  date: string;
  endTime: string;
  status: string;
  rescheduleCount: number;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  providerName: string;
  providerId: number;
  clientName?: string;
  clientPhone?: string;
  employeeName?: string;
}

const AppointmentLookupPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [providerId, setProviderId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const { toast } = useToast();

  // Extrair providerId da URL e determinar URL de booking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('providerId');
    if (providerParam) {
      setProviderId(parseInt(providerParam));
      
      // Determinar a URL de booking baseada no referrer ou construir dinamicamente
      const referrer = document.referrer;
      console.log('Referrer:', referrer);
      
      if (referrer && referrer.includes('/booking/')) {
        // Se veio de uma página de booking específica, usar essa URL
        const bookingPath = referrer.split('/booking/')[1];
        if (bookingPath) {
          setBookingUrl(`/booking/${bookingPath}`);
        } else {
          setBookingUrl(`/?providerId=${providerParam}`);
        }
      } else if (referrer && referrer.includes('?providerId=')) {
        // Se veio da página principal com providerId
        setBookingUrl(`/?providerId=${providerParam}`);
      } else {
        // Fallback: construir URL baseada no providerId
        setBookingUrl(`/?providerId=${providerParam}`);
      }
    }
  }, []);

  // Buscar agendamentos por telefone (apenas do provider atual)
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['/api/appointments/lookup', phone, providerId],
    queryFn: async () => {
      if (!phone || !providerId) return [];
      
      const res = await fetch(`/api/appointments/lookup?phone=${encodeURIComponent(phone)}&providerId=${providerId}`);
      if (!res.ok) {
        throw new Error('Erro ao buscar agendamentos');
      }
      return res.json();
    },
    enabled: false, // Só executa quando chamado manualmente
  });

  // Buscar dados do provider para obter o bookingLink
  const { data: provider } = useQuery({
    queryKey: [`/api/providers/${providerId}`],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}`);
      if (!res.ok) throw new Error('Failed to fetch provider details');
      return res.json();
    },
    enabled: !!providerId,
  });

  // Atualizar bookingUrl quando os dados do provider chegarem
  useEffect(() => {
    if (provider && provider.bookingLink) {
      console.log('Provider bookingLink:', provider.bookingLink);
      
      // Se o provider tem um bookingLink personalizado, usar ele
      const referrer = document.referrer;
      if (referrer && referrer.includes('/booking/')) {
        // Manter a URL original se veio de booking
        const bookingPath = referrer.split('/booking/')[1];
        if (bookingPath) {
          setBookingUrl(`/booking/${bookingPath}`);
        } else {
          // Se bookingLink já começa com /booking/, usar diretamente
          if (provider.bookingLink.startsWith('/booking/')) {
            setBookingUrl(provider.bookingLink);
          } else {
            setBookingUrl(`/booking/${provider.bookingLink}`);
          }
        }
      } else {
        // Verificar se o bookingLink já é uma URL completa
        if (provider.bookingLink.startsWith('/booking/')) {
          // Se já começa com /booking/, usar diretamente
          setBookingUrl(provider.bookingLink);
        } else if (provider.bookingLink.startsWith('/')) {
          // Se começa com /, mas não é /booking/, adicionar /booking
          setBookingUrl(`/booking${provider.bookingLink}`);
        } else {
          // Se não começa com /, adicionar /booking/ diretamente
          setBookingUrl(`/booking/${provider.bookingLink}`);
        }
      }
    }
  }, [provider]);

  const handleSearch = () => {
    if (phone && providerId) {
      refetch();
    }
  };

  const handleReschedule = (appointmentId: number) => {
    setLocation(`/reschedule-appointment/${appointmentId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      confirmed: { label: 'Confirmado', variant: 'default' as const },
      pending: { label: 'Pendente', variant: 'secondary' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
      completed: { label: 'Concluído', variant: 'outline' as const },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const canReschedule = (appointment: AppointmentData) => {
    // Não pode reagendar se já foi reagendado o máximo de vezes
    if (appointment.rescheduleCount >= 1) return false;
    
    // Não pode reagendar se não está confirmado ou pendente
    if (appointment.status !== 'confirmed' && appointment.status !== 'pending') return false;
    
    // Verificar se faltam pelo menos 30 minutos para o agendamento
    const appointmentDate = new Date(appointment.date);
    const now = new Date();
    const timeDiff = appointmentDate.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
    
    // Debug para entender o cálculo
    console.log(`Verificando reagendamento para agendamento ${appointment.id}:`);
    console.log(`- Data do agendamento: ${appointmentDate.toLocaleString('pt-BR')}`);
    console.log(`- Horário atual: ${now.toLocaleString('pt-BR')}`);
    console.log(`- Diferença em minutos: ${minutesDiff}`);
    console.log(`- Pode reagendar: ${minutesDiff >= 30}`);
    
    return minutesDiff >= 30;
  };

  if (!providerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Provider não especificado
              </h3>
              <p className="text-gray-500">
                Por favor, acesse esta página através do link de agendamento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Consultar Agendamento
          </h1>
          <p className="text-gray-600">
            Digite seu telefone para consultar seus agendamentos
          </p>
        </div>

        {/* Formulário de busca */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Buscar por Telefone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="phone">Número de Telefone</Label>
                <PhoneInput
                  placeholder="Digite seu telefone"
                  value={phone}
                  onChange={(value: string) => setPhone(value)}
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={!phone || isLoading}
                className="px-8"
              >
                {isLoading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {appointments && appointments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Seus Agendamentos ({appointments.length})
            </h2>
            
            {appointments.map((appointment: AppointmentData) => (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{appointment.clientName || 'Cliente'}</span>
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Funcionário: {appointment.employeeName || 'Não especificado'}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(appointment.date)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(appointment.date)} - {formatTime(appointment.endTime)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{appointment.serviceName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          <span>R$ {appointment.servicePrice.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{appointment.serviceDuration} minutos</span>
                        </div>
                      </div>
                      
                      {appointment.rescheduleCount > 0 && (
                        <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Este agendamento já foi reagendado {appointment.rescheduleCount} vez(es)
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {canReschedule(appointment) ? (
                        <Button 
                          onClick={() => handleReschedule(appointment.id)}
                          variant="outline"
                          size="sm"
                        >
                          Reagendar
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled
                          title={
                            appointment.rescheduleCount >= 1 
                              ? "Limite de reagendamentos atingido"
                              : appointment.status !== 'confirmed' && appointment.status !== 'pending'
                              ? "Agendamento não pode ser reagendado"
                              : "Reagendamento deve ser feito com pelo menos 30 minutos de antecedência"
                          }
                        >
                          Reagendar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {appointments && appointments.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum agendamento encontrado
                </h3>
                <p className="text-gray-500">
                  Não encontramos agendamentos para este telefone.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão voltar */}
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={() => {
              if (bookingUrl) {
                setLocation(bookingUrl);
              } else {
                // Fallback para history.back() se não conseguir determinar a URL
                window.history.back();
              }
            }}
          >
            Voltar para Agendamento
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentLookupPage; 