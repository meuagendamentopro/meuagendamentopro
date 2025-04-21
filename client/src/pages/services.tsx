import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/page-header";
import ServiceForm from "@/components/services/service-form";

const ServicesPage: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { toast } = useToast();
  
  // Using default provider ID from storage
  const providerId = 1;

  // Fetch services
  const { data: services, isLoading } = useQuery({
    queryKey: ['/api/providers', providerId, 'services'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  const handleAddService = () => {
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  const handleDeleteService = async (serviceId: number) => {
    try {
      await apiRequest('DELETE', `/api/services/${serviceId}`, undefined);
      queryClient.invalidateQueries({ queryKey: ['/api/providers', providerId, 'services'] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o serviço.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await apiRequest('PUT', `/api/services/${service.id}`, {
        ...service,
        active: !service.active
      });
      queryClient.invalidateQueries({ queryKey: ['/api/providers', providerId, 'services'] });
      toast({
        title: service.active ? "Serviço desativado" : "Serviço ativado",
        description: `O serviço "${service.name}" foi ${service.active ? "desativado" : "ativado"} com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do serviço.",
        variant: "destructive",
      });
    }
  };

  const handleServiceFormComplete = () => {
    setIsDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/providers', providerId, 'services'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Serviços" 
        description="Gerencie os serviços oferecidos"
      >
        <Button onClick={handleAddService}>
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
              <Button onClick={handleAddService}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar serviço
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Adicionar Serviço"}
            </DialogTitle>
          </DialogHeader>
          <ServiceForm
            providerId={providerId}
            service={editingService}
            onComplete={handleServiceFormComplete}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPage;
