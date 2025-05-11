import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ToastTester() {
  const { toast } = useToast();

  const showSuccessToast = () => {
    toast({
      title: "Sucesso!",
      description: "Operação realizada com sucesso.",
      variant: "default", // cor verde
    });
  };

  const showErrorToast = () => {
    toast({
      title: "Erro!",
      description: "Ocorreu um erro ao realizar a operação.",
      variant: "destructive", // cor vermelha
    });
  };

  const showWarningToast = () => {
    toast({
      title: "Aviso!",
      description: "Esta ação requer sua atenção.",
      variant: "warning", // cor amarela
    });
  };

  const showInfoToast = () => {
    toast({
      title: "Informação",
      description: "Este é um toast informativo.",
      variant: "info", // cor azul
    });
  };

  return (
    <div className="flex flex-col gap-2 items-start">
      <Button onClick={showSuccessToast} variant="default">Mostrar Toast de Sucesso</Button>
      <Button onClick={showErrorToast} variant="destructive">Mostrar Toast de Erro</Button>
      <Button onClick={showWarningToast} variant="outline">Mostrar Toast de Aviso</Button>
      <Button onClick={showInfoToast} variant="secondary">Mostrar Toast Informativo</Button>
    </div>
  );
}