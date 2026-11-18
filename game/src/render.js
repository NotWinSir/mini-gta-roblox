// The WebGL2 scene renderer: a sunset city in raw WebGL2 — gradient sky and a low sun,
// fog, a painted ground plane, textured block towers, palms, blocky cars with spinning
// wheels and flashing police lightbars, box pedestrians, blob shadows and the floating
// mission marker. The camera is a smoothed third-person chase camera behind the car.
// Nothing here changes the simulation; draw() only reads state and returns where the
// mission marker landed on screen, so the HUD can label it.
import {
  BRICK_PALETTE, CARS, FOG_COLOR, FOG_FAR, FOG_NEAR, POLICE_COLOR, SKY_HORIZON, SKY_TOP,
  SUN_DIR, VIEW, WORLD_H, WORLD_W,
} from './config.js';
import { GeometryBuilder, createPrograms, unitBox, unitCylinder, unitDisc, uploadMesh, uploadTexture } from './glx.js';
import {
  mat4Compose, mat4Identity, mat4LookAt, mat4Multiply, mat4Perspective, mat4RotX, mat4RotY,
  mat4Translate, projectPoint, vec3Normalize,
} from './math3d.js';
import { createRandom } from './rng.js';
import { buildBuildingsGeometry, buildPalmsGeometry, buildRoofsGeometry, makeFacadeCanvas, makeGroundCanvas } from './city.js';

const GLASS = [130, 190, 225];
const TYRE = [25, 25, 30];
const LEGS = [40, 40, 48];

function scaleMatrix(sx, sy, sz) {
  const out = mat4Identity();
  out[0] = sx;
  out[5] = sy;
  out[10] = sz;
  return out;
}

