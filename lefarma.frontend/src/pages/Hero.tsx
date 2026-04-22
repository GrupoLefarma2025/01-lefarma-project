import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Package,
  BarChart3,
  Users,
  Shield,
  Globe,
  ArrowRight,
  Sparkles,
  Calendar,
} from 'lucide-react';
import logoEstatico from '@/assets/logo.png';

const novedades = [
  {
    id: 1,
    icon: Package,
    title: 'Control de Inventarios',
    description: 'Monitoreo en tiempo real de stock',
    category: 'Operaciones',
    date: 'Mar 2026',
  },
  {
    id: 2,
    icon: BarChart3,
    title: 'Reportes Dinámicos',
    description: 'Dashboards interactivos y personalizados',
    category: 'Análisis',
    date: 'Feb 2026',
  },
  {
    id: 3,
    icon: Users,
    title: 'Gestión de Usuarios',
    description: 'Roles y permisos granulares',
    category: 'Administración',
    date: 'Ene 2026',
  },
  {
    id: 4,
    icon: Shield,
    title: 'Seguridad Mejorada',
    description: 'Autenticación con Active Directory',
    category: 'Seguridad',
    date: 'Dic 2025',
  },
  {
    id: 5,
    icon: Globe,
    title: 'Multi-Empresa',
    description: 'Una plataforma, múltiples empresas',
    category: 'Plataforma',
    date: 'Nov 2025',
  },
];

export default function Hero() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <img
            src={logoEstatico}
            alt="Grupo LeFarma"
            className="h-10 w-auto"
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/ayuda')} variant="ghost" className="text-muted-foreground hover:text-foreground">
              Ayuda
            </Button>
            <Button onClick={() => navigate('/login')} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </header>

      <section className="pt-20 min-h-screen flex items-center">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative aspect-square max-w-md mx-auto lg:max-w-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-3xl" />
                
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute top-8 left-8 w-24 h-24 border-2 border-primary/40 rounded-2xl rotate-12" />
                  <div className="absolute bottom-12 right-12 w-32 h-32 border border-primary/30 rounded-full" />
                  <div className="absolute top-1/3 right-8 w-16 h-16 bg-primary/20 rounded-xl -rotate-6" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-48 h-48 lg:w-64 lg:h-64 bg-card rounded-3xl shadow-2xl border border-border flex items-center justify-center overflow-hidden">
                      <img
                        src={logoEstatico}
                        alt="Grupo LeFarma"
                        className="w-3/4 h-auto object-contain"
                      />
                    </div>
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                      <Sparkles className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 bg-muted rounded-lg flex items-center justify-center border border-border">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 text-center lg:text-left">
              <p className="text-sm text-muted-foreground mb-3 flex items-center justify-center lg:justify-start gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Bienvenido a Grupolefarma
              </p>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
                Sistema de Gestión
                <br />
                <span className="text-primary">Farmacéutica</span>
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0">
                La plataforma integral para la gestión de tu farmacéutica.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/login')} 
                  className="gap-2 text-base px-8"
                >
                  Iniciar Sesión
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/ayuda')} 
                  className="gap-2 text-base px-8 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Ayuda
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-border">
        <div className="container mx-auto px-4 mb-8">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            Novedades del Sistema
          </h2>
          <p className="text-muted-foreground mt-2">
            Explora las últimas actualizaciones y mejoras
          </p>
        </div>

        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide pb-4">
            <div className="flex gap-4 px-4 container mx-auto">
              {novedades.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.id}
                    className="min-w-[280px] flex-shrink-0 bg-card hover:bg-card/80 transition-colors cursor-pointer group"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.date}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-foreground mb-1">
                        {item.title}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                        {item.description}
                      </p>
                      
                      <span className="inline-block text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
                        {item.category}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          
          <div className="flex justify-center gap-1 mt-4">
            {novedades.map((_, index) => (
              <div
                key={index}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 first:bg-primary"
              />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Grupo LeFarma © {new Date().getFullYear()} - Da Salud
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Versión {import.meta.env.VITE_APP_VERSION || '1.0.0'}
          </p>
        </div>
      </footer>
    </div>
  );
}
