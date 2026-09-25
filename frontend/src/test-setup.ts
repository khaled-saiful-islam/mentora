import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'motion'

// Animations finish instantly under test: jsdom paints nothing, and a test
// that waits on a spring is a test that is sometimes slow and sometimes flaky.
MotionGlobalConfig.skipAnimations = true
