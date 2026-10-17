/* Spheres: one sphere a mark. They rise through the picture turning on a
   slanted axis, softly lit from the upper left, with the backdrop bent into
   their rims. Each wears its mark on its own finish: pale and pearly, brushed
   silver, black.

   How it works: WebGL2. The picture (backdrop, figure, name) is a 2D canvas
   underneath, drawn at the stage's pixels. Above it a transparent WebGL canvas
   draws each sphere as a small quad and ray-casts it in the fragment shader:
   the normal comes from the disc, the skin from a longitude-latitude map read
   by the rotated normal (so a mark bends with the ball, which is the
   distortion), the light is a lambert with a tight highlight, and the rim
   takes a blurred read of the picture displaced along the normal, so the
   room seems to curve round the edge. Edges are antialiased in the shader.

   After the floating balls of 100k.studio. The skins are painted once in
   placeholders.js as 2:1 maps with the mark twice round the equator, so a
   turn always brings one round.

   SPHERES below sets each sphere: its skin (an index into skins()), radius
   (share of the shorter side), column (share of the width), the span of the
   loop it takes to rise from below the stage to above, its spin axis, how
   many turns it makes on the way, and where its turn starts. */

import { hero, drawName, skins } from "./placeholders.js";

const TAU = Math.PI * 2;

const SPHERES = {
  landscape: [
    { skin: 0, r: 0.2, x: 0.17, from: 0.035, to: 0.64, axis: [0.22, 1, 0.12], turns: 0.55, phase: -1.2 },
    { skin: 1, r: 0.16, x: 0.46, from: 0.18, to: 0.79, axis: [-0.3, 1, 0.2], turns: -0.6, phase: 1.4 },
    { skin: 2, r: 0.25, x: 0.32, from: 0.32, to: 0.96, axis: [0.1, 1, -0.25], turns: 0.5, phase: -0.9 },
  ],
  portrait: [
    { skin: 0, r: 0.3, x: 0.28, from: 0.04, to: 0.57, axis: [0.22, 1, 0.12], turns: 0.55, phase: -1.2 },
    { skin: 1, r: 0.24, x: 0.74, from: 0.18, to: 0.75, axis: [-0.3, 1, 0.2], turns: -0.6, phase: 1.4 },
    { skin: 2, r: 0.34, x: 0.42, from: 0.36, to: 0.96, axis: [0.1, 1, -0.25], turns: 0.5, phase: -0.9 },
  ],
};

/* Rodrigues: the rotation by `angle` about `axis`, column-major for uniformMatrix3fv. */
function rotation(axis, angle, out) {
  const len = Math.hypot(...axis);
  const [x, y, z] = axis.map((a) => a / len);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  out[0] = t * x * x + c;
  out[1] = t * x * y + s * z;
  out[2] = t * x * z - s * y;
  out[3] = t * x * y - s * z;
  out[4] = t * y * y + c;
  out[5] = t * y * z + s * x;
  out[6] = t * x * z + s * y;
  out[7] = t * y * z - s * x;
  out[8] = t * z * z + c;
}

/* The spheres on screen at `u`, back to front (the smaller further away), in
   canvas px. `t` turns them a little on their own, as 100k's do. */
function posesAt(u, t, width, height) {
  const short = Math.min(width, height);
  const poses = [];
  for (const s of SPHERES[width >= height ? "landscape" : "portrait"]) {
    const f = (u - s.from) / (s.to - s.from);
    if (f <= 0 || f >= 1) continue;
    const r = s.r * short;
    const rot = new Float32Array(9);
    rotation(s.axis, s.phase + f * s.turns * TAU + t * 0.22 * Math.sign(s.turns), rot);
    poses.push({
      skin: s.skin,
      r,
      y: height + r - f * (height + 2 * r),
      x: s.x * width + 0.025 * width * Math.sin(f * TAU + s.phase),
      rot,
    });
  }
  return poses.sort((a, b) => a.r - b.r);
}

