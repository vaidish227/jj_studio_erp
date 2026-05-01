import React, { useState } from 'react';
import { Plus, Trash2, Settings2, GripVertical, Type, Hash, AlignLeft, Table, ChevronDown } from 'lucide-react';
import Button from '../Button/Button';

const generateId = () => Math.random().toString(36).substring(2, 9);

const DynamicTableBuilder = ({ structure, onChange }) => {
  const { columns = [], rows = [] } = structure;
  
  // Track which column header is currently being edited for type settings
  const [activeColSettings, setActiveColSettings] = useState(null);

  const addColumn = () => {
    const newColId = generateId();
    const newColumns = [
      ...columns,
      { id: newColId, label: `Column ${columns.length + 1}`, type: 'text', width: 'auto' }
    ];
    
    const newRows = rows.map(row => ({
      ...row,
      cells: { ...row.cells, [newColId]: '' }
    }));
    
    onChange({ columns: newColumns, rows: newRows });
  };

  const removeColumn = (colId) => {
    const newColumns = columns.filter(col => col.id !== colId);
    
    const newRows = rows.map(row => {
      const newCells = { ...row.cells };
      delete newCells[colId];
      return { ...row, cells: newCells };
    });
    
    onChange({ columns: newColumns, rows: newRows });
    setActiveColSettings(null);
  };

  const updateColumn = (colId, field, value) => {
    const newColumns = columns.map(col => 
      col.id === colId ? { ...col, [field]: value } : col
    );
    onChange({ columns: newColumns, rows });
  };

  const addRow = (isGroupHeader = false) => {
    const newRowId = generateId();
    const newCells = {};
    columns.forEach(col => {
      newCells[col.id] = '';
    });
    
    const newRows = [
      ...rows,
      { id: newRowId, isGroupHeader, cells: newCells }
    ];
    
    onChange({ columns, rows: newRows });
  };

  const removeRow = (rowId) => {
    const newRows = rows.filter(row => row.id !== rowId);
    onChange({ columns, rows: newRows });
  };

  const updateCell = (rowId, colId, value) => {
    const newRows = rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          cells: {
            ...row.cells,
            [colId]: value
          }
        };
      }
      return row;
    });
    onChange({ columns, rows: newRows });
  };

  const toggleGroupHeader = (rowId) => {
    const newRows = rows.map(row => 
      row.id === rowId ? { ...row, isGroupHeader: !row.isGroupHeader } : row
    );
    onChange({ columns, rows: newRows });
  };

  if (columns.length === 0) {
    return (
      <div className="border-2 border-dashed border-[var(--border)] rounded-2xl p-16 flex flex-col items-center justify-center text-center bg-[var(--surface)] hover:bg-[var(--bg)] transition-colors cursor-pointer group" onClick={addColumn}>
        <div className="w-20 h-20 bg-[var(--primary)]/10 group-hover:bg-[var(--primary)]/20 transition-colors text-[var(--primary)] rounded-full flex items-center justify-center mb-6">
          <Table size={40} />
        </div>
        <h3 className="text-2xl font-black text-[var(--text-primary)] mb-2">Build Your Live Spreadsheet</h3>
        <p className="text-[var(--text-muted)] max-w-md mb-8 font-medium">
          Create a fully dynamic quotation table. Add columns instantly and type directly into the cells just like Excel.
        </p>
        <Button variant="primary" className="px-8 shadow-lg shadow-[var(--primary)]/20" onClick={(e) => { e.stopPropagation(); addColumn(); }}>
          <Plus size={18} /> Add First Column
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl shadow-black/5">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <AlignLeft size={16} className="text-[var(--primary)]" />
          Live Table Editor
        </h3>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          Edit column names by typing in headers. Change types via dropdown.
        </p>
      </div>
      
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)] relative shadow-sm">
              <th className="px-4 py-3 w-12 text-center text-[var(--text-muted)] border-r border-[var(--border)] font-bold text-[10px] tracking-widest uppercase bg-[var(--bg)]">
                #
              </th>
              
              {columns.map(col => (
                <th key={col.id} className="relative px-0 py-0 border-r border-[var(--border)] min-w-[200px] group align-top">
                  <div className="flex flex-col h-full bg-[var(--surface)] group-hover:bg-[var(--bg)] transition-colors">
                    {/* Column Label Input */}
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => updateColumn(col.id, 'label', e.target.value)}
                      placeholder="Column Name"
                      className="w-full bg-transparent px-4 py-3 font-bold text-[var(--text-primary)] focus:outline-none focus:bg-[var(--bg)] border-b border-transparent focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)]"
                    />
                    
                    {/* Column Configuration Bar (Type & Delete) */}
                    <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg)] border-t border-[var(--border)]">
                      <select
                        value={col.type}
                        onChange={(e) => updateColumn(col.id, 'type', e.target.value)}
                        className="bg-transparent text-[var(--text-muted)] text-[11px] font-bold uppercase outline-none cursor-pointer focus:text-[var(--primary)] transition-colors appearance-none pr-4"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '12px' }}
                      >
                        <option value="text">Text / String</option>
                        <option value="number">Numeric Value</option>
                        <option value="label">Static Label</option>
                      </select>

                      <button
                        onClick={() => removeColumn(col.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-all"
                        title="Delete Column"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </th>
              ))}
              
              <th className="px-2 py-0 align-middle bg-[var(--surface)] border-b border-[var(--border)]">
                <button
                  onClick={addColumn}
                  className="w-full h-full min-h-[60px] flex items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors font-bold text-xs whitespace-nowrap px-4"
                >
                  <Plus size={14} /> Add Col
                </button>
              </th>
            </tr>
          </thead>
          
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-12 text-center bg-[var(--bg)]">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[var(--text-muted)] mb-4">Your table has no rows yet.</p>
                    <div className="flex gap-3">
                      <Button variant="outline" size="sm" onClick={() => addRow(true)}>
                        <Plus size={14} /> Add Group Header
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => addRow(false)}>
                        <Plus size={14} /> Add Row
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : rows.map((row, rIndex) => (
              <tr key={row.id} className={`group ${row.isGroupHeader ? 'bg-[var(--primary)]/5' : 'hover:bg-[var(--bg)]'} border-b border-[var(--border)] transition-colors`}>
                {/* Row Number */}
                <td className="px-4 py-3 text-[var(--text-muted)] font-medium text-xs text-center border-r border-[var(--border)] bg-[var(--bg)]">
                  {rIndex + 1}
                </td>
                
                {row.isGroupHeader ? (
                  <td colSpan={columns.length} className="px-0 py-0 border-r border-[var(--border)]">
                    <input
                      type="text"
                      value={row.cells[columns[0]?.id] || ''}
                      onChange={(e) => updateCell(row.id, columns[0]?.id, e.target.value)}
                      placeholder="Type group header (e.g., Italian Work)"
                      className="w-full h-full bg-transparent px-4 py-3 font-black text-sm text-[var(--primary)] placeholder:text-[var(--primary)]/40 outline-none focus:bg-[var(--primary)]/10 transition-colors"
                    />
                  </td>
                ) : (
                  columns.map(col => (
                    <td key={col.id} className="px-0 py-0 border-r border-[var(--border)]">
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={row.cells[col.id] || ''}
                        onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                        placeholder={`...`}
                        className={`w-full h-full bg-transparent px-4 py-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/50 focus:bg-[var(--surface)] focus:outline-none transition-colors ${col.type === 'number' ? 'text-right font-medium' : ''}`}
                      />
                    </td>
                  ))
                )}
                
                {/* Row Actions */}
                <td className="px-2 py-0 align-middle">
                  <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleGroupHeader(row.id)}
                      className={`p-1.5 rounded hover:bg-[var(--surface)] transition-colors ${row.isGroupHeader ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}
                      title="Toggle Group Header"
                    >
                      <Settings2 size={14} />
                    </button>
                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-colors"
                      title="Delete Row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Quick Add Row Footers */}
            {rows.length > 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="p-0 border-t-2 border-dashed border-[var(--border)]">
                  <div className="flex">
                    <button
                      onClick={() => addRow(false)}
                      className="flex-1 flex items-center justify-center gap-2 py-4 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 font-bold text-sm transition-colors border-r border-[var(--border)]"
                    >
                      <Plus size={16} /> Add Standard Row
                    </button>
                    <button
                      onClick={() => addRow(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-4 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 font-bold text-sm transition-colors"
                    >
                      <AlignLeft size={16} /> Add Group Header
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DynamicTableBuilder;
