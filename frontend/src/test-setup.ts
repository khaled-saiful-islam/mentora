import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'motion'

// Animations finish instantly under test: jsdom paints nothing, and a test
// that waits on a spring is a test that is sometimes slow and sometimes flaky.
MotionGlobalConfig.skipAnimations = true

// jsdom has no IntersectionObserver, which scroll-into-view animations use.
// Under test everything counts as in view at once.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class InView {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback([{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  globalThis.IntersectionObserver = InView as unknown as typeof IntersectionObserver
}
