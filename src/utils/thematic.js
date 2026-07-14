import { ensureFeatureCollection } from './geo'

/** Distinct categorical palette (good for zoning / names) */
export const CATEGORICAL_PALETTE = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
  '#00e5a8', '#3b82f6', '#a78bfa', '#f59e0b', '#ef4444',
  '#22d3ee', '#f472b6', '#84cc16', '#fb923c', '#c084fc',
  '#14b8a6', '#f43f5e', '#8b5cf6', '#0ea5e9', '#65a30d',
]

/** Named color schemes — used for both categorical & numeric */
export const COLOR_SCHEMES = {
  vivid: CATEGORICAL_PALETTE,
  viridis: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
  heat: ['#431407', '#7c2d12', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'],
  blue: ['#0c1445', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  teal: ['#042f2e', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'],
  purple: ['#2e1065', '#4c1d95', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
  rainbow: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'],
}

/** @deprecated use COLOR_SCHEMES */
export const NUMERIC_RAMPS = COLOR_SCHEMES

const ZONING_FIELD_HINTS = [
  'zone', 'zoning', 'zonecode', 'zone_code', 'zoneclass', 'zone_class',
  'landuse', 'land_use', 'lu', 'lucode', 'lu_code', 'landuse_code',
  'class', 'category', 'type', 'code', 'descriptio', 'description',
  'name', 'label', 'district', 'overlay', 'zoning_des', 'zoning_typ',
  'zoningtype', 'zonetype', 'use', 'usage', 'parcel', 'fld_zone',
]

const THEME_KEYS = ['__theme_color', '__theme_label', '__theme_class']

/** Strip previous theme paint props so rebuilds stay clean */
export function stripThemeProps(geojson) {
  const fc = ensureFeatureCollection(geojson)
  if (!fc) return fc
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const props = { ...(f.properties || {}) }
      THEME_KEYS.forEach((k) => delete props[k])
      return { ...f, properties: props }
    }),
  }
}

/**
 * Collect property keys + value samples from a FeatureCollection.
 */
export function analyzeAttributes(geojson) {
  const fc = ensureFeatureCollection(geojson)
  if (!fc?.features?.length) {
    return { fields: [], fieldMeta: {}, featureCount: 0 }
  }

  const fieldMeta = {}
  const keys = new Set()

  for (const f of fc.features) {
    const props = f.properties || {}
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith('__')) continue
      keys.add(k)
      if (!fieldMeta[k]) {
        fieldMeta[k] = {
          name: k,
          values: new Set(),
          numericCount: 0,
          nullCount: 0,
          total: 0,
        }
      }
      const meta = fieldMeta[k]
      meta.total++
      if (v === null || v === undefined || v === '') {
        meta.nullCount++
        continue
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        meta.numericCount++
        meta.values.add(v)
        continue
      }
      const s = String(v).trim()
      if (/^-?\d+(\.\d+)?$/.test(s)) {
        meta.numericCount++
        meta.values.add(Number(s))
        continue
      }
      meta.values.add(s)
    }
  }

  const fields = [...keys].map((name) => {
    const m = fieldMeta[name]
    const unique = [...m.values]
    const uniqueCount = unique.length
    const nonNull = Math.max(1, m.total - m.nullCount)
    const isMostlyNumeric = m.numericCount / nonNull > 0.85
    const nums = isMostlyNumeric
      ? unique.map(Number).filter((n) => Number.isFinite(n))
      : []
    // Names / labels are almost always categorical even if few unique values
    const lower = name.toLowerCase()
    const forceCat = /name|label|zone|class|type|code|desc|category|land/.test(lower)
    const type =
      !forceCat && isMostlyNumeric && uniqueCount > 6 ? 'numeric' : 'categorical'

    return {
      name,
      type,
      uniqueCount,
      uniqueValues: type === 'categorical' ? unique.slice(0, 300).map(String) : [],
      min: nums.length ? Math.min(...nums) : null,
      max: nums.length ? Math.max(...nums) : null,
      nullCount: m.nullCount,
      total: m.total,
    }
  })

  fields.sort((a, b) => {
    const score = (f) => {
      const n = f.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      let s = 0
      if (ZONING_FIELD_HINTS.some((h) => n.includes(h.replace(/_/g, '')))) s += 50
      if (f.type === 'categorical' && f.uniqueCount > 1 && f.uniqueCount <= 40) s += 20
      if (f.type === 'numeric') s += 10
      if (f.uniqueCount === 1) s -= 15
      return s
    }
    return score(b) - score(a)
  })

  return { fields, fieldMeta, featureCount: fc.features.length }
}

