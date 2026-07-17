<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { WORDS } from '../data/wordlist.js'
import { babafy } from '../data/babafy.js'

const ITEM_H = 58 // px, must match .slot height
const BUFFER = 16 // slots rendered on each side of the centered one

// only words that actually contain "ba" belong in the crate
const words = WORDS.filter((w) => babafy(w))
const n = words.length

const scroller = ref(null)
const feBlur = ref(null) // <feGaussianBlur> node for the motion blur
const active = ref(0)
const moving = ref(false)
const viewH = ref(0) // scroller clientHeight — drives runway + sizer

// --- virtualization ---------------------------------------------------
// rows are a uniform ITEM_H, so a word's position is pure arithmetic:
//   top(i)      = viewH/2 (top runway) + i*ITEM_H
//   centerFloat = scrollTop/ITEM_H - 0.5   (the runway makes this exact)
// we render only a window around the centered index; a single .sizer child
// supplies the full scroll height so nothing else has to exist in the DOM.
const sizerStyle = computed(() => ({ height: viewH.value + n * ITEM_H + 'px' }))
const visible = computed(() => {
  const lo = Math.max(0, active.value - BUFFER)
  const hi = Math.min(n - 1, active.value + BUFFER)
  const arr = []
  for (let i = lo; i <= hi; i++) arr.push({ i, word: words[i] })
  return arr
})

// the center lens drifts a touch toward the mouse and leans with the scroll,
// then eases back to center on inactivity
const lensShift = ref({ x: 0, y: 0 }) // mouse-driven
const lensScrollY = ref(0) // scroll-driven vertical lean
const lensStyle = computed(() => {
  const x = lensShift.value.x
  const y = lensShift.value.y + lensScrollY.value
  return { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }
})
let lensIdleTimer = null
let lastMoveX = null
let lastMoveY = null
let lastMoveT = 0
function onMouseMove(e) {
  const now = performance.now()
  // direction: lean toward the cursor's position (-1..1 from screen center)
  const dirX = (e.clientX / window.innerWidth - 0.5) * 2
  const dirY = (e.clientY / window.innerHeight - 0.5) * 2
  // strength: grows with how fast the cursor is moving
  let speed = 0 // px per ms
  if (lastMoveX !== null) {
    const dist = Math.hypot(e.clientX - lastMoveX, e.clientY - lastMoveY)
    speed = dist / Math.max(1, now - lastMoveT)
  }
  lastMoveX = e.clientX
  lastMoveY = e.clientY
  lastMoveT = now
  const BASE = 8 // px of drift for a slow move
  const VELK = 8 // extra px per (px/ms) of cursor speed
  const MAXPX = 22 // clamp for fast flicks
  const strength = Math.min(MAXPX, BASE + speed * VELK)
  lensShift.value = { x: +(dirX * strength).toFixed(1), y: +(dirY * strength).toFixed(1) }
  clearTimeout(lensIdleTimer)
  lensIdleTimer = setTimeout(() => {
    lensShift.value = { x: 0, y: 0 } // reset to start after inactivity
  }, 600)
}

const current = computed(() => babafy(words[active.value] ?? ''))

// shrink the centered word so long results still fit inside the lens
const activeFont = computed(() => {
  const len = current.value?.result.length ?? 4
  const rem = Math.min(2.7, (2.7 * 9) / Math.max(9, len))
  return `${rem.toFixed(2)}rem`
})

function slots() {
  return scroller.value ? scroller.value.querySelectorAll('.slot') : []
}

let ticking = false
let lastTop = 0
let lastT = 0
let settleTimer = null

// --- capped scrolling -------------------------------------------------
// we own the wheel input so a hard flick can't rocket thousands of px in a
// single frame. wheel deltas accumulate into targetTop; an eased loop walks
// the real scrollTop toward it, never more than MAX_STEP px per frame.
const MAX_STEP = 80 // px/frame speed cap (~4800px/s at 60fps)
const EASE = 0.22 // approach factor before the cap kicks in
let targetTop = 0
let easeRaf = null

function clampTop(v) {
  const box = scroller.value
  return Math.max(0, Math.min(box.scrollHeight - box.clientHeight, v))
}

