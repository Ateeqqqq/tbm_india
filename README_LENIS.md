# The Buzz Media - Premium Lenis Scroll

Lenis is wired globally in `src/siteEffects.js` and runs from one requestAnimationFrame loop outside React renders.

Current feel:
- duration: 1.7s
- smoothWheel: true
- wheelMultiplier: 0.8
- touchMultiplier: 1
- anchors: true
- custom easing: `1 - Math.pow(1 - t, 4)`

Tuning:
- Heavier: raise `duration` toward 1.8-1.9 and/or lower `wheelMultiplier` toward 0.7.
- Lighter: lower `duration` toward 1.3-1.5 and/or raise `wheelMultiplier` toward 0.9-1.0.
- Faster: lower `duration`.
- More responsive: raise `wheelMultiplier` slightly and lower `duration`.

Mobile touch remains native-friendly because Lenis is not forcing `syncTouch` inertia. `touchMultiplier` is kept at 1.
