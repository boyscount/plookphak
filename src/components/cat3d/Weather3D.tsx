// อากาศจริงในเรือนน้ำชา (three.js): ฝนเป็นเส้น 3 มิติ, วงน้ำกระเพื่อมบนทะเลสาบ, ฟ้าแลบ (แสงวาบทั้งฉาก + สายฟ้าหลังภูเขา)
// ฟ้าแลบปิดเองเมื่อเครื่องตั้ง "ลดการเคลื่อนไหว"
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const BOX = { x: 22, z: 18, top: 13 }
const WATER_Y = -0.19

/** ฝน: LineSegments หนึ่งก้อน อัปเดตตำแหน่งทุกเฟรม */
export function Rain3D({ intensity, wind, night }: { intensity: number; wind: number; night: boolean }) {
  const count = Math.round(250 + intensity * 1750)
  const slant = Math.min(0.5, wind / 70)
  const reduce = useMemo(reduceMotion, [])
  const lines = useRef<THREE.LineSegments>(null)
  const ripples = useRef<THREE.InstancedMesh>(null)

  const { positions, drops } = useMemo(() => {
    const drops = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * BOX.x,
      y: Math.random() * BOX.top,
      z: (Math.random() - 0.5) * BOX.z,
      v: 9 + Math.random() * 5 + intensity * 4,
      len: 0.25 + Math.random() * 0.25 + intensity * 0.2,
    }))
    return { positions: new Float32Array(count * 6), drops }
  }, [count, intensity])

  const RINGS = 48
  const ringState = useMemo(() => Array.from({ length: RINGS }, () => ({ x: 0, z: 0, s: 0, life: 0 })), [])
  const m = useMemo(() => new THREE.Object3D(), [])
  const nextRing = useRef(0)

  useFrame((_, dtRaw) => {
    const dt = reduce ? 0 : Math.min(dtRaw, 0.05)
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]
      d.y -= d.v * dt
      d.x += d.v * slant * dt
      if (d.y < WATER_Y) {
        // ตกถึงน้ำ → วงกระเพื่อม (บางเม็ด)
        if (Math.random() < 0.08 + intensity * 0.1) {
          const r = ringState[nextRing.current++ % RINGS]
          Object.assign(r, { x: d.x, z: d.z, s: 0.05, life: 1 })
        }
        d.y = BOX.top + Math.random() * 2
        d.x = (Math.random() - 0.5) * BOX.x - slant * 4
        d.z = (Math.random() - 0.5) * BOX.z
      }
      const o = i * 6
      positions[o] = d.x
      positions[o + 1] = d.y
      positions[o + 2] = d.z
      positions[o + 3] = d.x - d.len * slant
      positions[o + 4] = d.y + d.len
      positions[o + 5] = d.z
    }
    const geo = lines.current?.geometry
    if (geo) (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true

    const mesh = ripples.current
    if (mesh) {
      ringState.forEach((r, i) => {
        if (r.life > 0) {
          r.s += dt * 1.0
          r.life -= dt * 1.4
        }
        const alive = r.life > 0
        m.position.set(r.x, WATER_Y, r.z)
        m.rotation.set(-Math.PI / 2, 0, 0)
        m.scale.setScalar(alive ? r.s : 0.0001)
        m.updateMatrix()
        mesh.setMatrixAt(i, m.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  const color = night ? '#b9c6ff' : '#ffffff'
  return (
    <>
      <lineSegments ref={lines} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.28 + intensity * 0.32} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={ripples} args={[undefined, undefined, RINGS]} frustumCulled={false}>
        <ringGeometry args={[0.8, 1, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  )
}

/** ฟ้าแลบ: แสงวาบทั้งฉาก + พื้นหลังสว่างขึ้น + บางครั้งมีสายฟ้าผ่าลงหลังภูเขา */
export function Lightning3D({ sky, demo = false }: { sky: string; demo?: boolean }) {
  const { scene } = useThree()
  const flashLight = useRef<THREE.AmbientLight>(null)
  const bolt = useRef<THREE.Mesh>(null)
  const state = useRef({ flash: 0, boltLife: 0, next: performance.now() + (demo ? 800 : 2500 + Math.random() * 5000), echo: 0 })
  const base = useMemo(() => new THREE.Color(sky), [sky])
  const white = useMemo(() => new THREE.Color('#eef2ff'), [])
  const reduce = useMemo(reduceMotion, [])

  // สร้างสายฟ้าใหม่ทุกครั้งที่ผ่า: เส้นหยัก ๆ จากฟ้าลงไปหลังภูเขา
  const makeBolt = () => {
    const x0 = (Math.random() - 0.5) * 26
    const pts: THREE.Vector3[] = []
    let x = x0
    for (let y = 16; y > 0; y -= 1.2 + Math.random() * 1.4) {
      pts.push(new THREE.Vector3(x, y, -21))
      x += (Math.random() - 0.5) * 1.6
    }
    pts.push(new THREE.Vector3(x, -0.2, -21))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 48, 0.07, 5, false)
  }

  useEffect(() => () => bolt.current?.geometry.dispose(), [])

  useFrame(() => {
    const s = state.current
    const now = performance.now()
    if (!reduce && now >= s.next) {
      s.flash = 1
      s.echo = now + 130 // แลบซ้ำอีกครั้งสั้น ๆ
      if (Math.random() < 0.65 && bolt.current) {
        bolt.current.geometry.dispose()
        bolt.current.geometry = makeBolt()
        s.boltLife = 1
      }
      s.next = now + (demo ? 2200 + Math.random() * 2500 : 4000 + Math.random() * 8000)
    }
    if (s.echo && now >= s.echo) {
      s.flash = Math.max(s.flash, 0.6)
      s.echo = 0
    }
    if (flashLight.current) flashLight.current.intensity = s.flash * 3.2
    if (scene.background instanceof THREE.Color) scene.background.copy(base).lerp(white, s.flash * 0.55)
    if (bolt.current) {
      bolt.current.visible = s.boltLife > 0
      ;(bolt.current.material as THREE.MeshBasicMaterial).opacity = s.boltLife
    }
    s.flash *= 0.86
    if (s.flash < 0.01) s.flash = 0
    s.boltLife = Math.max(0, s.boltLife - 0.07)
  })

  return (
    <>
      <ambientLight ref={flashLight} color="#dfe6ff" intensity={0} />
      <mesh ref={bolt} visible={false}>
        <bufferGeometry />
        <meshBasicMaterial color="#ffffff" transparent fog={false} toneMapped={false} />
      </mesh>
    </>
  )
}
