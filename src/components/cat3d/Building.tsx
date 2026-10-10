// ตึกแมวของ admin: ผู้ยืม 1 คน = 1 ชั้น — โหลดแยก (lazy)
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CatMood } from '../../lib/catStats'
import { Cat } from './Cat'

export const FLOOR_H = 1.7
const W = 4.2
const D = 2.6

export type FloorInfo = {
  id: string
  name: string
  color: string
  mood: CatMood
  fullness: number
  balance: string
  overdue: boolean
  pendingSlips: number
}

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} flatShading roughness={0.9} />
}

const WALLS = ['#d9c8ff', '#ffd6e6', '#c7f0d8', '#ffe8b8', '#cfe3ff', '#f3d1ff']

/** ไฟแดงกะพริบเตือนค้างชำระ */
function Alarm() {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 0.6 + Math.abs(Math.sin(clock.elapsedTime * 4)) * 2.4
  })
  return (
    <group position={[W / 2 - 0.35, FLOOR_H - 0.35, -D / 2 + 0.12]}>
      <mesh>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial ref={ref} color="#ff2d3d" emissive="#ff2d3d" emissiveIntensity={1} />
      </mesh>
      <pointLight color="#ff2d3d" intensity={1.2} distance={2.2} />
    </group>
  )
}

function Floor({ info, index, onPick, selected }: { info: FloorInfo; index: number; onPick: (id: string) => void; selected: boolean }) {
  const wall = info.overdue ? '#ffc9cf' : WALLS[index % WALLS.length]
  // หิว = นั่งข้างชาม, เศร้า = ไปที่นอน, นอกนั้นกลางห้อง
  const target: [number, number, number] =
    info.mood === 'hungry' ? [0.9, 0.12, 0.3] : info.mood === 'sad' ? [-1.3, 0.16, -0.4] : [0, 0.12, 0.2]
  const food = info.fullness / 100

  return (
    <group
      position={[0, index * FLOOR_H, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onPick(info.id)
      }}
    >
      {/* พื้นห้อง (แผ่นพื้นของชั้นนี้) */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[W, 0.1, D]} />
        <Mat color={selected ? '#ffe9a8' : '#f2d4b8'} />
      </mesh>
      {/* ผนังหลัง + ผนังข้าง */}
      <mesh position={[0, FLOOR_H / 2, -D / 2]}>
        <boxGeometry args={[W, FLOOR_H, 0.08]} />
        <Mat color={wall} />
      </mesh>
      <mesh position={[-W / 2, FLOOR_H / 2, 0]}>
        <boxGeometry args={[0.08, FLOOR_H, D]} />
        <Mat color={wall} />
      </mesh>
      {/* หน้าต่าง */}
      <mesh position={[0.6, FLOOR_H * 0.6, -D / 2 + 0.05]}>
        <planeGeometry args={[0.9, 0.55]} />
        <meshBasicMaterial color="#a6dcff" />
      </mesh>
      {/* ที่นอน */}
      <mesh position={[-1.3, 0.2, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.1, 6, 12]} />
        <Mat color="#9a6bff" />
      </mesh>
      {/* ชามอาหาร */}
      <group position={[1.35, 0.1, 0.55]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.2, 0.15, 0.12, 12, 1, true]} />
          <meshStandardMaterial color="#7432ea" side={THREE.DoubleSide} flatShading />
        </mesh>
        {food > 0.15 && (
          <mesh position={[0, 0.01 + food * 0.05, 0]} scale={[0.4 + food * 0.6, food, 0.4 + food * 0.6]}>
            <sphereGeometry args={[0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color="#c98a4b" />
          </mesh>
        )}
      </group>
      {/* โซฟาเล็ก */}
      <mesh position={[0.6, 0.3, -D / 2 + 0.4]}>
        <boxGeometry args={[1.1, 0.3, 0.5]} />
        <Mat color="#ff8fb3" />
      </mesh>
      {info.overdue && <Alarm />}
      <group scale={0.75}>
        <Cat color={info.color} mood={info.mood} action={null} target={target.map((v) => v / 0.75) as [number, number, number]} />
      </group>
    </group>
  )
}

/** บันไดซิกแซกด้านขวาของตึก */
function Stairs({ floors }: { floors: number }) {
  const steps = []
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < 8; i++) {
      const dir = f % 2 === 0 ? 1 : -1
      steps.push(
        <mesh key={`${f}-${i}`} position={[W / 2 + 0.45, f * FLOOR_H + (i + 1) * (FLOOR_H / 8), dir * (-D / 2 + 0.3 + i * 0.27)]}>
          <boxGeometry args={[0.7, 0.06, 0.3]} />
          <Mat color="#ffffff" />
        </mesh>,
      )
    }
  }
  return <group>{steps}</group>
}

