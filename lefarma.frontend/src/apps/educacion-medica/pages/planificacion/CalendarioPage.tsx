import { WfPage, WfAlert, WfPanel, WfField, WfTable } from '../../wireframes/wf';

const WEEK_ROWS = [
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
];

export default function CalendarioPage() {
  return (
    <WfPage title="Calendario">
      <WfAlert text="Lo elabora el Auxiliar Administrativo (día 17). Firma pendiente de definición." />
      <WfPanel title="Mes">
        <div className="space-y-1">
          {WEEK_ROWS.map((week, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {week.map((day, j) => (
                <WfField key={j} label={`[semana]`} value={day} />
              ))}
            </div>
          ))}
        </div>
      </WfPanel>
      <WfPanel title="Talleres del mes">
        <WfTable
          headers={['Fecha', 'Hospital', 'Ejecutivo', 'Especialista']}
          rows={[
            ['[Fecha]', '[Hospital]', '[Ejecutivo]', '[Especialista]'],
            ['[Fecha]', '[Hospital]', '[Ejecutivo]', '[Especialista]'],
            ['[Fecha]', '[Hospital]', '[Ejecutivo]', '[Especialista]'],
            ['[Fecha]', '[Hospital]', '[Ejecutivo]', '[Especialista]'],
          ]}
        />
      </WfPanel>
    </WfPage>
  );
}