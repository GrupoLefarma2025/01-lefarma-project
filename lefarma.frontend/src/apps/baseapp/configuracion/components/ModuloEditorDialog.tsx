import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { actualizarModulo, crearModulo } from '../services/configuracionAdminApi';
import type { ModuloConfig } from '../types';
import { mensajeError, aSegmentoClave, sinAcentos } from '../utils';

const CLAVE_MODULO_REGEX = /^[a-z][a-z0-9_]*$/;

interface ModuloEditorDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Módulo a editar; `null` para crear uno nuevo. */
  modulo: ModuloConfig | null;
  onGuardado: (modulo: ModuloConfig) => void;
}

/** Convierte texto libre en slug de módulo: "Días límite" → "dias_limite". */
function aSlug(texto: string): string {
  return sinAcentos(texto)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function ModuloEditorDialog({
  open,
  setOpen,
  modulo,
  onGuardado,
}: ModuloEditorDialogProps) {
  const esEdicion = modulo !== null;
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(modulo?.nombre ?? '');
    setClave(modulo?.clave ?? '');
    setDescripcion(modulo?.descripcion ?? '');
    setIntento(false);
    setGuardando(false);
  }, [open, modulo]);

  const errorClave = intento
    ? !clave.trim()
      ? 'La clave es obligatoria.'
      : !CLAVE_MODULO_REGEX.test(clave.trim())
        ? 'Usa minúsculas, números y guiones bajos; debe iniciar con una letra (ej. viaticos).'
        : clave.trim().length > 50
          ? 'La clave no puede exceder 50 caracteres.'
          : null
    : null;
  const errorNombre =
    intento && !nombre.trim() ? 'El nombre es obligatorio.' : null;

  const guardar = async () => {
    if (guardando) return;
    setIntento(true);
    if (errorClave || errorNombre || !clave.trim() || !nombre.trim()) return;

    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      };
      const guardado = esEdicion
        ? await actualizarModulo(modulo.idModulo, payload)
        : await crearModulo({ ...payload, clave: clave.trim().toLowerCase() });
      toast.success(esEdicion ? 'Módulo actualizado.' : 'Módulo creado.');
      onGuardado(guardado);
      setOpen(false);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      id="modal-modulo-configuracion"
      open={open}
      setOpen={setOpen}
      title={esEdicion ? 'Editar módulo' : 'Nuevo módulo'}
      subtitle="Agrupa variables y define el prefijo de su clave."
      size="lg"
      beforeClose={() => !guardando}
      bodyClassName="flex flex-col gap-3"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : esEdicion ? (
              'Guardar cambios'
            ) : (
              'Crear módulo'
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="modulo-nombre" className="text-xs">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="modulo-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Viáticos"
          className="h-9"
          maxLength={200}
          aria-invalid={Boolean(errorNombre)}
          autoFocus
        />
        {errorNombre && <p className="text-[11px] text-destructive">{errorNombre}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <div className="min-w-0">
            <Label htmlFor="modulo-clave" className="text-xs">
              Clave del módulo <span className="text-destructive">*</span>
            </Label>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
              Prefijo de las claves de sus variables: módulo.namespace.clave.
            </p>
          </div>
          {!esEdicion && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={!nombre.trim()}
              onClick={() => setClave(aSlug(nombre))}
            >
              <Sparkles className="h-3 w-3" />
              Generar desde el nombre
            </Button>
          )}
        </div>
        <Input
          id="modulo-clave"
          value={clave}
          onChange={(e) => setClave(aSegmentoClave(e.target.value).slice(0, 50))}
          placeholder="Ej. viaticos"
          className="h-9 font-mono text-sm"
          maxLength={50}
          disabled={esEdicion}
          aria-invalid={Boolean(errorClave)}
          spellCheck={false}
        />
        {esEdicion && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            La clave no cambia después de crear el módulo.
          </p>
        )}
        {errorClave && <p className="text-[11px] text-destructive">{errorClave}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="modulo-descripcion" className="text-xs">
          Descripción{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="modulo-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Para qué sirve este módulo y qué variables agrupa"
          className="resize-none text-sm"
          rows={3}
          maxLength={1000}
        />
      </div>
    </Modal>
  );
}
