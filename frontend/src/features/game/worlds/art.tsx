/**
 * The five worlds' art (§23), layer by layer, in their own tokens. Each is
 * drawn into a 1600 × 900 scene that the backdrop scales to fill the screen;
 * the game's cards sit over the middle, so the busy parts keep to the edges
 * and the ground.
 */
import { Drift, Sliding, Sway, Twinkle, type ArtProps } from './parts'

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// --- Taman Negara rainforest -------------------------------------------------

export function RainforestArt({ p, random, live, run }: ArtProps) {
  const trees = range(9).map((i) => ({ x: i * 190 + random() * 60, h: 260 + random() * 160, r: 70 + random() * 40 }))
  const ferns = range(12).map((i) => ({ x: i * 140 + random() * 40, s: 0.8 + random() * 0.6 }))
  return (
    <g>
      <circle cx="1250" cy="170" r="300" fill="url(#glow-rainforest)" />
      <path d="M0 560 Q 200 470 420 540 T 860 520 T 1300 500 T 1600 530 V 900 H 0 Z" fill={p('far')} />
      <Sliding run={run} seconds={70}>
        {trees.map((t, i) => (
          <g key={i}>
            <rect x={t.x - 9} y={760 - t.h} width="18" height={t.h} rx="8" fill={p('near')} />
            {[-1, 0, 1].map((side) => (
              <circle key={side} cx={t.x + side * t.r * 0.7} cy={760 - t.h + Math.abs(side) * 30} r={t.r * (side ? 0.75 : 1)} fill={p('mid')} />
            ))}
          </g>
        ))}
      </Sliding>
      <path d="M-20 820 C 300 760 520 860 860 800 S 1360 760 1640 800 V 900 H -20 Z" fill={p('accent', 0.9)} />
      <path d="M80 835 H 220 M 600 820 H 760 M 1100 800 H 1260" stroke={p('glow', 0.7)} strokeWidth="5" strokeLinecap="round" strokeDasharray="30 22">
        {live && <animate attributeName="stroke-dashoffset" from="0" to="-104" dur="3s" repeatCount="indefinite" />}
      </path>
      <rect y="866" width="1600" height="34" fill={p('ground')} />
      <Sliding run={run} seconds={22}>
        {ferns.map((f, i) => (
          <Sway key={i} live={live} deg={4} seconds={3.5 + (i % 3)} x={f.x} y={900}>
            {[-50, -20, 15, 45].map((angle) => (
              <ellipse key={angle} cx={f.x} cy={900 - 70 * f.s} rx={18 * f.s} ry={78 * f.s} fill={p('near')} transform={`rotate(${angle} ${f.x} 900)`} />
            ))}
          </Sway>
        ))}
      </Sliding>
      {live && (
        <g>
          {/* A hornbill crossing the canopy, now and then. */}
          <path d="M0 0 q 26 -18 52 0 q -10 4 -20 4 l 18 10 l -26 -4 q -14 8 -24 -10 z M48 -4 l 22 -6 l -10 10 z" fill={p('near')} transform="scale(1.3)" />
          <animateTransform attributeName="transform" type="translate" values="-200 180; 1800 120" dur="28s" repeatCount="indefinite" />
        </g>
      )}
      <Drift live={live} count={9} random={random} from={-60} to={960} render={(_, s) => <ellipse rx={9 * s} ry={4 * s} fill={p('mid', 0.85)} transform="rotate(35)" />} />
    </g>
  )
}

// --- Sipadan coral reef -------------------------------------------------------

