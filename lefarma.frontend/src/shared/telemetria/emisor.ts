let solicitud: () => void = () => {};

export function conectarEmisor(emisor: () => void): void {
  solicitud = emisor;
}

export function pedirEnvio(): void {
  solicitud();
}
