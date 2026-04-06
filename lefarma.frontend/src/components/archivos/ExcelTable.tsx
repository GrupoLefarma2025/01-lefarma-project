// lefarma.frontend/src/components/archivos/ExcelTable.tsx


interface ExcelTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
}

export function ExcelTable({ data, maxRows = 100 }: ExcelTableProps) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-4">El archivo está vacío</p>;
  }

  const headers = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <div className="overflow-auto max-h-[400px] border rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-3 py-2 text-left font-medium text-gray-700 border-b"
              >
                {header || `(Columna ${idx + 1})`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {displayData.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
              {headers.map((header, colIdx) => (
                <td key={colIdx} className="px-3 py-2 text-gray-600">
                  {String(row[header] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="p-2 bg-gray-50 text-center text-sm text-gray-500 border-t">
          Mostrando {maxRows} de {data.length} filas
        </div>
      )}
    </div>
  );
}
