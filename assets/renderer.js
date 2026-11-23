import { MAX_BOIDS } from "./simulation.js";
const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 state;
layout(location=2) in float variation;
uniform vec2 viewport;
out vec2 local;
out float brightness;
void main(){
  float speed=length(state.zw);
  vec2 direction=state.zw/max(speed,0.001);
  vec2 normal=vec2(-direction.y,direction.x);
  float velocity=clamp((speed-24.0)/58.0,0.0,1.0);
  float stroke=mix(4.0,10.5,velocity)+variation*1.5;
  vec2 pixel=state.xy+direction*corner.x*stroke*0.5+normal*corner.y*0.7;
  gl_Position=vec4(pixel/viewport*vec2(2.0,-2.0)+vec2(-1.0,1.0),0.0,1.0);
  local=corner;
  brightness=0.32+velocity*0.34+variation*0.12;
}`;
const fragment = `#version 300 es
precision highp float;
in vec2 local;
in float brightness;
out vec4 color;
void main(){
  float edge=1.0-smoothstep(0.25,1.0,abs(local.y));
  float tip=1.0-smoothstep(0.78,1.0,abs(local.x));
  color=vec4(vec3(0.82),edge*tip*brightness);
}`;
export function webglFlockRenderer(canvas) {
	let gl = null;
	let program = null, geometry = null, instances = null, vao = null;
	const shaders = [];
	function dispose() {
		if (!gl) return;
		if (geometry) gl.deleteBuffer(geometry);
		if (instances) gl.deleteBuffer(instances);
		if (vao) gl.deleteVertexArray(vao);
		if (program) gl.deleteProgram(program);
		for (const shader of shaders) gl.deleteShader(shader);
	}
	try {
		gl = canvas.getContext("webgl2", {
			alpha: false,
			antialias: true,
			powerPreference: "low-power"
		});
		if (!gl || gl.isContextLost()) return null;
		function compile(type, source) {
			const shader = gl.createShader(type);
			if (!shader) throw Error("No shader");
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error("No shader support");
			return shader;
		}
		const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
		program = gl.createProgram();
		if (!program) throw Error("No program");
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error("No instancing support");
		vao = gl.createVertexArray();
		geometry = gl.createBuffer();
		instances = gl.createBuffer();
		if (!vao || !geometry || !instances) throw Error("No buffers");
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1,
			-1,
			1,
			-1,
			-1,
			1,
			1,
			1
		]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, instances);
		gl.bufferData(gl.ARRAY_BUFFER, MAX_BOIDS * 5 * 4, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 20, 0);
		gl.vertexAttribDivisor(1, 1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
		gl.vertexAttribDivisor(2, 1);
		const viewport = gl.getUniformLocation(program, "viewport");
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.clearColor(0, 0, 0, 1);
		return {
			dispose,
			draw(flock) {
				gl.viewport(0, 0, canvas.width, canvas.height);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.useProgram(program);
				gl.bindVertexArray(vao);
				gl.uniform2f(viewport, flock.width, flock.height);
				gl.bindBuffer(gl.ARRAY_BUFFER, instances);
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, flock.pack());
				gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, flock.count);
			}
		};
	} catch {
		dispose();
		return null;
	}
}
export function canvasFlockRenderer(canvas) {
	const context = canvas.getContext("2d", { alpha: false });
	if (!context) return null;
	return {
		dispose() {},
		draw(flock) {
			context.setTransform(canvas.width / flock.width, 0, 0, canvas.height / flock.height, 0, 0);
			context.fillStyle = "#000";
			context.fillRect(0, 0, flock.width, flock.height);
			context.lineWidth = .85;
			context.lineCap = "round";
			// Four batches preserve speed variation without 1,200 individual stroke calls.
			for (let band = 0; band < 4; band++) {
				context.strokeStyle = `rgba(209,209,209,${.32 + band * .12})`;
				context.beginPath();
				for (let i = 0; i < flock.count; i++) {
					const speed = Math.hypot(flock.vx[i], flock.vy[i]), velocity = Math.max(0, Math.min(1, (speed - 24) / 58));
					if (Math.min(3, Math.floor(velocity * 4)) !== band) continue;
					const half = (4 + velocity * 6.5 + flock.variation[i] * 1.5) / 2, dx = flock.vx[i] / speed * half, dy = flock.vy[i] / speed * half;
					context.moveTo(flock.x[i] - dx, flock.y[i] - dy);
					context.lineTo(flock.x[i] + dx, flock.y[i] + dy);
				}
				context.stroke();
			}
		}
	};
}