function ease() {
  const box = scroller.value
  if (!box) {
    easeRaf = null
    return
  }
  const diff = targetTop - box.scrollTop
  if (Math.abs(diff) < 0.5) {
    box.scrollTop = targetTop
    easeRaf = null
    return
  }
  box.scrollTop += Math.max(-MAX_STEP, Math.min(MAX_STEP, diff * EASE))
  easeRaf = requestAnimationFrame(ease)
}

function startEase() {
  if (easeRaf === null) easeRaf = requestAnimationFrame(ease)
}

function onWheel(e) {
  const box = scroller.value
  if (!box) return
  e.preventDefault()
  let dy = e.deltaY
  if (e.deltaMode === 1) dy *= 16 // lines → px (Firefox mouse wheel)
  else if (e.deltaMode === 2) dy *= box.clientHeight // pages
  // if idle, resync target to where we actually are before accumulating
  if (easeRaf === null) targetTop = box.scrollTop
  targetTop = clampTop(targetTop + dy)
  startEase()
}

// touch drag + fling — mobile fires no wheel event, so we own touch too and
// funnel it through the same targetTop/ease cap. finger travel accumulates
// into targetTop; a light fling projects release velocity forward. because
// ease() is the ONLY writer of scrollTop, every input shares one speed cap.
let touchY = null
let touchVel = 0 // px/ms, smoothed
let touchT = 0
function onTouchStart(e) {
  const box = scroller.value
  if (!box) return
  targetTop = box.scrollTop // grab: cancel any residual momentum
  touchY = e.touches[0].clientY
  touchT = performance.now()
  touchVel = 0
}
function onTouchMove(e) {
  const box = scroller.value
  if (!box || touchY === null) return
  e.preventDefault()
  const y = e.touches[0].clientY
  const now = performance.now()
  const dy = touchY - y // finger up → scroll down (+)
  const dt = Math.max(1, now - touchT)
  touchVel = 0.6 * touchVel + 0.4 * (dy / dt) // EMA of finger velocity
  touchY = y
  touchT = now
  targetTop = clampTop(targetTop + dy)
  startEase()
}
function onTouchEnd() {
  if (touchY === null) return
  touchY = null
  const FLING = 130 // ms of release velocity projected forward
  const stale = performance.now() - touchT > 80 // finger paused before lift → no fling
  if (!stale) targetTop = clampTop(targetTop + touchVel * FLING)
  startEase()
}

// keyboard: arrows/page step the crate. ITEM_H steps preserve the exact
// centered offset so a tap lands dead-on the next word; the ease still caps
// how fast a held key can spin (native arrow-scroll had no cap at all).
function onKeyDown(e) {
  const box = scroller.value
  if (!box) return
  let delta = 0
  switch (e.key) {
    case 'ArrowDown': delta = ITEM_H; break
    case 'ArrowUp': delta = -ITEM_H; break
    case 'PageDown': delta = ITEM_H * 5; break
    case 'PageUp': delta = -ITEM_H * 5; break
    case 'Home': delta = -box.scrollHeight; break
    case 'End': delta = box.scrollHeight; break
    default: return
  }
  e.preventDefault()
  if (easeRaf === null) targetTop = box.scrollTop
  targetTop = clampTop(targetTop + delta)
  startEase()
}

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(paint)
}

