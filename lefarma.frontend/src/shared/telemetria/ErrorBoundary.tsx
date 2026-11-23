import { Component, type ErrorInfo, type ReactNode } from 'react';
import { registrarErrorReact } from './capturaErrores';

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface Estado {
  error: Error | null;
}

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