export function ReefArt({ p, random, live, run }: ArtProps) {
  const corals = range(8).map((i) => ({ x: i * 205 + random() * 70, h: 120 + random() * 110 }))
  const fans = range(7).map((i) => ({ x: 100 + i * 230 + random() * 60, s: 0.8 + random() * 0.5 }))
  const fish = range(5).map(() => ({ y: 220 + random() * 380, s: 0.7 + random() * 0.6, d: 16 + random() * 14 }))
  return (
    <g>
      {range(5).map((i) => (
        <Sway key={i} live={live} deg={2} seconds={7 + i} x={260 + i * 300} y={0}>
          <polygon points={`${200 + i * 300},0 ${320 + i * 300},0 ${420 + i * 300},900 ${160 + i * 300},900`} fill={p('glow', 0.12)} />
        </Sway>
      ))}
      <path d="M0 640 Q 240 560 480 620 T 980 600 T 1600 620 V 900 H 0 Z" fill={p('far')} />
      <Sliding run={run} seconds={60}>
        {corals.map((c, i) => (
          <g key={i} fill={p(i % 2 ? 'mid' : 'near')}>
            <rect x={c.x - 10} y={820 - c.h} width="20" height={c.h} rx="10" />
            <rect x={c.x - 52} y={850 - c.h * 0.7} width="18" height={c.h * 0.7} rx="9" transform={`rotate(-18 ${c.x - 43} 850)`} />
            <rect x={c.x + 34} y={850 - c.h * 0.6} width="18" height={c.h * 0.6} rx="9" transform={`rotate(20 ${c.x + 43} 850)`} />
            <circle cx={c.x + 90} cy={846} r={38} />
          </g>
        ))}
      </Sliding>
      <path d="M0 840 Q 400 810 800 840 T 1600 830 V 900 H 0 Z" fill={p('ground')} />
      <path d="M120 870 q 40 -10 80 0 M 520 862 q 40 -10 80 0 M 980 872 q 40 -10 80 0 M 1380 864 q 40 -10 80 0" stroke={p('far', 0.35)} strokeWidth="4" fill="none" strokeLinecap="round" />
      {fans.map((f, i) => (
        <Sway key={i} live={live} deg={5} seconds={4 + (i % 3)} x={f.x} y={880}>
          <path d={`M${f.x} 880 C ${f.x - 70 * f.s} ${880 - 120 * f.s}, ${f.x - 30 * f.s} ${880 - 190 * f.s}, ${f.x} ${880 - 170 * f.s} C ${f.x + 30 * f.s} ${880 - 190 * f.s}, ${f.x + 70 * f.s} ${880 - 120 * f.s}, ${f.x} 880 Z`} fill={p('near', 0.85)} />
        </Sway>
      ))}
      {fish.map((f, i) => (
        <g key={i} transform={live ? undefined : `translate(${300 + i * 260} ${f.y})`}>
          <g transform={`scale(${f.s})`}>
            <ellipse cx="0" cy="0" rx="30" ry="14" fill={p('accent')} />
            <polygon points="26,0 48,-14 48,14" fill={p('accent')} />
            <circle cx="-14" cy="-3" r="3" fill={p('haze')} />
          </g>
          {live && <animateTransform attributeName="transform" type="translate" values={`1750 ${f.y}; -150 ${f.y + 30}`} dur={`${f.d}s`} begin={`${-i * 4}s`} repeatCount="indefinite" />}
        </g>
      ))}
      <Drift live={live} count={14} random={random} from={960} to={-60} render={(_, s) => <circle r={7 * s} fill="none" stroke={p('glow', 0.8)} strokeWidth="2" />} />
    </g>
  )
}

// --- Kampung festival at sunset ----------------------------------------------

