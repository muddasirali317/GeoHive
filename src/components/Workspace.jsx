import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Search,
  Upload,
  Hexagon,
  Layers,
  MapPin,
  Eye,
  EyeOff,
  Trash2,
  Crosshair,
  Box,
  Home,
  MousePointerClick,
  Loader2,
  Navigation,
  Focus,
  Palette,
  Table2,
  List,
} from 'lucide-react'
import MapView from './MapView'
import Legend from './Legend'
import AttributeTable from './AttributeTable'
import Logo from './Logo'
import {
  parseUploadedFile,
  createBuffer,
  geocodeForward,
  geocodeReverse,
  getBounds,
  featureCount,
  geometryTypes,
  makeLayerId,
  nextColor,
  ensureFeatureCollection,
} from '../utils/geo'
import {
  analyzeAttributes,
  autoThemeLayer,
  buildThematicStyle,
  sampleZoningGeoJSON,
  COLOR_SCHEMES,
  stripThemeProps,
} from '../utils/thematic'
import './Workspace.css'

const TOOLS = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'geocode', label: 'Geocode', icon: Navigation },
  { id: 'buffer', label: 'Buffer', icon: Hexagon },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'layers', label: 'Layers', icon: Layers },
]

function sampleCities() {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'New York', pop: 8336000, region: 'Americas' },
        geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
      },
      {
        type: 'Feature',
        properties: { name: 'London', pop: 8982000, region: 'Europe' },
        geometry: { type: 'Point', coordinates: [-0.1276, 51.5074] },
      },
      {
        type: 'Feature',
        properties: { name: 'Tokyo', pop: 13960000, region: 'Asia' },
        geometry: { type: 'Point', coordinates: [139.6917, 35.6895] },
      },
      {
        type: 'Feature',
        properties: { name: 'Sydney', pop: 5312000, region: 'Oceania' },
        geometry: { type: 'Point', coordinates: [151.2093, -33.8688] },
      },
      {
        type: 'Feature',
        properties: { name: 'São Paulo', pop: 12330000, region: 'Americas' },
        geometry: { type: 'Point', coordinates: [-46.6333, -23.5505] },
      },
      {
        type: 'Feature',
        properties: { name: 'Cairo', pop: 9900000, region: 'Africa' },
        geometry: { type: 'Point', coordinates: [31.2357, 30.0444] },
      },
      {
        type: 'Feature',
        properties: { name: 'Mumbai', pop: 20410000, region: 'Asia' },
        geometry: { type: 'Point', coordinates: [72.8777, 19.076] },
      },
      {
        type: 'Feature',
        properties: { name: 'Nairobi', pop: 4397000, region: 'Africa' },
        geometry: { type: 'Point', coordinates: [36.8219, -1.2921] },
      },
    ],
  }
}

function makeLayerRecord(name, geojson, opts = {}, layerIndex = 0) {
  const id = makeLayerId(opts.prefix || 'layer')
  const raw = stripThemeProps(ensureFeatureCollection(geojson))
  const color = opts.color || nextColor(layerIndex)
  const analysis = analyzeAttributes(raw)
  const ramp = opts.ramp || 'vivid'

  let theme = opts.theme
  if (!theme && opts.autoTheme !== false && analysis.fields.length > 0) {
    const auto = autoThemeLayer(raw, { defaultColor: color, ramp })
    theme = auto.theme
  }
  if (!theme) {
    theme = buildThematicStyle(raw, null, { defaultColor: color, ramp })
  }

  // Map always renders themed/styled copy with __theme_color on each feature
  const displayGeo = theme?.styledGeojson || raw

  return {
    id,
    name,
    geojson: displayGeo,
    rawGeojson: raw,
    color,
    visible: true,
    opacity: opts.opacity ?? (theme?.mode === 'thematic' ? 0.65 : 0.4),
    theme,
    fields: analysis.fields,
    themeField: theme?.field || null,
    ramp,
  }
}

