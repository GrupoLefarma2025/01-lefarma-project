import { cn } from '@/lib/utils';

export interface CheckboxAnimadoProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Animación del check: la palomita se dibuja al activar (feedback continuo
 * sobre el evento causal) y la caja responde al instante al presionar
 * (`:active`, 100ms). Sin rebotes ni ondas expansivas: un tap no lleva
 * momentum, así que la transición es críticamente amortiguada (ease-out
 * corto). Solo se animan transform/opacidad. Se respeta
 * `prefers-reduced-motion`.
 */
const CHECKBOX_CSS = `
.checkbox-animado { position: relative; }
.checkbox-animado .ca-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.checkbox-animado .ca-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.checkbox-animado .ca-box {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--primary);
  background: transparent;
  transition: background 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out, transform 100ms ease-out;
  flex-shrink: 0;
}
.checkbox-animado .ca-box svg {
  width: 12px;
  height: 10px;
  fill: none;
  stroke: var(--primary-foreground);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 16px;
  stroke-dashoffset: 16px;
  transition: stroke-dashoffset 240ms ease-out 60ms;
}
.checkbox-animado .ca-label:hover .ca-box {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent);
}
.checkbox-animado .ca-label:active .ca-box {
  transform: scale(0.9);
}
.checkbox-animado .ca-input:focus-visible + .ca-label .ca-box {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.checkbox-animado .ca-input:checked + .ca-label .ca-box {
  background: var(--primary);
  border-color: var(--primary);
}
.checkbox-animado .ca-input:checked + .ca-label .ca-box svg {
  stroke-dashoffset: 0;
}
@media (prefers-reduced-motion: reduce) {
  .checkbox-animado .ca-box,
  .checkbox-animado .ca-box svg {
    transition: none !important;
  }
  .checkbox-animado .ca-input:checked + .ca-label .ca-box svg {
    stroke-dashoffset: 0;
  }
}
`;

/**
 * Checkbox con palomita que se dibuja al activar, en el primario del tema.
 * Usa un input nativo enfocado por teclado + label asociado, así que
 * `getByLabelText` y la navegación con Tab/Espacio siguen funcionando.
 */
export function CheckboxAnimado({ id, checked, onCheckedChange, children, className }: CheckboxAnimadoProps) {
  return (
    <div className={cn('checkbox-animado', className)}>
      <style>{CHECKBOX_CSS}</style>
      <input
        id={id}
        type="checkbox"
        className="ca-input"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <label htmlFor={id} className="ca-label">
        <span className="ca-box" aria-hidden="true">
          <svg viewBox="0 0 12 10">
            <polyline points="1.5 6 4.5 9 10.5 1" />
          </svg>
        </span>
        <span className="text-sm font-medium">{children}</span>
      </label>
    </div>
  );
}
