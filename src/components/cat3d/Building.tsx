// เรือนน้ำชากลางทะเลสาบของ admin: ผู้ยืม 1 คน = 1 ชั้น — โหลดแยก (lazy)
// โคมหน้าห้องบอกสถานะ (ทอง = ปกติ, แดงกะพริบ = ค้าง, ดับ = ปิดยอด) · เรือมาจอดเมื่อมีสลิปรอตรวจ
// กลางวัน/กลางคืน ฝน หมอก ฟ้าแลบ ตามอากาศจริงของที่อยู่ที่เลือก (ยังโหลดไม่เสร็จใช้เวลาไทย)
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CatMood } from '../../lib/catStats'
import type { Weather } from '../../lib/weather'
import { Cat } from './Cat'
import { Lightning3D, Rain3D } from './Weather3D'

export const FLOOR_H = 1.7
const W = 4.2
const D = 2.6
const BASE = 0.6 // ชานเรือนสูงจากน้ำ

export type FloorInfo = {
  id: string
  name: string
  color: string
  mood: CatMood
  fullness: number
  balance: string
  overdue: boolean
  closed: boolean
  pendingSlips: number
}

function isNightBkk() {
  const h = new Date(Date.now() + 7 * 3_600_000).getUTCHours()
  return h >= 18 || h < 6
}

const THEME = {
  day: { sky: '#cfe6e3', fog: '#d6ebe7', water: '#5fb3ab', wood: '#7a3b24', roof: '#2f3a44', paper: '#f1e3c4', mountain: '#8fbcb8', light: 1.1 },
  night: { sky: '#0b1430', fog: '#0e1838', water: '#13224a', wood: '#6a3522', roof: '#1f2836', paper: '#ffd98a', mountain: '#1c2852', light: 0.85 },
}

function Mat({ color, emissive, intensity = 0 }: { color: string; emissive?: string; intensity?: number }) {
  return <meshStandardMaterial color={color} flatShading roughness={0.85} emissive={emissive ?? '#000000'} emissiveIntensity={intensity} />
}

/** หลังคาบนสุด: ปิรามิดสี่เหลี่ยม */
function Eave({ y, w, d, color, h = 0.45 }: { y: number; w: number; d: number; color: string; h?: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w / Math.SQRT2, 1, d / Math.SQRT2]}>
      <coneGeometry args={[1, h, 4, 1]} />
      <Mat color={color} />
    </mesh>
  )
}

/** ชายคาระหว่างชั้น: ทรงกระโปรงกลวง ยื่นออกนอกผนังอย่างเดียว ไม่ทะลุเข้าไปในห้องชั้นบน */
function EaveSkirt({ y, w, d, color }: { y: number; w: number; d: number; color: string }) {
  // radiusTop ชิดผนัง, radiusBottom ยื่นออก (หลังหมุน 45° ครึ่งความกว้าง = r × sx × 0.707)
  const inner = (W / 2 + 0.05) / (w / 2)
  return (
    <mesh position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w / Math.SQRT2, 1, d / Math.SQRT2]}>
      <cylinderGeometry args={[inner, 1, 0.42, 4, 1, true]} />
      <meshStandardMaterial color={color} flatShading roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** โคมกระดาษหน้าห้อง — แดงกะพริบเมื่อค้าง */
