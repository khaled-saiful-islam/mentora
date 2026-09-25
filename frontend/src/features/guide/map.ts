/**
 * The concept map on a guide's cover: the topic in the middle, its sections
 * round it, and each section's words to know just beyond. Laid out here — a
 * pure function of the guide — so the picture is the same on every screen
 * and testable without one.
 */

export interface MapNode {
  id: string
  label: string
  x: number
  y: number
  ring: 0 | 1 | 2
  /** Which section it belongs to; none for the centre. */
  section?: number
}

export interface MapEdge {
  from: string
  to: string
}

export interface ConceptMap {
  width: number
  height: number
  nodes: MapNode[]
  edges: MapEdge[]
}

/** Two at most: more and the outer ring overlaps itself. */
const TERMS_PER_SECTION = 2

export function layoutMap(
  title: string,
  sections: { heading: string; terms: { term: string }[] }[],
  width = 720,
  height = 440,
): ConceptMap {
  const cx = width / 2
  const cy = height / 2
  const nodes: MapNode[] = [{ id: 'centre', label: title, x: cx, y: cy, ring: 0 }]
  const edges: MapEdge[] = []
  const count = Math.max(sections.length, 1)

  sections.forEach((section, i) => {
    // From the top, clockwise, so the first section is where the eye starts.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    const id = `s${i}`
    nodes.push({
      id,
      label: section.heading,
      x: round(cx + Math.cos(angle) * width * 0.3),
      y: round(cy + Math.sin(angle) * height * 0.3),
      ring: 1,
      section: i,
    })
    edges.push({ from: 'centre', to: id })

    const terms = section.terms.slice(0, TERMS_PER_SECTION)
    terms.forEach((term, t) => {
      const spread = terms.length === 1 ? 0 : (t === 0 ? -1 : 1) * (Math.PI / Math.max(count * 2.6, 5))
      const outer = angle + spread
      const termId = `${id}t${t}`
      nodes.push({
        id: termId,
        label: term.term,
        x: clamp(round(cx + Math.cos(outer) * width * 0.44), 50, width - 50),
        y: clamp(round(cy + Math.sin(outer) * height * 0.45), 18, height - 18),
        ring: 2,
        section: i,
      })
      edges.push({ from: id, to: termId })
    })
  })

  return { width, height, nodes, edges }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}