export function KampungArt({ p, random, live, run }: ArtProps) {
  const houses = range(5).map((i) => ({ x: 60 + i * 330 + random() * 50, w: 170 + random() * 50 }))
  const palms = range(5).map((i) => ({ x: 200 + i * 330 + random() * 60 }))
  return (
    <g>
      <circle cx="800" cy="540" r="330" fill="url(#glow-kampung)" />
      <circle cx="800" cy="540" r="120" fill={p('glow')} />
      <path d="M0 600 Q 300 520 600 590 T 1200 570 T 1600 600 V 900 H 0 Z" fill={p('far')} />
      <Sliding run={run} seconds={60}>
        {houses.map((h, i) => (
          <g key={i} fill={p('mid')}>
            {[0.15, 0.5, 0.85].map((at) => (
              <rect key={at} x={h.x + h.w * at - 5} y="720" width="10" height="110" />
            ))}
            <rect x={h.x} y="610" width={h.w} height="115" rx="6" />
            <polygon points={`${h.x - 24},616 ${h.x + h.w / 2},520 ${h.x + h.w + 24},616`} />
            <rect x={h.x + h.w * 0.2} y="640" width="34" height="40" rx="4" fill={p('glow', 0.85)} />
            <rect x={h.x + h.w * 0.6} y="640" width="34" height="40" rx="4" fill={p('glow', 0.85)} />
          </g>
        ))}
      </Sliding>
      <rect y="820" width="1600" height="80" fill={p('ground')} />
      <path d="M0 300 Q 400 380 800 300 T 1600 300" stroke={p('mid')} strokeWidth="3" fill="none" />
      {range(9).map((i) => (
        <Sway key={i} live={live} deg={6} seconds={3 + (i % 4) * 0.5} x={100 + i * 175} y={310 + (i % 2) * 30}>
          <line x1={100 + i * 175} y1={310 + (i % 2) * 30} x2={100 + i * 175} y2={340 + (i % 2) * 30} stroke={p('mid')} strokeWidth="2" />
          <ellipse cx={100 + i * 175} cy={360 + (i % 2) * 30} rx="22" ry="26" fill={p('accent')} />
          <ellipse cx={100 + i * 175} cy={360 + (i % 2) * 30} rx="10" ry="18" fill={p('glow', 0.6)} />
        </Sway>
      ))}
      <Sliding run={run} seconds={24}>
        {palms.map((t, i) => (
          <g key={i}>
            <path d={`M${t.x} 900 C ${t.x + 20} 760, ${t.x - 10} 640, ${t.x + 30} 560`} stroke={p('near')} strokeWidth="18" fill="none" strokeLinecap="round" />
            <Sway live={live} deg={4} seconds={5} x={t.x + 30} y={560}>
              {[-150, -110, -60, -20, 25].map((angle) => (
                <ellipse key={angle} cx={t.x + 30} cy={500} rx="16" ry="70" fill={p('near')} transform={`rotate(${angle + 90} ${t.x + 30} 560)`} />
              ))}
            </Sway>
          </g>
        ))}
      </Sliding>
      <g transform={live ? undefined : 'translate(1260 170)'}>
        {/* A wau, high on the evening wind. */}
        <path d="M0 -60 L 34 0 L 0 50 L -34 0 Z M -60 -10 Q 0 -40 60 -10 Q 0 -20 -60 -10 Z" fill={p('accent')} stroke={p('mid')} strokeWidth="3" />
        <line x1="0" y1="50" x2="-120" y2="420" stroke={p('mid', 0.7)} strokeWidth="2" />
        {live && <animateTransform attributeName="transform" type="translate" values="1260 170; 1290 150; 1260 170" dur="6s" repeatCount="indefinite" />}
      </g>
      <Drift live={live} count={10} random={random} from={900} to={300} render={(_, s) => <circle r={4 * s} fill={p('glow')} />} />
    </g>
  )
}

// --- Kuala Lumpur at night -----------------------------------------------------

