import { useState } from 'react'
import Landing from './components/Landing'
import Workspace from './components/Workspace'
import './App.css'

export default function App() {
  const [view, setView] = useState('landing')

  if (view === 'landing') {
    return <Landing onEnter={() => setView('workspace')} />
  }

  return <Workspace onHome={() => setView('landing')} />
}