// curve the rendered slots into a cylinder, blur by distance from the lens,
// smear vertically while spinning, and lock the centered index
function paint(now) {
  ticking = false
  const box = scroller.value
  if (!box) return
  const scrollTop = box.scrollTop

  // vertical motion blur + lens lean driven by scroll velocity
  const t = typeof now === 'number' ? now : performance.now()
  const dt = Math.max(1, t - lastT)
  const rawDelta = scrollTop - lastTop // signed: + is scrolling down
  const vel = Math.abs(rawDelta) / dt // px per ms
  lastTop = scrollTop
  lastT = t
  const smear = Math.min(16, vel * 5)
  if (feBlur.value) feBlur.value.setAttribute('stdDeviation', `0 ${smear.toFixed(2)}`)
  moving.value = smear > 0.6
  // lean the lens in the scroll direction, like a mouse nudge up/down
  lensScrollY.value = Math.max(-12, Math.min(12, +(rawDelta * 0.35).toFixed(1)))
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    if (feBlur.value) feBlur.value.setAttribute('stdDeviation', '0 0')
    moving.value = false
    lensScrollY.value = 0 // ease the lens back when scrolling stops
    snapToNearest()
  }, 110)

  // centered index straight from scrollTop — no DOM reads
  const centerFloat = scrollTop / ITEM_H - 0.5
  const ci = Math.max(0, Math.min(n - 1, Math.round(centerFloat)))
  if (ci !== active.value) active.value = ci // re-renders the window when we cross a row

  // style just the rendered window (~33 slots), keyed by their real index
  const els = slots()
  for (let k = 0; k < els.length; k++) {
    const el = els[k]
    const delta = +el.dataset.i - centerFloat // distance in item-units
    const abs = Math.abs(delta)
    if (abs > 7) {
      el.style.opacity = 0
      el.style.filter = 'none'
      continue
    }
    const rot = Math.max(-72, Math.min(72, -delta * 20))
    const opacity = Math.max(0.14, 1 - abs * 0.26)
    const scale = Math.max(0.72, 1 - abs * 0.08)
    // sharp inside the lens, blurrier the farther out
    const blur = abs < 0.5 ? 0 : Math.min(6.5, (abs - 0.4) * 1.7)
    el.style.transform = `rotateX(${rot}deg) scale(${scale})`
    el.style.opacity = opacity
    el.style.filter = blur ? `blur(${blur.toFixed(2)}px)` : 'none'
  }
}

// scrollTop that centers row k on the lens (runway makes this exact)
function topForIndex(k) {
  return k * ITEM_H + ITEM_H / 2
}

// after free-scrolling settles, glide the nearest word onto the lens.
// this replaces CSS scroll-snap (which fights the wheel in Firefox).
function snapToNearest() {
  const box = scroller.value
  if (!box) return
  const k = Math.max(0, Math.min(n - 1, Math.round(box.scrollTop / ITEM_H - 0.5)))
  const target = topForIndex(k)
  if (Math.abs(target - box.scrollTop) > 2) {
    targetTop = clampTop(target)
    startEase()
  }
}

function scrollToIndex(i, smooth = true) {
  const box = scroller.value
  if (!box) return
  i = Math.max(0, Math.min(n - 1, i))
  active.value = i // render the window around the destination first
  const top = clampTop(topForIndex(i))
  targetTop = top
  if (smooth) startEase()
  else box.scrollTop = top
}

function shuffle() {
  // jump straight there — an eased glide across the whole crate would be slow
  scrollToIndex(Math.floor(Math.random() * n), false)
}

function onResize() {
  if (!scroller.value) return
  viewH.value = scroller.value.clientHeight
  requestAnimationFrame(paint)
}

onMounted(async () => {
  await nextTick()
  viewH.value = scroller.value.clientHeight
  await nextTick() // let the sizer + slot tops apply with the real height
  lastT = performance.now()
  scrollToIndex(Math.max(0, words.indexOf('balloon')), false)
  requestAnimationFrame(paint)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('resize', onResize)
  scroller.value.addEventListener('wheel', onWheel, { passive: false })
  scroller.value.addEventListener('touchstart', onTouchStart, { passive: false })
  scroller.value.addEventListener('touchmove', onTouchMove, { passive: false })
  scroller.value.addEventListener('touchend', onTouchEnd)
  scroller.value.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('resize', onResize)
  scroller.value?.removeEventListener('wheel', onWheel)
  scroller.value?.removeEventListener('touchstart', onTouchStart)
  scroller.value?.removeEventListener('touchmove', onTouchMove)
  scroller.value?.removeEventListener('touchend', onTouchEnd)
  scroller.value?.removeEventListener('keydown', onKeyDown)
  if (easeRaf !== null) cancelAnimationFrame(easeRaf)
  clearTimeout(lensIdleTimer)
  clearTimeout(settleTimer)
})
</script>

