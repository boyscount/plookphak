// ห้องแมว 3D low-poly — โหลดแยก (lazy) เฉพาะตอนเปิดหน้าบ้านแมว
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import type { CatMood } from '../../lib/catStats'
import type { Tier } from '../../lib/tier'
import { Cat, type CatAction } from './Cat'

function Mat({ color, rough = 0.9 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} flatShading roughness={rough} />
}

const TIER_COLOR: Record<Tier, string> = { platinum: '#dfe6ee', gold: '#e9c766', silver: '#a9aeb4' }

/** ท้องฟ้านอกหน้าต่างตามเวลาไทย */
function skyColor() {
  const h = new Date(Date.now() + 7 * 3_600_000).getUTCHours()
  if (h >= 6 && h < 17) return '#a6dcff'
  if (h >= 17 && h < 19) return '#ffb38a'
  return '#1d2257'
}

function Room({ fullness, tier }: { fullness: number; tier: Tier }) {
  const sky = skyColor()
  const night = sky === '#1d2257'
  const food = Math.max(0, fullness / 100)
  return (
    <group>
      {/* พื้น + ผนัง */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.1, 4.4]} />
        <Mat color="#f2d4b8" />
      </mesh>
      {/* ลายไม้ */}
      {[-1.65, -0.55, 0.55, 1.65].map((x) => (
        <mesh key={x} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.02, 4.4]} />
          <meshBasicMaterial color="#d9b493" />
        </mesh>
      ))}
      <mesh position={[0, 1.2, -2.2]} receiveShadow>
        <boxGeometry args={[4.4, 2.5, 0.1]} />
        <Mat color="#d9c8ff" />
      </mesh>
      <mesh position={[-2.2, 1.2, 0]} receiveShadow>
        <boxGeometry args={[0.1, 2.5, 4.4]} />
        <Mat color="#cdb8fb" />
      </mesh>
      {/* บัวผนังสีชมพู */}
      <mesh position={[0, 0.25, -2.14]}>
        <boxGeometry args={[4.4, 0.5, 0.02]} />
        <Mat color="#ffb3c7" />
      </mesh>
      <mesh position={[-2.14, 0.25, 0]}>
        <boxGeometry args={[0.02, 0.5, 4.4]} />
        <Mat color="#ffa6bf" />
      </mesh>

      {/* หน้าต่าง */}
      <group position={[-0.6, 1.45, -2.13]}>
        <mesh>
          <boxGeometry args={[1.2, 0.9, 0.04]} />
          <Mat color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[1.05, 0.75]} />
          <meshBasicMaterial color={sky} />
        </mesh>
        {night &&
          [
            [-0.3, 0.2],
            [0.1, 0.25],
            [0.35, 0.05],
            [-0.1, -0.15],
            [0.25, -0.22],
          ].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.03]}>
              <circleGeometry args={[0.015, 5]} />
              <meshBasicMaterial color="#fff6c8" />
            </mesh>
          ))}
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[0.03, 0.75, 0.01]} />
          <Mat color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[1.05, 0.03, 0.01]} />
          <Mat color="#ffffff" />
        </mesh>
      </group>

      {/* กรอบรูปบัตรสมาชิก สีตามระดับ */}
      <group position={[1.1, 1.55, -2.13]}>
        <mesh>
          <boxGeometry args={[0.8, 0.55, 0.04]} />
          <Mat color="#3a2470" />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[0.66, 0.42]} />
          <meshStandardMaterial color={TIER_COLOR[tier]} metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[-0.18, 0.02, 0.03]}>
          <planeGeometry args={[0.12, 0.09]} />
          <meshStandardMaterial color="#c99a35" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* พรม */}
      <mesh position={[0.2, 0.01, 0.3]} receiveShadow>
        <cylinderGeometry args={[1.15, 1.15, 0.02, 24]} />
        <Mat color="#ffd6e6" />
      </mesh>
      <mesh position={[0.2, 0.022, 0.3]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.005, 24]} />
        <Mat color="#ffc2d8" />
      </mesh>

      {/* ที่นอนแมว */}
      <group position={[-1.35, 0, -1.3]}>
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.38, 0.13, 8, 16]} />
          <Mat color="#9a6bff" />
        </mesh>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.08, 16]} />
          <Mat color="#ffe3ef" />
        </mesh>
      </group>

      {/* โซฟา */}
      <group position={[1.15, 0, -1.6]}>
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.3, 0.7]} />
          <Mat color="#ff8fb3" />
        </mesh>
        <mesh position={[0, 0.5, -0.27]} castShadow>
          <boxGeometry args={[1.5, 0.5, 0.18]} />
          <Mat color="#ff7aa6" />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.35, 0]} castShadow>
            <boxGeometry args={[0.16, 0.45, 0.7]} />
            <Mat color="#ff7aa6" />
          </mesh>
        ))}
        <mesh position={[-0.35, 0.45, 0.05]} rotation={[0.2, 0.3, 0.15]} castShadow>
          <boxGeometry args={[0.32, 0.3, 0.1]} />
          <Mat color="#fff0b3" />
        </mesh>
      </group>

      {/* ต้นไม้ */}
      <group position={[-1.75, 0, 1.55]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.14, 0.36, 8]} />
          <Mat color="#c97b55" />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.55 + i * 0.22, 0]} castShadow>
            <coneGeometry args={[0.32 - i * 0.07, 0.4, 7]} />
            <Mat color={['#4fb36b', '#5cc47a', '#6fd38a'][i]} />
          </mesh>
        ))}
      </group>

      {/* ชามอาหาร: อาหารเหลือตามค่าความอิ่ม */}
      <group position={[1.25, 0, 0.95]}>
        <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.18, 0.14, 14, 1, true]} />
          <meshStandardMaterial color="#7432ea" flatShading side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.005, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.01, 14]} />
          <Mat color="#5a22c0" />
        </mesh>
        {/* อาหารยุบลงตามความอิ่ม — ต่ำกว่า 15% เหลือแต่ก้นชาม */}
        {food > 0.15 && (
          <mesh position={[0, 0.01 + food * 0.05, 0]} scale={[0.4 + food * 0.6, food, 0.4 + food * 0.6]}>
            <sphereGeometry args={[0.19, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color="#c98a4b" />
          </mesh>
        )}
      </group>

      {/* ชั้นวางกับกองเหรียญ */}
      <group position={[-2.1, 1.1, 0.4]}>
        <mesh>
          <boxGeometry args={[0.18, 0.05, 1.1]} />
          <Mat color="#ffffff" />
        </mesh>
        {Array.from({ length: tier === 'platinum' ? 6 : tier === 'gold' ? 4 : 2 }, (_, i) => (
          <mesh key={i} position={[0.02, 0.05 + i * 0.035, -0.3]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 12]} />
            <meshStandardMaterial color="#f2c14e" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0.02, 0.12, 0.25]} castShadow>
          <boxGeometry args={[0.1, 0.18, 0.14]} />
          <Mat color="#7ccf6b" />
        </mesh>
      </group>
    </group>
  )
}

