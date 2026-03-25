import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHelpStore } from '@/store/helpStore';

const MODULES = [
  { value: 'General', label: 'General' },
  { value: 'Catalogos', label: 'Catálogos' },
  { value: 'Auth', label: 'Autenticación' },
  { value: 'Notificaciones', label: 'Notificaciones' },
  { value: 'Profile', label: 'Perfil' },
  { value: 'Admin', label: 'Administración' },
  { value: 'SystemConfig', label: 'Configuración' },
] as const;

const TYPES = [
  { value: 'usuario', label: 'Usuario Final' },
  { value: 'desarrollador', label: 'Desarrollador' },
  { value: 'ambos', label: 'Ambos' },
] as const;

export function HelpSidebar() {
  const { selectedModule, selectedType, fetchAllArticles, fetchArticlesByModule, fetchArticlesByType } =
    useHelpStore();

  const handleModuleClick = (modulo: string) => {
    fetchArticlesByModule(modulo);
  };

  const handleTypeClick = (tipo: string) => {
    fetchArticlesByType(tipo);
  };

  const handleAllClick = () => {
    fetchAllArticles();
  };

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="space-y-6 p-4">
        {/* All Articles Button */}
        <div className="space-y-2">
          <Button
            variant={selectedModule === 'General' && selectedType === 'usuario' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={handleAllClick}
          >
            Todos los artículos
          </Button>
        </div>

        {/* Modules Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Módulos
          </h3>
          <div className="space-y-1">
            {MODULES.map((module) => (
              <Button
                key={module.value}
                variant={selectedModule === module.value ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => handleModuleClick(module.value)}
              >
                {module.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Types Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tipo de contenido
          </h3>
          <div className="space-y-1">
            {TYPES.map((type) => (
              <Button
                key={type.value}
                variant={selectedType === type.value ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => handleTypeClick(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