const VERT = `#version 300 es
uniform vec4 uBox; // the sphere's quad, canvas px from the top-left: x0 y0 x1 y1
uniform vec2 uRes;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 p = mix(uBox.xy, uBox.zw, c);
  gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec3 uSph; // centre and radius, canvas px
uniform mat3 uRot; // world to object
uniform sampler2D uSkin;
uniform sampler2D uScene; // the picture under the sphere, mipmapped
out vec4 outColor;

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = (p - uSph.xy) / uSph.z;
  float r2 = dot(d, d);
  float z = sqrt(max(0., 1. - min(r2, 1.)));
  vec3 n = normalize(vec3(d.x, -d.y, z + 1e-4));
  vec3 o = uRot * n;
  vec2 uv = vec2(atan(o.x, o.z) / 6.2831853 + .5, .5 - asin(clamp(o.y, -1., 1.)) / 3.1415927);
  // The longitude wraps: take the gradient from whichever side of the seam
  // is continuous here, or the seam draws a line.
  vec2 uv2 = vec2(fract(uv.x + .5), uv.y);
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  vec2 gx2 = dFdx(uv2);
  vec2 gy2 = dFdy(uv2);
  if (abs(gx2.x) + abs(gy2.x) < abs(gx.x) + abs(gy.x)) {
    gx = gx2;
    gy = gy2;
  }
  vec3 skin = textureGrad(uSkin, uv, gx, gy).rgb;
  // Soft light from the upper left: the picture reads all the way round,
  // darkening only a little toward the limb.
  vec3 L = normalize(vec3(-.5, .65, .6));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float lam = max(dot(n, L), 0.);
  float nh = max(dot(n, H), 0.);
  float rim = pow(1. - z, 2.4);
  vec3 c = skin * (.7 + .36 * lam);
  c *= .88 + .12 * smoothstep(-.9, .4, n.y);
  // The room in its rim: the picture behind it, blurred and bent round the edge.
  vec2 at = clamp((p + n.xy * vec2(1., -1.) * uSph.z * .9) / uRes, 0., 1.);
  vec3 room = textureLod(uScene, at, 4.6).rgb;
  c = mix(c, room * 1.6 + .06, rim * .6);
  c += pow(nh, 60.) * .45 + pow(nh, 8.) * .05;
  float a = clamp((1. - sqrt(r2)) * uSph.z / 1.25 + .5, 0., 1.);
  outColor = vec4(min(c, vec3(1.)) * a, a); // premultiplied
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function texture(gl, source, repeatX) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatX ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export const sketches = {
  spheres: async (env) => {
    const base = env.canvas("2d");
    const glView = env.canvas("webgl2");
    const gl = glView.ctx;
    const picture = document.createElement("canvas");
    let key = "";
    let sceneTex = null;
    let prog = null;
    let skinTex = [];
    let loc = null;

    if (gl) {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      loc = Object.fromEntries(["uBox", "uRes", "uSph", "uRot", "uSkin", "uScene"].map((n) => [n, gl.getUniformLocation(prog, n)]));
      skinTex = skins().map((c) => texture(gl, c, true));
      gl.useProgram(prog);
      gl.uniform1i(loc.uScene, 0);
      gl.uniform1i(loc.uSkin, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /* The picture is composed once per size: the backdrop, the figure and the
       name, in the canvas's own pixels. It is the layer under the spheres and
       the texture their rims read. */
    function compose() {
      const { w, h, dpr } = base;
      key = `${w}x${h}@${dpr}`;
      const scene = hero(w, h, dpr);
      picture.width = Math.round(w * dpr);
      picture.height = Math.round(h * dpr);
      const g = picture.getContext("2d");
      g.drawImage(scene.backdrop, 0, 0);
      g.drawImage(scene.figure, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawName(g, w, h);
      if (gl) {
        if (sceneTex) gl.deleteTexture(sceneTex);
        gl.activeTexture(gl.TEXTURE0);
        sceneTex = texture(gl, picture, false);
      }
    }

    function render(u, time) {
      const { ctx, w, h, dpr } = base;
      if (key !== `${w}x${h}@${dpr}`) compose();
      // the canvas is cleared whenever the stage is resized, so the picture is redrawn every frame
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(picture, 0, 0);
      if (!gl) return;

      const W = glView.canvas.width;
      const H = glView.canvas.height;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(loc.uRes, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      for (const s of posesAt(u, time, W, H)) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, skinTex[s.skin]);
        gl.uniform3f(loc.uSph, s.x, s.y, s.r);
        gl.uniformMatrix3fv(loc.uRot, false, s.rot);
        gl.uniform4f(loc.uBox, s.x - s.r - 2, s.y - s.r - 2, s.x + s.r + 2, s.y + s.r + 2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    return { mode: "loop", duration: 12, still: 0.5, render };
  },
};
