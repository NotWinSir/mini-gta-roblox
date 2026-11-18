// Raw WebGL2 plumbing: two hand-written shader programs, a geometry builder and mesh upload.
//
// LIT  — the world shader: per-vertex colour or a facade/ground texture, one directional
//        "sun" light plus ambient, sunset fog by view depth, an optional uniform colour
//        override so one unit box can become any blocky prop.
// FLAT — unlit colour (vertex or uniform), used for the sky, the sun disc, lightbars,
//        headlights, blob shadows, the mission beam and its ring.

const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec3 aColor;
layout(location=3) in vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uOverride;
uniform float uUseOverride;
out vec3 vColor;
out vec3 vNorm;
out vec2 vUv;
out float vViewZ;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 view = uView * world;
  vNorm = mat3(uModel) * aNorm;
  vColor = uUseOverride > 0.5 ? uOverride : aColor;
  vUv = aUv;
  vViewZ = -view.z;
  gl_Position = uProj * view;
}`;

const LIT_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform float uUseTex;
uniform vec3 uLightDir;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
in vec3 vColor;
in vec3 vNorm;
in vec2 vUv;
in float vViewZ;
out vec4 fragColor;
void main() {
  vec3 base = uUseTex > 0.5 ? texture(uTex, vUv).rgb : vColor;
  float diff = max(dot(normalize(vNorm), normalize(uLightDir)), 0.0);
  vec3 col = base * (0.48 + 0.58 * diff);
  float f = smoothstep(uFogRange.x, uFogRange.y, vViewZ);
  fragColor = vec4(mix(col, uFogColor, f), 1.0);
}`;

