/**
 * Tipos compartidos del router para montaje de subárboles multi-app.
 *
 * El shell monta cada subárbol de app (CxP, RH, apps futuras) vía una llamada
 * de función reutilizable de módulo de ruta. Cada módulo de rutas de app
 * acepta la MISMA shape para que el shell pueda montarlos uniformemente sin
 * que props específicas de app se filtren en la capa del router (DRY:
 * reemplaza los antiguos duplicados por-app `GastosRoutesProps` y
 * `RhRoutesProps`).
 */
export interface SubtreeRoutesProps {
  /**
   * Root mantiene un landing de índice específico de app; el subárbol
   * redirige el índice al login por-app.
   *
   * NOTA: después del nav-reorg el shell se monta en la raíz (`/`), así que
   * solo el variant `subtree` se monta en producción. El variant `root` se
   * conserva por estabilidad de API y testing de módulo standalone.
   */
  variant: 'root' | 'subtree';
  /**
   * Destino de login del subárbol. Por defecto `/login` (root) o el propio
   * `/{app}/login` de la app (subtree). El shell pasa el login explícito
   * por-app para que los hits no autenticados del subárbol redirijan al login
   * correcto de la app en lugar del global.
   */
  loginPath?: string;
}
