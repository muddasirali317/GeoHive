import { useMemo, useState } from 'react'
import { Table2, X, Search } from 'lucide-react'
import { getAttributeRows } from '../utils/thematic'

export default function AttributeTable({ layer, onClose, onRowFocus }) {
  const [filter, setFilter] = useState('')
  const { columns, rows, total } = useMemo(
    () => (layer ? getAttributeRows(layer.geojson, 1000) : { columns: [], rows: [], total: 0 }),
    [layer]
  )

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows
    const q = filter.toLowerCase()
    return rows.filter((r) =>
      columns.some((c) => String(r[c] ?? '').toLowerCase().includes(q))
    )
  }, [rows, columns, filter])

  if (!layer) return null

  return (
    <div className="attr-table-panel">
      <div className="attr-table-header">
        <div className="attr-table-title">
          <Table2 size={16} />
          <strong>{layer.name}</strong>
          <span className="attr-meta">
            {filtered.length}
            {total > filtered.length || filter ? ` / ${total}` : ''} features
          </span>
        </div>
        <div className="attr-table-actions">
          <div className="attr-search">
            <Search size={13} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter attributes…"
            />
          </div>
          <button className="icon-btn" onClick={onClose} title="Close table">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="attr-table-scroll">
        {columns.length === 0 ? (
          <div className="empty-layers">No attributes on this layer.</div>
        ) : (
          <table className="attr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Geom</th>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr
                  key={row.__id}
                  onClick={() => onRowFocus?.(row.__id)}
                  title="Click to highlight on map"
                >
                  <td className="mono">{idx + 1}</td>
                  <td className="mono dim">{row.__geom}</td>
                  {columns.map((c) => (
                    <td key={c}>{formatCell(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function formatCell(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
