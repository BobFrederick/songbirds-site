import {Flock} from './simulation.js';
import {webglFlockRenderer, canvasFlockRenderer} from './renderer.js';
import {measureLetters} from './letter-field.js';

const hero = document.querySelector('.hero');
const layer = hero.querySelector('.flock-background');
const gpu = layer.querySelector('#flock-gpu');
const cpu = layer.querySelector('#flock-cpu');
const media = matchMedia('(prefers-reduced-motion: reduce)');
const labels = hero.querySelectorAll('[data-flock-text]');
let renderer = webglFlockRenderer(gpu);
function fallback() {
  renderer?.dispose();
  gpu.hidden = true;
  cpu.hidden = false;
  renderer = canvasFlockRenderer(cpu);
}
if (!renderer) fallback();
let flock, frame = 0, last = 0, remainder = 0, visible = true, dirty = true;

function layout() {
  const {width, height} = layer.getBoundingClientRect();
  if (!width || !height) return;
  if (!flock || flock.width !== width || flock.height !== height) flock = new Flock(width, height);
  const scale = Math.min(devicePixelRatio || 1, 1.5);
  for (const canvas of [gpu, cpu]) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  }
  flock.field = measureLetters(layer, labels);
  flock.step(1/60);
  dirty = false;
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
  if (!frame && visible && !document.hidden && renderer) frame = requestAnimationFrame(draw);
}
function restart() {
  cancelAnimationFrame(frame); frame = 0; last = 0; remainder = 0;
  layer.dataset.motion = 'still';
  schedule();
}
function resized() { dirty = true; schedule(); }
const sizes = new ResizeObserver(resized);
sizes.observe(hero);
for (const label of labels) sizes.observe(label);
new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; restart();}).observe(layer);
gpu.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); restart(); });
media.addEventListener('change', restart);
document.addEventListener('visibilitychange', restart);
document.fonts.ready.then(resized);
window.addEventListener('pageshow', restart);
window.addEventListener('pagehide', () => {cancelAnimationFrame(frame); frame = 0;});
schedule();
