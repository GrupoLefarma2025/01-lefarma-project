import { Component, type ErrorInfo, type ReactNode } from 'react';
import { registrarErrorReact } from './capturaErrores';

interface Props {
  children: ReactNode;
  /**
   * Cuando cambia (por ejemplo, la ruta actual) se vuelve a intentar dibujar a
   * los hijos. Así una pantalla rota no obliga a recargar el navegador: basta
   * con navegar a otra sección.
   */
  resetKey?: string;
}

interface Estado {
  error: Error | null;
}

/**
 * Red de seguridad de React: si un componente revienta al dibujar, el error se
 * guarda antes de que la persona note nada. A propósito no muestra una pantalla
 * de error: el módulo se queda vacío y al cambiar de ruta se reintenta solo.
 */
export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    registrarErrorReact(error, info.componentStack ?? undefined);
  }

  componentDidUpdate(anterior: Props): void {
    if (this.state.error && anterior.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    return this.state.error ? null : this.props.children;
  }
}