export function suggestThemeField(fields) {
  if (!fields?.length) return null
  for (const f of fields) {
    const n = f.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (
      ZONING_FIELD_HINTS.some((h) => n.includes(h.replace(/_/g, ''))) &&
      f.uniqueCount > 1
    ) {
      return f.name
    }
  }
  const cat = fields.find((f) => f.type === 'categorical' && f.uniqueCount > 1)
  if (cat) return cat.name
  const num = fields.find((f) => f.type === 'numeric' && f.min !== f.max)
  if (num) return num.name
  return fields[0]?.name || null
}

function getPalette(rampName) {
  return COLOR_SCHEMES[rampName] || COLOR_SCHEMES.vivid
}

function colorAt(palette, i) {
  if (!palette.length) return '#00e5a8'
  return palette[i % palette.length]
}

/** Stable string key for any attribute value */
function valueKey(raw) {
  if (raw === null || raw === undefined || raw === '') return '(empty)'
  return String(raw)
}

/**
 * Bake __theme_color onto every feature — most reliable way to color MapLibre layers.
 */
function bakeFeatureColors(fc, getColorForFeature) {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f, idx) => {
      const { color, label, classIndex } = getColorForFeature(f, idx)
      return {
        ...f,
        properties: {
          ...(f.properties || {}),
          __theme_color: color,
          __theme_label: label,
          __theme_class: classIndex,
        },
      }
    }),
  }
}

/**
 * Build thematic style + styled GeoJSON with per-feature colors.
 */
export function buildThematicStyle(geojson, field, options = {}) {
  const clean = stripThemeProps(geojson)
  const fc = ensureFeatureCollection(clean)
  const { fields } = analyzeAttributes(fc)
  const meta = fields.find((f) => f.name === field)
  const defaultColor = options.defaultColor || '#6b7280'
  const rampName = options.ramp || 'vivid'
  const palette = getPalette(rampName)

  // Simple single-color style
  if (!field || !meta || !fc?.features?.length) {
    const c = options.defaultColor || '#00e5a8'
    const styled = bakeFeatureColors(fc || { type: 'FeatureCollection', features: [] }, () => ({
      color: c,
      label: 'All features',
      classIndex: 0,
    }))
    return {
      mode: 'single',
      field: null,
      type: 'single',
      classes: [{ label: 'All features', color: c, value: null, count: styled.features.length }],
      // Always use property-based color — never fragile match expressions
      fillColorExpr: ['coalesce', ['get', '__theme_color'], c],
      lineColorExpr: ['coalesce', ['get', '__theme_color'], c],
      circleColorExpr: ['coalesce', ['get', '__theme_color'], c],
      defaultColor: c,
      styledGeojson: styled,
      ramp: rampName,
    }
  }

  if (meta.type === 'numeric' && meta.uniqueCount > 6 && meta.min !== meta.max) {
    return buildNumericTheme(fc, field, meta, palette, defaultColor, options.classes || 7, rampName)
  }

  return buildCategoricalTheme(fc, field, meta, palette, defaultColor, options, rampName)
}

