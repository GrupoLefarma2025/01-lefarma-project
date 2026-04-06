/**
 * RecipientSelector - Componente para seleccionar usuarios y roles
 * Permite selección múltiple de usuarios y roles para envío de notificaciones
 */


import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Tipos
interface Usuario {
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
}

interface Rol {
  idRol: number;
  nombreRol: string;
  descripcion: string;
}

interface RecipientSelectorProps {
  selectedUserIds: number[];
  selectedRoleNames: string[];
  onUserIdsChange: (userIds: number[]) => void;
  onRoleNamesChange: (roleNames: string[]) => void;
  disabled?: boolean;
}

export function RecipientSelector({
  selectedUserIds,
  selectedRoleNames,
  onUserIdsChange,
  onRoleNamesChange,
  disabled = false,
}: RecipientSelectorProps) {
  const { token } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cargar usuarios y roles
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5134/api';

        // Cargar usuarios
        const usuariosRes = await fetch(`${apiUrl}/auth/usuarios`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (usuariosRes.ok) {
          const data = await usuariosRes.json();
          setUsuarios(data.data || []);
        }

        // Cargar roles
        const rolesRes = await fetch(`${apiUrl}/auth/roles`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(data.data || []);
        }
      } catch (error) {
        console.error('Error loading recipients:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtrar usuarios por búsqueda
  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.nombreCompleto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.correo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtrar roles por búsqueda
  const filteredRoles = roles.filter(
    (r) =>
      r.nombreRol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle selección de usuario
  const toggleUsuario = (usuarioId: number) => {
    if (selectedUserIds.includes(usuarioId)) {
      onUserIdsChange(selectedUserIds.filter((id) => id !== usuarioId));
    } else {
      onUserIdsChange([...selectedUserIds, usuarioId]);
    }
  };

  // Toggle selección de rol
  const toggleRol = (rolName: string) => {
    if (selectedRoleNames.includes(rolName)) {
      onRoleNamesChange(selectedRoleNames.filter((n) => n !== rolName));
    } else {
      onRoleNamesChange([...selectedRoleNames, rolName]);
    }
  };

  const selectedUsuarioCount = selectedUserIds.length;
  const selectedRolCount = selectedRoleNames.length;

  return (
    <div className="space-y-4">
      {/* Selector de Usuarios */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                {selectedUsuarioCount === 0
                  ? 'Seleccionar usuarios'
                  : `${selectedUsuarioCount} usuario${selectedUsuarioCount !== 1 ? 's' : ''}`}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar usuarios por nombre o email..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <ScrollArea className="h-64">
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Cargando usuarios...
                  </div>
                ) : filteredUsuarios.length === 0 ? (
                  <CommandEmpty>No se encontraron usuarios</CommandEmpty>
                ) : (
                  <CommandGroup heading="Usuarios">
                    {filteredUsuarios.map((usuario) => (
                      <CommandItem
                        key={usuario.idUsuario}
                        onSelect={() => toggleUsuario(usuario.idUsuario)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-4 w-4 rounded-sm border ${
                              selectedUserIds.includes(usuario.idUsuario)
                                ? 'bg-primary border-primary'
                                : 'border-muted'
                            }`}
                          >
                            {selectedUserIds.includes(usuario.idUsuario) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {usuario.nombreCompleto}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {usuario.correo}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selector de Roles */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                {selectedRolCount === 0
                  ? 'Seleccionar roles'
                  : `${selectedRolCount} rol${selectedRolCount !== 1 ? 'es' : ''}`}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar roles por nombre..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <ScrollArea className="h-64">
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Cargando roles...
                  </div>
                ) : filteredRoles.length === 0 ? (
                  <CommandEmpty>No se encontraron roles</CommandEmpty>
                ) : (
                  <CommandGroup heading="Roles">
                    {filteredRoles.map((rol) => (
                      <CommandItem
                        key={rol.idRol}
                        onSelect={() => toggleRol(rol.nombreRol)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-4 w-4 rounded-sm border ${
                              selectedRoleNames.includes(rol.nombreRol)
                                ? 'bg-primary border-primary'
                                : 'border-muted'
                            }`}
                          >
                            {selectedRoleNames.includes(rol.nombreRol) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{rol.nombreRol}</div>
                            <div className="text-xs text-muted-foreground">
                              {rol.descripcion}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Resumen de selección */}
      {(selectedUsuarioCount > 0 || selectedRolCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {selectedUsuarioCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedUsuarioCount} usuario{selectedUsuarioCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {selectedRolCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {selectedRolCount} rol{selectedRolCount !== 1 ? 'es' : ''}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
