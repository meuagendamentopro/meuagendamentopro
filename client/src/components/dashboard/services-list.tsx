import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { Service } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ServiceForm from "@/components/services/service-form";

interface ServicesListProps {
  providerId: number;
  limit?: number;
  showAddButton?: boolean;
}

const ServicesList: React.FC<ServicesListProps> = ({ 
  providerId, 
  limit = 5, 
  showAddButton = true 
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { toast } = useToast();

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

  const handleServiceFormComplete = () => {
    setIsDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/providers', providerId, 'services'] });
  };

  const displayServices = services?.slice(0, limit) || [];

  return (
    <>
      <Card>
        <CardHeader className="px-6 py-4 flex-row items-center justify-between">
          <CardTitle>Seus serviços</CardTitle>
          {showAddButton && (
            <Button
              variant="outline"
              size="sm"
              className="px-2.5 py-1.5 text-xs"
              onClick={handleAddService}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(limit)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : displayServices.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {displayServices.map((service: Service) => (
                <li key={service.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-500">{formatDuration(service.duration)}</p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900 mr-4">
                      {formatCurrency(service.price)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditService(service)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-gray-500">
              Nenhum serviço cadastrado. Clique em "Adicionar" para criar seu primeiro serviço.
            </div>
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
    </>
  );
};

export default ServicesList;