function Lanterns({ y, tone, night }: { y: number; tone: 'ok' | 'late' | 'off'; night: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current && tone === 'late') mat.current.emissiveIntensity = 0.8 + Math.abs(Math.sin(clock.elapsedTime * 3.5)) * 2.2
  })
  const color = tone === 'late' ? '#ff3b4a' : tone === 'off' ? '#4a4038' : '#ffb21f'
  const glow = tone === 'off' ? 0 : night ? 1.8 : 0.9
  const xs = [-1.7, -0.85, 0, 0.85, 1.7]
  return (
    // แขวนใต้ขอบชายคาด้านนอก ไม่ให้ชายคาบัง (ชายคายื่นออกถึง z ≈ D/2 + 0.65)
    <group position={[0, y, D / 2 + 0.5]}>
      {xs.map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.3, 4]} />
            <meshBasicMaterial color="#1b1410" />
          </mesh>
          <mesh scale={[1, 1.35, 1]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial ref={i === 2 ? mat : undefined} color={color} emissive={color} emissiveIntensity={glow} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 10]} />
            <meshBasicMaterial color="#1b1410" />
          </mesh>
        </group>
      ))}
      {/* ไฟส่องจริงเฉพาะห้องที่ค้าง (คุมจำนวนไฟให้มือถือไม่หน่วง) */}
      {tone === 'late' && <pointLight color="#ff5a66" intensity={night ? 0.7 : 0.3} distance={2} />}
    </group>
  )
}

function Floor({
  info,
  index,
  onPick,
  selected,
  night,
}: {
  info: FloorInfo
  index: number
  onPick: (id: string) => void
  selected: boolean
  night: boolean
}) {
  const t = night ? THEME.night : THEME.day
  const target: [number, number, number] =
    info.mood === 'hungry' ? [0.9, 0.12, 0.3] : info.mood === 'sad' ? [-1.3, 0.16, -0.4] : [0, 0.12, 0.2]
  const food = info.fullness / 100
  const tone = info.overdue ? 'late' : info.closed ? 'off' : 'ok'

  return (
    <group
      position={[0, BASE + index * FLOOR_H, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onPick(info.id)
      }}
    >
      {/* พื้นเสื่อ */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[W, 0.1, D]} />
        <Mat color={selected ? '#ffe9a8' : '#d9c48f'} />
      </mesh>
      {/* ผนังไม้ + ประตูกระดาษด้านหลัง */}
      <mesh position={[0, FLOOR_H / 2, -D / 2]}>
        <boxGeometry args={[W, FLOOR_H, 0.08]} />
        <Mat color={t.wood} />
      </mesh>
      {[-1.4, -0.47, 0.47, 1.4].map((x) => (
        <mesh key={x} position={[x, FLOOR_H * 0.48, -D / 2 + 0.05]}>
          <planeGeometry args={[0.8, FLOOR_H * 0.62]} />
          <meshStandardMaterial color={t.paper} emissive={t.paper} emissiveIntensity={night && tone !== 'off' ? 0.55 : 0.05} />
        </mesh>
      ))}
      <mesh position={[-W / 2, FLOOR_H / 2, 0]}>
        <boxGeometry args={[0.08, FLOOR_H, D]} />
        <Mat color={t.wood} />
      </mesh>
      <mesh position={[W / 2, FLOOR_H / 2, 0]}>
        <boxGeometry args={[0.08, FLOOR_H, D]} />
        <Mat color={t.wood} />
      </mesh>
      {/* เสาหน้า */}
      {[-W / 2 + 0.05, W / 2 - 0.05].map((x) => (
        <mesh key={x} position={[x, FLOOR_H / 2, D / 2 - 0.05]}>
          <boxGeometry args={[0.1, FLOOR_H, 0.1]} />
          <Mat color={t.wood} />
        </mesh>
      ))}
      {/* ราวระเบียง */}
      <mesh position={[0, 0.35, D / 2 + 0.15]}>
        <boxGeometry args={[W + 0.3, 0.05, 0.05]} />
        <Mat color={t.wood} />
      </mesh>
      {/* เบาะรองนั่ง + ชาม */}
      <mesh position={[-1.3, 0.16, -0.4]}>
        <cylinderGeometry args={[0.38, 0.38, 0.1, 16]} />
        <Mat color="#b0473d" />
      </mesh>
      <group position={[1.35, 0.1, 0.55]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.2, 0.15, 0.12, 12, 1, true]} />
          <meshStandardMaterial color="#2f3a44" side={THREE.DoubleSide} flatShading />
        </mesh>
        {food > 0.15 && (
          <mesh position={[0, 0.01 + food * 0.05, 0]} scale={[0.4 + food * 0.6, food, 0.4 + food * 0.6]}>
            <sphereGeometry args={[0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color="#c98a4b" />
          </mesh>
        )}
      </group>
      <group scale={0.75}>
        <Cat color={info.color} mood={info.mood} action={null} target={target.map((v) => v / 0.75) as [number, number, number]} />
      </group>
      {/* ชายคาของชั้นนี้ + โคม */}
      <EaveSkirt y={FLOOR_H - 0.05} w={W + 1.3} d={D + 1.3} color={t.roof} />
      <Lanterns y={FLOOR_H - 0.62} tone={tone} night={night} />
    </group>
  )
}

/** ต้นซากุระบนโขดหิน */
function SakuraIsle({ position, scale = 1, night }: { position: [number, number, number]; scale?: number; night: boolean }) {
  const pink = night ? '#8f5a74' : '#ffb3cc'
  const pink2 = night ? '#7a4c66' : '#ff9fbf'
  const blobs: [number, number, number, number][] = [
    [0, 2.3, 0, 0.75],
    [0.7, 2.0, 0.2, 0.6],
    [-0.65, 2.05, -0.1, 0.62],
    [0.25, 2.65, -0.3, 0.5],
    [-0.3, 2.55, 0.35, 0.5],
  ]
  return (
    <group position={position} scale={scale}>
      {[[-0.4, 0, 0.2, 0.55], [0.35, 0, -0.1, 0.65], [0, 0, 0.4, 0.45]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.55, 1]}>
          <dodecahedronGeometry args={[r, 0]} />
          <Mat color={night ? '#2b3448' : '#6f7c7a'} />
        </mesh>
      ))}
      <mesh position={[0, 1, 0]} rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.08, 0.14, 2, 6]} />
        <Mat color={night ? '#2a1a12' : '#5a3626'} />
      </mesh>
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 0]} />
          <Mat color={i % 2 ? pink : pink2} />
        </mesh>
      ))}
    </group>
  )
}

