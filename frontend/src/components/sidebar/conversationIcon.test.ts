import { ChatCircleText, Cards, ChalkboardTeacher, Exam, BookOpenText } from '@phosphor-icons/react'
import { describe, expect, it } from 'vitest'
import { iconForConversation } from './conversationIcon'

describe('a chat in the list', () => {
  it.each([
    ['Make me a quiz on fractions', Exam],
    ['Flashcards for planets', Cards],
    ['A study guide on rain', BookOpenText],
    ['Plan a fractions lesson', ChalkboardTeacher],
    ['Hello there', ChatCircleText],
  ])('"%s" gets its icon', (title, Icon) => {
    expect(iconForConversation(title).Icon).toBe(Icon)
  })
})
