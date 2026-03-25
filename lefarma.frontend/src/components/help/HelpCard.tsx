import { useNavigate } from 'react-router-dom';
import { Calendar, User } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HelpArticle } from '@/types/help.types';

interface HelpCardProps {
  article: HelpArticle;
}

export function HelpCard({ article }: HelpCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/help/${article.id}`);
  };

  const getBadgeVariant = (tipo: HelpArticle['tipo']) => {
    return tipo === 'desarrollador' ? 'default' : 'secondary';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold line-clamp-2">{article.titulo}</h3>
          <Badge variant={getBadgeVariant(article.tipo)} className="shrink-0">
            {article.tipo === 'desarrollador' ? 'Dev' : 'Usuario'}
          </Badge>
        </div>
        <Badge variant="outline" className="w-fit">
          {article.modulo}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {article.resumen || 'Sin descripción'}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(article.fechaActualizacion)}</span>
          </div>
          {article.actualizadoPor && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{article.actualizadoPor}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