<template>
  <section class="wheel-wrap">
    <!-- vertical motion-blur filter, modulated live from scroll velocity -->
    <svg class="defs" aria-hidden="true" width="0" height="0">
      <filter id="mblur" x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur ref="feBlur" in="SourceGraphic" stdDeviation="0 0" />
      </filter>
    </svg>

    <!-- the center lens: drifts slightly toward the mouse, eases back on idle -->
    <div class="lens" :style="lensStyle" aria-hidden="true"></div>

    <!-- motion blur lives on this wrapper, never on the scroller itself:
         toggling a filter on the scrolling element kills momentum in Firefox -->
    <div class="wheel-motion" :class="{ moving }">
      <div
        ref="scroller"
        class="wheel"
        @scroll="onScroll"
        tabindex="0"
        role="listbox"
        aria-label="Word crate"
      >
        <!-- gives the scroller its full height; the runway is baked into top(i) -->
        <div class="sizer" :style="sizerStyle" aria-hidden="true"></div>

        <div
          v-for="item in visible"
          :key="item.i"
          :data-i="item.i"
          class="slot"
          :class="{ active: item.i === active }"
          :style="{
            top: viewH / 2 + item.i * ITEM_H + 'px',
            fontSize: item.i === active ? activeFont : null,
          }"
          role="option"
          :aria-selected="item.i === active"
          @click="scrollToIndex(item.i)"
        >
          <Transition name="stut" mode="out-in">
            <span v-if="item.i === active && current" key="ba" class="babafied">
              <span class="plain">{{ current.before }}</span
              ><span class="ba matched">{{ current.matched }}</span
              ><span class="ba echo">{{ current.inserted }}</span
              ><span class="plain">{{ current.after }}</span>
            </span>
            <span v-else key="plain" class="plainword">{{ item.word }}</span>
          </Transition>
        </div>
      </div>
    </div>

    <button class="dig" @click="shuffle">dig randomly</button>
  </section>
</template>

<style scoped>
.wheel-wrap {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.defs {
  position: absolute;
  width: 0;
  height: 0;
}

.wheel-motion {
  position: absolute;
  inset: 0;
}

/* vertical smear while the crate is spinning — applied to the wrapper so the
   scroller's own momentum is never interrupted */
.wheel-motion.moving {
  filter: url(#mblur);
}

.wheel {
  position: relative;
  height: 100%;
  width: 100%;
  overflow-y: scroll;
  /* no CSS scroll-snap: Firefox re-snaps small wheel deltas back to the
     current item, which fights continuous scrolling. we free-scroll and
     center the nearest word in JS after the scroll settles (snapToNearest). */
  /* native scroll is fully owned in JS (wheel/touch/keys all feed targetTop),
     so the browser must never scroll this itself — otherwise touch + held
     arrow keys move uncapped, bypassing the MAX_STEP velocity cap. */
  touch-action: none;
  overscroll-behavior: none;
  -ms-overflow-style: none;
  scrollbar-width: none;
  perspective: 720px;
  perspective-origin: 50% 50%;
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    #000 26%,
    #000 74%,
    transparent 100%
  );
}

.wheel::-webkit-scrollbar {
  display: none;
}

/* in-flow element that supplies the full scroll height (viewH runway top &
   bottom + all rows); the virtualized slots are absolutely positioned over it */
.sizer {
  width: 100%;
}

.slot {
  position: absolute;
  left: 0;
  right: 0;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-stretch: 125%;
  font-variation-settings: 'wdth' 125;
  font-size: 1.9rem;
  line-height: 1;
  letter-spacing: -0.005em;
  color: var(--smoke-soft);
  cursor: pointer;
  transform-style: preserve-3d;
  transition: color 0.35s ease, font-size 0.25s ease;
  white-space: nowrap;
}

.slot.active {
  color: var(--smoke);
  font-size: 2.6rem;
  font-weight: 800;
  z-index: 2;
}

/* the pill "lens" that frames the centered pick */
.lens {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(88%, 460px);
  height: 3.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 1;
  pointer-events: none;
  transition: transform 0.35s ease-out;
}

.babafied {
  display: inline-flex;
  align-items: baseline;
}

.plain,
.ba.echo {
  color: var(--smoke);
}

.ba {
  border-radius: 0.12em;
}

.ba.matched {
  color: var(--marigold);
}

/* slow reveal when a word settles into / out of its stutter */
.stut-enter-active,
.stut-leave-active {
  transition: opacity 0.15s ease, filter 0.15s ease;
}

.stut-enter-from,
.stut-leave-to {
  opacity: 0;
  filter: blur(2px);
}

.dig {
  position: absolute;
  bottom: 1rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--smoke-faint);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.dig:hover {
  color: var(--smoke-soft);
}
</style>
