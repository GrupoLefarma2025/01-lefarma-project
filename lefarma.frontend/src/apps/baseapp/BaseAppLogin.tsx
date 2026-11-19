import { useSearchParams } from 'react-router-dom';
import { MultiStepLogin } from '@/components/baseapp/MultiStepLogin';

/** Destino por defecto del login global del shell. */
const DEFAULT_REDIRECT = '/hub';

/**
 * Valida un `?return=` para que sólo se acepten rutas internas seguras:
 * debe empezar con `/`, no puede ser protocol-relative (`//`) y no puede ser
 * una URL absoluta (`http`/`https`). Devuelve `null` si no es seguro.
 */
function resolveSafeReturn(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (/^https?:/i.test(value)) return null;
  return value;
}

/**
 * Login global del shell baseapp — flujo de 2 pasos (usuario + contraseña),
 * sin selección de contexto.
 *
 * Honra `?return=` cuando apunta a una ruta interna segura (así una sesión no
 * autenticada que llegó a una ruta protegida vuelve a su destino tras
 * autenticarse) y, si no, aterriza en `/hub`
 * (spec app-routing: "Global Login Route").
 */
export default function BaseAppLogin() {
  const [searchParams] = useSearchParams();
  const redirectTo = resolveSafeReturn(searchParams.get('return')) ?? DEFAULT_REDIRECT;

  return <MultiStepLogin redirectTo={redirectTo} />;
}