/** ลูกบอลเด้งตอนกด "เล่นด้วย" */
function Ball({ action }: { action: CatAction }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current!
    const since = action?.kind === 'play' ? (performance.now() - action.at) / 1000 : 99
    m.visible = since < 3
    if (!m.visible) return
    const x = 1.3 - since * 0.7
    m.position.set(x, 0.12 + Math.abs(Math.sin(since * 5)) * 0.6 * Math.max(0, 1 - since / 3), 0.4 + since * 0.15)
    m.rotation.z += 0.2
  })
  return (
    <mesh ref={ref} castShadow visible={false}>
      <sphereGeometry args={[0.1, 10, 8]} />
      <meshStandardMaterial color="#ff6f61" flatShading />
    </mesh>
  )
}

/** หัวใจลอยตอนลูบหัว (HTML ทับฉาก เบากว่าทำเป็นโมเดล) */
function Hearts({ action, at }: { action: CatAction; at: [number, number, number] }) {
  if (!action || action.kind !== 'pet') return null
  return (
    <Html position={[at[0] + 0.45, 0.95, at[2]]} center zIndexRange={[20, 11]} key={action.at}>
      <div className="cat-hearts">
        <span>💕</span>
        <span>💖</span>
        <span>💗</span>
      </div>
    </Html>
  )
}

export default function CatRoom({
  color,
  mood,
  fullness,
  tier,
  line,
  action,
}: {
  color: string
  mood: CatMood
  fullness: number
  tier: Tier
  line: string
  action: CatAction
}) {
  // หิว = ไปนั่งข้างชาม, เศร้า = ไปนอนที่นอน, นอกนั้นนั่งกลางพรม
  const target: [number, number, number] =
    mood === 'hungry' ? [0.75, 0, 0.75] : mood === 'sad' ? [-1.35, 0.06, -1.3] : [0.2, 0.02, 0.35]
  const [ready, setReady] = useState(false)

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [4.6, 3.8, 4.6], fov: 38 }}
      onCreated={() => setReady(true)}
      className={ready ? 'cat-canvas-ready' : ''}
    >
      <color attach="background" args={['#efe7ff']} />
      <hemisphereLight args={['#ffffff', '#c9a7ff', 0.8]} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <Room fullness={fullness} tier={tier} />
      <Cat color={color} mood={mood} action={action} target={target} />
      <Ball action={action} />
      <Hearts action={action} at={target} />
      <Html position={[target[0], 1.35, target[2]]} center zIndexRange={[10, 0]}>
        <div className="cat-bubble">{line}</div>
      </Html>
      <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={5} blur={2.2} far={1.5} />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        minDistance={4.5}
        maxDistance={9}
        minPolarAngle={0.55}
        maxPolarAngle={1.2}
        minAzimuthAngle={-0.15}
        maxAzimuthAngle={1.7}
        enableDamping
      />
    </Canvas>
  )
}
