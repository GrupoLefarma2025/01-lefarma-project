import { DIAS_RETENCION, MAXIMO_PENDIENTES } from './config';
import type { EventoTelemetria } from './tipos';

/**
 * Cola local de eventos en IndexedDB. Si el navegador niega la base (modo
 * privado, cuota llena, bloqueo del usuario) se sigue guardando en memoria: se
 * pierde al recargar, pero la sesión actual no se queda sin telemetría.
 */

const NOMBRE_BD = 'lefarma-telemetria';
const ALMACEN = 'pendientes';
const VERSION_BD = 1;

export interface Pendiente {
  id: number;
  creadoEn: number;
  evento: EventoTelemetria;
}

let apertura: Promise<IDBDatabase | null> | null = null;
const memoria: Pendiente[] = [];
let siguienteId = 1;
let usarMemoria = false;

function guardarEnMemoria(evento: EventoTelemetria): void {
  memoria.push({ id: siguienteId++, creadoEn: Date.now(), evento });
  if (memoria.length > MAXIMO_PENDIENTES) {
    memoria.splice(0, memoria.length - MAXIMO_PENDIENTES);
  }
}

function abrirBd(): Promise<IDBDatabase | null> {
  if (apertura) {
    return apertura;
  }

  apertura = new Promise((resolver) => {
    if (typeof indexedDB === 'undefined') {
      usarMemoria = true;
      resolver(null);
      return;
    }

    try {
      const solicitud = indexedDB.open(NOMBRE_BD, VERSION_BD);
      solicitud.onupgradeneeded = () => {
        const bd = solicitud.result;
        if (!bd.objectStoreNames.contains(ALMACEN)) {
          const almacen = bd.createObjectStore(ALMACEN, {
            keyPath: 'id',
            autoIncrement: true,
          });
          almacen.createIndex('creadoEn', 'creadoEn');
        }
      };
      solicitud.onsuccess = () => resolver(solicitud.result);
      solicitud.onerror = () => {
        usarMemoria = true;
        resolver(null);
      };
    } catch {
      usarMemoria = true;
      resolver(null);
    }
  });

  return apertura;
}

function prometer<T>(solicitud: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

export async function encolar(evento: EventoTelemetria): Promise<void> {
  if (usarMemoria) {
    guardarEnMemoria(evento);
    return;
  }

  const bd = await abrirBd();
  if (!bd) {
    guardarEnMemoria(evento);
    return;
  }

  try {
    const transaccion = bd.transaction(ALMACEN, 'readwrite');
    transaccion.objectStore(ALMACEN).add({ creadoEn: Date.now(), evento });
    await new Promise<void>((resolver, rechazar) => {
      transaccion.oncomplete = () => resolver();
      transaccion.onerror = () => rechazar(transaccion.error);
    });
  } catch {
    usarMemoria = true;
    guardarEnMemoria(evento);
  }
}

export async function leerPendientes(maximo: number): Promise<Pendiente[]> {
  if (usarMemoria) {
    return memoria.slice(0, maximo);
  }

  const bd = await abrirBd();
  if (!bd) {
    return memoria.slice(0, maximo);
  }

  try {
    const transaccion = bd.transaction(ALMACEN, 'readonly');
    const todos = await prometer(transaccion.objectStore(ALMACEN).getAll());
    return (todos as Pendiente[])
      .sort((a, b) => a.creadoEn - b.creadoEn)
      .slice(0, maximo);
  } catch {
    return memoria.slice(0, maximo);
  }
}

export async function descartar(ids: number[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  for (let i = memoria.length - 1; i >= 0; i -= 1) {
    if (ids.includes(memoria[i].id)) {
      memoria.splice(i, 1);
    }
  }

  if (usarMemoria) {
    return;
  }

  const bd = await abrirBd();
  if (!bd) {
    return;
  }

  try {
    const transaccion = bd.transaction(ALMACEN, 'readwrite');
    const almacen = transaccion.objectStore(ALMACEN);
    for (const id of ids) {
      almacen.delete(id);
    }
    await new Promise<void>((resolver, rechazar) => {
      transaccion.oncomplete = () => resolver();
      transaccion.onerror = () => rechazar(transaccion.error);
    });
  } catch {
    // Si falla el borrado, el evento se reintenta; no hay nada más que hacer.
  }
}

export async function limpiarViejos(): Promise<void> {
  const limite = Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000;

  for (let i = memoria.length - 1; i >= 0; i -= 1) {
    if (memoria[i].creadoEn < limite) {
      memoria.splice(i, 1);
    }
  }

  if (usarMemoria) {
    return;
  }

  const bd = await abrirBd();
  if (!bd) {
    return;
  }

  try {
    const transaccion = bd.transaction(ALMACEN, 'readwrite');
    const almacen = transaccion.objectStore(ALMACEN);
    const indice = almacen.index('creadoEn');
    const solicitud = indice.openCursor(IDBKeyRange.upperBound(limite));
    solicitud.onsuccess = () => {
      const cursor = solicitud.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch {
    // Sin limpieza no pasa nada: la siguiente corrida lo intenta de nuevo.
  }
}

export async function contarPendientes(): Promise<number> {
  if (usarMemoria) {
    return memoria.length;
  }

  const bd = await abrirBd();
  if (!bd) {
    return memoria.length;
  }

  try {
    const transaccion = bd.transaction(ALMACEN, 'readonly');
    return await prometer(transaccion.objectStore(ALMACEN).count());
  } catch {
    return memoria.length;
  }
}
