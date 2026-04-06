import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-muted p-6 rounded-full">
            <FileQuestion className="h-20 w-20 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Página No Encontrada</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </p>
        </div>

        <Link to="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
