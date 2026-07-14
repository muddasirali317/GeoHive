import * as turf from '@turf/turf'
import shp from 'shpjs'

const LAYER_COLORS = [
  '#00e5a8',
  '#3b82f6',
  '#a78bfa',
  '#f59e0b',
  '#ef4444',
  '#22d3ee',
  '#f472b6',
  '#84cc16',
]

export function nextColor(index) {
  return LAYER_COLORS[index % LAYER_COLORS.length]
}

export function makeLayerId(prefix = 'layer') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function ensureFeatureCollection(geojson) {
  if (!geojson) return null
  if (geojson.type === 'FeatureCollection') return geojson
  if (geojson.type === 'Feature') {
    return { type: 'FeatureCollection', features: [geojson] }
  }
  if (geojson.type && geojson.coordinates) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: geojson }],
    }
  }
  return null
}

export function createBuffer(geojson, distanceKm, steps = 64) {
  const fc = ensureFeatureCollection(geojson)
  if (!fc || !fc.features.length) throw new Error('No geometry to buffer')
  const buffered = turf.buffer(fc, distanceKm, { units: 'kilometers', steps })
  return ensureFeatureCollection(buffered)
}

export async function parseUploadedFile(file) {
  const name = file.name.toLowerCase()

  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    const text = await file.text()
    const data = JSON.parse(text)
    return {
      name: file.name.replace(/\.(geojson|json)$/i, ''),
      geojson: ensureFeatureCollection(data),
    }
  }

  if (name.endsWith('.zip') || name.endsWith('.shp')) {
    const buffer = await file.arrayBuffer()
    const result = await shp(buffer)
    // shpjs may return a FeatureCollection or an object of named layers
    if (result.type === 'FeatureCollection') {
      return {
        name: file.name.replace(/\.(zip|shp)$/i, ''),
        geojson: result,
      }
    }
    // Multi-layer shapefile zip
    const layers = []
    for (const [key, value] of Object.entries(result)) {
      const fc = ensureFeatureCollection(value)
      if (fc) layers.push({ name: key, geojson: fc })
    }
    if (layers.length === 1) return layers[0]
    if (layers.length > 1) {
      return {
        name: file.name.replace(/\.zip$/i, ''),
        geojson: {
          type: 'FeatureCollection',
          features: layers.flatMap((l) =>
            l.geojson.features.map((f) => ({
              ...f,
              properties: { ...f.properties, _source_layer: l.name },
            }))
          ),
        },
        multi: layers,
      }
    }
    throw new Error('No features found in shapefile')
  }

  if (name.endsWith('.kml')) {
    const text = await file.text()
    const geojson = kmlToGeoJSON(text)
    return {
      name: file.name.replace(/\.kml$/i, ''),
      geojson,
    }
  }

  throw new Error('Unsupported format. Use GeoJSON, SHP/ZIP, or KML.')
}

/** Minimal KML → GeoJSON for Point, LineString, Polygon */
function kmlToGeoJSON(kmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlText, 'text/xml')
  const features = []

  const placemarks = doc.getElementsByTagName('Placemark')
  for (const pm of placemarks) {
    const nameEl = pm.getElementsByTagName('name')[0]
    const name = nameEl?.textContent || ''
    const props = { name }

    const point = pm.getElementsByTagName('Point')[0]
    if (point) {
      const coords = parseKmlCoords(
        point.getElementsByTagName('coordinates')[0]?.textContent
      )
      if (coords[0]) {
        features.push({
          type: 'Feature',
          properties: props,
          geometry: { type: 'Point', coordinates: coords[0] },
        })
      }
      continue
    }

    const line = pm.getElementsByTagName('LineString')[0]
    if (line) {
      const coords = parseKmlCoords(
        line.getElementsByTagName('coordinates')[0]?.textContent
      )
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'LineString', coordinates: coords },
      })
      continue
    }

    const poly = pm.getElementsByTagName('Polygon')[0]
    if (poly) {
      const outer = poly.getElementsByTagName('outerBoundaryIs')[0]
      const coords = parseKmlCoords(
        outer?.getElementsByTagName('coordinates')[0]?.textContent
      )
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'Polygon', coordinates: [coords] },
      })
    }
  }

  return { type: 'FeatureCollection', features }
}

function parseKmlCoords(text) {
  if (!text) return []
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [lon, lat, alt] = pair.split(',').map(Number)
      return alt !== undefined && !Number.isNaN(alt) ? [lon, lat, alt] : [lon, lat]
    })
}

export async function geocodeForward(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&limit=6&addressdetails=1`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Geocoding request failed')
  const data = await res.json()
  return data.map((r) => ({
    id: r.place_id,
    label: r.display_name,
    lon: parseFloat(r.lon),
    lat: parseFloat(r.lat),
    type: r.type,
    bbox: r.boundingbox
      ? [
          parseFloat(r.boundingbox[2]),
          parseFloat(r.boundingbox[0]),
          parseFloat(r.boundingbox[3]),
          parseFloat(r.boundingbox[1]),
        ]
      : null,
  }))
}

export async function geocodeReverse(lon, lat) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lon=${lon}&lat=${lat}&addressdetails=1`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Reverse geocoding failed')
  const r = await res.json()
  return {
    label: r.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    lon,
    lat,
    address: r.address || {},
  }
}

export function getBounds(geojson) {
  try {
    const fc = ensureFeatureCollection(geojson)
    if (!fc?.features?.length) return null
    const b = turf.bbox(fc)
    if (b.some((n) => !Number.isFinite(n))) return null
    return b
  } catch {
    return null
  }
}

export function featureCount(geojson) {
  const fc = ensureFeatureCollection(geojson)
  return fc?.features?.length || 0
}

export function geometryTypes(geojson) {
  const fc = ensureFeatureCollection(geojson)
  if (!fc) return []
  const types = new Set()
  fc.features.forEach((f) => {
    if (f.geometry?.type) types.add(f.geometry.type)
  })
  return [...types]
}
