import { MultiStepLogin } from '@/components/baseapp/MultiStepLogin';

/**
 * Login global del shell baseapp — flujo de 2 pasos (usuario + contraseña),
 * sin selección de contexto. Aterriza en `/hub` al autenticar
 * (spec app-routing: "Global Login Route").
 *
 * Delega por completo en `<MultiStepLogin>`: este wrapper únicamente fija el
 * destino post-login específico del shell raíz. El comportamiento de 2 vs 3
 * pasos se controla en `MultiStepLogin` según la presencia del prop `step3`
 * (aquí omitido), por lo que se ejecuta el flujo de 2 pasos — equivalente al
 * `<Login requireContextSelection={false} />` original.
 */
export default function BaseAppLogin() {
  return <MultiStepLogin redirectTo="/hub" />;
}
