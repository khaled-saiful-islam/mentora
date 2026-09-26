import { apiFetch } from '@/lib/api'

/** One of a teacher's own files, kept as text to make from. */
export interface Material {
  id: string
  title: string
  filename: string
  /** "pdf", "docx", "pptx" or "text". */
  kind: string
  size_bytes: number
  /** "pages", "slides", "paragraphs" or "lines". */
  unit: string
  unit_count: number
  preview: string
  created_at: string
  updated_at: string
}

export const materialsApi = {
  list: (q?: string) => apiFetch<{ items: Material[]; limit: number }>(`/materials${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file, file.name)
    return apiFetch<Material>('/materials', { method: 'POST', body: form })
  },
  rename: (id: string, title: string) =>
    apiFetch<Material>(`/materials/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  remove: (id: string) => apiFetch<void>(`/materials/${id}`, { method: 'DELETE' }),
}

/** What the file picker accepts. */
export const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain'

/** "2.4 MB · 12 pages" */
export function sizeLine(m: Material): string {
  const mb = m.size_bytes / 1_048_576
  const size = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(m.size_bytes / 1024))} KB`
  const one = m.unit.replace(/s$/, '')
  return `${size} · ${m.unit_count} ${m.unit_count === 1 ? one : `${one}s`}`
}
