import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Sphere } from '@react-three/drei'
import * as THREE from 'three'

function Earth() {
  const meshRef = useRef()
  const ringsRef = useRef()
  const pointsRef = useRef()

  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i < 180; i++) {
      const lat = (Math.random() - 0.5) * Math.PI
      const lon = Math.random() * Math.PI * 2
      const r = 1.02
      pts.push(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon)
      )
    }
    return new Float32Array(pts)
  }, [])

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.12
    if (ringsRef.current) ringsRef.current.rotation.z += delta * 0.08
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.12
  })

  return (
    <group>
      {/* Atmosphere glow */}
      <Sphere args={[1.12, 64, 64]}>
        <meshBasicMaterial
          color="#00e5a8"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Earth body */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#0a1628"
          emissive="#061018"
          metalness={0.4}
          roughness={0.6}
          wireframe={false}
        />
      </mesh>

      {/* Wireframe overlay */}
      <mesh>
        <sphereGeometry args={[1.005, 36, 24]} />
        <meshBasicMaterial
          color="#00e5a8"
          wireframe
          transparent
          opacity={0.22}
        />
      </mesh>

      {/* Latitude/longitude rings */}
      <group ref={ringsRef}>
        {[0, 0.35, -0.35, 0.65, -0.65].map((y, i) => {
          const r = Math.sqrt(Math.max(0, 1 - y * y)) * 1.01
          return (
            <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r, 0.004, 8, 64]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
            </mesh>
          )
        })}
        {/* Meridians */}
        {[0, 45, 90, 135].map((deg, i) => (
          <mesh key={`m${i}`} rotation={[0, (deg * Math.PI) / 180, 0]}>
            <torusGeometry args={[1.01, 0.003, 8, 64]} />
            <meshBasicMaterial color="#00e5a8" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>

      {/* Data points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length / 3}
            array={points}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          color="#00e5a8"
          transparent
          opacity={0.9}
          sizeAttenuation
        />
      </points>

      {/* Orbital ring */}
      <mesh rotation={[Math.PI / 3, 0.2, 0.4]}>
        <torusGeometry args={[1.45, 0.006, 8, 100]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2.2, -0.3, 0.1]}>
        <torusGeometry args={[1.6, 0.004, 8, 100]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

export default function Globe3D() {
  return (
    <div className="globe-canvas">
      <Canvas
        camera={{ position: [0, 0.3, 3.2], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} color="#e0f7ff" />
        <pointLight position={[-4, -2, -3]} intensity={0.6} color="#00e5a8" />
        <pointLight position={[3, 4, -2]} intensity={0.4} color="#3b82f6" />
        <Stars radius={80} depth={40} count={2500} factor={3} saturation={0} fade speed={0.5} />
        <Earth />
      </Canvas>
    </div>
  )
}
