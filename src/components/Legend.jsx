import { List } from 'lucide-react'

export default function Legend({ layers, collapsed, onToggle }) {
  const themed = layers.filter(
    (l) => l.visible && l.theme?.classes?.length && l.theme.mode !== 'none'
  )

  if (!themed.length) return null

  return (
    <div className={`map-legend ${collapsed ? 'collapsed' : ''}`}>
      <button className="legend-header" onClick={onToggle} type="button">
        <List size={14} />
        <span>Legend</span>
        <span className="legend-count">{themed.length}</span>
      </button>
      {!collapsed && (
        <div className="legend-body">
          {themed.map((layer) => (
            <div key={layer.id} className="legend-layer">
              <div className="legend-layer-title">{layer.name}</div>
              {layer.theme.field && (
                <div className="legend-field">
                  Field: <strong>{layer.theme.field}</strong>
                  <span className="legend-type-badge">{layer.theme.type}</span>
                </div>
              )}
              <ul className="legend-items">
                {layer.theme.classes.map((c, i) => (
                  <li key={`${layer.id}-${i}`}>
                    <span
                      className="legend-swatch"
                      style={{
                        background: c.color,
                        borderRadius: layer.theme.type === 'numeric' ? 2 : 3,
                      }}
                    />
                    <span className="legend-label" title={c.label}>
                      {c.label}
                    </span>
                    {typeof c.count === 'number' && (
                      <span className="legend-item-count">{c.count}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
