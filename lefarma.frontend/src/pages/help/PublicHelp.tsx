import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle, ArrowRight, User, Lock, Building2, Mail } from 'lucide-react';

const faqItems = [
  {
    question: '¿Cómo inicio sesión?',
    answer: 'El proceso tiene 3 pasos: 1) Ingresá tu nombre de usuario, 2) Completá tu contraseña y seleccioná el dominio de tu empresa, 3) Seleccioná la empresa, sucursal y área desde la cual trabajarás.',
    icon: User,
  },
  {
    question: '¿Qué es el dominio?',
    answer: 'El dominio identifica a tu organización dentro del sistema. Si ves un selector de dominio, elegí de la lista: LeFarma Honduras, LeFarma Guatemala, LeFarma El Salvador, LeFarma Nicaragua, LeFarma Costa Rica o Distribuidora Central.',
    icon: Lock,
  },
  {
    question: '¿Puedo cambiar mi empresa o sucursal después de iniciar sesión?',
    answer: 'Sí. Podés cambiar tu empresa, sucursal o área en cualquier momento cerrando sesión y entrando nuevamente.',
    icon: Building2,
  },
  {
    question: '¿Olvidé mi contraseña, qué hago?',
    answer: 'Contactá al administrador de tu sistema o enviá un correo a 6@grupolefarma.com.mx para restablecer tus credenciales.',
    icon: Mail,
  },
];

export default function PublicHelp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Encabezado */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-primary" />
            <span className="font-semibold">Centro de Ayuda</span>
          </div>
          <Button onClick={() => navigate('/login')} size="sm">
            Iniciar Sesión
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {/* Title */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Centro de Ayuda
              </h1>
              <p className="text-muted-foreground">
                Resolvé tus dudas sobre cómo usar el sistema
              </p>
            </div>

            {/* FAQ Cards */}
            <div className="space-y-4 mb-10">
              {faqItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Card key={index} className="bg-card">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-2">
                            {item.question}
                          </h3>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Login CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  ¿Ya tenés una cuenta?
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Iniciá sesión para acceder al sistema completo de gestión farmacéutica.
                </p>
                <Button onClick={() => navigate('/login')} className="gap-2">
                  Iniciar Sesión
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Contact */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Necesitás ayuda adicional?{' '}
                <a 
                  href="mailto:6@grupolefarma.com.mx" 
                  className="text-primary hover:underline"
                >
                  6@grupolefarma.com.mx
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Pie */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Grupo LeFarma © {new Date().getFullYear()} - Da Salud
          </p>
        </div>
      </footer>
    </div>
  );
}