export function CityArt({ p, random, live, run }: ArtProps) {
  const blocks = range(14).map((i) => ({ x: i * 118 + random() * 30, w: 80 + random() * 40, h: 160 + random() * 220 }))
  const stars = range(30).map(() => ({ x: random() * 1600, y: random() * 360, r: 1 + random() * 2.2 }))
  return (
    <g>
      {stars.map((s, i) => (
        <Twinkle key={i} live={live} seconds={2 + (i % 5)} delay={-(i % 7)}>
          <circle cx={s.x} cy={s.y} r={s.r} fill={p('glow')} />
        </Twinkle>
      ))}
      <circle cx="1330" cy="150" r="64" fill={p('glow', 0.92)} />
      <circle cx="1310" cy="140" r="64" fill={p('sky')} />
      <g fill={p('far')}>
        {blocks.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={760 - b.h} width={b.w} height={b.h} />
            {range(Math.floor(b.h / 60)).map((row) => (
              <Twinkle key={row} live={live && (i + row) % 3 === 0} seconds={4 + row} delay={-i}>
                <rect x={b.x + 16} y={780 - b.h + row * 60} width={b.w - 32} height="12" rx="3" fill={p('accent', 0.55)} />
              </Twinkle>
            ))}
          </g>
        ))}
      </g>
      {/* The twin towers, tapering to their spires, joined by the skybridge. */}
      {[690, 870].map((x) => (
        <g key={x} fill={p('mid')}>
          <path d={`M${x - 46} 760 V 330 L ${x - 30} 260 L ${x - 14} 200 L ${x} 60 L ${x + 14} 200 L ${x + 30} 260 L ${x + 46} 330 V 760 Z`} />
          {range(12).map((row) => (
            <rect key={row} x={x - 30} y={360 + row * 32} width="60" height="8" rx="3" fill={p('glow', 0.6)} />
          ))}
        </g>
      ))}
      <rect x="720" y="470" width="120" height="16" rx="4" fill={p('mid')} />
      <rect y="760" width="1600" height="140" fill={p('ground')} />
      <Sliding run={run} seconds={9}>
        {range(10).map((i) => (
          <rect key={i} x={i * 160 + 30} y="836" width="80" height="8" rx="4" fill={p('glow', 0.7)} />
        ))}
      </Sliding>
      <Sliding run={run} seconds={26}>
        {range(8).map((i) => (
          <g key={i}>
            <rect x={i * 200 + 92} y="700" width="14" height="70" fill={p('near')} />
            <circle cx={i * 200 + 99} cy="680" r="54" fill={p('near')} />
          </g>
        ))}
      </Sliding>
    </g>
  )
}

// --- A space mission ------------------------------------------------------------

export function SpaceArt({ p, random, live, run }: ArtProps) {
  const stars = range(70).map(() => ({ x: random() * 1600, y: random() * 900, r: 0.8 + random() * 2.4 }))
  const craters = range(7).map((i) => ({ x: i * 240 + random() * 80, r: 22 + random() * 30 }))
  return (
    <g>
      <circle cx="420" cy="260" r="360" fill="url(#glow-space)" opacity="0.35" />
      {stars.map((s, i) => (
        <Twinkle key={i} live={live && i % 3 === 0} seconds={2 + (i % 6)} delay={-(i % 9)}>
          <circle cx={s.x} cy={s.y} r={s.r} fill={p('glow', 0.9)} />
        </Twinkle>
      ))}
      <g>
        <circle cx="1240" cy="230" r="110" fill={p('far')} />
        <ellipse cx="1240" cy="230" rx="190" ry="34" fill="none" stroke={p('accent', 0.7)} strokeWidth="10" transform="rotate(-14 1240 230)" />
      </g>
      {live && (
        <line x1="0" y1="0" x2="120" y2="40" stroke={p('glow')} strokeWidth="4" strokeLinecap="round" opacity="0.9">
          <animateTransform attributeName="transform" type="translate" values="-300 60; 1900 520" dur="9s" repeatCount="indefinite" />
        </line>
      )}
      <Sliding run={run} seconds={50}>
        <path d="M0 720 Q 400 640 800 700 T 1600 690 V 900 H 0 Z" fill={p('mid')} />
        {craters.map((c, i) => (
          <ellipse key={i} cx={c.x} cy={760 + (i % 2) * 40} rx={c.r} ry={c.r * 0.35} fill={p('near')} />
        ))}
      </Sliding>
      <Sliding run={run} seconds={20}>
        {range(9).map((i) => (
          <ellipse key={i} cx={i * 190 + 60} cy="880" rx={60 + (i % 3) * 20} ry="36" fill={p('ground')} />
        ))}
      </Sliding>
      <Drift live={live} count={6} random={random} from={950} to={-50} render={(_, s) => <circle r={2.5 * s} fill={p('accent')} />} />
    </g>
  )
}