/** ดาดฟ้า: ป้ายยอดค้างรับ + ไฟประดับ */
function Roof({ y, total, rate }: { y: number; total: string; rate: number }) {
  const bulbs = Array.from({ length: 9 }, (_, i) => -W / 2 + 0.2 + (i * (W - 0.4)) / 8)
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[W + 0.2, 0.1, D + 0.2]} />
        <Mat color="#5a2fb8" />
      </mesh>
      {/* ราวกันตก */}
      <mesh position={[0, 0.3, D / 2 + 0.05]}>
        <boxGeometry args={[W + 0.2, 0.04, 0.04]} />
        <Mat color="#ffffff" />
      </mesh>
      {bulbs.map((x, i) => (
        <mesh key={i} position={[x, 0.75 - Math.sin((i / 8) * Math.PI) * 0.15, -D / 2 + 0.15]}>
          <sphereGeometry args={[0.05, 6, 5]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcf4d" emissiveIntensity={1.5} />
        </mesh>
      ))}
      <Html position={[0, 0.7, 0]} center zIndexRange={[20, 10]}>
        <div className="roof-sign">
          <span>ยอดค้างรับทั้งหมด</span>
          <b>{total}</b>
          <small>เก็บได้แล้ว {Math.round(rate * 100)}%</small>
        </div>
      </Html>
    </group>
  )
}

/**
 * ป้ายชื่อหน้าห้องเป็น HTML ธรรมดานอก Canvas แล้วคำนวณตำแหน่งจากกล้องทุกเฟรม
 * (drei <Html> หลายอันพร้อมกัน ตัวแรกแสดงเนื้อหาว่างเป็นบางครั้ง)
 */
function PlateTracker({ count, plates }: { count: number; plates: React.RefObject<(HTMLElement | null)[]> }) {
  const v = useRef(new THREE.Vector3())
  useFrame(({ camera, size }) => {
    for (let i = 0; i < count; i++) {
      const el = plates.current?.[i]
      if (!el) continue
      v.current.set(0, i * FLOOR_H + 0.05, D / 2 + 0.05).project(camera)
      const behind = v.current.z > 1
      el.style.display = behind ? 'none' : ''
      el.style.transform = `translate(-50%, -50%) translate(${((v.current.x + 1) / 2) * size.width}px, ${((1 - v.current.y) / 2) * size.height}px)`
    }
  })
  return null
}

/** เลื่อนกล้องไปยังชั้นที่เลือกแบบนุ่ม ๆ */
function FocusFloor({ y }: { y: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const goal = useRef(new THREE.Vector3(0, y, 0))
  useEffect(() => {
    goal.current.set(0, y, 0)
  }, [y])
  useFrame(({ camera }) => {
    if (!controls) return
    const t = controls.target
    const dy = goal.current.y - t.y
    if (Math.abs(dy) < 0.005) return
    const step = dy * 0.08
    t.y += step
    camera.position.y += step
    controls.update()
  })
  return null
}

export default function Building({
  floors,
  selectedId,
  focusY,
  onPick,
  total,
  rate,
}: {
  floors: FloorInfo[]
  selectedId: string | null
  focusY: number
  onPick: (id: string) => void
  total: string
  rate: number
}) {
  const top = floors.length * FLOOR_H
  const plates = useRef<(HTMLElement | null)[]>([])
  return (
    <div className="relative h-full w-full">
    <Canvas dpr={[1, 1.5]} camera={{ position: [6.5, focusY + 2.6, 7.5], fov: 40 }} onPointerMissed={() => onPick('')}>
      <color attach="background" args={['#1a1240']} />
      <fog attach="fog" args={['#1a1240', 14, 30]} />
      <hemisphereLight args={['#ffffff', '#6a4bd6', 0.9]} />
      <directionalLight position={[4, top + 6, 6]} intensity={1.3} />
      {/* พื้นดิน */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[W + 3, 0.1, D + 3]} />
        <Mat color="#3b2a7a" />
      </mesh>
      {floors.map((f, i) => (
        <Floor key={f.id} info={f} index={i} onPick={onPick} selected={f.id === selectedId} />
      ))}
      <Stairs floors={floors.length} />
      <Roof y={top} total={total} rate={rate} />
      <OrbitControls
        makeDefault
        target={[0, focusY, 0]}
        enablePan={false}
        minDistance={5}
        maxDistance={16}
        minPolarAngle={0.7}
        maxPolarAngle={1.45}
        minAzimuthAngle={-0.2}
        maxAzimuthAngle={1.3}
        enableDamping
      />
      <FocusFloor y={focusY} />
      <PlateTracker count={floors.length} plates={plates} />
    </Canvas>
      {/* ป้ายชื่อหน้าห้อง (กดได้) */}
      {floors.map((f, i) => (
        <button
          key={f.id}
          ref={(el) => {
            plates.current[i] = el
          }}
          type="button"
          onClick={() => onPick(f.id)}
          className={`floor-plate absolute top-0 left-0 ${f.overdue ? 'is-late' : ''} ${f.id === selectedId ? 'is-selected' : ''}`}
        >
          <b>ชั้น {i + 1}</b> · {f.name} · {f.balance}
          {f.pendingSlips > 0 && <span> · 📩{f.pendingSlips}</span>}
        </button>
      ))}
    </div>
  )
}
