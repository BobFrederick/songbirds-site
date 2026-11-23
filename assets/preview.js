const reaction = document.querySelector('.reaction-pill');
const count = reaction.querySelector('.reaction-count');
reaction.disabled = false;
reaction.addEventListener('click', () => {
  const selected = reaction.getAttribute('aria-pressed') !== 'true';
  reaction.setAttribute('aria-pressed', String(selected));
  count.textContent = selected ? '2' : '1';
  reaction.setAttribute('aria-label', selected ? 'Fire reaction, 2 reactions' : 'Fire reaction, 1 reaction');
});

const faces = document.querySelectorAll('.field-face');
const canTrack = matchMedia('(any-pointer: fine) and (prefers-reduced-motion: no-preference)');
let pointer, frame = 0;
function look() {
  frame = 0;
  for (const face of faces) {
    const rect = face.getBoundingClientRect();
    const dx = pointer ? pointer.x - (rect.left + rect.width / 2) : 0;
    const dy = pointer ? pointer.y - (rect.top + rect.height / 2) : 0;
    const distance = Math.max(72, Math.hypot(dx, dy));
    face.style.setProperty('--look-x', (24 * dx / distance) + 'px');
    face.style.setProperty('--look-y', (21 * dy / distance) + 'px');
  }
}
function scheduleLook() { if (!frame) frame = requestAnimationFrame(look); }
function reset() { pointer = null; scheduleLook(); }
document.addEventListener('pointermove', event => {
  if (!canTrack.matches || event.pointerType === 'touch') return;
  pointer = {x: event.clientX, y: event.clientY};
  scheduleLook();
}, {passive:true});
document.addEventListener('scroll', () => { if (pointer) scheduleLook(); }, {passive:true});
document.documentElement.addEventListener('pointerleave', reset);
window.addEventListener('blur', reset);
canTrack.addEventListener('change', reset);
