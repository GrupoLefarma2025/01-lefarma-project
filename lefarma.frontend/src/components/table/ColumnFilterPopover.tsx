import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import type { ColumnFilter, FilterType, TextOperator, NumberOperator, BooleanValue } from '@/types/table.types';

interface ColumnFilterPopoverProps {
  columnId: string;
  columnName: string;
  filterType: FilterType;
  hasActiveFilter: boolean;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  selectOptions?: { value: string; label: string }[];
  valueOptions?: string[];
  activeFilter?: ColumnFilter;
}

export function ColumnFilterPopover({
  columnId,
  columnName,
  filterType,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  selectOptions = [],
  valueOptions = [],
  activeFilter,
}: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
          aria-label={`Filtrar ${columnName}`}
          title={`Filtrar ${columnName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {filterType === 'text' && (
          <TextFilterPopover
            columnId={columnId}
            columnName={columnName}
            valueOptions={valueOptions}
            activeFilter={activeFilter}
            onApplyFilter={onApplyFilter}
            onClearFilter={onClearFilter}
            hasActiveFilter={hasActiveFilter}
            open={open}
            setOpen={setOpen}
          />
        )}
        {filterType === 'boolean' && (
          <BooleanFilterPopover
            columnId={columnId}
            columnName={columnName}
            onApplyFilter={onApplyFilter}
            onClearFilter={onClearFilter}
            hasActiveFilter={hasActiveFilter}
            open={open}
            setOpen={setOpen}
          />
        )}
        {filterType === 'number' && (
          <NumberFilterPopover
            columnId={columnId}
            columnName={columnName}
            onApplyFilter={onApplyFilter}
            onClearFilter={onClearFilter}
            hasActiveFilter={hasActiveFilter}
            open={open}
            setOpen={setOpen}
          />
        )}
        {filterType === 'select' && (
          <SelectFilterPopover
            columnId={columnId}
            columnName={columnName}
            selectOptions={selectOptions}
            onApplyFilter={onApplyFilter}
            onClearFilter={onClearFilter}
            hasActiveFilter={hasActiveFilter}
            open={open}
            setOpen={setOpen}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

interface TextFilterPopoverProps {
  columnId: string;
  columnName: string;
  valueOptions: string[];
  activeFilter?: ColumnFilter;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function TextFilterPopover({
  columnId,
  columnName,
  valueOptions,
  activeFilter,
  onApplyFilter,
  onClearFilter,
  hasActiveFilter,
  open,
  setOpen,
}: TextFilterPopoverProps) {
  const valoresActivos = Array.isArray(activeFilter?.value)
    ? (activeFilter.value as (string | number)[]).map(String)
    : [];
  const textoActivo =
    activeFilter && !Array.isArray(activeFilter.value) ? String(activeFilter.value) : '';

  const [modo, setModo] = useState<'valores' | 'texto'>(
    textoActivo || valueOptions.length === 0 ? 'texto' : 'valores'
  );
  const [operador, setOperador] = useState<TextOperator>(
    activeFilter && !Array.isArray(activeFilter.value)
      ? (activeFilter.operator as TextOperator)
      : 'contains'
  );
  const [valor, setValor] = useState(textoActivo);
  const [seleccionados, setSeleccionados] = useState<string[]>(valoresActivos);
  const [busquedaValor, setBusquedaValor] = useState('');

  const opcionesVisibles = useMemo(() => {
    const termino = busquedaValor.trim().toLocaleLowerCase('es');
    if (!termino) return valueOptions;
    return valueOptions.filter((option) =>
      option.toLocaleLowerCase('es').includes(termino)
    );
  }, [valueOptions, busquedaValor]);

  const seleccionVisibles = opcionesVisibles.filter((option) =>
    seleccionados.includes(option)
  ).length;
  const todosVisibles =
    opcionesVisibles.length > 0 && seleccionVisibles === opcionesVisibles.length;
  const algunosVisibles = seleccionVisibles > 0 && !todosVisibles;

  const alternarValor = (option: string) => {
    setSeleccionados((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  };

  const alternarTodos = () => {
    setSeleccionados((prev) => {
      if (todosVisibles) return prev.filter((item) => !opcionesVisibles.includes(item));
      return [...new Set([...prev, ...opcionesVisibles])];
    });
  };

  const aplicarValores = () => {
    if (seleccionados.length === 0) return;

    if (seleccionados.length === valueOptions.length) {
      onClearFilter();
      setOpen(false);
      return;
    }

    const etiqueta =
      seleccionados.length <= 2
        ? seleccionados.map((item) => `"${item}"`).join(', ')
        : `"${seleccionados[0]}", "${seleccionados[1]}" +${seleccionados.length - 2}`;

    onApplyFilter({
      columnId,
      type: 'text',
      operator: 'exact',
      value: seleccionados,
      displayLabel: etiqueta,
    });
    setOpen(false);
  };

  const aplicarTexto = () => {
    if (!valor.trim()) return;

    onApplyFilter({
      columnId,
      type: 'text',
      operator: operador,
      value: valor.trim(),
      displayLabel: `${getOperatorLabel(operador)} "${valor.trim()}"`,
    });
    setOpen(false);
  };

  const handleClear = () => {
    onClearFilter();
    setSeleccionados([]);
    setValor('');
    setBusquedaValor('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">Filtro: {columnName}</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {valueOptions.length > 0 && (
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
          <Button
            type="button"
            size="sm"
            variant={modo === 'valores' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setModo('valores')}
          >
            Valores
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modo === 'texto' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setModo('texto')}
          >
            Texto
          </Button>
        </div>
      )}

      {modo === 'valores' ? (
        <div className="space-y-2">
          <Input
            value={busquedaValor}
            onChange={(e) => setBusquedaValor(e.target.value)}
            placeholder="Buscar valor..."
            className="h-8"
          />

          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
            <div className="flex items-center gap-2 border-b border-border pb-1.5">
              <Checkbox
                id={`${columnId}-filtro-todos`}
                checked={todosVisibles ? true : algunosVisibles ? 'indeterminate' : false}
                onCheckedChange={alternarTodos}
              />
              <Label
                htmlFor={`${columnId}-filtro-todos`}
                className="cursor-pointer text-xs font-medium"
              >
                (Seleccionar todo)
              </Label>
            </div>

            {opcionesVisibles.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">Ningún valor coincide.</p>
            ) : (
              opcionesVisibles.map((option, indice) => (
                <div key={option} className="flex items-start gap-2">
                  <Checkbox
                    id={`${columnId}-filtro-${indice}`}
                    className="mt-0.5"
                    checked={seleccionados.includes(option)}
                    onCheckedChange={() => alternarValor(option)}
                  />
                  <Label
                    htmlFor={`${columnId}-filtro-${indice}`}
                    className="cursor-pointer break-all text-xs font-normal leading-snug"
                    title={option}
                  >
                    {option}
                  </Label>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={aplicarValores}
              className="flex-1"
              disabled={seleccionados.length === 0}
            >
              Aceptar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>

          {hasActiveFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={handleClear}
            >
              Borrar filtro
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Operador</Label>
            <Select value={operador} onValueChange={(v) => setOperador(v as TextOperator)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contiene</SelectItem>
                <SelectItem value="exact">Exacto</SelectItem>
                <SelectItem value="startsWith">Comienza con</SelectItem>
                <SelectItem value="endsWith">Termina con</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ingrese valor..."
              onKeyDown={(e) => e.key === 'Enter' && aplicarTexto()}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={aplicarTexto} className="flex-1" disabled={!valor.trim()}>
              Aplicar
            </Button>
            {hasActiveFilter && (
              <Button size="sm" variant="outline" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface BooleanFilterPopoverProps {
  columnId: string;
  columnName: string;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function BooleanFilterPopover({
  columnId,
  columnName,
  onApplyFilter,
  onClearFilter,
  hasActiveFilter,
  open,
  setOpen,
}: BooleanFilterPopoverProps) {
  const [value, setValue] = useState<BooleanValue>('all');

  const handleApply = () => {
    if (value === 'all') {
      onClearFilter();
      setOpen(false);
      return;
    }

    onApplyFilter({
      columnId,
      type: 'boolean',
      operator: value,
      value: value === 'true',
      displayLabel: value === 'true' ? 'Activo' : 'Inactivo',
    });
    setOpen(false);
  };

  const handleClear = () => {
    onClearFilter();
    setValue('all');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">Filtro: {columnName}</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <RadioGroup value={value} onValueChange={(v) => setValue(v as BooleanValue)}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="all" />
          <Label htmlFor="all">Todos</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="true" id="true" />
          <Label htmlFor="true">Activo</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="false" id="false" />
          <Label htmlFor="false">Inactivo</Label>
        </div>
      </RadioGroup>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleApply} className="flex-1">
          Aplicar
        </Button>
        {hasActiveFilter && (
          <Button size="sm" variant="outline" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface NumberFilterPopoverProps {
  columnId: string;
  columnName: string;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function NumberFilterPopover({
  columnId,
  columnName,
  onApplyFilter,
  onClearFilter,
  hasActiveFilter,
  open,
  setOpen,
}: NumberFilterPopoverProps) {
  const [operator, setOperator] = useState<NumberOperator>('equals');
  const [value, setValue] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const handleApply = () => {
    if (operator === 'between') {
      if (!minValue.trim() || !maxValue.trim()) return;

      const min = parseFloat(minValue);
      const max = parseFloat(maxValue);

      if (isNaN(min) || isNaN(max) || min > max) return;

      onApplyFilter({
        columnId,
        type: 'number',
        operator: 'between',
        value: [min, max],
        displayLabel: `${min} - ${max}`,
      });
      setMinValue('');
      setMaxValue('');
      setOpen(false);
    } else {
      if (!value.trim()) return;

      const num = parseFloat(value);
      if (isNaN(num)) return;

      onApplyFilter({
        columnId,
        type: 'number',
        operator,
        value: num,
        displayLabel: `${getNumberOperatorLabel(operator)} ${num}`,
      });
      setValue('');
      setOpen(false);
    }
  };

  const handleClear = () => {
    onClearFilter();
    setValue('');
    setMinValue('');
    setMaxValue('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">Filtro: {columnName}</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Operador</Label>
        <Select value={operator} onValueChange={(v) => setOperator(v as NumberOperator)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">=</SelectItem>
            <SelectItem value="notEquals">≠</SelectItem>
            <SelectItem value="greaterThan">&gt;</SelectItem>
            <SelectItem value="lessThan">&lt;</SelectItem>
            <SelectItem value="between">Entre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {operator === 'between' ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label>Mínimo</Label>
            <Input
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="0"
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            />
          </div>
          <div className="space-y-1">
            <Label>Máximo</Label>
            <Input
              type="number"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="100"
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Valor</Label>
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleApply}
          className="flex-1"
          disabled={operator === 'between' ? !minValue || !maxValue : !value}
        >
          Aplicar
        </Button>
        {hasActiveFilter && (
          <Button size="sm" variant="outline" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface SelectFilterPopoverProps {
  columnId: string;
  columnName: string;
  selectOptions: { value: string; label: string }[];
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function SelectFilterPopover({
  columnId,
  columnName,
  selectOptions,
  onApplyFilter,
  onClearFilter,
  hasActiveFilter,
  open,
  setOpen,
}: SelectFilterPopoverProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleToggle = (value: string) => {
    setSelectedOptions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleApply = () => {
    if (selectedOptions.length === 0) return;

    const labels = selectOptions
      .filter((opt) => selectedOptions.includes(opt.value))
      .map((opt) => opt.label)
      .join(', ');

    onApplyFilter({
      columnId,
      type: 'select',
      operator: 'contains',
      value: selectedOptions,
      displayLabel: labels,
    });
    setSelectedOptions([]);
    setOpen(false);
  };

  const handleClear = () => {
    onClearFilter();
    setSelectedOptions([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">Filtro: {columnName}</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-2">
        {selectOptions.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <Checkbox
              id={option.value}
              checked={selectedOptions.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
            />
            <Label htmlFor={option.value} className="cursor-pointer">
              {option.label}
            </Label>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleApply} className="flex-1" disabled={selectedOptions.length === 0}>
          Aplicar
        </Button>
        {hasActiveFilter && (
          <Button size="sm" variant="outline" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function getOperatorLabel(operator: TextOperator): string {
  const labels: Record<TextOperator, string> = {
    contains: 'Contiene',
    exact: 'Exacto',
    startsWith: 'Comienza con',
    endsWith: 'Termina con',
  };
  return labels[operator];
}

function getNumberOperatorLabel(operator: NumberOperator): string {
  const labels: Record<NumberOperator, string> = {
    equals: '=',
    notEquals: '≠',
    greaterThan: '>',
    lessThan: '<',
    between: 'Entre',
  };
  return labels[operator];
}
