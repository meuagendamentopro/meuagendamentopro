import React from 'react';
import { useTimeExclusions } from '@/hooks/use-time-exclusions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, Clock, Calendar } from 'lucide-react';
import { TimeExclusionDialog } from './time-exclusion-dialog';
import { TimeExclusion } from '@shared/schema';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

const DAYS_OF_WEEK = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
  7: 'Domingo',
  all: 'Todos os dias'
};

export function TimeExclusionManager() {
  const {
    timeExclusions,
    isLoading,
    isError,
    getGroupedExclusions,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    isDialogOpen,
    editingExclusion,
    selectedDayOfWeek,
    deleteExclusionMutation,
    toggleExclusionStatus
  } = useTimeExclusions();

  const [activeTab, setActiveTab] = React.useState('all');
  const [exclusionToDelete, setExclusionToDelete] = React.useState<TimeExclusion | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const groupedExclusions = getGroupedExclusions();

  // Handler para o botão de exclusão
  const handleDelete = (exclusion: TimeExclusion) => {
    setExclusionToDelete(exclusion);
    setIsDeleteDialogOpen(true);
  };

  // Confirmar exclusão
  const confirmDelete = () => {
    if (exclusionToDelete) {
      deleteExclusionMutation.mutate(exclusionToDelete.id);
      setIsDeleteDialogOpen(false);
      setExclusionToDelete(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-6">Carregando exclusões de horário...</div>;
  }

  if (isError) {
    return <div className="text-destructive p-6">Erro ao carregar exclusões de horário</div>;
  }

  // Renderizar o conteúdo da tab
  const renderTabContent = (day: string) => {
    const exclusions = groupedExclusions[day] || [];
    
    return (
      <div className="space-y-4">
        {exclusions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            {day === 'all' 
              ? 'Nenhuma exclusão configurada para todos os dias' 
              : `Nenhuma exclusão específica para ${DAYS_OF_WEEK[day as keyof typeof DAYS_OF_WEEK]}`}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exclusions.map(exclusion => (
              <Card key={exclusion.id} className={`shadow-sm ${!exclusion.isActive ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-medium">
                      {exclusion.name || `Exclusão ${exclusion.startTime}-${exclusion.endTime}`}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Switch 
                        id={`switch-${exclusion.id}`}
                        checked={exclusion.isActive}
                        onCheckedChange={() => toggleExclusionStatus(exclusion.id, exclusion.isActive)}
                      />
                      <Label htmlFor={`switch-${exclusion.id}`} className="text-xs">
                        {exclusion.isActive ? 'Ativo' : 'Inativo'}
                      </Label>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {exclusion.startTime} - {exclusion.endTime}
                    </span>
                    {exclusion.dayOfWeek && (
                      <>
                        <Calendar className="h-3.5 w-3.5 ml-2" />
                        <span>{DAYS_OF_WEEK[exclusion.dayOfWeek as keyof typeof DAYS_OF_WEEK]}</span>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-end pt-2 gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openEditDialog(exclusion)}
                    className="h-8 px-2"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(exclusion)}
                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Períodos Indisponíveis</h2>
          <Button onClick={() => openCreateDialog(activeTab === 'all' ? null : parseInt(activeTab))}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nova Exclusão
          </Button>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 md:grid-cols-8">
            <TabsTrigger value="all">
              Todos
              {groupedExclusions.all.length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions.all.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="1">
              Seg
              {groupedExclusions['1'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['1'].length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="2">
              Ter
              {groupedExclusions['2'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['2'].length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="3">
              Qua
              {groupedExclusions['3'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['3'].length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="4">
              Qui
              {groupedExclusions['4'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['4'].length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="5">
              Sex
              {groupedExclusions['5'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['5'].length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="6">
              Sáb
              {groupedExclusions['6'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['6'].length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="7">
              Dom
              {groupedExclusions['7'].length > 0 && (
                <Badge variant="secondary" className="ml-1">{groupedExclusions['7'].length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          {/* Conteúdo das tabs */}
          <TabsContent value="all" className="mt-4">
            {renderTabContent('all')}
          </TabsContent>
          <TabsContent value="1" className="mt-4">
            {renderTabContent('1')}
          </TabsContent>
          <TabsContent value="2" className="mt-4">
            {renderTabContent('2')}
          </TabsContent>
          <TabsContent value="3" className="mt-4">
            {renderTabContent('3')}
          </TabsContent>
          <TabsContent value="4" className="mt-4">
            {renderTabContent('4')}
          </TabsContent>
          <TabsContent value="5" className="mt-4">
            {renderTabContent('5')}
          </TabsContent>
          <TabsContent value="6" className="mt-4">
            {renderTabContent('6')}
          </TabsContent>
          <TabsContent value="7" className="mt-4">
            {renderTabContent('7')}
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogo de edição/criação */}
      {isDialogOpen && (
        <TimeExclusionDialog
          isOpen={isDialogOpen}
          onClose={closeDialog}
          exclusion={editingExclusion}
          dayOfWeek={selectedDayOfWeek}
        />
      )}

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta faixa de horário indisponível?
              {exclusionToDelete && (
                <div className="mt-2 font-medium">
                  {exclusionToDelete.name || `${exclusionToDelete.startTime} - ${exclusionToDelete.endTime}`}
                  {exclusionToDelete.dayOfWeek ? 
                    ` (${DAYS_OF_WEEK[exclusionToDelete.dayOfWeek as keyof typeof DAYS_OF_WEEK]})` : 
                    ' (Todos os dias)'}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}