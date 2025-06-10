import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Calendar, Users, Clock, CreditCard, Settings, BarChart3, MessageSquare, UserCheck, Building2 } from "lucide-react";

export default function LandingPage() {
  const [, navigate] = useLocation();
  
  // Buscar configurações do sistema para obter o logo
  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Erro ao buscar configurações do sistema');
      }
      return await response.json();
    },
  });

  // Lista de recursos/funcionalidades - ATUALIZADA com gestão de equipe
  const features = [
    {
      title: "Agendamento Online",
      description: "Permita que seus clientes agendem serviços 24/7 através de uma interface intuitiva e responsiva.",
      icon: <Calendar className="h-10 w-10 text-primary" />
    },
    {
      title: "Gestão de Equipe",
      description: "Gerencie profissionais, horários individuais e distribua agendamentos automaticamente entre sua equipe.",
      icon: <UserCheck className="h-10 w-10 text-primary" />
    },
    {
      title: "Gerenciamento de Clientes",
      description: "Mantenha um cadastro completo dos seus clientes com histórico de atendimentos e preferências.",
      icon: <Users className="h-10 w-10 text-primary" />
    },
    {
      title: "Controle de Horários",
      description: "Configure disponibilidade individual de cada profissional, intervalos e bloqueios de horários.",
      icon: <Clock className="h-10 w-10 text-primary" />
    },
    {
      title: "Pagamentos Online",
      description: "Aceite pagamentos via PIX diretamente pelo sistema, com confirmação automática.",
      icon: <CreditCard className="h-10 w-10 text-primary" />
    },
    {
      title: "Personalização Empresarial",
      description: "Adapte o sistema às necessidades da sua empresa com configurações flexíveis para múltiplos profissionais.",
      icon: <Building2 className="h-10 w-10 text-primary" />
    },
    {
      title: "Relatórios e Análises",
      description: "Acompanhe o desempenho individual e da equipe com relatórios detalhados e gráficos intuitivos.",
      icon: <BarChart3 className="h-10 w-10 text-primary" />
    },
    {
      title: "Notificações",
      description: "Envie lembretes automáticos por e-mail para reduzir faltas e melhorar a experiência do cliente.",
      icon: <MessageSquare className="h-10 w-10 text-primary" />
    }
  ];

  // Planos de assinatura reais do banco de dados
  const plans = [
    {
      name: "Mensal",
      price: 49.90,
      features: [
        "Acesso a todas as funcionalidades por 1 mês",
        "Agendamentos ilimitados",
        "Pagamentos online via PIX",
        "Relatórios e análises",
        "Suporte por e-mail"
      ],
      highlight: false
    },
    {
      name: "Trimestral",
      price: 119.90,
      features: [
        "Acesso a todas as funcionalidades por 3 meses",
        "Agendamentos ilimitados",
        "Pagamentos online via PIX",
        "Relatórios e análises",
        "Suporte prioritário",
        "Economia de 20% em relação ao plano mensal"
      ],
      highlight: true
    },
    {
      name: "Semestral",
      price: 219.90,
      features: [
        "Acesso a todas as funcionalidades por 6 meses",
        "Agendamentos ilimitados",
        "Pagamentos online via PIX",
        "Relatórios e análises avançados",
        "Suporte prioritário",
        "Economia de 27% em relação ao plano mensal"
      ],
      highlight: false
    },
    {
      name: "Anual",
      price: 449.90,
      features: [
        "Acesso a todas as funcionalidades por 12 meses",
        "Agendamentos ilimitados",
        "Pagamentos online via PIX",
        "Relatórios e análises completos",
        "Suporte VIP",
        "Economia de 25% em relação ao plano mensal"
      ],
      highlight: false
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section - Versão Melhorada */}
      <section className="relative overflow-hidden bg-gradient-to-r from-primary/20 via-primary/10 to-background py-24">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -right-24 w-80 h-80 bg-primary/80 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-primary/50 rounded-full blur-3xl"></div>
          
          {/* Grid Pattern */}
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)', 
            backgroundSize: '30px 30px' 
          }}></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left Content */}
            <div className="text-left lg:w-1/2">
              <div className="flex justify-start mb-8">
                {systemSettings?.logoUrl ? (
                  <img 
                    src={`${systemSettings.logoUrl}?t=${Date.now()}`} 
                    alt="Meu Agendamento PRO" 
                    className="h-24 max-w-[300px]"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-logo.png';
                    }}
                  />
                ) : (
                  <h1 className="text-4xl font-bold text-primary">Meu Agendamento PRO</h1>
                )}
              </div>
              
              <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Sistema Completo para <span className="text-primary">Profissionais</span> e <span className="text-primary">Empresas</span>
              </h2>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
                Ideal para profissionais individuais e empresas como salões de beleza, clínicas, consultórios e centros estéticos. Gerencie sua equipe, reduza faltas em até 70% e aumente a produtividade.
              </p>
              
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <span>Gestão de Equipe</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <span>Agendamento 24/7</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <span>Pagamentos online</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="px-8" onClick={() => navigate("/auth")}>
                  Experimentar Grátis por {systemSettings?.trialPeriodDays || 7} Dias
                </Button>
                <Button size="lg" variant="outline" className="px-8" onClick={() => {
                  const demoSection = document.getElementById('demo');
                  demoSection?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  Ver Demonstração
                </Button>
              </div>
              
              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-background flex items-center justify-center bg-primary/20 text-xs font-bold`}>
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold">+5.000</span> profissionais e empresas já utilizam
                </p>
              </div>
            </div>
            
            {/* Right Content - Apenas Imagem */}
            <div className="lg:w-1/2 relative">
              <div className="relative">
                <img 
                  src="/images/agenda.png" 
                  alt="Visualização do calendário de agendamentos" 
                  className="w-full h-auto rounded-lg shadow-xl"
                />
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-lg rotate-12 border border-primary/20"></div>
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-primary/10 rounded-lg -rotate-12 border border-primary/20"></div>
            </div>
          </div>
          
          {/* Stats Bar */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 bg-card p-6 rounded-lg border border-border shadow-lg">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">+5.000</p>
              <p className="text-sm text-muted-foreground">Profissionais e Empresas</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">+100.000</p>
              <p className="text-sm text-muted-foreground">Agendamentos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">+15.000</p>
              <p className="text-sm text-muted-foreground">Profissionais Gerenciados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">30%</p>
              <p className="text-sm text-muted-foreground">Aumento de receita</p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section - Com Ícones e Ilustrações */}
      <section id="demo" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Conheça Nosso Sistema</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Uma solução completa para gerenciar seus agendamentos com facilidade e eficiência
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
            {/* Cartão 1: Agenda Inteligente */}
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Agenda Inteligente</h3>
                <p className="text-muted-foreground">
                  Visualize agendas individuais e da equipe. Organize compromissos de forma eficiente.
                </p>
                <div className="mt-6 pt-6 border-t border-border w-full">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Visualizações</span>
                    <span className="font-medium">Individual/Equipe</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Notificações</span>
                    <span className="font-medium">Email</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cartão 2: Gestão de Equipe */}
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <UserCheck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Gestão de Equipe</h3>
                <p className="text-muted-foreground">
                  Cadastre profissionais, configure horários individuais e distribua agendamentos automaticamente entre sua equipe.
                </p>
                <div className="mt-6 pt-6 border-t border-border w-full">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profissionais</span>
                    <span className="font-medium">Ilimitados</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Horários</span>
                    <span className="font-medium">Individuais</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cartão 3: Gestão de Clientes */}
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Gestão de Clientes</h3>
                <p className="text-muted-foreground">
                  Cadastre e gerencie clientes com histórico completo de atendimentos e preferências.
                </p>
                <div className="mt-6 pt-6 border-t border-border w-full">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cadastros</span>
                    <span className="font-medium">Ilimitados</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Histórico</span>
                    <span className="font-medium">Completo</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cartão 4: Serviços e Preços */}
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Settings className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Serviços e Preços</h3>
                <p className="text-muted-foreground">
                  Configure seus serviços, preços e durações. Personalize de acordo com suas necessidades.
                </p>
                <div className="mt-6 pt-6 border-t border-border w-full">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Categorias</span>
                    <span className="font-medium">Personalizáveis</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Precificação</span>
                    <span className="font-medium">Flexível</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cartão 5: Relatórios */}
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Relatórios da Equipe</h3>
                <p className="text-muted-foreground">
                  Acompanhe desempenho individual e da equipe com relatórios detalhados e gráficos.
                </p>
                <div className="mt-6 pt-6 border-t border-border w-full">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Análises</span>
                    <span className="font-medium">Individual/Equipe</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Exportação</span>
                    <span className="font-medium">PDF</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Fluxo de Trabalho Ilustrado */}
          <div className="mt-20 mb-10">
            <h3 className="text-2xl font-bold text-center mb-12">Como Funciona</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Linha conectora (visível apenas em telas médias e maiores) */}
              <div className="hidden md:block absolute top-16 left-[25%] right-[25%] h-0.5 bg-primary/30"></div>
              
              {/* Passo 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg mb-4 relative z-10">
                  1
                </div>
                <h4 className="text-xl font-bold mb-2">Configure</h4>
                <p className="text-muted-foreground">
                  Cadastre seus serviços, horários de funcionamento e toda sua equipe em poucos minutos.
                </p>
              </div>
              
              {/* Passo 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg mb-4 relative z-10">
                  2
                </div>
                <h4 className="text-xl font-bold mb-2">Gerencie</h4>
                <p className="text-muted-foreground">
                  Acompanhe agendas individuais e da equipe, distribua clientes automaticamente entre profissionais.
                </p>
              </div>
              
              {/* Passo 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg mb-4 relative z-10">
                  3
                </div>
                <h4 className="text-xl font-bold mb-2">Cresça</h4>
                <p className="text-muted-foreground">
                  Analise relatórios de desempenho individual e da equipe, otimize recursos e expanda seu negócio.
                </p>
              </div>
            </div>
          </div>
          
          {/* Botão de CTA */}
          <div className="mt-16 text-center">
            <div className="inline-flex flex-col items-center">
              <Button size="lg" className="px-8 py-6 text-lg" onClick={() => navigate("/auth")}>
                Experimentar Grátis por {systemSettings?.trialPeriodDays || 7} Dias
              </Button>
              <p className="mt-3 text-muted-foreground">Não é necessário cartão de crédito</p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Visualização do Sistema */}
      <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Visualize o Sistema em Ação</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Interface moderna e intuitiva para gerenciar todos os seus agendamentos
            </p>
          </div>
          
          <div className="flex justify-center">
            <div className="relative max-w-4xl w-full">
              {/* Decoração de fundo */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/5 rounded-lg transform rotate-12 z-0"></div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-primary/5 rounded-lg transform -rotate-12 z-0"></div>
              
              {/* Container da imagem com sombra e borda */}
              <div className="relative z-10 rounded-xl overflow-hidden border border-border shadow-xl">
                <div className="bg-card/80 p-2 border-b border-border flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="ml-2 text-sm text-center w-full font-medium">Meu Agendamento PRO - Dashboard</div>
                </div>
                <img 
                  src="/images/sistema_1.png" 
                  alt="Visualização do calendário de agendamentos" 
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section - Melhorado */}
      <section id="features" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Recursos que Transformam seu Negócio</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas projetadas para profissionais que buscam eficiência e crescimento
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl text-center">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground">{feature.description}</p>
                </CardContent>
                <CardFooter className="flex justify-center pt-0">
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                    Saiba mais
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <div className="mt-16 bg-muted/30 rounded-lg border border-border p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">Benefícios para Profissionais e Empresas</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Gestão completa de equipe</p>
                      <p className="text-sm text-muted-foreground">Controle horários individuais e distribua agendamentos automaticamente</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Redução de 70% nas faltas</p>
                      <p className="text-sm text-muted-foreground">Com lembretes automáticos e confirmações para toda equipe</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Aumento de 30% na receita</p>
                      <p className="text-sm text-muted-foreground">Otimizando agenda da equipe e reduzindo tempo ocioso</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Ideal para salões, clínicas e consultórios</p>
                      <p className="text-sm text-muted-foreground">Sistema escalável para empresas de todos os tamanhos</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold">Crescimento de Clientes</h4>
                    <p className="text-sm text-muted-foreground">Média mensal por negócio</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Antes</span>
                    <span className="font-medium">12 novos clientes/mês</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-primary/30"></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Depois</span>
                    <span className="font-medium">32 novos clientes/mês</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div className="w-4/5 h-full bg-primary"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Reformulada */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Escolha Seu Período de Uso</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Acesso completo a todas as funcionalidades. Escolha o período que melhor se adapta ao seu negócio. Planos a partir de <span className="font-bold text-primary">R$ 49,90</span>.
            </p>
          </div>

          {/* Planos de Período */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
            <Card className="border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-lg">Mensal</CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">R$ 49,90</div>
                  <div className="text-sm text-muted-foreground">por mês</div>
                </div>
                </CardHeader>
                <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Todas as funcionalidades</span>
                      </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Agendamentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Pagamentos via PIX</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Relatórios completos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Suporte por email</span>
                  </li>
                  </ul>
                </CardContent>
                <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                    Começar Agora
                  </Button>
                </CardFooter>
              </Card>

            <Card className="border border-primary shadow-lg relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                  MAIS POPULAR
                </span>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-lg">Trimestral</CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">R$ 39,97</div>
                  <div className="text-sm text-muted-foreground">por mês</div>
                  <div className="text-xs text-green-600 font-medium">Economize 20%</div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Todas as funcionalidades</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Agendamentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Pagamentos via PIX</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Relatórios completos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Suporte prioritário</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Começar Agora
                </Button>
              </CardFooter>
            </Card>

            <Card className="border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-lg">Semestral</CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">R$ 36,65</div>
                  <div className="text-sm text-muted-foreground">por mês</div>
                  <div className="text-xs text-green-600 font-medium">Economize 27%</div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Todas as funcionalidades</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Agendamentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Pagamentos via PIX</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Relatórios completos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Suporte prioritário</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                  Começar Agora
                </Button>
              </CardFooter>
            </Card>

            <Card className="border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-lg">Anual</CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">R$ 37,49</div>
                  <div className="text-sm text-muted-foreground">por mês</div>
                  <div className="text-xs text-green-600 font-medium">Economize 25%</div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Todas as funcionalidades</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Agendamentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Pagamentos via PIX</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Relatórios completos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Suporte VIP</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                  Começar Agora
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Seção Gestão de Equipe */}
          <div className="bg-gradient-to-br from-card to-primary/5 rounded-lg border border-primary/20 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">Funcionalidade Empresarial</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Gestão Completa de Equipe</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Para empresas como salões, clínicas e consultórios que precisam gerenciar múltiplos profissionais, oferecemos funcionalidades avançadas de gestão de equipe.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium mb-2">Profissionais Ilimitados</h4>
                <p className="text-sm text-muted-foreground">Cadastre quantos profissionais precisar, cada um com suas especialidades e horários.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium mb-2">Horários Individuais</h4>
                <p className="text-sm text-muted-foreground">Configure horários de trabalho específicos para cada profissional da equipe.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium mb-2">Relatórios por Profissional</h4>
                <p className="text-sm text-muted-foreground">Acompanhe performance individual e da equipe com relatórios detalhados.</p>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-muted-foreground mb-4">
                Interessado na gestão de equipe? Entre em contato para ativar essa funcionalidade.
              </p>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Solicitar Ativação da Gestão de Equipe
              </Button>
            </div>
          </div>

                               {/* CTA Final */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">Todas as funcionalidades disponíveis em todos os períodos!</p>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Experimentar Grátis por {systemSettings?.trialPeriodDays || 7} Dias
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Acesso completo • Sem compromisso • Cancele quando quiser</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Melhorada */}
      <section className="py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O Que Nossos Clientes Dizem</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Histórias reais de profissionais que transformaram seus negócios com o Meu Agendamento PRO
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
            {/* Depoimento Destacado */}
            <div className="lg:col-span-6 lg:row-span-2">
              <Card className="border border-primary/20 shadow-lg h-full bg-gradient-to-br from-card to-primary/5">
                <CardContent className="pt-8 h-full flex flex-col">
                  <div className="mb-6 text-primary">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i} className="text-xl">★</span>
                    ))}
                  </div>
                  <blockquote className="text-xl italic text-muted-foreground mb-8 flex-grow">
                    "O Meu Agendamento PRO revolucionou completamente meu salão de beleza. Reduzi as faltas em mais de 70% com os lembretes automáticos, e meus clientes adoram a facilidade de agendar online. O sistema é incrivelmente intuitivo e o suporte é excepcional. Em apenas 3 meses, aumentei minha receita em 35%. É o melhor investimento que fiz para o meu negócio!"
                  </blockquote>
                  <div className="flex items-center mt-auto">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <img 
                        src="/images/testimonial-1.jpg" 
                        alt="Maria Lima" 
                        className="w-14 h-14 rounded-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = 'ML';
                          target.parentElement!.className += ' text-primary font-bold';
                        }}
                      />
                    </div>
                    <div className="ml-4">
                      <p className="font-bold text-lg">Maria Lima</p>
                      <p className="text-muted-foreground">Salão Beleza Natural</p>
                      <p className="text-sm text-primary mt-1">Cliente há 2 anos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Outros Depoimentos */}
            <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-4 text-primary">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <p className="italic text-muted-foreground mb-4">
                    "Interface intuitiva e suporte excelente. Meus pacientes adoram a facilidade de agendar consultas online a qualquer momento."
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      CS
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">Dr. Carlos Silva</p>
                      <p className="text-sm text-muted-foreground">Clínica Bem Estar</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-4 text-primary">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <p className="italic text-muted-foreground mb-4">
                    "O sistema de pagamento integrado foi um diferencial enorme para meu estúdio. Reduziu inadimplência e melhorou meu fluxo de caixa."
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      AP
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">Ana Paula</p>
                      <p className="text-sm text-muted-foreground">Estúdio de Pilates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-4 text-primary">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <p className="italic text-muted-foreground mb-4">
                    "Consigo gerenciar minha agenda de forma muito mais eficiente. A visão clara dos horários e a facilidade de reagendamento são incríveis."
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      RS
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">Roberto Santos</p>
                      <p className="text-sm text-muted-foreground">Personal Trainer</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-4 text-primary">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <p className="italic text-muted-foreground mb-4">
                    "Os relatórios me ajudam a entender melhor meu negócio e tomar decisões baseadas em dados reais. Ferramenta essencial!"
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      JO
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">Juliana Oliveira</p>
                      <p className="text-sm text-muted-foreground">Terapeuta Holística</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Logos de Empresas */}
          <div className="mt-20">
            <p className="text-center text-sm font-medium text-muted-foreground mb-8">EMPRESAS QUE CONFIAM EM NÓS</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
              {['Salão VIP', 'Clínica Saude+', 'Estúdio Bem Estar', 'Academia Fitness', 'SPA Relax'].map((company, i) => (
                <div key={i} className="text-xl font-bold text-muted-foreground/50 hover:text-primary transition-colors">
                  {company}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* FAQ Section - Nova */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo o que você precisa saber sobre o Meu Agendamento PRO
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border border-border hover:border-primary/20 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">?</div>
                  Preciso instalar algum software?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Não! O Meu Agendamento PRO é uma solução 100% online. Você só precisa de um navegador web e conexão com a internet para acessar de qualquer dispositivo.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border hover:border-primary/20 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">?</div>
                  Como funciona o período de teste?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Oferecemos {systemSettings?.trialPeriodDays || 14} dias de teste grátis com acesso a todas as funcionalidades. Não é necessário cartão de crédito para começar a testar.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border hover:border-primary/20 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">?</div>
                  Posso cancelar a assinatura a qualquer momento?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sim! Não há contratos de fidelidade. Você pode cancelar sua assinatura a qualquer momento diretamente pela sua conta, sem taxas adicionais.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border hover:border-primary/20 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">?</div>
                  Meus clientes precisam criar uma conta?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Não necessariamente. Seus clientes podem agendar fornecendo apenas nome, email e telefone. Porém, se criarem uma conta, terão acesso a mais recursos como histórico de agendamentos.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border hover:border-primary/20 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">?</div>
                  O sistema envia lembretes automáticos?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sim! O sistema envia lembretes automáticos por email e notificações no sistema para reduzir faltas e melhorar a experiência do cliente.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border hover:border-primary/20 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">?</div>
                  Posso personalizar o sistema com minha marca?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sim! Você pode personalizar o sistema com sua logo, cores e informações de contato, oferecendo uma experiência personalizada aos seus clientes.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-6">Ainda tem dúvidas? Entre em contato com nosso suporte</p>
            <Button 
              variant="outline" 
              size="lg" 
              className="gap-2"
              onClick={() => {
                // Número de WhatsApp que será configurado posteriormente
                const phoneNumber = "5511984704925"; // Substitua pelo número real
                const message = "Olá. Eu gostaria de saber mais sobre o sistema Meu Agendamento PRO.";
                const encodedMessage = encodeURIComponent(message);
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
                window.open(whatsappUrl, "_blank");
              }}
            >
              <MessageSquare className="h-5 w-5" /> Falar com Suporte
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section - Melhorada */}
      <section className="py-24 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background"></div>
        
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto bg-card rounded-xl border border-border shadow-xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left Content */}
              <div className="p-8 md:p-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Pronto para Transformar seu Negócio?</h2>
                <p className="text-muted-foreground mb-8">
                  Junte-se a mais de 5.000 profissionais que já estão usando o Meu Agendamento PRO para crescer e otimizar seu tempo.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <span>Comece gratuitamente</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <span>Sem necessidade de cartão de crédito</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <span>Suporte personalizado</span>
                  </div>
                </div>
                
                <div className="mt-8">
                  <Button size="lg" className="w-full md:w-auto" onClick={() => navigate("/auth")}>
                    Começar Agora
                  </Button>
                </div>
              </div>
              
              {/* Right Content - Stats */}
              <div className="bg-primary/5 p-8 md:p-12 flex flex-col justify-center">
                <h3 className="text-xl font-bold mb-6">Resultados Comprovados</h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Redução de faltas</span>
                      <span className="font-bold text-primary">70%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="w-[70%] h-full bg-primary"></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Economia de tempo</span>
                      <span className="font-bold text-primary">85%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="w-[85%] h-full bg-primary"></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Aumento de receita</span>
                      <span className="font-bold text-primary">30%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="w-[30%] h-full bg-primary"></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center bg-primary/20 text-xs font-bold">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">+5.000 profissionais</span> confiam em nós
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Melhorado */}
      <footer className="py-16 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Logo e Descrição */}
            <div className="md:col-span-4">
              <div className="mb-6">
                {systemSettings?.logoUrl ? (
                  <img 
                    src={`${systemSettings.logoUrl}?t=${Date.now()}`} 
                    alt="Meu Agendamento PRO" 
                    className="h-16 max-w-[240px]"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-logo.png';
                    }}
                  />
                ) : (
                  <h3 className="text-2xl font-bold text-primary">Meu Agendamento PRO</h3>
                )}
              </div>
              
              <p className="text-muted-foreground mb-6">
                Sistema completo de agendamento online para profissionais e empresas de todos os tamanhos.
              </p>
              
              <div className="flex gap-4">
                {[
                  { icon: <MessageSquare className="h-5 w-5" />, label: "Email" },
                  { icon: <Users className="h-5 w-5" />, label: "Facebook" },
                  { icon: <MessageSquare className="h-5 w-5" />, label: "Instagram" },
                  { icon: <MessageSquare className="h-5 w-5" />, label: "LinkedIn" }
                ].map((item, i) => (
                  <a 
                    key={i} 
                    href="#" 
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                    aria-label={item.label}
                  >
                    {item.icon}
                  </a>
                ))}
              </div>
            </div>
            
            {/* Links Rápidos */}
            <div className="md:col-span-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <h4 className="font-bold mb-4 text-lg">Produto</h4>
                  <ul className="space-y-3">
                    <li><a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Recursos</a></li>
                    <li><a href="#demo" className="text-muted-foreground hover:text-primary transition-colors">Demonstração</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Preços</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Atualizações</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold mb-4 text-lg">Empresa</h4>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Sobre Nós</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Clientes</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Contato</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Blog</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold mb-4 text-lg">Suporte</h4>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Ajuda</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Tutoriais</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">API</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Status</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold mb-4 text-lg">Legal</h4>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Termos de Uso</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Privacidade</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Cookies</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Licenças</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} Meu Agendamento PRO - Todos os direitos reservados
            </p>
            
            <div className="flex gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Termos</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacidade</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
