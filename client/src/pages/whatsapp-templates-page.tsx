import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";
import { PageHeader } from "@/components/layout/page-header";
import { Shell } from "@/components/ui/sidebar";
import MessageTemplates from "@/components/whatsapp/message-templates";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function WhatsAppTemplatesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Carregar os dados do provider para o usuário atual
  const {
    data: provider,
    isLoading: isProviderLoading,
  } = useQuery({
    queryKey: ["/api/my-provider"],
    enabled: !!user,
  });

  // Verifica se está carregando
  if (isAuthLoading || isProviderLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redireciona para login se não estiver autenticado
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Redireciona para página principal se não for um provider
  if (!provider) {
    return <Redirect to="/" />;
  }

  return (
    <Shell>
      <PageHeader
        heading="Modelos de Mensagens WhatsApp"
        text="Visualize e personalize os modelos de mensagens enviadas para seus clientes."
      >
        <Button variant="outline" asChild>
          <Link href="/settings">Voltar para Configurações</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-8">
        <MessageTemplates providerId={provider.id} />
      </div>
    </Shell>
  );
}