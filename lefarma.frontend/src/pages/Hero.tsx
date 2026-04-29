import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, BarChart3, Users, Shield, Globe, ArrowRight, Pill, Calendar } from 'lucide-react';
import logoEstatico from '@/assets/logo.png';

const novedades = [
  {
    id: 1,
    icon: BarChart3,
    title: 'Reportes de Gastos',
    description: 'Visualiza métricas y gráficos en tiempo real',
    category: 'Finanzas',
  },
  {
    id: 2,
    icon: Users,
    title: 'Gestión de Usuarios',
    description: 'Control de accesos con roles y permisos',
    category: 'Administración',
  },
  {
    id: 3,
    icon: Shield,
    title: 'Seguridad LDAP',
    description: 'Autenticación integrada con Active Directory',
    category: 'Seguridad',
  },
  {
    id: 4,
    icon: Globe,
    title: 'Multi-Empresa',
    description: 'Administra varias empresas y sucursales',
    category: 'Plataforma',
  },
  {
    id: 5,
    icon: Package,
    title: 'Control de Inventarios',
    description: 'Gestión de stock e insumos médicos',
    category: 'Operaciones',
  },
];

export default function Hero() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <img src={logoEstatico} alt="Grupo LeFarma" className="h-10 w-auto" />
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/ayuda')}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              Ayuda
            </Button>
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </header>

      <section className="flex min-h-screen items-center pt-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="order-2 lg:order-1">
              <div className="relative mx-auto aspect-square max-w-md lg:max-w-none">
                <div className="from-primary/20 via-primary/10 absolute inset-0 rounded-3xl bg-gradient-to-br to-transparent" />

                <div className="absolute inset-0 opacity-30">
                  <div className="border-primary/40 absolute left-8 top-8 h-24 w-24 rotate-12 rounded-2xl border-2" />
                  <div className="border-primary/30 absolute bottom-12 right-12 h-32 w-32 rounded-full border" />
                  <div className="bg-primary/20 absolute right-8 top-1/3 h-16 w-16 -rotate-6 rounded-xl" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card shadow-2xl lg:h-64 lg:w-64">
                      <img
                        src={logoEstatico}
                        alt="Grupo Lefarma"
                        className="h-auto w-3/4 object-contain"
                      />
                    </div>
                    <div className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
                      <Pill className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="absolute -bottom-3 -left-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 text-center lg:order-2 lg:text-left">
              <p className="text-sm text-muted-foreground mb-3 flex items-center justify-center lg:justify-start gap-2">
                <Pill className="w-4 h-4 text-primary" />
                Portal Interno - Grupo LeFarma
              </p>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
                Control de Gastos
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0">
                Plataforma interna para la gestión de gastos del grupo LeFarma.
              </p>

              <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                <Button
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="gap-2 px-8 text-base"
                >
                  Iniciar Sesión
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/ayuda')}
                  className="gap-2 border-primary px-8 text-base text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Ayuda
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="container mx-auto mb-8 px-4">
          <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <Calendar className="h-6 w-6 text-primary" />
            Novedades del Sistema
          </h2>
          <p className="mt-2 text-muted-foreground">
            Explora las últimas actualizaciones y mejoras del sistema
          </p>
        </div>

        <div className="relative">
          <div className="scrollbar-hide overflow-x-auto pb-4">
            <div className="container mx-auto flex gap-4 px-4">
              {novedades.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.id}
                    className="hover:bg-card/80 group min-w-[280px] flex-shrink-0 cursor-pointer bg-card transition-colors"
                  >
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                      </div>

                      <h3 className="mb-1 font-semibold text-foreground">{item.title}</h3>

                      <p className="mb-3 line-clamp-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>

                      <span className="inline-block rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {item.category}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-1">
            {novedades.map((_, index) => (
              <div
                key={index}
                className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full first:bg-primary"
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
          <p className="text-muted-foreground/60 mt-1 text-xs">
            Versión {import.meta.env.VITE_APP_VERSION || '1.0.0'}
          </p>
        </div>
      </footer>
    </div>
  );
}
