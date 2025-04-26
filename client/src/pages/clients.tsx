import React, { useState } from "react";
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
import { Search, UserPlus, User, Phone, Mail, FileText } from "lucide-react";
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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const { toast } = useToast();

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

  // Handle client deletion
  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };
  
  // Confirm and process client deletion
  const confirmDelete = async () => {
    if (!clientToDelete) return;
    
    try {
      await apiRequest("DELETE", `/api/clients/${clientToDelete.id}`);
      
      toast({
        title: "Cliente desativado",
        description: "O cliente foi desativado com sucesso.",
      });
      
      // Atualizar a lista de clientes
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível desativar o cliente.",
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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Clientes" 
        description="Gerencie sua base de clientes"
      >
        <Button onClick={handleAddClient}>
          <UserPlus className="h-4 w-4 mr-2" /> Adicionar cliente
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatPhoneNumber(client.phone)}</TableCell>
                      <TableCell>{client.email || "-"}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {client.notes || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClient(client)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClient(client)}
                          >
                            Excluir
                          </Button>
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
        <DialogContent className="sm:max-w-[500px]">
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
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <PhoneInput placeholder="(00) 00000-0000" className="pl-9" {...field} />
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              {clientToDelete && (
                <>
                  Tem certeza que deseja desativar o cliente <strong>{clientToDelete.name}</strong>?
                  <br /><br />
                  Se o cliente tiver agendamentos, será apenas marcado como desativado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsPage;