/** กลีบซากุระร่วงรอบเรือน */
function FallingPetals({ night }: { night: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = 70
  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ x: ((i * 37) % 100) / 100, z: ((i * 53) % 100) / 100, s: 0.4 + ((i * 17) % 10) / 10, o: i * 0.37 })),
    [],
  )
  const m = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    seeds.forEach((p, i) => {
      const fall = ((t * 0.35 * p.s + p.o) % 1) * 9
      m.position.set((p.x - 0.5) * 16 + Math.sin(t + p.o) * 0.5, 9 - fall, (p.z - 0.5) * 12 + Math.cos(t * 0.7 + p.o) * 0.4)
      m.rotation.set(t * p.s, t * 0.6 + p.o, 0)
      m.updateMatrix()
      mesh.setMatrixAt(i, m.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <planeGeometry args={[0.09, 0.06]} />
      <meshBasicMaterial color={night ? '#c98ea3' : '#ffc1d6'} side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

/** เรือ: มีสลิปรอตรวจ = จอดที่ท่า, ไม่มี = ลอยอยู่ไกล ๆ */
function Boat({ docked, onClick, night }: { docked: boolean; onClick?: () => void; night: boolean }) {
  const ref = useRef<THREE.Group>(null)
  // จอดหน้าชานเรือน (อยู่ในมุมกล้องเสมอ) / ไม่มีสลิป = ลอยห่างออกไปทางขวา
  const goal = docked ? new THREE.Vector3(1.4, 0, D / 2 + 1.9) : new THREE.Vector3(6.5, 0, 5.5)
  const WATER = -0.2
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.position.lerp(goal, 0.03)
    g.position.y = WATER + 0.12 + Math.sin(clock.elapsedTime * 1.6) * 0.04
    g.rotation.z = Math.sin(clock.elapsedTime * 1.2) * 0.05
  })
  const wood = night ? '#4a2c1a' : '#8a5230'
  return (
    <group
      ref={ref}
      position={[goal.x, 0, goal.z]}
      rotation={[0, 0.35, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      {/* ลำเรือ: ครึ่งทรงรีลอยพ้นน้ำ */}
      <mesh scale={[1.2, 0.42, 0.5]}>
        <sphereGeometry args={[0.8, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={wood} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, -0.01, 0]} scale={[1.15, 1, 0.47]}>
        <cylinderGeometry args={[0.8, 0.8, 0.02, 16]} />
        <meshStandardMaterial color={night ? '#2e1c12' : '#6b3f26'} />
      </mesh>
      {/* เสา + โคมดวงเล็ก */}
      <mesh position={[-0.55, 0.35, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[-0.55, 0.62, 0]} scale={[1, 1.3, 1]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial color="#ffcc5c" emissive="#ffcc5c" emissiveIntensity={night ? 2 : 0.8} />
      </mesh>
      {docked && (
        <>
          {/* ซองสลิป */}
          <mesh position={[0.15, 0.1, 0]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[0.4, 0.26, 0.05]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.6 : 0.15} />
          </mesh>
          <pointLight position={[-0.55, 0.7, 0]} color="#ffd27a" intensity={night ? 1.5 : 0.4} distance={3} />
        </>
      )}
    </group>
  )
}

/** หลังคาบนสุด + ป้ายยอดค้างรับ */
function TopRoof({ y, total, rate, night }: { y: number; total: string; rate: number; night: boolean }) {
  const t = night ? THEME.night : THEME.day
  return (
    <group position={[0, y, 0]}>
      <Eave y={0.55} w={W + 1.6} d={D + 1.6} color={t.roof} h={1.1} />
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.8, 0.08, 0.08]} />
        <Mat color="#c99a35" />
      </mesh>
      <Html position={[0, 1.7, 0]} center zIndexRange={[20, 10]}>
        <div className="roof-sign">
          <span>ยอดค้างรับทั้งหมด</span>
          <b>{total}</b>
          <small>เก็บได้แล้ว {Math.round(rate * 100)}%</small>
        </div>
      </Html>
    </group>
  )
}

/** ป้ายชื่อหน้าห้องเป็น HTML ธรรมดานอก Canvas แล้วคำนวณตำแหน่งจากกล้องทุกเฟรม */
function PlateTracker({ count, plates }: { count: number; plates: React.RefObject<(HTMLElement | null)[]> }) {
  const v = useRef(new THREE.Vector3())
  useFrame(({ camera, size }) => {
    for (let i = 0; i < count; i++) {
      const el = plates.current?.[i]
      if (!el) continue
      v.current.set(0, BASE + i * FLOOR_H + 0.05, D / 2 + 0.35).project(camera)
      el.style.display = v.current.z > 1 ? 'none' : ''
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
  onBoat,
  total,
  rate,
  weather,
  demo,
}: {
  floors: FloorInfo[]
  selectedId: string | null
  focusY: number
  onPick: (id: string) => void
  onBoat?: () => void
  total: string
  rate: number
  weather?: Weather | null
  demo?: boolean
}) {
  const hourNight = useMemo(isNightBkk, [])
  const night = weather ? !weather.isDay : hourNight
  const t = night ? THEME.night : THEME.day
  // เมฆ/ฝน/หมอก: ฟ้าหม่น แสงลด หมอกเข้ามาใกล้
  const overcast = weather ? { storm: 0.62, rain: 0.45, drizzle: 0.32, fog: 0.35, cloudy: 0.28, partly: 0.08, clear: 0 }[weather.kind] : 0
  const sky = useMemo(() => '#' + new THREE.Color(t.sky).lerp(new THREE.Color(night ? '#05070f' : '#7d8794'), overcast).getHexString(), [t.sky, night, overcast])
  const fogColor = useMemo(() => '#' + new THREE.Color(t.fog).lerp(new THREE.Color(night ? '#070a14' : '#8d969f'), overcast).getHexString(), [t.fog, night, overcast])
  const fogFar = weather?.kind === 'fog' ? 20 : 34 - overcast * 12
  const dim = 1 - overcast * 0.5
  const rain = weather?.rain ?? 0
  const top = BASE + floors.length * FLOOR_H
  const plates = useRef<(HTMLElement | null)[]>([])
  const pending = floors.reduce((n, f) => n + f.pendingSlips, 0)

  return (
    <div className="relative h-full w-full">
      <Canvas dpr={[1, 1.5]} camera={{ position: [9.5, focusY + 3.6, 13], fov: 40 }} onPointerMissed={() => onPick('')}>
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[fogColor, weather?.kind === 'fog' ? 6 : 12, fogFar]} />
        <hemisphereLight args={[night ? '#5a6aa8' : '#ffffff', night ? '#0b1430' : '#7fb0ae', t.light * dim]} />
        <directionalLight position={[5, top + 6, 6]} intensity={(night ? 0.55 : 1.2) * (1 - overcast * 0.8)} color={night ? '#9fb0ff' : '#ffffff'} />
        {/* แสงโคมอุ่น ๆ หน้าเรือนตอนกลางคืน */}
        {night && <pointLight position={[0, top * 0.5, D + 2]} color="#ffc878" intensity={6} distance={14} />}
        {night && overcast < 0.3 && (
          <mesh position={[-9, top + 7, -14]}>
            <sphereGeometry args={[0.9, 16, 12]} />
            <meshBasicMaterial color="#fff4d6" />
          </mesh>
        )}

        {/* ทะเลสาบ + ภูเขาในหมอก */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={t.water} metalness={0.35} roughness={0.25} />
        </mesh>
        {[
          [-12, -20, 7],
          [-3, -24, 9],
          [8, -22, 8],
          [16, -18, 6],
        ].map(([x, z, h], i) => (
          <mesh key={i} position={[x, h / 2 - 0.2, z]}>
            <coneGeometry args={[h * 1.1, h, 5]} />
            <Mat color={t.mountain} />
          </mesh>
        ))}

        {/* เสาเข็ม + ชาน */}
        {[-1.9, -0.95, 0, 0.95, 1.9].flatMap((x) =>
          [-1.1, 1.1].map((z) => (
            <mesh key={`${x}${z}`} position={[x, BASE / 2 - 0.2, z]}>
              <cylinderGeometry args={[0.07, 0.07, BASE + 0.1, 6]} />
              <Mat color={t.wood} />
            </mesh>
          )),
        )}
        <mesh position={[0, BASE - 0.02, 0.45]}>
          <boxGeometry args={[W + 1.4, 0.08, D + 1.6]} />
          <Mat color={t.wood} />
        </mesh>

        {floors.map((f, i) => (
          <Floor key={f.id} info={f} index={i} onPick={onPick} selected={f.id === selectedId} night={night} />
        ))}
        <TopRoof y={top} total={total} rate={rate} night={night} />

        <SakuraIsle position={[-5.2, -0.1, 1.5]} scale={1.1} night={night} />
        <SakuraIsle position={[5.6, -0.1, -0.8]} scale={1.25} night={night} />
        <SakuraIsle position={[-4, -0.1, -4.5]} scale={0.9} night={night} />
        {rain > 0 ? <Rain3D intensity={rain} wind={weather?.wind ?? 0} night={night} /> : <FallingPetals night={night} />}
        {weather?.lightning && <Lightning3D sky={sky} demo={demo} />}
        <Boat docked={pending > 0} onClick={onBoat} night={night} />

        <OrbitControls
          makeDefault
          target={[0, focusY, 0]}
          enablePan={false}
          minDistance={6}
          maxDistance={18}
          minPolarAngle={0.7}
          maxPolarAngle={1.45}
          minAzimuthAngle={-0.6}
          maxAzimuthAngle={1.2}
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
      {pending > 0 && (
        <button
          type="button"
          onClick={onBoat}
          className="absolute bottom-11 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1a1240] shadow"
        >
          ⛵ เรือส่งสลิปมาเทียบท่า {pending} ใบ — แตะเพื่อตรวจ
        </button>
      )}
    </div>
  )
}
