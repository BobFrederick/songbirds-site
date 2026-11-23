// Original 2D flock simulation. Positions are CSS pixels; no camera or scene objects.
export const MAX_BOIDS = 1200;
const CELL = 48;
const NEIGHBOR_BUDGET = 96;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function flockPopulation(width, height) {
	return clamp(Math.round(width * height / 1100), 160, MAX_BOIDS);
}
export class Flock {
	width;
	height;
	count;
	x;
	y;
	vx;
	vy;
	variation;
	instances;
	ax;
	ay;
	next;
	head;
	columns;
	rows;
	field = null;
	time = 0;
	neighborChecks = 0;
	constructor(width, height, count = flockPopulation(width, height), random = Math.random) {
		this.width = width;
		this.height = height;
		this.count = clamp(Math.floor(count), 1, MAX_BOIDS);
		this.columns = Math.max(1, Math.ceil(width / CELL));
		this.rows = Math.max(1, Math.ceil(height / CELL));
		this.head = new Int32Array(this.columns * this.rows);
		this.next = new Int32Array(this.count);
		this.x = new Float32Array(this.count);
		this.y = new Float32Array(this.count);
		this.vx = new Float32Array(this.count);
		this.vy = new Float32Array(this.count);
		this.ax = new Float32Array(this.count);
		this.ay = new Float32Array(this.count);
		this.variation = new Float32Array(this.count);
		this.instances = new Float32Array(this.count * 5);
		for (let i = 0; i < this.count; i++) {
			const x = this.x[i] = random() * width, y = this.y[i] = random() * height;
			this.variation[i] = random();
			const angle = Math.atan2(Math.sin(x * .009) + .2, Math.cos(y * .007) + .35) + (random() - .5) * .5;
			const speed = 32 + this.variation[i] * 28;
			this.vx[i] = Math.cos(angle) * speed;
			this.vy[i] = Math.sin(angle) * speed;
		}
	}
	step(seconds) {
		const dt = clamp(seconds, 0, 1 / 30);
		if (!dt) return;
		this.time += dt;
		this.neighborChecks = 0;
		this.head.fill(-1);
		for (let i = 0; i < this.count; i++) {
			const cx = clamp(Math.floor(this.x[i] / CELL), 0, this.columns - 1), cy = clamp(Math.floor(this.y[i] / CELL), 0, this.rows - 1);
			const cell = cy * this.columns + cx;
			this.next[i] = this.head[cell];
			this.head[cell] = i;
		}
		// Read the entire old state before integrating, so results don't depend on update order.
		for (let i = 0; i < this.count; i++) {
			const x = this.x[i], y = this.y[i], vx = this.vx[i], vy = this.vy[i];
			const cx = clamp(Math.floor(x / CELL), 0, this.columns - 1), cy = clamp(Math.floor(y / CELL), 0, this.rows - 1);
			let neighbors = 0, checks = 0, alignX = 0, alignY = 0, cohesionX = 0, cohesionY = 0, separateX = 0, separateY = 0;
			search: for (let gy = Math.max(0, cy - 1); gy <= Math.min(this.rows - 1, cy + 1); gy++) {
				for (let gx = Math.max(0, cx - 1); gx <= Math.min(this.columns - 1, cx + 1); gx++) {
					for (let other = this.head[gy * this.columns + gx]; other !== -1; other = this.next[other]) {
						if (other === i) continue;
						if (checks++ >= NEIGHBOR_BUDGET) break search;
						const dx = this.x[other] - x, dy = this.y[other] - y, d2 = dx * dx + dy * dy;
						if (d2 >= CELL * CELL || d2 < .001) continue;
						neighbors++;
						alignX += this.vx[other];
						alignY += this.vy[other];
						cohesionX += dx;
						cohesionY += dy;
						if (d2 < 16 * 16) {
							const distance = Math.sqrt(d2), weight = (1 - distance / 16) / distance;
							separateX -= dx * weight;
							separateY -= dy * weight;
						}
					}
				}
			}
			this.neighborChecks += Math.min(checks, NEIGHBOR_BUDGET);
			const phase = this.variation[i] * Math.PI * 2;
			const wander = Math.sin(this.time * .65 + phase) * 9;
			const speed = Math.max(1, Math.hypot(vx, vy));
			let ax = -vy / speed * wander, ay = vx / speed * wander;
			if (neighbors) {
				ax += (alignX / neighbors - vx) * 1.25 + cohesionX / neighbors * .24 + separateX * 85;
				ay += (alignY / neighbors - vy) * 1.25 + cohesionY / neighbors * .24 + separateY * 85;
			}
			// Steer only within a few pixels of a painted letter stroke.
			const away = this.field?.near(x + vx * .1, y + vy * .1);
			if (away) {
				const normalSpeed = vx * away.x + vy * away.y;
				const strength = Math.max(0, 1 - away.distance / 10);
				ax += away.x * strength * (90 + Math.max(0, -normalSpeed) * 3);
				ay += away.y * strength * (90 + Math.max(0, -normalSpeed) * 3);
			}
			const force = Math.hypot(ax, ay), scale = force > 125 ? 125 / force : 1;
			this.ax[i] = ax * scale;
			this.ay[i] = ay * scale;
		}
		for (let i = 0; i < this.count; i++) {
			let vx = this.vx[i] + this.ax[i] * dt, vy = this.vy[i] + this.ay[i] * dt;
			const speed = Math.max(.001, Math.hypot(vx, vy)), limited = clamp(speed, 24, 60 + this.variation[i] * 22);
			vx *= limited / speed;
			vy *= limited / speed;
			this.vx[i] = vx;
			this.vy[i] = vy;
			this.x[i] += vx * dt;
			this.y[i] += vy * dt;
			// Offscreen wrap leaves a fixed orthographic view and no visible wall bounces.
			if (this.x[i] < -14) this.x[i] = this.width + 14;
			else if (this.x[i] > this.width + 14) this.x[i] = -14;
			if (this.y[i] < -14) this.y[i] = this.height + 14;
			else if (this.y[i] > this.height + 14) this.y[i] = -14;
			const contact = this.field?.near(this.x[i], this.y[i]);
			if (contact && contact.distance < 2.5) {
				this.x[i] += contact.x * (2.5 - contact.distance);
				this.y[i] += contact.y * (2.5 - contact.distance);
				const inward = Math.min(0, this.vx[i] * contact.x + this.vy[i] * contact.y);
				this.vx[i] -= contact.x * inward;
				this.vy[i] -= contact.y * inward;
			}
		}
	}
	pack() {
		for (let i = 0; i < this.count; i++) {
			const offset = i * 5;
			this.instances[offset] = this.x[i];
			this.instances[offset + 1] = this.y[i];
			this.instances[offset + 2] = this.vx[i];
			this.instances[offset + 3] = this.vy[i];
			this.instances[offset + 4] = this.variation[i];
		}
		return this.instances;
	}
}
