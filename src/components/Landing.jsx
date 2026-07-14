import { useEffect, useRef } from 'react'
import {
  Map,
  Layers,
  Search,
  Upload,
  Hexagon,
  Navigation,
  Zap,
  ArrowRight,
  Box,
  Palette,
  Table2,
} from 'lucide-react'
import Globe3D from './Globe3D'
import Logo from './Logo'
import './Landing.css'

const FEATURES = [
  {
    icon: Box,
    title: '3D Spatial View',
    desc: 'Explore terrain and layers with interactive 3D pitch, bearing, and fly-to navigation.',
  },
  {
    icon: Hexagon,
    title: 'Buffer Analysis',
    desc: 'Generate proximity buffers around points, lines, and polygons with custom distances.',
  },
  {
    icon: Search,
    title: 'Location Search',
    desc: 'Find places worldwide with instant map fly-to and marker placement.',
  },
  {
    icon: Navigation,
    title: 'Geocoding',
    desc: 'Convert addresses to coordinates and reverse-geocode any map click.',
  },
  {
    icon: Upload,
    title: 'Multi-format Upload',
    desc: 'Import GeoJSON, Shapefile (SHP/ZIP), and KML layers into your workspace.',
  },
  {
    icon: Palette,
    title: 'Thematic Mapping',
    desc: 'Auto-style zoning and attribute fields with legends, ramps, and categories.',
  },
  {
    icon: Table2,
    title: 'Attributes & Popups',
    desc: 'Inspect tables, filter records, and click features for full attribute popups.',
  },
  {
    icon: Layers,
    title: 'Layer Management',
    desc: 'Toggle visibility, style layers, and organize your spatial workspace.',
  },
]

export default function Landing({ onEnter }) {
  const heroRef = useRef(null)

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      el.style.setProperty('--mx', `${x * 20}px`)
      el.style.setProperty('--my', `${y * 12}px`)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="grid-overlay" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
      </div>

      <nav className="landing-nav">
        <div className="brand">
          <Logo size={38} />
        </div>
        <div className="nav-actions">
          <a href="#features" className="nav-link">
            Features
          </a>
          <button className="btn-primary" onClick={onEnter}>
            Launch Workspace
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      <section className="hero" ref={heroRef}>
        <div className="hero-copy">
          <div className="hero-badge">
            <Zap size={12} />
            Spatial Intelligence Platform
          </div>
          <h1>
            Map the world in
            <span className="gradient-text"> three dimensions</span>
          </h1>
          <p className="hero-sub">
            GeoHive brings professional geospatial tools to your browser —
            buffer analysis, geocoding, thematic zoning maps, legends, and
            multi-format layer import on a living 3D map canvas.
          </p>
          <div className="hero-cta">
            <button className="btn-primary large" onClick={onEnter}>
              <Map size={18} />
              Open Workspace
            </button>
            <button
              className="btn-ghost"
              onClick={() =>
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Explore Features
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <strong>3D</strong>
              <span>Interactive Map</span>
            </div>
            <div>
              <strong>SHP+</strong>
              <span>File Formats</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>Global Coverage</span>
            </div>
          </div>
        </div>
        <div className="hero-globe">
          <Globe3D />
          <div className="globe-caption">
            <span className="pulse-dot" />
            Live spatial engine
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="features-header">
          <span className="badge">Capabilities</span>
          <h2>Everything you need for spatial analysis</h2>
          <p>
            From field survey imports to proximity buffers, zoning themes, and
            address geocoding — GeoHive keeps the workflow in one cinematic workspace.
          </p>
        </div>
        <div className="features-grid features-grid-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="feature-card">
              <div className="feature-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <div className="features-cta">
          <button className="btn-primary large" onClick={onEnter}>
            Start Mapping
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <Logo size={28} />
        <p>© {new Date().getFullYear()} GeoHive · Spatial Intelligence for everyone</p>
      </footer>
    </div>
  )
}
