import React, { useState } from "react";
import ClientNotesReportModal from "@/components/clients/client-notes-report-modal";
import ClientAppointmentHistoryModal from "@/components/clients/client-appointment-history-modal";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  UserPlus, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  MoreVertical, 
  Shield, 
  ShieldOff, 
  Trash, 
  Edit2, 
  AlertTriangle,
  Ban,
  MessageCircle,
  Calendar,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";
import { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

// Client form schema
const clientFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  phone: z.string().min(10, { message: "Telefone inválido" }),
  email: z.string().email({ message: "Email inválido" }).optional().or(z.literal("")),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

const ClientsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [clientToBlock, setClientToBlock] = useState<Client | null>(null);
  const { toast } = useToast();

  // Fetch provider data
  const { data: providerData } = useQuery({
    queryKey: ["/api/my-provider"],
    queryFn: async () => {
      const res = await fetch("/api/my-provider");
      if (!res.ok) throw new Error("Failed to fetch provider data");
      return res.json();
    },
  });

  // Fetch clients
  const { data: clients, isLoading, refetch: refetchClients } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  // Form for adding/editing clients
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  // Filter clients based on search term
  const filteredClients = React.useMemo(() => {
    if (!clients) return [];
    
    if (!searchTerm) return clients;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return clients.filter((client: Client) => 
      client.name.toLowerCase().includes(lowerSearchTerm) ||
      client.phone.includes(searchTerm) ||
      (client.email && client.email.toLowerCase().includes(lowerSearchTerm))
    );
  }, [clients, searchTerm]);

  const handleAddClient = () => {
    setSelectedClient(null);
    form.reset({
      name: "",
      phone: "",
      email: "",
      notes: ""
    });
    setIsDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    form.reset({
      name: client.name,
      phone: client.phone,
      email: client.email || "",
      notes: client.notes || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: ClientFormValues) => {
    try {
      if (selectedClient) {
        // Update existing client
        await apiRequest("PUT", `/api/clients/${selectedClient.id}`, data);
        toast({
          title: "Cliente atualizado",
          description: "Os dados do cliente foram atualizados com sucesso.",
        });
      } else {
        // Create new client
        await apiRequest("POST", "/api/clients", data);
        toast({
          title: "Cliente adicionado",
          description: "O cliente foi adicionado com sucesso.",
        });
      }
      
      setIsDialogOpen(false);
      refetchClients();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar os dados do cliente.",
        variant: "destructive",
      });
    }
  };

  // Handle client block/unblock
  const handleToggleBlock = (client: Client) => {
    setClientToBlock(client);
    setIsBlockDialogOpen(true);
  };
  
  // Handle opening client notes report
  const handleOpenNotesReport = (client: Client) => {
    setSelectedClient(client);
    setIsReportModalOpen(true);
  };
  
  // Handle opening client appointment history
  const handleOpenAppointmentHistory = (client: Client) => {
    setSelectedClient(client);
    setIsHistoryModalOpen(true);
  };

  // Confirm and process block/unblock
  const confirmToggleBlock = async () => {
    if (!clientToBlock) return;
    
    try {
      const newBlockedState = !clientToBlock.isBlocked;
      await apiRequest("PATCH", `/api/clients/${clientToBlock.id}/block`, { 
        blocked: newBlockedState 
      });
      
      toast({
        title: newBlockedState ? "Cliente bloqueado" : "Cliente desbloqueado",
        description: newBlockedState 
          ? "O cliente foi bloqueado e não poderá realizar novos agendamentos." 
          : "O cliente foi desbloqueado e já pode realizar agendamentos.",
      });
      
      // Atualizar a lista de clientes
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsBlockDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do cliente.",
        variant: "destructive",
      });
    }
  };

  // Handle client permanent deletion
  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };
  
  // Confirm and process permanent deletion
  const confirmDelete = async () => {
    if (!clientToDelete) return;
    
    try {
      await apiRequest("DELETE", `/api/clients/${clientToDelete.id}`);
      
      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído permanentemente do sistema.",
      });
      
      // Atualizar a lista de clientes
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente.",
        variant: "destructive",
      });
    }
  };

  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Formatar número de telefone para exibição, considerando o país
  const formatClientPhone = (phone: string) => {
    // Se o número já tem código internacional (começa com +), exibir como está
    if (phone.startsWith('+')) {
      // Se for um número brasileiro com código internacional (+55), remover o código do país
      if (phone.startsWith('+55')) {
        const phoneWithoutCountryCode = phone.substring(3); // Remove o +55
        return formatPhoneNumber(phoneWithoutCountryCode);
      }
      return phone; // Outros números internacionais exibir como estão
    } else {
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Verificar se é um número de Portugal (especificamente começa com 351 ou tem o formato (35))
      if ((phone.includes('(35)') && !phone.includes('(35)9')) || 
          (cleanPhone.startsWith('351') && cleanPhone.length >= 11)) {
        // Formatar como número de Portugal
        if (cleanPhone.startsWith('351')) {
          // Se já tem o código do país, formatar adequadamente
          const countryCode = cleanPhone.substring(0, 3); // 351
          const rest = cleanPhone.substring(3);
          
          // Formato português: +351 XXX XXX XXX
          return `+${countryCode} ${rest.substring(0, 3)} ${rest.substring(3, 6)} ${rest.substring(6)}`;
        } else {
          // Se está no formato (35) XXXXX-XXXX
          return `+351 ${cleanPhone.substring(2, 5)} ${cleanPhone.substring(5, 8)} ${cleanPhone.substring(8)}`;
        }
      } else {
        // Verificar se o número já começa com 55 (código do Brasil)
        if (cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
          // Remover o código do país e formatar apenas com DDD + número
          const phoneWithoutCountryCode = cleanPhone.substring(2);
          return formatPhoneNumber(phoneWithoutCountryCode);
        } else {
          // Se não tem o código do país, formatar normalmente
          return formatPhoneNumber(phone);
        }
      }
    }
  };

  // Create WhatsApp URL from phone number
  const getWhatsAppUrl = (phone: string) => {
    // Verificar se o número já tem código internacional
    if (phone.startsWith('+')) {
      // Se já tem código internacional, remover o + e usar como está
      return `https://wa.me/${phone.substring(1)}`;
    } else {
      // Detectar país pelo formato do número
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Verificar se o número tem o formato (35) XXXXX-XXXX ou similar
      // Isso indica que é um número de Portugal com código 351
      if ((phone.includes('(35)') && !phone.includes('(35)9')) || 
          (cleanPhone.startsWith('351') && cleanPhone.length >= 11)) {
        // É um número de Portugal, usar o código 351
        if (cleanPhone.startsWith('351')) {
          return `https://wa.me/${cleanPhone}`; // Já tem o código do país
        } else {
          // Adicionar o código 351 se não estiver presente
          return `https://wa.me/351${cleanPhone.substring(2)}`;
        }
      } else {
        // Se não for identificado como outro país, verificar se já começa com 55 (Brasil)
        if (cleanPhone.startsWith('55')) {
          return `https://wa.me/${cleanPhone}`; // Já tem o código do Brasil
        } else {
          return `https://wa.me/55${cleanPhone}`; // Adicionar o código do Brasil
        }
      }
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      <PageHeader 
        title="Clientes" 
        description="Gerencie sua base de clientes"
      >
        <Button onClick={handleAddClient}>
          <UserPlus className="h-4 w-4 mr-2" /> Adicionar cliente
        </Button>
      </PageHeader>

      <Card className="w-full">
        <CardContent className="pt-6 w-full">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Clients Table */}
          {isLoading ? (
            <div className="py-8 text-center">Carregando clientes...</div>
          ) : !filteredClients.length ? (
            <div className="py-8 text-center">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum cliente encontrado</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? "Tente ajustar sua busca"
                  : "Comece a adicionar clientes para vê-los aqui"}
              </p>
              <Button onClick={handleAddClient}>
                <UserPlus className="h-4 w-4 mr-2" /> Adicionar cliente
              </Button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="w-full min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/6">Nome</TableHead>
                    <TableHead className="w-1/6">Telefone</TableHead>
                    <TableHead className="hidden md:table-cell w-1/6">Email</TableHead>
                    <TableHead className="hidden md:table-cell w-1/6">Observações</TableHead>
                    <TableHead className="w-auto text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client: Client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <span className="font-medium text-gray-600">{getInitials(client.name)}</span>
                          </div>
                          <div>
                            <span className="font-medium">{client.name}</span>
                            {client.isBlocked && (
                              <Badge variant="destructive" className="ml-2">
                                <Ban className="h-3 w-3 mr-1" />
                                Bloqueado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a 
                          href={getWhatsAppUrl(client.phone)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-primary hover:text-primary/80 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4 mr-1.5" />
                          {formatClientPhone(client.phone)}
                        </a>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{client.email || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="max-w-xs truncate">
                          {client.notes || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Botões para telas maiores */}
                        <div className="hidden md:flex md:items-center md:justify-end md:space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditClient(client)}
                            className="h-8 px-2 py-1 text-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenAppointmentHistory(client)}
                            className="h-8 px-2 py-1 text-xs"
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            Histórico de Atendimento
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenNotesReport(client)}
                            className="h-8 px-2 py-1 text-xs"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Relatório
                          </Button>
                          
                          <Button 
                            variant={client.isBlocked ? "default" : "outline"}
                            size="sm" 
                            onClick={() => handleToggleBlock(client)}
                            className="h-8 px-2 py-1 text-xs"
                          >
                            {client.isBlocked ? (
                              <>
                                <ShieldOff className="h-3.5 w-3.5 mr-1" />
                                Desbloquear
                              </>
                            ) : (
                              <>
                                <Shield className="h-3.5 w-3.5 mr-1" />
                                Bloquear
                              </>
                            )}
                          </Button>
                          
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDeleteClient(client)}
                            className="h-8 px-2 py-1 text-xs"
                          >
                            <Trash className="h-3.5 w-3.5 mr-1" />
                            Excluir
                          </Button>
                        </div>
                        
                        {/* Menu dropdown para dispositivos móveis */}
                        <div className="md:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => handleOpenAppointmentHistory(client)}>
                                <Calendar className="h-4 w-4 mr-2" />
                                Histórico de Atendimento
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => handleOpenNotesReport(client)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Ver Relatório
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => handleToggleBlock(client)}>
                                {client.isBlocked ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                    Desbloquear cliente
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Bloquear cliente
                                  </>
                                )}
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClient(client)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash className="h-4 w-4 mr-2" />
                                Excluir permanentemente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Client Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedClient ? "Editar Cliente" : "Adicionar Cliente"}
            </DialogTitle>
            <DialogDescription>
              {selectedClient 
                ? "Atualize as informações do cliente abaixo."
                : "Preencha as informações para adicionar um novo cliente."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input className="pl-9" placeholder="Nome completo" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <div>
                        <PhoneInput 
                          placeholder="(00) 00000-0000" 
                          value={field.value}
                          onChange={field.onChange}
                          defaultCountry="BR"
                          onCountryChange={(country) => {
                            // Quando o país muda, precisamos atualizar o formato do número
                            // mas não precisamos armazenar o código do país separadamente neste caso
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (opcional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input className="pl-9" placeholder="email@exemplo.com" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações (opcional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Textarea 
                          className="pl-9 min-h-[100px]" 
                          placeholder="Informações adicionais sobre o cliente" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedClient ? "Salvar alterações" : "Adicionar cliente"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Block/Unblock confirmation dialog */}
      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clientToBlock?.isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clientToBlock?.isBlocked
                ? `Tem certeza que deseja desbloquear ${clientToBlock?.name}? Isso permitirá que o cliente faça agendamentos novamente.`
                : `Tem certeza que deseja bloquear ${clientToBlock?.name}? Isso impedirá que o cliente faça novos agendamentos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmToggleBlock} 
              className={clientToBlock?.isBlocked ? 
                "bg-primary text-primary-foreground hover:bg-primary/90" : 
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {clientToBlock?.isBlocked ? "Desbloquear" : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    
      {/* Permanent Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Excluir permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clientToDelete && (
                <>
                  <p className="font-semibold mb-2">
                    Você está prestes a excluir o cliente <strong>{clientToDelete.name}</strong> permanentemente.
                  </p>
                  
                  <p className="mb-2">
                    Esta ação <strong>não pode ser desfeita</strong> e removerá todos os dados deste cliente do sistema.
                  </p>
                  
                  <p>
                    Se você só quer impedir este cliente de fazer agendamentos, 
                    considere usar a opção <strong>Bloquear cliente</strong> em vez de excluir.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Client Notes Report Modal */}
      {selectedClient && providerData && (
        <ClientNotesReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          client={selectedClient}
          providerId={providerData.id}
        />
      )}
      
      {/* Client Appointment History Modal */}
      {selectedClient && (
        <ClientAppointmentHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          client={selectedClient}
        />
      )}
    </div>
  );
};

export default ClientsPage;
