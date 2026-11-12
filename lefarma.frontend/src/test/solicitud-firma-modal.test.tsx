import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SolicitudFirmaModal } from '@/apps/rh/components/SolicitudFirmaModal';
import type { AccionDisponibleResponse } from '@/types/solicitudPersonalWorkflow.types';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';

vi.mock('@/components/archivos/FileUploader', () => ({
  FileUploader: () => <div data-testid="file-uploader" />,
}));

vi.mock('@/services/archivoService', () => ({
  archivoService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/apps/rh/services/rh.api', () => ({
  autorizacionesIncidenciasApi: { get: vi.fn().mockResolvedValue({ data: { success: false } }) },
}));

const accionAutorizar: AccionDisponibleResponse = {
  idAccion: 1,
  idTipoAccion: 3,
  tipoAccionCodigo: 'AUTORIZAR',
  tipoAccionNombre: 'Autorización',
  tipoAccionDescripcion: 'Autoriza la solicitud y la envía al siguiente paso.',
  tipoAccionCambiaEstado: true,
  enviaConcentrado: false,
  handlers: [],
  camposWorkflow: [],
  camposRequeridos: [],
  requiereComentario: true,
  requiereAdjunto: false,
  permiteAdjunto: true,
};

const solicitud = {
  idSolicitud: 203,
  folio: 'SOL-2026-00203',
  fechaInicio: '2026-11-10',
  categoria: '2',
  idEstado: 7,
  estadoNombre: 'APROBACION',
  estadoColor: '#1d4ed8',
  idPasoActual: 1,
} as unknown as SolicitudPersonalResponse;

function renderModal(isSubmitting: boolean) {
  return render(
    <SolicitudFirmaModal
      open
      onClose={() => undefined}
      accion={accionAutorizar}
      solicitud={solicitud}
      getEstadoInfo={() => ({ nombre: 'APROBACION', color: '#1d4ed8' })}
      onSubmit={async () => true}
      isSubmitting={isSubmitting}
    />
  );
}

async function renderAndSettle(isSubmitting: boolean) {
  const result = renderModal(isSubmitting);
  // Deja resolver la carga de archivos existentes que arranca el modal al abrirse.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe('SolicitudFirmaModal', () => {
  it('muestra el loader y deshabilita el modal mientras se procesa', async () => {
    await renderAndSettle(true);

    expect(screen.getByRole('status')).toHaveTextContent('Procesando la solicitud…');
    expect(screen.getByText('No cierres esta ventana.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
  });

  it('no muestra el loader ni bloquea los botones cuando no hay nada en proceso', async () => {
    await renderAndSettle(false);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Confirmar autorización' })).toBeEnabled();
  });

  it('mantiene el bloqueo desde el clic hasta que la acción termina y cierra el modal', async () => {
    let resolver: (ok: boolean) => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolver = resolve;
        })
    );
    const onClose = vi.fn();
    render(
      <SolicitudFirmaModal
        open
        onClose={onClose}
        accion={accionAutorizar}
        solicitud={solicitud}
        getEstadoInfo={() => ({ nombre: 'APROBACION', color: '#1d4ed8' })}
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText(/Comentario/i), {
      target: { value: 'todo ok' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar autorización' }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Procesando la solicitud…');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await act(async () => {
      resolver(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
