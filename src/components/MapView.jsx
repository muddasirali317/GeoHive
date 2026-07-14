import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import maplibregl from 'maplibre-gl'
import { buildPopupHTML } from '../utils/thematic'

const STYLE = {
  version: 8,
  name: 'GeoHive Dark',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#05080f' },
    },
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: { 'raster-opacity': 0.92 },
    },
  ],
}

function injectPopupStyles() {
  if (document.getElementById('gynix-popup-styles')) return
  const style = document.createElement('style')
  style.id = 'gynix-popup-styles'
  style.textContent = `
    .gynix-popup { min-width: 180px; max-width: 280px; font-family: Outfit, system-ui, sans-serif; }
    .gynix-pop-title { font-weight: 700; font-size: 13px; color: #e8eef7; margin-bottom: 2px; }
    .gynix-pop-layer { font-size: 10px; color: #00e5a8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .gynix-pop-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .gynix-pop-table tr { border-top: 1px solid rgba(0,229,168,0.12); }
    .gynix-pop-key { color: #8b9bb4; padding: 4px 8px 4px 0; vertical-align: top; white-space: nowrap; font-weight: 500; }
    .gynix-pop-val { color: #e8eef7; padding: 4px 0; word-break: break-word; }
  `
  document.head.appendChild(style)
}