const FLAT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec3 aColor;
uniform mat4 uMvp;
uniform vec4 uColor;
uniform float uUseUniform;
out vec4 vColor;
void main() {
  vColor = uUseUniform > 0.5 ? uColor : vec4(aColor, 1.0);
  gl_Position = uMvp * vec4(aPos, 1.0);
}`;

const FLAT_FS = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 fragColor;
void main() {
  fragColor = vColor;
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function program(gl, vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(prog)}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(prog, i);
    uniforms[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, uniforms };
}

export function createPrograms(gl) {
  return {
    lit: program(gl, LIT_VS, LIT_FS),
    flat: program(gl, FLAT_VS, FLAT_FS),
  };
}

/** Accumulates interleaved position/normal/colour/uv vertices plus indices. */
export class GeometryBuilder {
  constructor() {
    this.vertices = [];
    this.indices = [];
  }

  vertex(x, y, z, nx, ny, nz, color, u = 0, v = 0) {
    this.vertices.push(x, y, z, nx, ny, nz, color[0] / 255, color[1] / 255, color[2] / 255, u, v);
    return this.vertices.length / 11 - 1;
  }

  quad(a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  }

  /** A box from its min corner, sized (w, h, d); uvMode 'facade' maps each side to the full texture. */
  box(x, y, z, w, h, d, color, uvMode = 'none') {
    const x1 = x + w;
    const y1 = y + h;
    const z1 = z + d;
    const uv = uvMode === 'facade' ? [0, 0, 1, 0, 1, 1, 0, 1] : [0, 0, 0, 0, 0, 0, 0, 0];
    const face = (normal, corners) => {
      const ids = corners.map((corner, i) => this.vertex(corner[0], corner[1], corner[2], normal[0], normal[1], normal[2], color, uv[i * 2], uv[i * 2 + 1]));
      this.quad(ids[0], ids[1], ids[2], ids[3]);
    };
    face([0, 0, -1], [[x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z]]);
    face([0, 0, 1], [[x1, y, z1], [x, y, z1], [x, y1, z1], [x1, y1, z1]]);
    face([-1, 0, 0], [[x, y, z1], [x, y, z], [x, y1, z], [x, y1, z1]]);
    face([1, 0, 0], [[x1, y, z], [x1, y, z1], [x1, y1, z1], [x1, y1, z]]);
    face([0, 1, 0], [[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]]);
    face([0, -1, 0], [[x, y, z1], [x1, y, z1], [x1, y, z], [x, y, z]]);
  }

  /** A flat quad in the XZ plane (ground, fronds), optionally textured across its extent. */
  planeXZ(x, y, z, w, d, color, textured = false) {
    const uv = textured ? [0, 0, 1, 0, 1, 1, 0, 1] : [0, 0, 0, 0, 0, 0, 0, 0];
    const a = this.vertex(x, y, z, 0, 1, 0, color, uv[0], uv[1]);
    const b = this.vertex(x + w, y, z, 0, 1, 0, color, uv[2], uv[3]);
    const c = this.vertex(x + w, y, z + d, 0, 1, 0, color, uv[4], uv[5]);
    const d2 = this.vertex(x, y, z + d, 0, 1, 0, color, uv[6], uv[7]);
    // Wound so the geometric normal points up (+y): visible from above with culling on.
    this.quad(a, d2, c, b);
  }

  /** A vertical double-sided quad (palm fronds), centred at (x, y, z), rotated around Y. */
  frond(x, y, z, len, drop, angleDeg, color) {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dz = Math.sin(rad);
    const tipX = x + dx * len;
    const tipZ = z + dz * len;
    const a = this.vertex(x, y, z, 0, 1, 0, color);
    const b = this.vertex(tipX, y - drop, tipZ, 0, 1, 0, color);
    const c = this.vertex(tipX, y - drop - 3, tipZ, 0, 1, 0, color);
    const d = this.vertex(x, y - 3, z, 0, 1, 0, color);
    this.quad(a, b, c, d);
    this.quad(b, a, d, c);
  }

  /** A cylinder along Y, centred at (x, y, z). */
  cylinder(x, y, z, radius, height, segments, color) {
    const base = [];
    const top = [];
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      base.push(this.vertex(x + nx * radius, y, z + nz * radius, nx, 0, nz, color));
      top.push(this.vertex(x + nx * radius, y + height, z + nz * radius, nx, 0, nz, color));
    }
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % segments;
      this.quad(base[i], base[j], top[j], top[i]);
    }
  }

  /** A flat ring in the XZ plane (mission marker ground ring). */
  ring(x, y, z, inner, outer, segments, color) {
    const ringA = [];
    const ringB = [];
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ringA.push(this.vertex(x + ca * inner, y, z + sa * inner, 0, 1, 0, color));
      ringB.push(this.vertex(x + ca * outer, y, z + sa * outer, 0, 1, 0, color));
    }
    for (let i = 0; i < segments; i += 1) {
      this.quad(ringA[i], ringB[i], ringB[i + 1], ringA[i + 1]);
      this.quad(ringB[i], ringA[i], ringA[i + 1], ringB[i + 1]);
    }
  }

  /** A flat disc in the XZ plane (blob shadows, the sun). */
  disc(x, y, z, radius, segments, color) {
    const centre = this.vertex(x, y, z, 0, 1, 0, color);
    const rim = [];
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      rim.push(this.vertex(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius, 0, 1, 0, color));
    }
    for (let i = 0; i < segments; i += 1) {
      this.indices.push(centre, rim[i], rim[i + 1]);
      this.indices.push(centre, rim[i + 1], rim[i]);
    }
  }
}

/** Upload a GeometryBuilder to a VAO; stride is 11 floats: pos, normal, colour, uv. */
export function uploadMesh(gl, builder) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.vertices), gl.STATIC_DRAW);
  const stride = 11 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 6 * 4);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 9 * 4);
  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.indices), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: builder.indices.length };
}

/** A texture from a canvas, mipmapped (WebGL2 handles the non-power-of-two sizes fine). */
export function uploadTexture(gl, canvas) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/** A unit box centred on the origin (scaled per draw), white so overrides and colours show true. */
export function unitBox(gl) {
  const b = new GeometryBuilder();
  b.box(-0.5, -0.5, -0.5, 1, 1, 1, [255, 255, 255]);
  return uploadMesh(gl, b);
}

/** A unit disc in the XZ plane, radius 1, white. */
export function unitDisc(gl) {
  const b = new GeometryBuilder();
  b.disc(0, 0, 0, 1, 20, [255, 255, 255]);
  return uploadMesh(gl, b);
}

/** A unit cylinder along Y (radius 0.5, height 1, centred), white — the wheel/trunk shape. */
export function unitCylinder(gl) {
  const b = new GeometryBuilder();
  b.cylinder(0, -0.5, 0, 0.5, 1, 14, [255, 255, 255]);
  return uploadMesh(gl, b);
}
