import { useState } from 'react';
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
}

export function ColumnFilterPopover({
  columnId,
  columnName,
  filterType,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  selectOptions = [],
}: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {filterType === 'text' && (
          <TextFilterPopover
            columnId={columnId}
            columnName={columnName}
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

// ==================== Text Filter ====================
interface TextFilterPopoverProps {
  columnId: string;
  columnName: string;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function TextFilterPopover({
  columnId,
  columnName,
  onApplyFilter,
  onClearFilter,
  hasActiveFilter,
  open,
  setOpen,
}: TextFilterPopoverProps) {
  const [operator, setOperator] = useState<TextOperator>('contains');
  const [value, setValue] = useState('');

  const handleApply = () => {
    if (!value.trim()) return;

    onApplyFilter({
      columnId,
      type: 'text',
      operator,
      value: value.trim(),
      displayLabel: `${getOperatorLabel(operator)} "${value}"`,
    });
    setValue('');
    setOpen(false);
  };

  const handleClear = () => {
    onClearFilter();
    setValue('');
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
        <Select value={operator} onValueChange={(v) => setOperator(v as TextOperator)}>
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ingrese valor..."
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleApply} className="flex-1" disabled={!value.trim()}>
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

// ==================== Boolean Filter ====================
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

// ==================== Number Filter ====================
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

// ==================== Select Filter ====================
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

// ==================== Helpers ====================
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
