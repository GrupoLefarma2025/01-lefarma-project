import { WfPage, WfAlert, WfInput, WfButton, WfTable } from '../../wireframes/wf';

export default function HospitalesPage() {
  return (
    <WfPage title="Hospitales" subtitle="Catálogo">
      <div className="flex flex-wrap gap-2">
        <div className="w-48">
          <WfInput placeholder="Gerencia" />
        </div>
        <div className="w-56">
          <WfInput placeholder="Servicio de anestesia integral" />
        </div>
        <div className="w-32">
          <WfInput placeholder="Año" />
        </div>
        <WfButton label="+ Nuevo hospital" />
      </div>
      <WfAlert text="Los cálculos de anestesias son automáticos: solo se capturan los quirófanos." />
      <WfTable
        headers={[
          'CLUES (Clave Única de Establecimientos de Salud)',
          'Hospital',
          'Quirófanos',
          'Anestesias Totales',
          'Generales',
          'Regionales',
        ]}
        rows={[
          ['[CLUES 1]', '[Hospital A]', '4', '[auto]', '[auto]', '[auto]'],
          ['[CLUES 2]', '[Hospital B]', '6', '[auto]', '[auto]', '[auto]'],
          ['[CLUES 3]', '[Hospital C]', '3', '[auto]', '[auto]', '[auto]'],
          ['[CLUES 4]', '[Hospital D]', '5', '[auto]', '[auto]', '[auto]'],
        ]}
      />
    </WfPage>
  );
}