/** base * translate * scale — the model matrix of a unit box part. */
function partMatrix(base, tx, ty, tz, sx, sy, sz) {
  return mat4Multiply(base, mat4Multiply(mat4Translate(tx, ty, tz), scaleMatrix(sx, sy, sz)));
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) return null;
  const { lit, flat } = createPrograms(gl);

  const facadeRng = createRandom(20261118);
  const groundTex = uploadTexture(gl, makeGroundCanvas());
  const facadeTex = BRICK_PALETTE.map((_, variant) => uploadTexture(gl, makeFacadeCanvas(variant, facadeRng)));

  const groundBuilder = new GeometryBuilder();
  groundBuilder.planeXZ(0, 0, 0, WORLD_W, WORLD_H, [255, 255, 255], true);
  const groundMesh = uploadMesh(gl, groundBuilder);
  const buildingMeshes = BRICK_PALETTE.map((_, variant) => uploadMesh(gl, buildBuildingsGeometry(variant)));
  const roofsMesh = uploadMesh(gl, buildRoofsGeometry());
  const palmsMesh = uploadMesh(gl, buildPalmsGeometry());

  const boxMesh = unitBox(gl);
  const discMesh = unitDisc(gl);
  const cylinderMesh = unitCylinder(gl);
  const ringBuilder = new GeometryBuilder();
  ringBuilder.ring(0, 0, 0, 0.78, 1, 28, [255, 255, 255]);
  const ringMesh = uploadMesh(gl, ringBuilder);

  // The sky: one huge triangle in clip space, horizon colour low, sunset top colour high
  // (the top vertex colour is extrapolated so the visible top of the screen is exact).
  const skyBuilder = new GeometryBuilder();
  const horizon = SKY_HORIZON.map((v) => Math.round(v * 255));
  const topExt = SKY_TOP.map((v, i) => Math.round((2 * v - SKY_HORIZON[i]) * 255));
  const s0 = skyBuilder.vertex(-1, -1, 0, 0, 1, 0, horizon);
  const s1 = skyBuilder.vertex(3, -1, 0, 0, 1, 0, horizon);
  const s2 = skyBuilder.vertex(-1, 3, 0, 0, 1, 0, topExt);
  skyBuilder.indices.push(s0, s1, s2);
  const skyMesh = uploadMesh(gl, skyBuilder);

  const proj = mat4Perspective(62, VIEW.width / VIEW.height, 1, 4200);
  const lightDir = vec3Normalize(SUN_DIR);
  const cam = { x: 0, y: 90, z: 0, tx: 0, ty: 0, tz: 0, ready: false };

  function drawLit(mesh, model, tex = null, override = null) {
    gl.useProgram(lit.prog);
    gl.uniformMatrix4fv(lit.uniforms.uModel, false, model);
    gl.uniform1f(lit.uniforms.uUseTex, tex ? 1 : 0);
    if (tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(lit.uniforms.uTex, 0);
    }
    gl.uniform1f(lit.uniforms.uUseOverride, override ? 1 : 0);
    if (override) gl.uniform3f(lit.uniforms.uOverride, override[0] / 255, override[1] / 255, override[2] / 255);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  function drawFlat(mesh, mvp, uniformColor = null) {
    gl.useProgram(flat.prog);
    gl.uniformMatrix4fv(flat.uniforms.uMvp, false, mvp);
    gl.uniform1f(flat.uniforms.uUseUniform, uniformColor ? 1 : 0);
    if (uniformColor) gl.uniform4f(flat.uniforms.uColor, uniformColor[0], uniformColor[1], uniformColor[2], uniformColor[3]);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  function drawCar(vp, view, x, z, angleDeg, carDef, spinDeg, police, frame) {
    const base = mat4Compose(x, 0, z, -angleDeg);
    const baseY = carDef.wheelR * 0.75;
    const bodyTop = baseY + carDef.bodyH;
    const bodyColor = police ? POLICE_COLOR : carDef.color;
    drawLit(boxMesh, partMatrix(base, 0, baseY + carDef.bodyH / 2, 0, carDef.length, carDef.bodyH, carDef.width), null, bodyColor);
    const cabinX = carDef.length >= 54 ? carDef.length * 0.22 : -carDef.length * 0.05;
    drawLit(boxMesh, partMatrix(base, cabinX, bodyTop + carDef.cabinH / 2, 0, carDef.length * 0.46, carDef.cabinH, carDef.width * 0.84), null, GLASS);
    // Wheels: unit cylinder spun around its own axis, then laid across the car.
    for (const wx of [carDef.length * 0.32, -carDef.length * 0.32]) {
      for (const wz of [carDef.width / 2, -carDef.width / 2]) {
        const wheel = mat4Multiply(
          base,
          mat4Multiply(
            mat4Translate(wx, carDef.wheelR, wz),
            mat4Multiply(mat4RotX(90), mat4Multiply(mat4RotY(spinDeg), scaleMatrix(carDef.wheelR * 2, carDef.width * 0.34, carDef.wheelR * 2))),
          ),
        );
        drawLit(cylinderMesh, wheel, null, TYRE);
      }
    }
    // Headlights and taillights: small unlit boxes so they glow against the sunset.
    const lightY = baseY + carDef.bodyH * 0.55;
    for (const lz of [carDef.width * 0.3, -carDef.width * 0.3]) {
      drawFlat(boxMesh, mat4Multiply(vp, partMatrix(base, carDef.length / 2 + 0.6, lightY, lz, 2, 3.5, 5.5)), [1, 0.95, 0.75, 1]);
      drawFlat(boxMesh, mat4Multiply(vp, partMatrix(base, -carDef.length / 2 - 0.6, lightY, lz, 2, 3.5, 5.5)), [0.9, 0.12, 0.12, 1]);
    }
    if (police) {
      const phase = Math.floor(frame / 10) % 2;
      const left = phase === 0 ? [1, 0.15, 0.15, 1] : [0.2, 0.45, 1, 1];
      const right = phase === 0 ? [0.2, 0.45, 1, 1] : [1, 0.15, 0.15, 1];
      const barY = bodyTop + carDef.cabinH + 1.5;
      drawFlat(boxMesh, mat4Multiply(vp, partMatrix(base, cabinX, barY, -4.6, 8, 3, 6.5)), left);
      drawFlat(boxMesh, mat4Multiply(vp, partMatrix(base, cabinX, barY, 4.6, 8, 3, 6.5)), right);
    }
  }

  function draw(state, snapCamera = false) {
    const carDef = CARS[state.carType];
    const rad = (state.angle * Math.PI) / 180;
    const fwdX = Math.cos(rad);
    const fwdZ = Math.sin(rad);
    const lookAhead = 60 + Math.abs(state.speed) * 7;
    const want = {
      x: state.carX - fwdX * 165,
      y: 92,
      z: state.carZ - fwdZ * 165,
      tx: state.carX + fwdX * lookAhead,
      ty: 16,
      tz: state.carZ + fwdZ * lookAhead,
    };
    if (snapCamera || !cam.ready) {
      Object.assign(cam, want, { ready: true });
    } else {
      const k = 0.085;
      cam.x += (want.x - cam.x) * k;
      cam.y += (want.y - cam.y) * k;
      cam.z += (want.z - cam.z) * k;
      cam.tx += (want.tx - cam.tx) * k;
      cam.ty += (want.ty - cam.ty) * k;
      cam.tz += (want.tz - cam.tz) * k;
    }
    const view = mat4LookAt([cam.x, cam.y, cam.z], [cam.tx, cam.ty, cam.tz], [0, 1, 0]);
    const vp = mat4Multiply(proj, view);

    gl.viewport(0, 0, VIEW.width, VIEW.height);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // Sky, then the sun disc where the light comes from.
    gl.disable(gl.DEPTH_TEST);
    drawFlat(skyMesh, mat4Identity());
    const sunPoint = projectPoint(vp, cam.x + SUN_DIR[0] * 2600, cam.y + SUN_DIR[1] * 2600, cam.z + SUN_DIR[2] * 2600, VIEW.width, VIEW.height);
    if (sunPoint) {
      const nx = (sunPoint.x / VIEW.width) * 2 - 1;
      const ny = 1 - (sunPoint.y / VIEW.height) * 2;
      const sunModel = mat4Multiply(
        mat4Translate(nx, ny, 0),
        mat4Multiply(mat4RotX(90), scaleMatrix(0.13, 1, 0.13 * (VIEW.width / VIEW.height))),
      );
      drawFlat(discMesh, sunModel, [1, 0.78, 0.45, 1]);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    // Lit world: shared uniforms once, then every mesh.
    gl.useProgram(lit.prog);
    gl.uniformMatrix4fv(lit.uniforms.uProj, false, proj);
    gl.uniformMatrix4fv(lit.uniforms.uView, false, view);
    gl.uniform3f(lit.uniforms.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform3f(lit.uniforms.uFogColor, FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2]);
    gl.uniform2f(lit.uniforms.uFogRange, FOG_NEAR, FOG_FAR);
    const identity = mat4Identity();
    drawLit(groundMesh, identity, groundTex);
    buildingMeshes.forEach((mesh, variant) => drawLit(mesh, identity, facadeTex[variant]));
    drawLit(roofsMesh, identity);
    drawLit(palmsMesh, identity);

    // Blob shadows under everything that moves.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    const shadow = (x, z, rx, rz) => {
      drawFlat(discMesh, mat4Multiply(vp, mat4Compose(x, 0.35, z, 0, rx, 1, rz)), [0, 0, 0, 0.32]);
    };
    shadow(state.carX, state.carZ, carDef.length * 0.62, carDef.width * 1.05);
    for (const cop of state.police) shadow(cop.x, cop.z, 30, 13);
    for (const ped of state.peds) if (ped.alive) shadow(ped.x, ped.z, 9, 9);

    // Cars and pedestrians.
    drawCar(vp, view, state.carX, state.carZ, state.angle, carDef, state.wheelSpin, false, state.frame);
    const policeDef = CARS[0];
    for (const cop of state.police) {
      drawCar(vp, view, cop.x, cop.z, cop.angle, policeDef, cop.spin, true, state.frame);
    }
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      const base = mat4Compose(ped.x, 0, ped.z, -(ped.angle * 180) / Math.PI);
      const bob = Math.sin(state.frame * 0.25 + ped.phase) * 1.1;
      drawLit(boxMesh, partMatrix(base, 0, 3, 0, 10, 6, 6), null, LEGS);
      drawLit(boxMesh, partMatrix(base, 0, 13.5 + bob, 0, 13, 15, 7.5), null, ped.shirt);
      drawLit(boxMesh, partMatrix(base, 0, 26.5 + bob, 0, 11, 11, 11), null, ped.skin);
    }

    // The mission marker: a ground ring, a translucent beam and a spinning gem.
    const target = state.mission.stage === 0 ? state.mission.pickup : state.mission.drop;
    const gemColor = state.mission.stage === 0 ? [1, 0.85, 0.15, 0.95] : [0.25, 0.95, 0.4, 0.95];
    const bobY = 40 - Math.abs(Math.sin(state.frame / 12)) * 7;
    drawFlat(ringMesh, mat4Multiply(vp, mat4Compose(target.x, 0.5, target.z, 0, 30, 1, 30)), [gemColor[0], gemColor[1], gemColor[2], 0.85]);
    drawFlat(boxMesh, mat4Multiply(vp, mat4Compose(target.x, bobY / 2, target.z, 0, 7, bobY, 7)), [gemColor[0], gemColor[1], gemColor[2], 0.30]);
    drawFlat(boxMesh, mat4Multiply(vp, mat4Compose(target.x, bobY + 12, target.z, state.frame * 2, 15, 15, 15)), gemColor);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    const markerScreen = projectPoint(vp, target.x, bobY + 30, target.z, VIEW.width, VIEW.height);
    return { markerScreen, markerStage: state.mission.stage };
  }

  return { draw, gl };
}
