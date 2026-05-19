import { useEffect, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, Menu } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { helpService } from '@/services/helpService';
import type { HelpArticle } from '@/types/help.types';

export default function PublicHelpList() {
  const { modulo } = useParams<{ modulo?: string }>();
  const navigate = useNavigate();
  usePageTitle('Ayuda', 'Centro de ayuda y soporte');

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const decodedModulo = modulo ? decodeURIComponent(modulo) : '';

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const data = await helpService.getPublicForUser(decodedModulo || undefined);
        setArticles(data ?? []);
        setSelectedArticleId(null);
      } catch {
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticles();
  }, [decodedModulo]);

  const selectedArticle = useMemo<HelpArticle | null>(() => {
    if (!articles?.length) return null;
    if (!selectedArticleId) return articles[0];
    return articles.find((a) => a.id === selectedArticleId) ?? articles[0];
  }, [articles, selectedArticleId]);

  useEffect(() => {
    if (!articles?.length) {
      setSelectedArticleId(null);
    } else if (!selectedArticleId || !articles.some((a) => a.id === selectedArticleId)) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  const modules = useMemo(() => {
    if (!articles?.length) return [];
    const moduleSet = new Set(articles.map((a) => a.modulo).filter(Boolean));
    return Array.from(moduleSet).sort();
  }, [articles]);

  const handleModuleSelect = (mod: string) => {
    setIsSidebarOpen(false);
    if (mod) {
      navigate(`/ayuda/${encodeURIComponent(mod)}`);
    } else {
      navigate('/ayuda');
    }
  };

  const handleBack = () => {
    if (decodedModulo) {
      navigate('/ayuda');
    }
  };

  if (isLoading && !articles?.length) {
    return (
      <div className="flex flex-col md:flex-row h-[calc(100vh-7rem)]">
        <div className="hidden md:block w-64 border-r shrink-0 p-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="w-full p-3 md:p-4 space-y-3 md:space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-32" />
            <div className="space-y-4 rounded-lg border p-4 md:p-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-7rem)]">
      {/* Mobile sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de módulos</SheetTitle>
          </SheetHeader>
          <div className="p-4 space-y-2">
            <Button
              variant={!decodedModulo ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleModuleSelect('')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Todos
            </Button>
            {modules.map((mod) => (
              <Button
                key={mod}
                variant={decodedModulo === mod ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => handleModuleSelect(mod)}
              >
                <FileText className="mr-2 h-4 w-4" />
                {mod}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 border-r shrink-0 p-4">
        <div className="space-y-2">
          <Button
            variant={!decodedModulo ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => handleModuleSelect('')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Todos
          </Button>
          {modules.map((mod) => (
            <Button
              key={mod}
              variant={decodedModulo === mod ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleModuleSelect(mod)}
            >
              <FileText className="mr-2 h-4 w-4" />
              {mod}
            </Button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 p-2 sm:p-4 sm:pb-0">
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2">
                {decodedModulo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden shrink-0"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {decodedModulo || 'Todos los artículos'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 min-h-0 p-2 sm:p-4">
          {!articles?.length ? (
            <Card className="border-dashed h-full">
              <CardContent className="flex flex-col items-center justify-center h-full p-4">
                <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-lg sm:text-xl font-semibold text-muted-foreground mb-2 text-center">
                  No hay artículos disponibles
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-md px-4">
                  No hay artículos de ayuda para mostrar en esta sección.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-full">
              <Card>
                <CardContent className="p-2 sm:p-4">
                  {selectedArticle && (
                    <div>
                      <h1 className="text-2xl font-bold mb-4">{selectedArticle.titulo}</h1>
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.contenido) }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
