import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TeacherPanel } from './TeacherPanel'

describe("the teacher's view of who is in the room", () => {
  it('tells a student who left apart from one who dropped out', () => {
    Element.prototype.scrollTo ??= () => undefined
    render(
      <TeacherPanel
        id="l1"
        hands={[]}
        said={[]}
        roster={[
          { id: 'a', name: 'Aina', buddy: null, here: true },
          { id: 'b', name: 'Hafiz', buddy: null, here: false, left: true },
          { id: 'c', name: 'Mei', buddy: null, here: false },
        ]}
      />,
    )
    expect(screen.getByText('In the room · 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Hafiz').parentElement).toHaveTextContent('left the lesson')
    expect(screen.getByText('Mei').parentElement).toHaveTextContent('away')
  })
})