export default function Workspace({ onHome }) {
  const mapRef = useRef(null)
  const fileInputRef = useRef(null)
  const [tool, setTool] = useState('upload')
  const [pitch3d, setPitch3d] = useState(true)
  const [layers, setLayers] = useState([])
  const [cursor, setCursor] = useState({ lon: 0, lat: 0 })
  const [toast, setToast] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  // Search
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])

  // Geocode / reverse
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState([])
  const [reverseMode, setReverseMode] = useState(false)
  const [reverseInfo, setReverseInfo] = useState(null)
  const [geocoding, setGeocoding] = useState(false)

  // Buffer
  const [bufferDistance, setBufferDistance] = useState(50)
  const [bufferUnit, setBufferUnit] = useState('km')
  const [bufferSource, setBufferSource] = useState('')
  const [pickMode, setPickMode] = useState(false)
  const [pickedPoint, setPickedPoint] = useState(null)

  // Theme / legend / attributes
  const [themeLayerId, setThemeLayerId] = useState('')
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [attrLayerId, setAttrLayerId] = useState(null)
  const [selectedFeature, setSelectedFeature] = useState(null)

  const showToast = useCallback((msg, ms = 3200) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }, [])

  const addLayer = useCallback((name, geojson, opts = {}) => {
    // Build record with provisional index; re-index inside setState for accuracy
    const provisional = makeLayerRecord(name, geojson, opts, 0)
    setLayers((prev) => {
      const layer = {
        ...provisional,
        color: opts.color || nextColor(prev.length),
      }
      // Keep same id so callers can reference the returned object
      return [...prev, layer]
    })
    return provisional
  }, [])

  const addLayersBatch = useCallback((items) => {
    // items: [{ name, geojson, opts }]
    let created = []
    setLayers((prev) => {
      const next = [...prev]
      created = items.map((item, i) => {
        const layer = makeLayerRecord(
          item.name,
          item.geojson,
          item.opts || {},
          next.length + i
        )
        next.push(layer)
        return layer
      })
      return next
    })
    return created
  }, [])

  // When layers change, default theme panel target
  useEffect(() => {
    if (!layers.length) {
      setThemeLayerId('')
      return
    }
    if (!themeLayerId || !layers.find((l) => l.id === themeLayerId)) {
      setThemeLayerId(layers[layers.length - 1].id)
    }
  }, [layers, themeLayerId])

  const fitLayer = useCallback((geojson) => {
    const bbox = getBounds(geojson)
    if (bbox) mapRef.current?.fitBounds(bbox)
  }, [])

  const handleMapClick = useCallback(
    async (lon, lat, _e, feats) => {
      setCursor({ lon, lat })

      if (pickMode) {
        setPickedPoint({ lon, lat })
        mapRef.current?.clearMarkers()
        mapRef.current?.addMarker(lon, lat, '#f59e0b')
        showToast(`Point picked: ${lat.toFixed(5)}, ${lon.toFixed(5)}`)
        setPickMode(false)
        return
      }

      if (feats?.length) {
        setSelectedFeature({
          properties: feats[0].properties,
          layerId: feats[0].layer?.id,
        })
      } else {
        setSelectedFeature(null)
      }

      if (reverseMode || tool === 'geocode') {
        try {
          setGeocoding(true)
          const info = await geocodeReverse(lon, lat)
          setReverseInfo(info)
          if (!feats?.length) {
            mapRef.current?.clearMarkers()
            mapRef.current?.addMarker(lon, lat, '#a78bfa')
          }
          showToast('Address resolved')
        } catch {
          showToast('Reverse geocode failed')
        } finally {
          setGeocoding(false)
        }
      }
    },
    [pickMode, reverseMode, tool, showToast]
  )

  const handleMapReady = useCallback((map) => {
    map.on('mousemove', (e) => {
      setCursor({ lon: e.lngLat.lng, lat: e.lngLat.lat })
    })
  }, [])

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const data = await geocodeForward(query.trim())
      setResults(data)
      if (!data.length) showToast('No locations found')
    } catch {
      showToast('Search failed — check network')
    } finally {
      setSearching(false)
    }
  }

  const selectResult = (r) => {
    mapRef.current?.flyTo(r.lon, r.lat, 13)
    mapRef.current?.clearMarkers()
    mapRef.current?.addMarker(r.lon, r.lat)
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: r.label, source: 'search' },
          geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        },
      ],
    }
    const layer = addLayer(r.label.split(',')[0], fc, {
      color: '#00e5a8',
      opacity: 0.4,
      autoTheme: false,
    })
    if (layer) setThemeLayerId(layer.id)
    showToast(`Navigated to ${r.label.split(',')[0]}`)
  }

  const runGeocode = async (e) => {
    e?.preventDefault()
    if (!geoQuery.trim()) return
    setGeocoding(true)
    setGeoResults([])
    try {
      const data = await geocodeForward(geoQuery.trim())
      setGeoResults(data)
      if (!data.length) showToast('No geocode results')
    } catch {
      showToast('Geocoding failed')
    } finally {
      setGeocoding(false)
    }
  }

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return

    for (const file of files) {
      try {
        showToast(`Parsing ${file.name}…`)
        const parsed = await parseUploadedFile(file)
        if (parsed.multi) {
          const batch = addLayersBatch(
            parsed.multi.map((m) => ({
              name: m.name,
              geojson: m.geojson,
              opts: { autoTheme: true },
            }))
          )
          if (batch[0]) {
            fitLayer(batch[0].geojson)
            setThemeLayerId(batch[0].id)
            setAttrLayerId(batch[0].id)
            setTool('theme')
          }
          showToast(`Loaded ${file.name} · auto legend + attributes`)
        } else {
          const layer = addLayer(parsed.name, parsed.geojson, { autoTheme: true })
          if (layer) {
            fitLayer(layer.geojson)
            setThemeLayerId(layer.id)
            setAttrLayerId(layer.id)
            setTool('theme')
            const field = layer.theme?.field
            showToast(
              field
                ? `Loaded ${file.name} · thematic map on “${field}” + legend`
                : `Loaded ${file.name}`
            )
          }
        }
      } catch (err) {
        console.error(err)
        showToast(err.message || `Failed to load ${file.name}`)
      }
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const runBuffer = () => {
    try {
      let sourceGeo = null
      let sourceName = 'picked point'

      if (bufferSource === '__pick__' || (!bufferSource && pickedPoint)) {
        if (!pickedPoint) {
          showToast('Pick a point on the map first')
          return
        }
        sourceGeo = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [pickedPoint.lon, pickedPoint.lat],
              },
            },
          ],
        }
      } else {
        const src = layers.find((l) => l.id === bufferSource)
        if (!src) {
          showToast('Select a source layer or pick a point')
          return
        }
        sourceGeo = src.geojson
        sourceName = src.name
      }

      let dist = Number(bufferDistance)
      if (!Number.isFinite(dist) || dist <= 0) {
        showToast('Enter a valid distance')
        return
      }
      if (bufferUnit === 'm') dist = dist / 1000
      if (bufferUnit === 'mi') dist = dist * 1.60934

      const buffered = createBuffer(sourceGeo, dist)
      const label = `Buffer ${bufferDistance}${bufferUnit} · ${sourceName}`
      const layer = addLayer(label, buffered, {
        prefix: 'buffer',
        color: '#3b82f6',
        opacity: 0.22,
        autoTheme: false,
      })
      if (layer) fitLayer(layer.geojson)
      showToast('Buffer created')
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Buffer failed')
    }
  }

  const loadSample = () => {
    const geo = sampleCities()
    const layer = addLayer('Sample Cities', geo, { color: '#f59e0b', autoTheme: true })
    if (layer) {
      fitLayer(layer.geojson)
      setThemeLayerId(layer.id)
      setAttrLayerId(layer.id)
    }
    showToast('Sample cities loaded with thematic legend')
  }

  const loadZoningSample = () => {
    const geo = sampleZoningGeoJSON()
    const layer = addLayer('Sample US Zoning', geo, {
      color: '#e6194b',
      autoTheme: true,
      opacity: 0.6,
    })
    if (layer) {
      fitLayer(layer.geojson)
      setThemeLayerId(layer.id)
      setAttrLayerId(layer.id)
      setTool('theme')
      setPitch3d(false)
    }
    showToast('Zoning sample loaded · legend + attributes ready')
  }

  const applyTheme = (layerId, field, ramp) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== layerId) return l
        const source = l.rawGeojson || stripThemeProps(l.geojson)
        const nextRamp = ramp || l.ramp || 'vivid'
        const theme = buildThematicStyle(source, field || null, {
          defaultColor: l.color,
          ramp: nextRamp,
        })
        return {
          ...l,
          rawGeojson: source,
          geojson: theme.styledGeojson || source,
          theme: { ...theme },
          themeField: field || null,
          ramp: nextRamp,
          opacity: theme.mode === 'thematic' ? 0.65 : 0.4,
        }
      })
    )
    showToast(
      field
        ? `Colored by “${field}” · scheme: ${ramp || 'vivid'}`
        : 'Single-color style'
    )
  }

  const toggleLayer = (id) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    )
  }

  const removeLayer = (id) => {
    setLayers((prev) => prev.filter((l) => l.id !== id))
    if (attrLayerId === id) setAttrLayerId(null)
  }

  const focusLayer = (layer) => {
    fitLayer(layer.geojson)
  }

  useEffect(() => {
    if (bufferSource && bufferSource !== '__pick__') {
      if (!layers.find((l) => l.id === bufferSource)) {
        setBufferSource('')
      }
    }
  }, [layers, bufferSource])

  const themeLayer = layers.find((l) => l.id === themeLayerId)
  const attrLayer = layers.find((l) => l.id === attrLayerId)

  return (
    <div className={`workspace ${attrLayerId ? 'with-table' : ''}`}>
      <header className="ws-header">
        <div className="ws-header-left">
          <button className="ws-home" onClick={onHome} title="Back to home">
            <Logo size={32} />
          </button>
        </div>

        <div className="ws-header-center">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`mode-btn ${tool === id ? 'active' : ''}`}
              onClick={() => setTool(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="ws-header-right">
          <div className="coords-display">
            {cursor.lat.toFixed(4)}°, {cursor.lon.toFixed(4)}°
          </div>
          <button
            className={`toggle-3d ${pitch3d ? 'on' : ''}`}
            onClick={() => setPitch3d((v) => !v)}
            title="Toggle 3D pitch"
          >
            <Box size={14} />
            {pitch3d ? '3D ON' : '2D'}
          </button>
          <button className="btn-ghost" onClick={onHome} style={{ padding: '7px 12px' }}>
            <Home size={14} />
          </button>
        </div>
      </header>

      <aside className="ws-sidebar">
        <div className="panel-section" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`tool-btn ${tool === id ? 'active' : ''}`}
              style={{ width: 'auto', flex: '1 1 40%' }}
              onClick={() => setTool(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {tool === 'search' && (
          <div className="panel-section">
            <h3>Location Search</h3>
            <form className="search-box" onSubmit={runSearch}>
              <div className="search-input-wrap">
                <input
                  className="field-input"
                  placeholder="City, address, landmark…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="search-btn" type="submit" disabled={searching}>
                  {searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                </button>
              </div>
            </form>
            {results.length > 0 && (
              <div className="search-results">
                {results.map((r) => (
                  <button
                    key={r.id}
                    className="search-result-item"
                    onClick={() => selectResult(r)}
                  >
                    <MapPin size={12} style={{ display: 'inline', marginRight: 6 }} />
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            <p className="hint">
              Powered by OpenStreetMap Nominatim. Select a result to fly the map
              and drop a marker layer.
            </p>
            <button className="sample-btn" onClick={loadSample}>
              Load sample world cities
            </button>
          </div>
        )}

        {tool === 'geocode' && (
          <div className="panel-section">
            <h3>Geocoding</h3>
            <label className="field-label">Forward geocode (address → coords)</label>
            <form onSubmit={runGeocode}>
              <div className="search-input-wrap">
                <input
                  className="field-input"
                  placeholder="Enter an address…"
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                />
                <button className="search-btn" type="submit" disabled={geocoding}>
                  {geocoding ? <Loader2 size={16} /> : <Navigation size={16} />}
                </button>
              </div>
            </form>
            {geoResults.length > 0 && (
              <div className="search-results">
                {geoResults.map((r) => (
                  <button
                    key={r.id}
                    className="search-result-item"
                    onClick={() => {
                      selectResult(r)
                      setReverseInfo({
                        label: r.label,
                        lon: r.lon,
                        lat: r.lat,
                      })
                    }}
                  >
                    <strong style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                      {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
                    </strong>
                    <br />
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label className="field-label">Reverse geocode (map click → address)</label>
              <button
                className="action-btn secondary"
                style={
                  reverseMode
                    ? {
                        background: 'linear-gradient(135deg, var(--accent), var(--blue))',
                        color: '#041016',
                        border: 'none',
                      }
                    : undefined
                }
                onClick={() => {
                  setReverseMode((v) => !v)
                  showToast(
                    !reverseMode
                      ? 'Click anywhere on the map to reverse geocode'
                      : 'Reverse mode off'
                  )
                }}
              >
                <MousePointerClick size={16} />
                {reverseMode ? 'Click map… (active)' : 'Enable reverse geocode'}
              </button>
            </div>

            {reverseInfo && (
              <div className="rev-card" style={{ marginTop: 12 }}>
                <div className="coords">
                  {reverseInfo.lat.toFixed(6)}, {reverseInfo.lon.toFixed(6)}
                </div>
                {reverseInfo.label}
              </div>
            )}
          </div>
        )}

        {tool === 'buffer' && (
          <div className="panel-section">
            <h3>Buffer Analysis</h3>
            <label className="field-label">Source layer</label>
            <select
              className="field-input"
              value={bufferSource}
              onChange={(e) => setBufferSource(e.target.value)}
            >
              <option value="">— select layer —</option>
              <option value="__pick__">Picked map point</option>
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <div className="buffer-row" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label">Distance</label>
                <input
                  className="field-input"
                  type="number"
                  min="0.001"
                  step="any"
                  value={bufferDistance}
                  onChange={(e) => setBufferDistance(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Unit</label>
                <select
                  className="field-input"
                  value={bufferUnit}
                  onChange={(e) => setBufferUnit(e.target.value)}
                >
                  <option value="km">Kilometers</option>
                  <option value="m">Meters</option>
                  <option value="mi">Miles</option>
                </select>
              </div>
            </div>

            <div className="buffer-actions">
              <button
                className="action-btn secondary"
                onClick={() => {
                  setPickMode(true)
                  setBufferSource('__pick__')
                  showToast('Click the map to pick a buffer center')
                }}
              >
                <Crosshair size={16} />
                Pick point on map
              </button>
              <button className="action-btn primary" onClick={runBuffer}>
                <Hexagon size={16} />
                Generate Buffer
              </button>
            </div>

            {pickedPoint && (
              <div className="rev-card" style={{ marginTop: 12 }}>
                <div className="coords">
                  Center: {pickedPoint.lat.toFixed(5)}, {pickedPoint.lon.toFixed(5)}
                </div>
              </div>
            )}
          </div>
        )}

        {tool === 'upload' && (
          <div className="panel-section">
            <h3>Import Layers</h3>
            <div
              className={`upload-zone ${dragOver ? 'dragover' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <Upload size={28} />
              <p>Drop zoning / GIS files here</p>
              <span>GeoJSON · JSON · SHP/ZIP · KML</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,.zip,.shp,.kml"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Upload US zoning maps or any layer — GeoHive auto-detects fields
              like <strong>ZONE</strong>, <strong>LANDUSE</strong>, builds a
              thematic map, legend, and attribute popups.
            </p>
            <button className="sample-btn" onClick={loadZoningSample}>
              Try sample US zoning map
            </button>
            <button className="sample-btn" onClick={loadSample}>
              Load sample cities
            </button>
          </div>
        )}

        {tool === 'theme' && (
          <div className="panel-section">
            <h3>Thematic Mapping</h3>
            {layers.length === 0 ? (
              <div className="empty-layers">
                Upload a layer first (e.g. zoning GeoJSON / SHP).
              </div>
            ) : (
              <>
                <label className="field-label">Layer</label>
                <select
                  className="field-input"
                  value={themeLayerId}
                  onChange={(e) => setThemeLayerId(e.target.value)}
                >
                  {layers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                {themeLayer && (
                  <>
                    <label className="field-label" style={{ marginTop: 12 }}>
                      Attribute field
                    </label>
                    <select
                      className="field-input"
                      value={themeLayer.themeField || ''}
                      onChange={(e) =>
                        applyTheme(themeLayer.id, e.target.value || null, themeLayer.ramp)
                      }
                    >
                      <option value="">— single color —</option>
                      {(themeLayer.fields || []).map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.type}, {f.uniqueCount} unique)
                        </option>
                      ))}
                    </select>

                    <label className="field-label" style={{ marginTop: 12 }}>
                      Color scheme
                    </label>
                    <select
                      className="field-input"
                      value={themeLayer.ramp || 'vivid'}
                      onChange={(e) =>
                        applyTheme(
                          themeLayer.id,
                          themeLayer.themeField,
                          e.target.value
                        )
                      }
                    >
                      {Object.keys(COLOR_SCHEMES).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div className="scheme-swatches" style={{ marginTop: 8 }}>
                      {(COLOR_SCHEMES[themeLayer.ramp || 'vivid'] || []).slice(0, 8).map((c) => (
                        <span
                          key={c}
                          title={c}
                          style={{
                            display: 'inline-block',
                            width: 18,
                            height: 12,
                            background: c,
                            borderRadius: 2,
                            marginRight: 3,
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                        />
                      ))}
                    </div>

                    <div className="theme-preview" style={{ marginTop: 14 }}>
                      <div className="legend-field" style={{ marginBottom: 8 }}>
                        {themeLayer.theme?.field ? (
                          <>
                            Styled by <strong>{themeLayer.theme.field}</strong>
                            <span className="legend-type-badge">{themeLayer.theme.type}</span>
                          </>
                        ) : (
                          'Single color style'
                        )}
                      </div>
                      <ul className="legend-items compact">
                        {(themeLayer.theme?.classes || []).slice(0, 12).map((c, i) => (
                          <li key={i}>
                            <span
                              className="legend-swatch"
                              style={{ background: c.color }}
                            />
                            <span className="legend-label">{c.label}</span>
                            {typeof c.count === 'number' && (
                              <span className="legend-item-count">{c.count}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {(themeLayer.theme?.classes?.length || 0) > 12 && (
                        <p className="hint">
                          +{themeLayer.theme.classes.length - 12} more in map legend
                        </p>
                      )}
                    </div>

                    <div className="buffer-actions" style={{ marginTop: 12 }}>
                      <button
                        className="action-btn secondary"
                        onClick={() => {
                          setAttrLayerId(themeLayer.id)
                          showToast('Attribute table open')
                        }}
                      >
                        <Table2 size={16} />
                        Open attribute table
                      </button>
                      <button
                        className="action-btn secondary"
                        onClick={() => setLegendCollapsed(false)}
                      >
                        <List size={16} />
                        Show map legend
                      </button>
                    </div>
                  </>
                )}
                <p className="hint" style={{ marginTop: 12 }}>
                  Zoning layers auto-pick fields like ZONE / LANDUSE. Click any
                  polygon on the map for an attribute popup.
                </p>
              </>
            )}
          </div>
        )}

        {tool === 'layers' && (
          <div className="panel-section" style={{ flex: 1 }}>
            <h3>Layer Manager ({layers.length})</h3>
            {layers.length === 0 ? (
              <div className="empty-layers">
                No layers yet. Upload data or load samples.
              </div>
            ) : (
              <div className="layer-list">
                {[...layers].reverse().map((layer) => (
                  <div key={layer.id} className="layer-item">
                    <div
                      className="layer-swatch"
                      style={{
                        background:
                          layer.theme?.classes?.[0]?.color || layer.color,
                      }}
                    />
                    <div className="layer-meta">
                      <strong title={layer.name}>{layer.name}</strong>
                      <span>
                        {featureCount(layer.geojson)} feat ·{' '}
                        {layer.theme?.field
                          ? `theme: ${layer.theme.field}`
                          : geometryTypes(layer.geojson).join(', ') || '—'}
                      </span>
                    </div>
                    <div className="layer-actions">
                      <button
                        className="icon-btn"
                        title="Attributes"
                        onClick={() => {
                          setAttrLayerId(layer.id)
                          setThemeLayerId(layer.id)
                        }}
                      >
                        <Table2 size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Zoom to layer"
                        onClick={() => focusLayer(layer)}
                      >
                        <Focus size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title={layer.visible ? 'Hide' : 'Show'}
                        onClick={() => toggleLayer(layer.id)}
                      >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Remove"
                        onClick={() => removeLayer(layer.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {layers.length > 0 && (
              <button
                className="action-btn danger"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setLayers([])
                  setAttrLayerId(null)
                  mapRef.current?.clearMarkers()
                  mapRef.current?.closePopup()
                  showToast('All layers cleared')
                }}
              >
                <Trash2 size={14} />
                Clear all layers
              </button>
            )}
          </div>
        )}

        {/* Selected feature mini attributes */}
        {selectedFeature?.properties && tool !== 'theme' && (
          <div className="panel-section">
            <h3>Selected Feature</h3>
            <div className="rev-card selected-attrs">
              {Object.entries(selectedFeature.properties)
                .filter(([k]) => !k.startsWith('__'))
                .slice(0, 12)
                .map(([k, v]) => (
                  <div key={k} className="attr-row">
                    <span>{k}</span>
                    <strong>{v === null || v === undefined ? '—' : String(v)}</strong>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tool !== 'layers' && layers.length > 0 && (
          <div className="panel-section" style={{ marginTop: 'auto' }}>
            <h3>Active Layers</h3>
            <div className="layer-list">
              {layers.slice(-3).map((layer) => (
                <div key={layer.id} className="layer-item">
                  <div
                    className="layer-swatch"
                    style={{
                      background: layer.theme?.classes?.[0]?.color || layer.color,
                    }}
                  />
                  <div className="layer-meta">
                    <strong>{layer.name}</strong>
                    <span>
                      {layer.theme?.field
                        ? `legend: ${layer.theme.field}`
                        : `${featureCount(layer.geojson)} features`}
                    </span>
                  </div>
                  <button className="icon-btn" onClick={() => toggleLayer(layer.id)}>
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="ws-map-area">
        <MapView
          ref={mapRef}
          layers={layers}
          pitch3d={pitch3d}
          popupsEnabled
          onMapReady={handleMapReady}
          onMapClick={handleMapClick}
        />
        <div className="map-overlay-tools">
          {(pickMode || reverseMode) && (
            <div className="overlay-chip active">
              <Crosshair size={14} />
              {pickMode ? 'Click to pick buffer center' : 'Click to reverse geocode'}
            </div>
          )}
          <div className="overlay-chip">
            <Box size={14} />
            {pitch3d ? '3D view · drag to orbit' : '2D top-down'}
          </div>
          <div className="overlay-chip">
            <MousePointerClick size={14} />
            Click features for attribute popups
          </div>
        </div>

        <Legend
          layers={layers}
          collapsed={legendCollapsed}
          onToggle={() => setLegendCollapsed((v) => !v)}
        />
      </main>

      {attrLayerId && attrLayer && (
        <AttributeTable
          layer={attrLayer}
          onClose={() => setAttrLayerId(null)}
          onRowFocus={(idx) => mapRef.current?.highlightFeature(attrLayer.id, idx)}
        />
      )}

      {toast && (
        <div className="status-toast">
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          {toast}
        </div>
      )}
    </div>
  )
}
