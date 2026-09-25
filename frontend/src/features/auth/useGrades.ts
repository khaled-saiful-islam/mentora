import { useMemo } from 'react'
import { useConfig } from '@/hooks/useConfig'
import type { Grade } from '@/lib/api'

export interface GradeGroup {
  stage: string
  grades: Grade[]
}

/** The school levels from /config, grouped by stage in picker order. */
export function useGrades(): { grades: Grade[]; groups: GradeGroup[]; loading: boolean } {
  const config = useConfig()
  return useMemo(() => {
    const grades = config?.grades ?? []
    const groups: GradeGroup[] = []
    for (const grade of grades) {
      const last = groups[groups.length - 1]
      if (last && last.stage === grade.stage) last.grades.push(grade)
      else groups.push({ stage: grade.stage, grades: [grade] })
    }
    return { grades, groups, loading: config === null }
  }, [config])
}
