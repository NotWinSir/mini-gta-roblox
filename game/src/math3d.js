// Minimal 4x4 matrix and vector helpers for the WebGL2 renderer, column-major like WebGL.
// Only what the game needs: perspective, lookAt, multiply, translation/rotation/scale
// composition, and projecting a world point back to screen pixels for HUD labels.

export function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function mat4Perspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function vec3Sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function vec3Normalize(a) {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function mat4LookAt(eye, target, up) {
  const zAxis = vec3Normalize(vec3Sub(eye, target));
  const xAxis = vec3Normalize(vec3Cross(up, zAxis));
  const yAxis = vec3Cross(zAxis, xAxis);
  const out = new Float32Array(16);
  out[0] = xAxis[0]; out[1] = yAxis[0]; out[2] = zAxis[0];
  out[4] = xAxis[1]; out[5] = yAxis[1]; out[6] = zAxis[1];
  out[8] = xAxis[2]; out[9] = yAxis[2]; out[10] = zAxis[2];
  out[12] = -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]);
  out[13] = -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]);
  out[14] = -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]);
  out[15] = 1;
  return out;
}

/** Compose a model matrix from translation, Y rotation (degrees) and scale. */
export function mat4Compose(px, py, pz, rotYDeg = 0, sx = 1, sy = 1, sz = 1) {
  const rad = (rotYDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const out = new Float32Array(16);
  out[0] = c * sx; out[2] = -s * sx;
  out[5] = sy;
  out[8] = s * sz; out[10] = c * sz;
  out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
  return out;
}

/** Rotations about the X and Y axes (degrees), for wheel spin and placement. */
export function mat4RotX(deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const out = mat4Identity();
  out[5] = c; out[6] = s;
  out[9] = -s; out[10] = c;
  return out;
}

export function mat4RotY(deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const out = mat4Identity();
  out[0] = c; out[2] = -s;
  out[8] = s; out[10] = c;
  return out;
}

/** A rotation about the Z axis (degrees), for spinning wheels. */
export function mat4RotZ(deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const out = mat4Identity();
  out[0] = c; out[1] = s;
  out[4] = -s; out[5] = c;
  return out;
}

export function mat4Translate(px, py, pz) {
  const out = mat4Identity();
  out[12] = px; out[13] = py; out[14] = pz;
  return out;
}

/** Project a world point through a view-projection matrix to screen pixels; null when behind. */
export function projectPoint(vp, x, y, z, width, height) {
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (cw <= 0.01) return null;
  const nx = cx / cw;
  const ny = cy / cw;
  if (nx < -1.1 || nx > 1.1 || ny < -1.1 || ny > 1.1) return null;
  return { x: ((nx + 1) / 2) * width, y: ((1 - ny) / 2) * height };
}
