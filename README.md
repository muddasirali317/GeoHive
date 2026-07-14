# GeoHive

**Spatial Intelligence Platform** — a 3D animated GIS web application.

## Features

- **3D animated landing page** with interactive Three.js globe
- **3D map workspace** (MapLibre GL) with pitch / orbit controls
- **Location search** — find places worldwide and fly to them
- **Geocoding** — forward (address → coords) and reverse (click → address)
- **Buffer analysis** — proximity buffers around layers or a picked point
- **File upload** — GeoJSON, Shapefile (ZIP), KML
- **Thematic mapping** — auto-style zoning and attribute fields with legends
- **Attribute table & popups** — inspect and filter feature attributes
- **Layer manager** — show/hide, zoom to, remove layers

## Quick start

```bash
cd gis-gynix
npm install
npm run dev
```

Open the URL printed in the terminal (usually http://localhost:5173).

## Brand

- Wordmark: **GeoHive**
- Logo: hexagonal hive mark with spatial node (`public/logo.svg`, `public/favicon.svg`)

## Tech stack

- React + Vite
- MapLibre GL (map canvas)
- Three.js / React Three Fiber (landing globe)
- Turf.js (buffers & spatial helpers)
- shpjs (Shapefile parsing)
- OpenStreetMap Nominatim (geocoding)
- CARTO dark basemap tiles