function buildCategoricalTheme(fc, field, meta, palette, defaultColor, options, rampName) {
  const counts = new Map()
  for (const f of fc.features) {
    const key = valueKey(f.properties?.[field])
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  let entries = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))
  )

  const maxCats = options.maxCategories || 60
  let otherCount = 0
  const otherKeys = new Set()
  if (entries.length > maxCats) {
    const head = entries.slice(0, maxCats - 1)
    const tail = entries.slice(maxCats - 1)
    otherCount = tail.reduce((s, [, c]) => s + c, 0)
    tail.forEach(([k]) => otherKeys.add(k))
    entries = head
  }

  const colorByValue = new Map()
  const classes = entries.map(([value, count], i) => {
    const color = colorAt(palette, i)
    colorByValue.set(value, color)
    return { value, label: String(value), color, count }
  })

  if (otherCount > 0) {
    classes.push({
      value: '__other__',
      label: 'Other',
      color: defaultColor,
      count: otherCount,
    })
  }

  const styled = bakeFeatureColors(fc, (f) => {
    const key = valueKey(f.properties?.[field])
    if (otherKeys.has(key)) {
      return { color: defaultColor, label: 'Other', classIndex: -1 }
    }
    const color = colorByValue.get(key) || defaultColor
    const classIndex = classes.findIndex((c) => c.value === key)
    return { color, label: key, classIndex: classIndex >= 0 ? classIndex : -1 }
  })

  return {
    mode: 'thematic',
    field,
    type: 'categorical',
    classes,
    fillColorExpr: ['coalesce', ['get', '__theme_color'], defaultColor],
    lineColorExpr: ['coalesce', ['get', '__theme_color'], defaultColor],
    circleColorExpr: ['coalesce', ['get', '__theme_color'], defaultColor],
    defaultColor,
    styledGeojson: styled,
    ramp: rampName,
  }
}

function buildNumericTheme(fc, field, meta, palette, defaultColor, classCount, rampName) {
  const values = []
  for (const f of fc.features) {
    const v = f.properties?.[field]
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n)) values.push(n)
  }

  if (!values.length) {
    return buildCategoricalTheme(fc, field, meta, palette, defaultColor, {}, rampName)
  }

  values.sort((a, b) => a - b)
  const min = values[0]
  const max = values[values.length - 1]
  const n = Math.max(3, Math.min(classCount, palette.length, 8))

  if (min === max) {
    const c = colorAt(palette, Math.floor(palette.length / 2))
    const styled = bakeFeatureColors(fc, () => ({
      color: c,
      label: String(min),
      classIndex: 0,
    }))
    return {
      mode: 'thematic',
      field,
      type: 'numeric',
      classes: [{ label: String(min), color: c, min, max, count: values.length }],
      fillColorExpr: ['coalesce', ['get', '__theme_color'], c],
      lineColorExpr: ['coalesce', ['get', '__theme_color'], c],
      circleColorExpr: ['coalesce', ['get', '__theme_color'], c],
      defaultColor,
      styledGeojson: styled,
      ramp: rampName,
      min,
      max,
    }
  }

  // Equal-interval breaks (more predictable than quantiles for display)
  const classes = []
  for (let i = 0; i < n; i++) {
    const lo = min + ((max - min) * i) / n
    const hi = min + ((max - min) * (i + 1)) / n
    const color = colorAt(
      palette,
      Math.round((i / Math.max(1, n - 1)) * (palette.length - 1))
    )
    classes.push({
      label: `${formatNum(lo)} – ${formatNum(hi)}`,
      color,
      min: lo,
      max: hi,
      count: 0,
    })
  }

  const styled = bakeFeatureColors(fc, (f) => {
    const v = f.properties?.[field]
    const num = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(num)) {
      return { color: defaultColor, label: '(empty)', classIndex: -1 }
    }
    let idx = Math.min(n - 1, Math.floor(((num - min) / (max - min)) * n))
    if (num >= max) idx = n - 1
    if (idx < 0) idx = 0
    classes[idx].count = (classes[idx].count || 0) + 1
    return {
      color: classes[idx].color,
      label: classes[idx].label,
      classIndex: idx,
    }
  })

  return {
    mode: 'thematic',
    field,
    type: 'numeric',
    classes,
    fillColorExpr: ['coalesce', ['get', '__theme_color'], defaultColor],
    lineColorExpr: ['coalesce', ['get', '__theme_color'], defaultColor],
    circleColorExpr: ['coalesce', ['get', '__theme_color'], defaultColor],
    defaultColor,
    styledGeojson: styled,
    ramp: rampName,
    min,
    max,
  }
}

