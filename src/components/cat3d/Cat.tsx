// แมวชิบิ: หัวโต ตัวเล็ก ตาโตมีประกาย แสงเงาแบบการ์ตูน (toon) + เส้นขอบ — สร้างจากรูปทรงล้วน ไม่มีไฟล์โมเดล
import { Outlines } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { CatMood } from '../../lib/catStats'

export type CatAction = { kind: 'pet' | 'play' | 'feed'; at: number } | null

const CREAM = '#fff4e2'
const PINK = '#ffa3bd'
const INK = '#221a2e'
const LINE = '#3a2a4a'

/** ไล่แสง 3 ระดับแบบการ์ตูน */
function useToonGradient() {
  return useMemo(() => {
    const data = new Uint8Array([90, 170, 255])
    const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    return tex
  }, [])
}

function Toon({ color, grad }: { color: string; grad: THREE.Texture }) {
  return <meshToonMaterial color={color} gradientMap={grad} />
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
  const grad = useToonGradient()
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const t0 = useRef(Math.random() * 10)
  const dark = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l < 0.3

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + t0.current
    const g = root.current!
    // เดินไปยังตำแหน่งเป้าหมายช้า ๆ และหันหน้าไปทางที่เดิน
    const goal = new THREE.Vector3(...target)
    const d = goal.clone().sub(g.position).setY(0)
    const walking = d.length() > 0.05
    if (walking) {
      g.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * 0.9))
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(d.x, d.z), 0.08)
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.6, 0.03)
    }

    // ตัวเด้งดึ๋งตอนหายใจ/เดิน
    const squish = walking ? Math.sin(t * 14) * 0.05 : Math.sin(t * (mood === 'sad' ? 1.2 : 2)) * 0.03
    body.current!.scale.set(1 - squish * 0.5, 1 + squish, 1 - squish * 0.5)

    // หาง: ดีใจกระดิกเร็ว เศร้าห้อย
    const tailSpeed = mood === 'happy' ? 7 : mood === 'sad' ? 1 : 3
    tail.current!.rotation.z = Math.sin(t * tailSpeed) * (mood === 'sad' ? 0.1 : 0.5)
    tail.current!.rotation.x = mood === 'sad' ? 0.8 : -0.35

    // หัว: เศร้าก้ม, หิวเงยอ้อน, ปกติเอียงคอน่ารัก
    const headDown = mood === 'sad' ? 0.3 : mood === 'hungry' ? -0.18 : Math.sin(t * 0.8) * 0.05
    head.current!.rotation.x = THREE.MathUtils.lerp(head.current!.rotation.x, headDown, 0.05)
    head.current!.rotation.z = Math.sin(t * 0.7) * 0.12

    // ตา: กะพริบ + เศร้าหรี่ตา + ดีใจยิ้มตา
    const blink = Math.sin(t * 1.3) > 0.985 ? 0.1 : 1
    eyes.current!.scale.y = blink * (mood === 'sad' ? 0.55 : mood === 'happy' ? 0.85 : 1)

    // กระโดด: ตอนดีใจเป็นระยะ หรือหลังถูกลูบ/เล่นด้วย
    let hop = 0
    const since = action ? (performance.now() - action.at) / 1000 : 99
    if (since < 1.2) hop = Math.abs(Math.sin(since * Math.PI * 2.5)) * 0.35 * (1.2 - since)
    else if (mood === 'happy') hop = Math.max(0, Math.sin(t * 2.2) - 0.92) * 2.5
    g.position.y = target[1] + hop
  })

  const outline = <Outlines thickness={0.018} color={LINE} />

  return (
    <group ref={root} position={target}>
      {/* ตัวเล็กป้อม */}
      <group ref={body} position={[0, 0.2, 0]}>
        <mesh castShadow scale={[1, 0.9, 1.1]}>
          <sphereGeometry args={[0.22, 24, 16]} />
          <Toon color={color} grad={grad} />
          {outline}
        </mesh>
        <mesh position={[0, -0.01, 0.14]} scale={[0.75, 0.8, 0.5]}>
          <sphereGeometry args={[0.2, 20, 14]} />
          <Toon color={CREAM} grad={grad} />
        </mesh>
      </group>

      {/* ขาสั้นจุ๊ด */}
      {[
        [-0.1, 0.05, 0.13],
        [0.1, 0.05, 0.13],
        [-0.12, 0.05, -0.1],
        [0.12, 0.05, -0.1],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} scale={[1, 0.8, 1.15]} castShadow>
          <sphereGeometry args={[0.065, 14, 10]} />
          <Toon color={i < 2 ? CREAM : color} grad={grad} />
          {outline}
        </mesh>
      ))}

      {/* หางโค้งอ้วน */}
      <group ref={tail} position={[0, 0.2, -0.22]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[0, 0.03 + i * 0.055, -0.03 - Math.sin(i * 0.45) * 0.08]}>
            <sphereGeometry args={[0.055 - i * 0.003, 12, 8]} />
            <Toon color={i === 6 ? CREAM : color} grad={grad} />
          </mesh>
        ))}
      </group>

      {/* หัวโต (ชิบิ) */}
      <group ref={head} position={[0, 0.58, 0.04]}>
        <mesh castShadow scale={[1.08, 0.94, 1]}>
          <sphereGeometry args={[0.34, 32, 24]} />
          <Toon color={color} grad={grad} />
          {outline}
        </mesh>
        {/* หูกลมมน */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.21, 0.25, -0.02]} rotation={[0, 0, -s * 0.4]}>
            <mesh castShadow>
              <coneGeometry args={[0.12, 0.2, 16]} />
              <Toon color={color} grad={grad} />
              {outline}
            </mesh>
            <mesh position={[0, -0.02, 0.05]} scale={[0.6, 0.7, 0.3]}>
              <coneGeometry args={[0.12, 0.2, 16]} />
              <Toon color={mood === 'sad' ? '#c995a6' : PINK} grad={grad} />
            </mesh>
          </group>
        ))}
        {/* ปากกระบอกครีม */}
        <mesh position={[0, -0.11, 0.285]} scale={[1.4, 0.85, 0.7]}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <Toon color={CREAM} grad={grad} />
        </mesh>
        <mesh position={[0, -0.075, 0.355]} scale={[1.3, 0.9, 0.8]}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <meshBasicMaterial color="#ff7f9f" />
        </mesh>
        {/* ปากรูป ω */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.028, -0.125, 0.345]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.026, 0.006, 6, 16, Math.PI]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
        {mood === 'hungry' && (
          <mesh position={[0, -0.17, 0.33]} scale={[1, 1.4, 0.5]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshBasicMaterial color="#ff6f8f" />
          </mesh>
        )}
        {/* ตาโตมีประกาย */}
        <group ref={eyes} position={[0, 0.0, 0.3]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.125, 0, 0]} rotation={[0, s * 0.25, 0]}>
              <mesh scale={[0.8, mood === 'hungry' ? 1.2 : 1.05, 0.5]}>
                <sphereGeometry args={[0.08, 20, 14]} />
                <meshBasicMaterial color={dark ? '#ffd23f' : INK} />
              </mesh>
              {dark && (
                <mesh position={[0, 0, 0.035]} scale={[0.3, 0.9, 0.3]}>
                  <sphereGeometry args={[0.07, 12, 10]} />
                  <meshBasicMaterial color={INK} />
                </mesh>
              )}
              <mesh position={[0.022 * s, 0.035, 0.04]}>
                <sphereGeometry args={[0.026, 10, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[-0.02 * s, -0.03, 0.04]}>
                <sphereGeometry args={[0.012, 8, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
        {/* แก้มชมพู (มีเสมอ ดีใจเข้มขึ้น) */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.2, -0.1, 0.27]} rotation={[0, s * 0.6, 0]} scale={[1, 0.55, 0.2]}>
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshBasicMaterial color="#ff7a9c" transparent opacity={mood === 'happy' ? 0.85 : 0.45} />
          </mesh>
        ))}
        {/* หนวด */}
        {[-1, 1].map((s) =>
          [0, 1].map((k) => (
            <mesh key={`${s}${k}`} position={[s * 0.3, -0.08 - k * 0.04, 0.22]} rotation={[0, 0, s * (0.1 - k * 0.2)]}>
              <boxGeometry args={[0.13, 0.006, 0.006]} />
              <meshBasicMaterial color={dark ? '#ffffff' : LINE} />
            </mesh>
          )),
        )}
        {/* น้ำตาตอนเศร้า */}
        {mood === 'sad' && (
          <mesh position={[0.13, -0.08, 0.34]} scale={[0.6, 1.1, 0.6]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshBasicMaterial color="#7cc8ff" />
          </mesh>
        )}
      </group>
    </group>
  )
}
