import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Phone, 
  Calendar, 
  Clock, 
  User, 
  CreditCard, 
  MessageSquare, 
  X, 
  CheckCircle2, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate, formatTime } from '@/lib/dates';
import { formatPhoneNumber } from '@/lib/utils';
import { toast } from "@/hooks/use-toast";
import { AppointmentPixPayment } from "./appointment-pix-payment";

// Definir tipos para status de agendamento
type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface AppointmentDetailsProps {
  appointment: any;
  isOpen: boolean;
  onClose: () => void;
  clients?: any[];
  services?: any[];
  onStatusChange?: (id: number, status: string, reason?: string) => void;
}

export const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({
  appointment,
  isOpen,
  onClose,
  clients,
  services,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status || 'pending');
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('details');

  // Buscar o cliente relacionado ao agendamento
  const client = clients?.find(c => c.id === appointment?.clientId);
  // Buscar o serviço relacionado ao agendamento
  const service = services?.find(s => s.id === appointment?.serviceId);

  // Mutação para atualizar o status do agendamento
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: string; reason?: string }) => {
      const res = await apiRequest('PATCH', `/api/appointments/${id}/status`, { status, reason });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status atualizado",
        description: `O agendamento foi ${status === 'cancelled' ? 'cancelado' : 'atualizado'} com sucesso.`,
      });
      // Atualizar a lista de agendamentos
      queryClient.invalidateQueries({ queryKey: ['/api/my-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/providers/34/appointments'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o status do agendamento.",
        variant: "destructive",
      });
    }
  });

  // Formatar data e hora
  const appointmentDate = appointment ? new Date(appointment.date) : new Date();
  const formattedDate = formatDate(appointmentDate);
  const formattedTime = formatTime(appointmentDate);

  // Verificar se o provedor exige pagamento via PIX
  const requiresPayment = appointment?.requiresPayment === true;
  
  // Verificar se o pagamento já foi realizado
  const isPaid = appointment?.paymentStatus === 'paid';
  
  // Status de agendamento permitidos para serem selecionados
  const allowedStatuses = () => {
    // Se for um agendamento passado, só permite Concluído ou Cancelado
    const now = new Date();
    const isPastAppointment = appointmentDate < now;

    if (isPastAppointment) {
      return ['completed', 'cancelled'];
    }

    // Se requer pagamento e não foi pago, só permite Pendente ou Cancelado
    if (requiresPayment && !isPaid) {
      return ['pending', 'cancelled'];
    }

    // Caso contrário, permite todos os status exceto o atual
    return ['pending', 'confirmed', 'completed', 'cancelled'].filter(s => s !== appointment?.status);
  };

  const handleStatusChange = () => {
    if (status === 'cancelled' && !cancellationReason.trim()) {
      toast({
        title: "Motivo do cancelamento necessário",
        description: "Por favor, informe o motivo do cancelamento.",
        variant: "destructive",
      });
      return;
    }

    updateStatusMutation.mutate({
      id: appointment.id,
      status,
      reason: status === 'cancelled' ? cancellationReason : undefined,
    });
  };

  // Formatação do valor do serviço
  const formatCurrency = (value?: number) => {
    if (!value) return "R$ 0,00";
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Detalhes do Agendamento #{appointment.id}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="payment">Pagamento</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>
          
          {/* Tab de Detalhes */}
          <TabsContent value="details">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Informações do Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{client?.name || "Cliente não encontrado"}</span>
                      </div>
                      {client?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span>{formatPhoneNumber(client.phone)}</span>
                        </div>
                      )}
                      {client?.email && (
                        <div className="flex items-center gap-2">
                          <svg 
                            className="h-4 w-4 text-gray-500" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="2" 
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          <span>{client.email}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Detalhes do Serviço</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="font-medium">{service?.name || "Serviço não encontrado"}</div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{service?.duration || "30"} minutos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-gray-500" />
                        <span>{formatCurrency(service?.price)}</span>
                      </div>

                      {/* Detalhes do pagamento quando pagamento parcial é utilizado */}
                      {appointment.requiresPayment && appointment.paymentPercentage && appointment.paymentPercentage < 100 && (
                        <>
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Valor pago: {formatCurrency(appointment.paymentAmount)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            <span>Valor restante: {formatCurrency(service?.price && appointment.paymentAmount 
                              ? service.price - appointment.paymentAmount 
                              : 0)}</span>
                          </div>
                        </>
                      )}

                      {/* Status do pagamento */}
                      {appointment.requiresPayment && (
                        <div className={`flex items-center gap-2 font-medium mt-1 ${
                          appointment.paymentStatus === 'confirmed' || appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'approved'
                            ? 'text-green-600'
                            : appointment.paymentStatus === 'pending'
                            ? 'text-amber-600'
                            : appointment.paymentStatus === 'failed'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          {appointment.paymentStatus === 'confirmed' || appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'approved' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : appointment.paymentStatus === 'pending' ? (
                            <Clock className="h-4 w-4" />
                          ) : appointment.paymentStatus === 'failed' ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <span>
                            {appointment.paymentStatus === 'confirmed' || appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'approved'
                              ? 'Pagamento confirmado'
                              : appointment.paymentStatus === 'pending'
                              ? 'Aguardando pagamento'
                              : appointment.paymentStatus === 'failed'
                              ? 'Pagamento falhou'
                              : appointment.paymentStatus === 'not_required'
                              ? 'Pagamento na hora'
                              : 'Status desconhecido'}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Horário Agendado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>{formattedTime}</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {appointment.status === 'pending' ? 'Pendente' :
                        appointment.status === 'confirmed' ? 'Confirmado' :
                        appointment.status === 'completed' ? 'Concluído' :
                        'Cancelado'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {appointment.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-gray-500 mt-1" />
                      <span>{appointment.notes}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {appointment.cancellationReason && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-red-600">Motivo do Cancelamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 mt-1" />
                      <span>{appointment.cancellationReason}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          {/* Tab de Pagamento */}
          <TabsContent value="payment">
            {service ? (
              <AppointmentPixPayment 
                appointmentId={appointment.id} 
                servicePrice={service.price || 0} 
                serviceName={service.name || ""}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center text-center p-4">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                    <span>Informações do serviço não encontradas</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Tab de Atualização de Status */}
          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>Atualizar Status</CardTitle>
                <CardDescription>
                  Altere o status atual do agendamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Novo Status</Label>
                  <Select 
                    value={status} 
                    onValueChange={(value) => setStatus(value as AppointmentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedStatuses().includes('pending') && (
                        <SelectItem value="pending">Pendente</SelectItem>
                      )}
                      {allowedStatuses().includes('confirmed') && (
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                      )}
                      {allowedStatuses().includes('completed') && (
                        <SelectItem value="completed">Concluído</SelectItem>
                      )}
                      {allowedStatuses().includes('cancelled') && (
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {status === 'cancelled' && (
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo do Cancelamento</Label>
                    <Textarea 
                      id="reason" 
                      placeholder="Informe o motivo do cancelamento"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                    />
                  </div>
                )}
                
                <Button
                  onClick={handleStatusChange}
                  disabled={
                    updateStatusMutation.isPending || 
                    status === appointment.status || 
                    (status === 'cancelled' && !cancellationReason.trim())
                  }
                  className="w-full"
                  variant={status === 'cancelled' ? "destructive" : "default"}
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : status === 'cancelled' ? (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar Agendamento
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Atualizar Status
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};