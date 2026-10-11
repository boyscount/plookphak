// ชุด avatar ให้ผู้ใช้เลือก: เส้นดำหนา สีแบน เข้ากับธีม
import type { ReactNode } from 'react'

const ink = '#0e0e10'
const line = { stroke: ink, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/** หัวแมว: หูสามเหลี่ยม + หน้ากลม */
function CatHead({ fill, inner = '#ff9fb8' }: { fill: string; inner?: string }) {
  return (
    <g>
      <path d="M22 50 L20 16 L44 33 Z" fill={fill} {...line} />
      <path d="M78 50 L80 16 L56 33 Z" fill={fill} {...line} />
      <path d="M26 42 L25 24 L37 33 Z" fill={inner} />
      <path d="M74 42 L75 24 L63 33 Z" fill={inner} />
      <ellipse cx="50" cy="56" rx="32" ry="27" fill={fill} {...line} />
    </g>
  )
}

function Whiskers() {
  return (
    <g {...line} strokeWidth={2.5} fill="none">
      <path d="M20 60 L8 57 M20 66 L8 68" />
      <path d="M80 60 L92 57 M80 66 L92 68" />
    </g>
  )
}

export const AVATARS: { id: string; label: string; bg: string; art: ReactNode }[] = [
  {
    id: 'person',
    label: 'ค่าเริ่มต้น',
    bg: '#ffc95c',
    art: (
      <g fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round">
        <circle cx="50" cy="38" r="16" />
        <path d="M22 84v-6a20 20 0 0 1 20-20h16a20 20 0 0 1 20 20v6" />
      </g>
    ),
  },
  {
    id: 'cat_finger',
    label: 'แมวชูนิ้วกลาง',
    bg: '#ffb3c7',
    art: (
      <g>
        <CatHead fill="#c9c3d6" />
        {/* ตาเบื่อโลก: เปลือกตาปิดครึ่ง */}
        <path d="M30 52 a8 8 0 0 0 16 0 Z" fill="#fff" {...line} strokeWidth={3} />
        <path d="M54 52 a8 8 0 0 0 16 0 Z" fill="#fff" {...line} strokeWidth={3} />
        <circle cx="38" cy="55.5" r="2.8" fill={ink} />
        <circle cx="62" cy="55.5" r="2.8" fill={ink} />
        <path d="M28 47 L46 50 M72 47 L54 50" {...line} strokeWidth={3} />
        <path d="M47 63 L50 66 L53 63 Z" fill="#ff7a9c" {...line} strokeWidth={2.5} />
        <path d="M43 70 q3.5 3 7 0 q3.5 3 7 0" fill="none" {...line} strokeWidth={2.5} />
        <Whiskers />
        {/* อุ้งเท้าชูนิ้วกลาง */}
        <g transform="translate(7 5)">
          <rect x="62" y="44" width="12" height="34" rx="6" fill="#c9c3d6" {...line} />
          <rect x="52" y="68" width="34" height="26" rx="12" fill="#c9c3d6" {...line} />
          <path d="M58 70 v6 M80 70 v6" {...line} strokeWidth={3} />
          <ellipse cx="69" cy="86" rx="7" ry="4.5" fill="#ff9fb8" />
        </g>
      </g>
    ),
  },
  {
    id: 'cat_side_eye',
    label: 'แมวมองตาขวาง',
    bg: '#c7f0d8',
    art: (
      <g>
        <CatHead fill="#ffb347" />
        {/* ลายส้ม */}
        <path d="M44 31 v8 M50 30 v10 M56 31 v8" {...line} strokeWidth={3} />
        <ellipse cx="37" cy="54" rx="9" ry="7" fill="#fff" {...line} strokeWidth={3} />
        <ellipse cx="63" cy="54" rx="9" ry="7" fill="#fff" {...line} strokeWidth={3} />
        <circle cx="43" cy="54" r="3.6" fill={ink} />
        <circle cx="69" cy="54" r="3.6" fill={ink} />
        {/* คิ้วกดหนึ่งข้าง ยกหนึ่งข้าง */}
        <path d="M27 44 L46 47" {...line} />
        <path d="M54 43 L72 40" {...line} />
        <path d="M47 63 L50 66 L53 63 Z" fill="#ff7a9c" {...line} strokeWidth={2.5} />
        <path d="M44 72 L57 70" {...line} strokeWidth={3} />
        <Whiskers />
      </g>
    ),
  },
  {
    id: 'shiba_derp',
    label: 'ชิบะหน้าเอ๋อ',
    bg: '#bfe0ff',
    art: (
      <g>
        <path d="M22 46 L24 14 L44 32 Z" fill="#f2a65a" {...line} />
        <path d="M78 46 L76 14 L56 32 Z" fill="#f2a65a" {...line} />
        <path d="M27 38 L28 23 L38 31 Z" fill="#fff1dc" />
        <path d="M73 38 L72 23 L62 31 Z" fill="#fff1dc" />
        <ellipse cx="50" cy="56" rx="33" ry="28" fill="#f2a65a" {...line} />
        <path d="M24 62 Q50 92 76 62 Q66 54 50 58 Q34 54 24 62 Z" fill="#fff1dc" />
        {/* ตาเหล่ไปคนละทาง */}
        <circle cx="36" cy="49" r="7.5" fill="#fff" {...line} strokeWidth={3} />
        <circle cx="64" cy="49" r="7.5" fill="#fff" {...line} strokeWidth={3} />
        <circle cx="39.5" cy="51" r="3.3" fill={ink} />
        <circle cx="60" cy="46" r="3.3" fill={ink} />
        <ellipse cx="50" cy="62" rx="6" ry="4" fill={ink} />
        <path d="M50 66 v4 M42 70 q8 6 16 0" fill="none" {...line} strokeWidth={3} />
        {/* ลิ้นห้อยเบี้ยว */}
        <path d="M51 72 q1 12 8 11 q6 -1 3 -12 Z" fill="#ff7a9c" {...line} strokeWidth={3} />
        <circle cx="29" cy="62" r="4" fill="#ffb3a0" />
        <circle cx="71" cy="62" r="4" fill="#ffb3a0" />
      </g>
    ),
  },
  {
    id: 'cat_shock',
    label: 'แมวดำช็อก',
    bg: '#ffe066',
    art: (
      <g>
        <CatHead fill="#2b2b33" inner="#6b5b7a" />
        <circle cx="37" cy="52" r="11" fill="#fff" {...line} strokeWidth={3} />
        <circle cx="63" cy="52" r="11" fill="#fff" {...line} strokeWidth={3} />
        <circle cx="37" cy="52" r="2.4" fill={ink} />
        <circle cx="63" cy="52" r="2.4" fill={ink} />
        <ellipse cx="50" cy="72" rx="5" ry="6.5" fill="#ff7a9c" stroke="#fff" strokeWidth="2.5" />
        <g stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <path d="M22 62 L10 60 M22 68 L10 70 M78 62 L90 60 M78 68 L90 70" />
        </g>
        <path d="M86 20 v10 M86 35 v1" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'pug_sleepy',
    label: 'ปั๊กง่วง',
    bg: '#d9c8ff',
    art: (
      <g>
        <path d="M18 40 Q14 22 32 26 L36 44 Z" fill="#3a2f2a" {...line} />
        <path d="M82 40 Q86 22 68 26 L64 44 Z" fill="#3a2f2a" {...line} />
        <ellipse cx="50" cy="56" rx="32" ry="29" fill="#e8c9a0" {...line} />
        <ellipse cx="50" cy="66" rx="18" ry="14" fill="#3a2f2a" />
        <path d="M30 50 q6 5 12 0 M58 50 q6 5 12 0" fill="none" {...line} strokeWidth={3.5} />
        <path d="M42 38 q8 -4 16 0" fill="none" {...line} strokeWidth={3} />
        <ellipse cx="50" cy="61" rx="5" ry="3.5" fill="#000" />
        <path d="M44 70 q6 4 12 0" fill="none" stroke="#e8c9a0" strokeWidth="3" strokeLinecap="round" />
        <text x="74" y="26" fontFamily="sans-serif" fontWeight="900" fontSize="16" fill={ink}>z</text>
        <text x="84" y="16" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill={ink}>z</text>
      </g>
    ),
  },
  {
    id: 'frog_meh',
    label: 'กบหน้าเซ็ง',
    bg: '#ffd1a8',
    art: (
      <g>
        <circle cx="32" cy="34" r="13" fill="#7ccf6b" {...line} />
        <circle cx="68" cy="34" r="13" fill="#7ccf6b" {...line} />
        <ellipse cx="50" cy="60" rx="36" ry="25" fill="#7ccf6b" {...line} />
        <circle cx="32" cy="34" r="7" fill="#fff" />
        <circle cx="68" cy="34" r="7" fill="#fff" />
        <path d="M25 34 h14 M61 34 h14" {...line} strokeWidth={3} />
        <circle cx="34" cy="37" r="2.5" fill={ink} />
        <circle cx="70" cy="37" r="2.5" fill={ink} />
        <path d="M30 66 Q50 60 70 68" fill="none" {...line} />
        <circle cx="26" cy="58" r="4" fill="#ff9f9f" />
        <circle cx="74" cy="58" r="4" fill="#ff9f9f" />
      </g>
    ),
  },
  {
    id: 'capy_chill',
    label: 'คาปิบาร่าชิล',
    bg: '#c7f0d8',
    art: (
      <g>
        {/* ส้มยูซุบนหัว */}
        <circle cx="50" cy="20" r="9" fill="#ffa733" {...line} strokeWidth={3} />
        <path d="M50 11 q4 -5 9 -3" fill="none" stroke="#3f8f3a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="27" cy="34" r="7" fill="#9b6b43" {...line} strokeWidth={3} />
        <circle cx="73" cy="34" r="7" fill="#9b6b43" {...line} strokeWidth={3} />
        <rect x="20" y="28" width="60" height="60" rx="26" fill="#b98557" {...line} />
        <rect x="32" y="56" width="36" height="26" rx="13" fill="#9b6b43" />
        {/* ตาหรี่ชิล ๆ */}
        <path d="M32 47 h10 M58 47 h10" {...line} strokeWidth={3.5} />
        <ellipse cx="43" cy="64" rx="2.5" ry="3.5" fill={ink} />
        <ellipse cx="57" cy="64" rx="2.5" ry="3.5" fill={ink} />
        <path d="M44 74 q6 3 12 0" fill="none" {...line} strokeWidth={3} />
      </g>
    ),
  },
  {
    id: 'bunny_shy',
    label: 'กระต่ายเขิน',
    bg: '#ffd6e6',
    art: (
      <g>
        <ellipse cx="36" cy="22" rx="9" ry="20" fill="#ffffff" {...line} transform="rotate(-10 36 22)" />
        <ellipse cx="64" cy="22" rx="9" ry="20" fill="#ffffff" {...line} transform="rotate(10 64 22)" />
        <ellipse cx="36" cy="24" rx="4" ry="13" fill="#ffb3c7" transform="rotate(-10 36 24)" />
        <ellipse cx="64" cy="24" rx="4" ry="13" fill="#ffb3c7" transform="rotate(10 64 24)" />
        <ellipse cx="50" cy="62" rx="31" ry="27" fill="#ffffff" {...line} />
        {/* ตายิ้ม ^^ */}
        <path d="M33 58 q5 -6 10 0 M57 58 q5 -6 10 0" fill="none" {...line} strokeWidth={3.5} />
        <ellipse cx="31" cy="68" rx="7" ry="4" fill="#ff8fb0" opacity=".8" />
        <ellipse cx="69" cy="68" rx="7" ry="4" fill="#ff8fb0" opacity=".8" />
        <path d="M47 66 L50 69 L53 66 Z" fill="#ff7a9c" {...line} strokeWidth={2.5} />
        <path d="M50 69 v4 M45 75 q5 3 10 0" fill="none" {...line} strokeWidth={2.5} />
        {/* เส้นเขิน */}
        <path d="M24 74 l3 -4 M28 76 l3 -4 M70 72 l3 4 M74 70 l3 4" {...line} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'bear_grumpy',
    label: 'หมีหน้าบึ้ง',
    bg: '#cfe3ff',
    art: (
      <g>
        <circle cx="26" cy="30" r="11" fill="#a0673f" {...line} />
        <circle cx="74" cy="30" r="11" fill="#a0673f" {...line} />
        <circle cx="26" cy="30" r="5" fill="#d9a07a" />
        <circle cx="74" cy="30" r="5" fill="#d9a07a" />
        <circle cx="50" cy="58" r="32" fill="#a0673f" {...line} />
        <ellipse cx="50" cy="70" rx="15" ry="11" fill="#e8c4a0" />
        {/* คิ้วขมวด */}
        <path d="M30 44 L44 50 M70 44 L56 50" {...line} strokeWidth={4} />
        <circle cx="39" cy="55" r="3.5" fill={ink} />
        <circle cx="61" cy="55" r="3.5" fill={ink} />
        <ellipse cx="50" cy="66" rx="5" ry="3.5" fill={ink} />
        <path d="M43 77 q7 -5 14 0" fill="none" {...line} strokeWidth={3} />
        <path d="M78 16 l6 -6 M84 18 l7 -2 M80 24 l8 2" stroke="#ff4d5e" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'panda_lazy',
    label: 'แพนด้าขี้เกียจ',
    bg: '#e3d6ff',
    art: (
      <g>
        <circle cx="27" cy="30" r="11" fill={ink} {...line} />
        <circle cx="73" cy="30" r="11" fill={ink} {...line} />
        <circle cx="50" cy="58" r="32" fill="#ffffff" {...line} />
        <ellipse cx="37" cy="56" rx="9" ry="11" fill={ink} transform="rotate(25 37 56)" />
        <ellipse cx="63" cy="56" rx="9" ry="11" fill={ink} transform="rotate(-25 63 56)" />
        {/* ตาปรือ */}
        <path d="M33 57 h8 M59 57 h8" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="50" cy="69" rx="4.5" ry="3" fill={ink} />
        <path d="M45 76 q5 2 10 0" fill="none" {...line} strokeWidth={2.5} />
        <path d="M60 78 q3 6 0 9" fill="none" stroke="#7cc8ff" strokeWidth="3" strokeLinecap="round" />
        <text x="72" y="22" fontFamily="sans-serif" fontWeight="900" fontSize="14" fill={ink}>z</text>
      </g>
    ),
  },
  {
    id: 'hamster_cheeks',
    label: 'แฮมสเตอร์แก้มตุ่ย',
    bg: '#fff0b3',
    art: (
      <g>
        <circle cx="30" cy="32" r="8" fill="#f2a65a" {...line} strokeWidth={3} />
        <circle cx="70" cy="32" r="8" fill="#f2a65a" {...line} strokeWidth={3} />
        <ellipse cx="50" cy="58" rx="36" ry="30" fill="#f2a65a" {...line} />
        {/* แก้มตุ่ยใส่เมล็ด */}
        <ellipse cx="25" cy="66" rx="14" ry="12" fill="#fff1dc" {...line} strokeWidth={3} />
        <ellipse cx="75" cy="66" rx="14" ry="12" fill="#fff1dc" {...line} strokeWidth={3} />
        <ellipse cx="50" cy="66" rx="12" ry="10" fill="#fff1dc" />
        <circle cx="40" cy="52" r="4.5" fill={ink} />
        <circle cx="60" cy="52" r="4.5" fill={ink} />
        <circle cx="41.5" cy="50.5" r="1.5" fill="#fff" />
        <circle cx="61.5" cy="50.5" r="1.5" fill="#fff" />
        <ellipse cx="50" cy="61" rx="3" ry="2" fill="#ff7a9c" />
        <path d="M46 66 q4 3 8 0" fill="none" {...line} strokeWidth={2.5} />
        <ellipse cx="50" cy="74" rx="4" ry="6" fill="#ffffff" {...line} strokeWidth={2} />
      </g>
    ),
  },
  {
    id: 'cat_lucky',
    label: 'แมวกวักเงิน',
    bg: '#ffc2c2',
    art: (
      <g>
        <path d="M24 46 L22 14 L44 32 Z" fill="#ffffff" {...line} />
        <path d="M76 46 L78 14 L56 32 Z" fill="#ffffff" {...line} />
        <path d="M27 38 L26 22 L37 31 Z" fill="#ff9fb8" />
        <ellipse cx="48" cy="56" rx="30" ry="26" fill="#ffffff" {...line} />
        <path d="M30 38 q4 -4 9 0" fill="none" stroke="#ff9f43" strokeWidth="6" strokeLinecap="round" />
        <path d="M33 54 q5 -6 10 0 M53 54 q5 -6 10 0" fill="none" {...line} strokeWidth={3.5} />
        <path d="M45 62 L48 65 L51 62 Z" fill="#ff7a9c" {...line} strokeWidth={2.5} />
        <path d="M42 69 q6 4 12 0" fill="none" {...line} strokeWidth={2.5} />
        {/* ปลอกคอ + กระดิ่ง */}
        <path d="M26 76 q22 10 44 0" fill="none" stroke="#e5383b" strokeWidth="6" strokeLinecap="round" />
        <circle cx="48" cy="83" r="5" fill="#ffd23f" {...line} strokeWidth={2.5} />
        {/* อุ้งเท้ากวัก + เหรียญ */}
        <ellipse cx="82" cy="40" rx="9" ry="12" fill="#ffffff" {...line} />
        <circle cx="80" cy="70" r="12" fill="#ffc93c" {...line} />
        <path d="M77 63 v14 M77 63 h4 a3 3 0 0 1 0 7 h-4 M77 70 h5 a3.5 3.5 0 0 1 0 7 h-5" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'penguin_cool',
    label: 'เพนกวินใส่แว่น',
    bg: '#bfefff',
    art: (
      <g>
        <ellipse cx="50" cy="56" rx="32" ry="34" fill="#2b3240" {...line} />
        <ellipse cx="50" cy="64" rx="22" ry="24" fill="#ffffff" />
        {/* แว่นดำ */}
        <path d="M24 46 h52" {...line} strokeWidth={3} />
        <rect x="28" y="42" width="19" height="13" rx="5" fill={ink} />
        <rect x="53" y="42" width="19" height="13" rx="5" fill={ink} />
        <path d="M31 45 l6 0" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
        <path d="M44 60 L50 67 L56 60 Z" fill="#ffa733" {...line} strokeWidth={2.5} />
        <path d="M45 74 q5 2 10 -1" fill="none" {...line} strokeWidth={2.5} />
        <ellipse cx="30" cy="66" rx="5" ry="3" fill="#ff9fb8" opacity=".8" />
        <ellipse cx="70" cy="66" rx="5" ry="3" fill="#ff9fb8" opacity=".8" />
      </g>
    ),
  },
]

export function avatarById(id: string | null | undefined) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

export function AvatarArt({ id, className }: { id?: string | null; className?: string }) {
  const a = avatarById(id)
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="50" fill={a.bg} />
      <g transform="translate(5 5) scale(0.9)">{a.art}</g>
    </svg>
  )
}

/** สีตัวแมว 3D ในบ้านแมว/เรือนน้ำชา ตามรูปโปรไฟล์ที่เลือก */
const CAT_COLOR: Record<string, string> = {
  cat_finger: '#c9c3d6',
  cat_side_eye: '#ffb347',
  cat_shock: '#2e2a36',
  shiba_derp: '#f2a65a',
  pug_sleepy: '#e8c9a0',
  frog_meh: '#7ccf6b',
  capy_chill: '#b98557',
  bunny_shy: '#fff7fa',
  bear_grumpy: '#a0673f',
  panda_lazy: '#f4f4f6',
  hamster_cheeks: '#f2a65a',
  cat_lucky: '#fffaf2',
  penguin_cool: '#3a4252',
}

export function catColorOf(avatar: string | null | undefined) {
  return CAT_COLOR[avatar ?? ''] ?? '#ffb347'
}
