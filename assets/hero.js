import {Flock} from './simulation.js';
import {webglFlockRenderer, canvasFlockRenderer} from './renderer.js';
import {measureLetters} from './letter-field.js';

const layer = document.querySelector('.flock-background');
const gpu = layer.querySelector('#flock-gpu');
const cpu = layer.querySelector('#flock-cpu');
const media = matchMedia('(prefers-reduced-motion: reduce)');
const labels = document.querySelectorAll('[data-flock-text], header a, .jam h2, .jam h2 + p, .guide h2, .requirements, li, summary, details p, footer .brand, footer p');
const artwork = document.querySelector('.artwork');
const jam = document.querySelector('#jam');
let renderer = webglFlockRenderer(gpu);
function fallback() {
  renderer?.dispose();
  gpu.hidden = true;
  cpu.hidden = false;
  renderer = canvasFlockRenderer(cpu);
}
if (!renderer) fallback();
let flock, frame = 0, last = 0, remainder = 0, dirty = true;
let scrollTop = window.scrollY, textFields = [], visibleFields = [];

function scrolled() {
  scrollTop = window.scrollY;
  visibleFields = textFields.filter(box => box.bottom >= scrollTop && box.top <= scrollTop + innerHeight);
  const blend = Math.min(1, Math.max(0, (.68 * innerHeight - jam.getBoundingClientRect().top) / (.6 * innerHeight)));
  artwork.style.setProperty('--warbler', media.matches ? Math.round(blend) : blend);
  schedule();
}

// Cache letter contours in document coordinates. Scrolling moves the sampling
// origin without rebuilding masks or resetting the moving flock.
const pageLetters = {
  near(x, y) {
    const pageY = y + scrollTop;
    for (const box of visibleFields) {
      if (x < box.left || x >= box.right || pageY < box.top || pageY >= box.bottom) continue;
      const hit = box.field.near(x - box.left, pageY - box.top);
      if (hit) return hit;
    }
    return null;
  }
};

function layout() {
  const {width, height} = layer.getBoundingClientRect();
  if (!width || !height) return;
  if (!flock || flock.width !== width || flock.height !== height) {
    flock = new Flock(width, height);
    flock.field = pageLetters;
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    for (const canvas of [gpu, cpu]) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
    }
  }
  textFields = [];
  for (const label of labels) {
    const rect = label.getBoundingClientRect();
    if (!rect.width || !rect.height || (label.closest('details:not([open])') && !label.matches('summary'))) continue;
    textFields.push({left: rect.left, right: rect.right, top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY, field: measureLetters(label, [label])});
  }
  dirty = false;
  scrolled();
}

function draw(time) {
  frame = 0;
  if (dirty) layout();
  if (!flock || !renderer) return;
  if (!media.matches) {
    remainder += last ? Math.min(.05, (time - last) / 1000) : 0;
    while (remainder >= 1/60) { flock.step(1/60); remainder -= 1/60; }
  }
  renderer.draw(flock);
  last = time;
  layer.dataset.motion = media.matches ? 'still' : 'running';
  if (!media.matches) schedule();
}

function schedule() {
  if (!frame && !document.hidden && renderer) frame = requestAnimationFrame(draw);
}
function restart() {
  cancelAnimationFrame(frame); frame = 0; last = 0; remainder = 0;
  layer.dataset.motion = 'still';
  scrolled();
}
function resized() { dirty = true; schedule(); }
const sizes = new ResizeObserver(resized);
sizes.observe(layer); sizes.observe(document.body);
for (const label of labels) sizes.observe(label);
document.addEventListener('scroll', scrolled, {passive:true});
document.querySelector('details').addEventListener('toggle', resized);
gpu.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); restart(); });
media.addEventListener('change', restart);
document.addEventListener('visibilitychange', restart);
document.fonts.ready.then(resized);
window.addEventListener('pageshow', restart);
window.addEventListener('pagehide', () => {cancelAnimationFrame(frame); frame = 0;});
scrolled();