const MapView = forwardRef(function MapView(
  { onMapReady, onMapClick, onFeatureClick, layers, pitch3d, popupsEnabled = true },
  ref
) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const popupRef = useRef(null)
  const readyRef = useRef(false)
  const layersRef = useRef(layers)
  const handlersRef = useRef({ onMapClick, onFeatureClick, popupsEnabled })

  layersRef.current = layers
  handlersRef.current = { onMapClick, onFeatureClick, popupsEnabled }

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    flyTo: (lon, lat, zoom = 12) => {
      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom,
        pitch: pitch3d ? 55 : 0,
        essential: true,
        duration: 1800,
      })
    },
    fitBounds: (bbox) => {
      if (!mapRef.current || !bbox) return
      mapRef.current.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 60, duration: 1200, pitch: pitch3d ? 45 : 0 }
      )
    },
    addMarker: (lon, lat, color = '#00e5a8') => {
      if (!mapRef.current) return null
      const el = document.createElement('div')
      el.className = 'gynix-marker'
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: ${color}; border: 3px solid #fff;
        box-shadow: 0 0 16px ${color}88, 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      `
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(mapRef.current)
      markersRef.current.push(marker)
      return marker
    },
    clearMarkers: () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    },
    closePopup: () => {
      popupRef.current?.remove()
      popupRef.current = null
    },
    setPitch: (pitch) => {
      mapRef.current?.easeTo({ pitch, duration: 800 })
    },
    highlightFeature: (layerId, featureIndex) => {
      const map = mapRef.current
      const layer = layersRef.current.find((l) => l.id === layerId)
      if (!map || !layer?.geojson?.features?.[featureIndex]) return
      const f = layer.geojson.features[featureIndex]
      const html = buildPopupHTML(f, layer.name)
      injectPopupStyles()
      popupRef.current?.remove()
      // Approximate center from first coordinate
      let center = null
      try {
        const g = f.geometry
        if (g.type === 'Point') center = g.coordinates
        else if (g.type === 'Polygon') center = g.coordinates[0][0]
        else if (g.type === 'MultiPolygon') center = g.coordinates[0][0][0]
        else if (g.type === 'LineString') center = g.coordinates[0]
        else if (g.type === 'MultiLineString') center = g.coordinates[0][0]
      } catch {
        /* ignore */
      }
      if (!center) return
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        maxWidth: '300px',
        className: 'gynix-map-popup',
      })
        .setLngLat(center)
        .setHTML(html)
        .addTo(map)
      map.flyTo({ center, zoom: Math.max(map.getZoom(), 12), duration: 900 })
    },
  }))

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    injectPopupStyles()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [10, 25],
      zoom: 1.8,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      antialias: true,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    )

    map.on('load', () => {
      readyRef.current = true
      onMapReady?.(map)
    })

    map.on('click', (e) => {
      const { onMapClick: click, onFeatureClick: featClick, popupsEnabled: pops } =
        handlersRef.current

      // Query top-most gynix feature
      const feats = map.queryRenderedFeatures(e.point, {
        layers: map
          .getStyle()
          .layers.filter(
            (l) =>
              l.id.startsWith('gynix_') &&
              (l.id.endsWith('_fill') || l.id.endsWith('_line') || l.id.endsWith('_circle'))
          )
          .map((l) => l.id),
      })

      if (feats.length > 0) {
        const f = feats[0]
        // Resolve layer id from map layer id: gynix_{id}_fill
        const m = f.layer.id.match(/^gynix_(.+)_(fill|line|circle)$/)
        const layerId = m ? m[1] : null
        const appLayer = layersRef.current.find((l) => l.id === layerId)

        if (pops && appLayer) {
          const html = buildPopupHTML(f, appLayer.name)
          popupRef.current?.remove()
          popupRef.current = new maplibregl.Popup({
            closeButton: true,
            maxWidth: '300px',
            className: 'gynix-map-popup',
          })
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map)
        }
        featClick?.(f, appLayer, e)
      } else {
        popupRef.current?.remove()
        popupRef.current = null
      }

      click?.(e.lngLat.lng, e.lngLat.lat, e, feats)
    })

    // Pointer cursor over features
    map.on('mousemove', (e) => {
      const layerIds = map
        .getStyle()
        .layers.filter(
          (l) =>
            l.id.startsWith('gynix_') &&
            (l.id.endsWith('_fill') || l.id.endsWith('_circle') || l.id.endsWith('_line'))
        )
        .map((l) => l.id)
      if (!layerIds.length) {
        map.getCanvas().style.cursor = ''
        return
      }
      const hits = map.queryRenderedFeatures(e.point, { layers: layerIds })
      map.getCanvas().style.cursor = hits.length ? 'pointer' : ''
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync layers to map with thematic colors
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    const apply = () => {
      const existing = map
        .getStyle()
        .layers.filter((l) => l.id.startsWith('gynix_'))
        .map((l) => l.id)

      existing.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      Object.keys(map.getStyle().sources).forEach((sid) => {
        if (sid.startsWith('gynix_') && map.getSource(sid)) {
          map.removeSource(sid)
        }
      })

      layers.forEach((layer) => {
        if (!layer.visible || !layer.geojson) return
        const sid = `gynix_${layer.id}`
        const fallback = layer.color || '#00e5a8'
        const theme = layer.theme
        // Prefer colors baked on each feature (__theme_color) — reliable for names/zones
        const colorExpr = [
          'coalesce',
          ['get', '__theme_color'],
          theme?.defaultColor || fallback,
        ]
        const opacity = layer.opacity ?? (theme?.mode === 'thematic' ? 0.65 : 0.35)
        const data = theme?.styledGeojson || layer.geojson

        try {
          map.addSource(sid, {
            type: 'geojson',
            data,
          })
        } catch (err) {
          console.error('Failed to add source', sid, err)
          return
        }

        try {
          map.addLayer({
            id: `${sid}_fill`,
            type: 'fill',
            source: sid,
            filter: ['==', '$type', 'Polygon'],
            paint: {
              'fill-color': colorExpr,
              'fill-opacity': opacity,
              'fill-outline-color': colorExpr,
            },
          })

          map.addLayer({
            id: `${sid}_line`,
            type: 'line',
            source: sid,
            filter: ['in', '$type', 'LineString', 'Polygon'],
            paint: {
              'line-color': colorExpr,
              'line-width': layer.id.includes('buffer')
                ? 2.5
                : theme?.mode === 'thematic'
                  ? 1.4
                  : 2,
              'line-opacity': 0.95,
            },
          })

          map.addLayer({
            id: `${sid}_circle`,
            type: 'circle',
            source: sid,
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-radius': 8,
              'circle-color': colorExpr,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.95,
            },
          })
        } catch (err) {
          console.error('Failed to add themed layers', sid, err)
        }
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({ pitch: pitch3d ? 55 : 0, duration: 900 })
  }, [pitch3d])

  return <div ref={containerRef} className="map-container" />
})

export default MapView