function formatNum(n) {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return Number(n.toPrecision(3)).toString()
}

export function autoThemeLayer(geojson, options = {}) {
  const analysis = analyzeAttributes(geojson)
  const field = suggestThemeField(analysis.fields)
  const theme = buildThematicStyle(geojson, field, {
    ...options,
    ramp: options.ramp || 'vivid',
  })
  return {
    analysis,
    theme,
    suggestedField: field,
  }
}

export function getAttributeRows(geojson, limit = 500) {
  const fc = ensureFeatureCollection(geojson)
  if (!fc?.features?.length) return { columns: [], rows: [], total: 0 }

  const colSet = new Set()
  fc.features.forEach((f) => {
    Object.keys(f.properties || {}).forEach((k) => {
      if (!k.startsWith('__')) colSet.add(k)
    })
  })
  const columns = [...colSet]
  const rows = fc.features.slice(0, limit).map((f, i) => ({
    __id: i,
    __geom: f.geometry?.type || '',
    ...(f.properties || {}),
  }))
  return { columns, rows, total: fc.features.length }
}

export function buildPopupHTML(feature, layerName) {
  const props = feature.properties || {}
  const entries = Object.entries(props).filter(([k]) => !k.startsWith('__'))
  const title =
    props.name ||
    props.NAME ||
    props.Name ||
    props.zone ||
    props.ZONE ||
    props.zoning ||
    props.ZONING ||
    props.class ||
    props.CLASS ||
    props.type ||
    props.TYPE ||
    props.__theme_label ||
    layerName ||
    'Feature'

  let rows = ''
  if (!entries.length) {
    rows = `<tr><td colspan="2" style="color:#8b9bb4">No attributes</td></tr>`
  } else {
    for (const [k, v] of entries) {
      const val =
        v === null || v === undefined
          ? '—'
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v)
      rows += `<tr>
        <td class="gynix-pop-key">${escapeHtml(k)}</td>
        <td class="gynix-pop-val">${escapeHtml(val)}</td>
      </tr>`
    }
  }

  const swatch = props.__theme_color
    ? `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escapeHtml(props.__theme_color)};margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.3)"></span>`
    : ''

  return `
    <div class="gynix-popup">
      <div class="gynix-pop-title">${swatch}${escapeHtml(String(title))}</div>
      <div class="gynix-pop-layer">${escapeHtml(layerName || '')}</div>
      <table class="gynix-pop-table"><tbody>${rows}</tbody></table>
    </div>
  `
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sample US-style zoning polygons for demo */
export function sampleZoningGeoJSON() {
  const zones = [
    { code: 'R-1', name: 'Single Family Residential' },
    { code: 'R-2', name: 'Multi Family Residential' },
    { code: 'C-1', name: 'Neighborhood Commercial' },
    { code: 'C-2', name: 'General Commercial' },
    { code: 'I-1', name: 'Light Industrial' },
    { code: 'P', name: 'Public / Parks' },
    { code: 'MU', name: 'Mixed Use' },
    { code: 'AG', name: 'Agricultural' },
  ]

  const originLon = -97.75
  const originLat = 30.27
  const step = 0.018
  const features = []

  zones.forEach((z, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x0 = originLon + col * step
    const y0 = originLat + row * step
    const x1 = x0 + step * 0.92
    const y1 = y0 + step * 0.92
    features.push({
      type: 'Feature',
      properties: {
        ZONE: z.code,
        ZONE_NAME: z.name,
        name: z.name,
        LANDUSE: z.name.split(' ').slice(-1)[0],
        ACRES: Math.round(40 + ((i * 37) % 200)),
        JURISDICT: 'Demo City',
        ORD_YEAR: 2019 + (i % 5),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
            [x0, y0],
          ],
        ],
      },
    })
  })

  return { type: 'FeatureCollection', features }
}
