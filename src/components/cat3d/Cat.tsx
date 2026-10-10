// แมว low-poly จากรูปทรงพื้นฐาน — ท่าทางเปลี่ยนตามอารมณ์
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { CatMood } from '../../lib/catStats'

export type CatAction = { kind: 'pet' | 'play' | 'feed'; at: number } | null

const CREAM = '#fff1dc'
const PINK = '#ff9fb8'
const INK = '#16131c'

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} flatShading roughness={0.85} />
}

export function Cat({
  color,
  mood,
  action,
  target,
}: {
  color: string
  mood: CatMood
  action: CatAction
  /** ตำแหน่งที่แมวควรไปอยู่ (เช่น หิว = ไปนั่งข้างชาม) */
  target: [number, number, number]
}) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const t0 = useRef(Math.random() * 10)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + t0.current
    const g = root.current!
    // เดินไปยังตำแหน่งเป้าหมายช้า ๆ และหันหน้าไปทางที่เดิน
    const goal = new THREE.Vector3(...target)
    const d = goal.clone().sub(g.position).setY(0)
    if (d.length() > 0.05) {
      g.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * 0.9))
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(d.x, d.z), 0.08)
    } else {
      // หยุดแล้วค่อย ๆ หันหน้าเข้าหากล้อง
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.6, 0.03)
    }

    // หายใจ
    const breathe = 1 + Math.sin(t * (mood === 'sad' ? 1.2 : 2)) * 0.03
    body.current!.scale.set(1, 0.85 * breathe, 1.25)

    // หาง: ดีใจกระดิกเร็ว เศร้าห้อย
    const tailSpeed = mood === 'happy' ? 6 : mood === 'sad' ? 1 : 3
    tail.current!.rotation.y = Math.sin(t * tailSpeed) * (mood === 'sad' ? 0.1 : 0.45)
    tail.current!.rotation.x = mood === 'sad' ? 0.9 : -0.2

    // หัว: เศร้าก้มหน้า, หิวเงยหน้าอ้อน
    const headDown = mood === 'sad' ? 0.35 : mood === 'hungry' ? -0.15 : Math.sin(t * 0.8) * 0.06
    head.current!.rotation.x = THREE.MathUtils.lerp(head.current!.rotation.x, headDown, 0.05)
    head.current!.rotation.z = Math.sin(t * 0.7) * 0.08

    // ตา: กะพริบ + เศร้าหรี่ตา
    const blink = Math.sin(t * 1.3) > 0.985 ? 0.1 : 1
    eyes.current!.scale.y = blink * (mood === 'sad' ? 0.45 : mood === 'happy' ? 0.7 : 1)

    // กระโดด: ตอนดีใจเป็นระยะ หรือหลังถูกลูบ/เล่นด้วย
    let hop = 0
    const since = action ? (performance.now() - action.at) / 1000 : 99
    if (since < 1.2) hop = Math.abs(Math.sin(since * Math.PI * 2.5)) * 0.35 * (1.2 - since)
    else if (mood === 'happy') hop = Math.max(0, Math.sin(t * 2.2) - 0.92) * 2.5
    g.position.y = hop
  })

  const earInner = mood === 'sad' ? '#b98c9a' : PINK

  return (
    <group ref={root} position={target}>
      {/* ตัว */}
      <mesh ref={body} position={[0, 0.32, 0]} castShadow>
        <sphereGeometry args={[0.32, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.3, 0.24]} scale={[1, 1.1, 0.7]} castShadow>
        <sphereGeometry args={[0.2, 8, 6]} />
        <Mat color={CREAM} />
      </mesh>

      {/* ขา */}
      {[
        [-0.15, 0.06, 0.28],
        [0.15, 0.06, 0.28],
        [-0.17, 0.06, -0.22],
        [0.17, 0.06, -0.22],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <sphereGeometry args={[0.08, 7, 5]} />
          <Mat color={i < 2 ? CREAM : color} />
        </mesh>
      ))}

      {/* หาง: ลูกกลมต่อกันเป็นโค้ง */}
      <group ref={tail} position={[0, 0.3, -0.36]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[Math.sin(i * 0.35) * 0.06, i * 0.07, -i * 0.05]} castShadow>
            <sphereGeometry args={[0.06 - i * 0.004, 6, 5]} />
            <Mat color={i === 6 ? CREAM : color} />
          </mesh>
        ))}
      </group>

      {/* หัว */}
      <group ref={head} position={[0, 0.72, 0.22]}>
        <mesh castShadow>
          <sphereGeometry args={[0.27, 10, 8]} />
          <Mat color={color} />
        </mesh>
        {/* หู */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.15, 0.2, -0.02]} rotation={[0, 0, -s * 0.35]}>
            <mesh castShadow>
              <coneGeometry args={[0.1, 0.2, 4]} />
              <Mat color={color} />
            </mesh>
            <mesh position={[0, -0.02, 0.04]} scale={[0.6, 0.7, 0.4]}>
              <coneGeometry args={[0.1, 0.2, 4]} />
              <Mat color={earInner} />
            </mesh>
          </group>
        ))}
        {/* ปากกระบอก */}
        <mesh position={[0, -0.07, 0.2]} scale={[1.3, 0.8, 0.8]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <Mat color={CREAM} />
        </mesh>
        <mesh position={[0, -0.03, 0.28]}>
          <sphereGeometry args={[0.03, 6, 5]} />
          <Mat color={PINK} />
        </mesh>
        {/* ตา */}
        <group ref={eyes} position={[0, 0.04, 0.22]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.1, 0, 0]}>
              <mesh scale={mood === 'hungry' ? 1.25 : 1}>
                <sphereGeometry args={[0.05, 8, 6]} />
                <meshStandardMaterial color={INK} roughness={0.3} />
              </mesh>
              <mesh position={[0.015, 0.02, 0.04]}>
                <sphereGeometry args={[0.015, 6, 4]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
        {/* แก้มแดงตอนดีใจ */}
        {mood === 'happy' &&
          [-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.17, -0.06, 0.18]} scale={[1, 0.6, 0.3]}>
              <sphereGeometry args={[0.045, 6, 4]} />
              <meshBasicMaterial color="#ff7a9c" transparent opacity={0.7} />
            </mesh>
          ))}
        {/* น้ำตาตอนเศร้า */}
        {mood === 'sad' && (
          <mesh position={[0.11, -0.04, 0.25]} scale={[0.6, 1, 0.6]}>
            <sphereGeometry args={[0.025, 6, 4]} />
            <meshStandardMaterial color="#7cc8ff" roughness={0.1} />
          </mesh>
        )}
      </group>
    </group>
  )
}
