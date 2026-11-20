/**
 * Puente mínimo entre los capturadores y el bucle de envío. Existe para que
 * `capturaErrores` y `capturaClics` puedan pedir un vaciado sin importar a
 * `iniciarTelemetria` (evita un ciclo de imports).
 */

let solicitud: () => void = () => {};

export function conectarEmisor(emisor: () => void): void {
  solicitud = emisor;
}

export function pedirEnvio(): void {
  solicitud();
}
