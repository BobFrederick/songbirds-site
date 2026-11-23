const favorite = document.querySelector('.favorite');
favorite.disabled = false;
favorite.addEventListener('click', () => {
  const selected = favorite.getAttribute('aria-pressed') !== 'true';
  favorite.setAttribute('aria-pressed', String(selected));
  favorite.querySelector('.favorite-count').textContent = selected ? '1' : '0';
});

const reaction = document.querySelector('.fire');
const count = reaction.querySelector('.reaction-count');
reaction.disabled = false;
reaction.addEventListener('click', () => {
  const selected = reaction.getAttribute('aria-pressed') !== 'true';
  reaction.setAttribute('aria-pressed', String(selected));
  count.textContent = selected ? '2' : '1';
  reaction.setAttribute('aria-label', selected ? 'Fire reaction, 2 reactions' : 'Fire reaction, 1 reaction');
});

const rooms = document.querySelector('.rooms');
const listToggle = document.querySelector('.list-toggle');
const listForm = document.querySelector('#list-form');
const roomName = document.querySelector('#room-name');
const lobbyStatus = document.querySelector('.lobby-status');
let joinedRoom = null;
let hostedRoom = null;

function setJoined(room) {
  if (joinedRoom) joinedRoom.querySelector('button').textContent = 'Join';
  joinedRoom = room;
  if (room) room.querySelector('button').textContent = 'Leave';
}

for (const button of rooms.querySelectorAll('button')) button.hidden = false;
rooms.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const room = button.closest('.room');
  const name = room.querySelector('.room-name').textContent;
  if (room === hostedRoom) {
    hostedRoom.remove();
    hostedRoom = null;
    for (const action of rooms.querySelectorAll('button')) action.disabled = false;
    listToggle.hidden = false;
    listToggle.focus();
    lobbyStatus.textContent = 'Your listing has ended.';
  } else {
    setJoined(room === joinedRoom ? null : room);
    lobbyStatus.textContent = joinedRoom ? `You joined ${name} in the preview.` : `You left ${name}.`;
  }
});

listToggle.hidden = false;
function showForm(show) {
  listForm.hidden = !show;
  listToggle.setAttribute('aria-expanded', String(show));
  listToggle.textContent = show ? 'Cancel' : 'List your Jam';
  if (show) roomName.focus();
}
listToggle.addEventListener('click', () => showForm(listForm.hidden));
roomName.addEventListener('input', () => roomName.setCustomValidity(''));
listForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = roomName.value.trim();
  if (!name) {
    roomName.setCustomValidity('Enter a name for your Jam.');
    roomName.reportValidity();
    return;
  }
  setJoined(null);
  hostedRoom = rooms.firstElementChild.cloneNode(true);
  hostedRoom.setAttribute('aria-label', name);
  hostedRoom.querySelector('.room-name').textContent = name;
  hostedRoom.querySelector('small').textContent = 'Hosted by you';
  hostedRoom.querySelector('p').textContent = 'Waiting for your first track';
  const endListing = hostedRoom.querySelector('button');
  endListing.textContent = 'End listing';
  for (const action of rooms.querySelectorAll('button')) action.disabled = true;
  rooms.prepend(hostedRoom);
  listForm.reset();
  showForm(false);
  listToggle.hidden = true;
  endListing.focus();
  lobbyStatus.textContent = `${name} is listed in this preview.`;
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
