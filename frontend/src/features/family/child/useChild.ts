import { useResource, type Resource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'

/** One of a child's pages, loaded for their parent and refreshed live as the
 *  child works (the `child` push carries whose page changed). */
export function useChildResource<T>(childId: string, name: string, load: () => Promise<T>): Resource<T> {
  const resource = useResource(childId ? `child-${name}:${childId}` : null, load)
  useLive(['child'], (message) => {
    if (message.student_id === childId) void resource.reload()
  })
  return resource
}
