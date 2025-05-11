import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { formatDuration } from "@/lib/dates";
import { Service } from "@shared/schema";
import { ServiceForm } from "@/components/services/service-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";

export default function ServicesPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const queryClient = useQueryClient();

  // Fetching provider data
  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch('/api/my-provider');
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    }
  });

  // Fetching services data
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch('/api/my-services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    enabled: !!provider,
  });

  const isLoading = providerLoading || servicesLoading;

  // Mutations
  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: Omit<Service, 'id'>) => {
      const res = await apiRequest("POST", "/api/services", serviceData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
      toast({
        title: "Serviço adicionado",
        description: "Seu novo serviço foi adicionado com sucesso",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao adicionar o serviço",
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (service: Service) => {
      const res = await apiRequest("PATCH", `/api/services/${service.id}`, service);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
      toast({
        title: "Serviço atualizado",
        description: "As alterações foram salvas com sucesso",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao atualizar o serviço",
        variant: "destructive",
      });
    },
  });

  const toggleServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const service = services.find(s => s.id === serviceId);
      const res = await apiRequest("PATCH", `/api/services/${serviceId}`, {
        active: !service.active
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao atualizar o status do serviço",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await apiRequest("DELETE", `/api/services/${serviceId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao excluir o serviço",
        variant: "destructive",
      });
    }
  });

  // Event handlers
  const handleAddService = () => {
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (editingService) {
      updateServiceMutation.mutate({ ...editingService, ...data });
    } else {
      createServiceMutation.mutate({ ...data, providerId: provider.id });
    }
  };

  const handleToggleActive = (service: Service) => {
    toggleServiceMutation.mutate(service.id);
  };

  const handleDeleteService = (serviceId: number) => {
    deleteServiceMutation.mutate(serviceId);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Serviços" 
        description="Gerencie os serviços oferecidos aos seus clientes"
      >
        <Button onClick={handleAddService} disabled={!provider}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar serviço
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">Carregando serviços...</div>
          ) : !services || services.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">Você ainda não tem serviços cadastrados</p>
              <Button onClick={handleAddService} disabled={!provider}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar serviço
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <div className="inline-block min-w-full align-middle px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Nome</TableHead>
                      <TableHead className="whitespace-nowrap">Descrição</TableHead>
                      <TableHead className="whitespace-nowrap">Duração</TableHead>
                      <TableHead className="whitespace-nowrap">Preço</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service: Service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {service.description || "-"}
                        </TableCell>
                        <TableCell>{formatDuration(service.duration)}</TableCell>
                        <TableCell>{formatCurrency(service.price)}</TableCell>
                        <TableCell>
                          <Switch 
                            checked={service.active}
                            onCheckedChange={() => handleToggleActive(service)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditService(service)}
                            className="mr-2"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir serviço</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o serviço "{service.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => handleDeleteService(service.id)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar serviço" : "Adicionar serviço"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? "Atualize as informações do serviço abaixo."
                : "Preencha as informações do novo serviço."}
            </DialogDescription>
          </DialogHeader>
          <ServiceForm
            defaultValues={editingService || {
              name: "",
              description: "",
              duration: 60,
              price: 0,
              active: true
            }}
            onSubmit={handleSubmit}
            isLoading={createServiceMutation.isPending || updateServiceMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}