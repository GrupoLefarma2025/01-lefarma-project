import { cn } from '@/lib/utils';

/**
 * Animación de espera para el cálculo de ruta: anillos, marcas y flechas.
 * Las animaciones van en un bloque CSS local porque combinan rotación,
 * `stroke-dashoffset` y retardos; el layout y los colores usan Tailwind.
 */
const RUTA_LOADER_CSS = `
.ruta-loader { display: block; }
.ruta-loader__arrows,
.ruta-loader__ring-rotate,
.ruta-loader__ring-stroke,
.ruta-loader__tick {
  animation-duration: 2s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.ruta-loader__arrows {
  animation-name: ruta-loader-arrows;
  transform-origin: 16px 52px;
}
.ruta-loader__ring-rotate,
.ruta-loader__ring-stroke {
  transform-origin: 80px 80px;
}
.ruta-loader__ring-rotate { animation-name: ruta-loader-ring-rotate; }
.ruta-loader__ring-stroke { animation-name: ruta-loader-ring-stroke; }
.ruta-loader__tick { animation-name: ruta-loader-tick; }
.ruta-loader__tick:nth-child(2) { animation-delay: -1.75s; }
.ruta-loader__tick:nth-child(3) { animation-delay: -1.5s; }
.ruta-loader__tick:nth-child(4) { animation-delay: -1.25s; }
.ruta-loader__tick:nth-child(5) { animation-delay: -1s; }
.ruta-loader__tick:nth-child(6) { animation-delay: -0.75s; }
.ruta-loader__tick:nth-child(7) { animation-delay: -0.5s; }
.ruta-loader__tick:nth-child(8) { animation-delay: -0.25s; }

@keyframes ruta-loader-arrows {
  from { transform: rotate(45deg); }
  to { transform: rotate(405deg); }
}
@keyframes ruta-loader-ring-rotate {
  from { transform: rotate(0); }
  to { transform: rotate(720deg); }
}
@keyframes ruta-loader-ring-stroke {
  from, to {
    stroke-dashoffset: 226;
    transform: rotate(-45deg);
  }
  50% {
    stroke-dashoffset: 113;
    transform: rotate(-180deg);
  }
}
@keyframes ruta-loader-tick {
  from, 3%, 47%, to { stroke-dashoffset: -12; }
  14%, 36% { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ruta-loader__arrows,
  .ruta-loader__ring-rotate,
  .ruta-loader__ring-stroke,
  .ruta-loader__tick {
    animation: none;
  }
}
`;

export function RutaLoader({ className }: { className?: string }) {
  return (
    <div className={cn('ruta-loader', className)} aria-hidden="true">
      <style>{RUTA_LOADER_CSS}</style>
      <svg viewBox="0 0 160 160" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ruta-loader-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" />
            <stop offset="100%" stopColor="#fff" />
          </linearGradient>
          <mask id="ruta-loader-mask-1">
            <rect x="0" y="0" width="160" height="160" fill="url(#ruta-loader-grad)" />
          </mask>
          <mask id="ruta-loader-mask-2">
            <rect x="28" y="28" width="104" height="104" fill="url(#ruta-loader-grad)" />
          </mask>
        </defs>

        <g className="text-primary">
          <g className="ruta-loader__ring-rotate">
            <circle
              className="ruta-loader__ring-stroke"
              cx="80"
              cy="80"
              r="72"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeDasharray="452.39 452.39"
              strokeDashoffset="226"
              strokeLinecap="round"
              transform="rotate(-45,80,80)"
            />
          </g>
        </g>
        <g mask="url(#ruta-loader-mask-1)" className="text-primary/40">
          <g className="ruta-loader__ring-rotate">
            <circle
              className="ruta-loader__ring-stroke"
              cx="80"
              cy="80"
              r="72"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeDasharray="452.39 452.39"
              strokeDashoffset="226"
              strokeLinecap="round"
              transform="rotate(-45,80,80)"
            />
          </g>
        </g>

        <g className="text-muted-foreground/50" strokeWidth="4" strokeDasharray="12 12" strokeDashoffset="0" strokeLinecap="round" transform="translate(80,80)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((grados) => (
            <polyline
              key={grados}
              className="ruta-loader__tick"
              stroke="currentColor"
              points="0,2 0,14"
              transform={`rotate(${grados},0,0) translate(0,40)`}
            />
          ))}
        </g>
        <g mask="url(#ruta-loader-mask-1)" className="text-primary/40" strokeWidth="4" strokeDasharray="12 12" strokeDashoffset="0" strokeLinecap="round" transform="translate(80,80)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((grados) => (
            <polyline
              key={grados}
              className="ruta-loader__tick"
              stroke="currentColor"
              points="0,2 0,14"
              transform={`rotate(${grados},0,0) translate(0,40)`}
            />
          ))}
        </g>

        <g transform="translate(64,28)">
          <g className="ruta-loader__arrows" transform="rotate(45,16,52)">
            <path className="text-[#eb6c36]" fill="currentColor" d="M17.998,1.506l13.892,43.594c.455,1.426-.56,2.899-1.998,2.899H2.108c-1.437,0-2.452-1.473-1.998-2.899L14.002,1.506c.64-2.008,3.356-2.008,3.996,0Z" />
            <path className="text-muted-foreground/40" fill="currentColor" d="M14.009,102.499L.109,58.889c-.453-1.421,.559-2.889,1.991-2.889H29.899c1.433,0,2.444,1.468,1.991,2.889l-13.899,43.61c-.638,2.001-3.345,2.001-3.983,0Z" />
          </g>
        </g>
        <g mask="url(#ruta-loader-mask-2)">
          <g transform="translate(64,28)">
            <g className="ruta-loader__arrows" transform="rotate(45,16,52)">
              <path className="text-[#eb6c36]/70" fill="currentColor" d="M17.998,1.506l13.892,43.594c.455,1.426-.56,2.899-1.998,2.899H2.108c-1.437,0-2.452-1.473-1.998-2.899L14.002,1.506c.64-2.008,3.356-2.008,3.996,0Z" />
              <path className="text-primary/30" fill="currentColor" d="M14.009,102.499L.109,58.889c-.453-1.421,.559-2.889,1.991-2.889H29.899c1.433,0,2.444,1.468,1.991,2.889l-13.899,43.61c-.638,2.001-3.345,2.001-3.983,0Z" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
