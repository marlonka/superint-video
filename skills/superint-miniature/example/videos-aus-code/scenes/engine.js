// Der Renderer. Kein Programm, das man kaufen kann: nur diese Datei.
// Jedes Filmbild wird viele Male gerechnet: jedes Mal steht die Kamera minimal anders, die Lampen
// leuchten von einem anderen Punkt, die Zeit laeuft ein Stueck weiter. Der Mittelwert ergibt
// weiche Schatten, echte Unschaerfe und Bewegungsunschaerfe. So hat man Film gerechnet, bevor es schnell ging.
import { VS, VS_DEPTH, FS_DEPTH, FS_MAIN, VS_FS, FS_VOL, FS_COPY, FS_DOWN, FS_UP, FS_TONE, FS_FINAL, MAXL, MAXR } from './shaders.js';
import { M, v3, hash } from './m.js';

const STRIDE = 44;

// Stabile Zufallsfolgen, jede Sitzung gleich. R2 ist gleichmaessiger als Wuerfeln.
const R2 = i => [(.5 + i * .7548776662466927) % 1, (.5 + i * .5698402909980532) % 1];
const R3 = i => [(.5 + i * .8191725133961645) % 1, (.5 + i * .6710436067037893) % 1, (.5 + i * .5497004779019703) % 1];
function disc(u, v) { const r = Math.sqrt(u), a = v * Math.PI * 2; return [r * Math.cos(a), r * Math.sin(a)]; }

export class Engine {
  constructor(canvas, width, height) {
    this.w = width; this.h = height; this.canvas = canvas;
    canvas.width = width; canvas.height = height;
    const gl = this.gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance', depth: false, stencil: false });
    if (!gl) throw new Error('WebGL2 fehlt');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('Float-Rendertargets fehlen');
    gl.getExtension('OES_texture_float_linear');
    this.floatBlend = !!gl.getExtension('EXT_float_blend');
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    this.statics = []; this.dyns = []; this.insts = [];
    this.lights = []; this.rooms = [];
    this.camera = { eye: [0, 0, 10], at: [0, 0, 0], up: [0, 1, 0], fov: .6, focus: 10, aperture: 0 };
    this.grade = { exp: 1, sat: 1.06, lift: [0, 0, 0], gain: [1, 1, 1], bloom: .05, vig: .35, fade: 1, grain: .018, ca: 1.2 };
    this.text = { mask: 0, geo: [960, 540, 0, 100], cell: 14, scroll: 0 };
    this.clipY = -1e9; this.refl = 0;
    this.live = [null, null, null, null];
    this.vao0 = gl.createVertexArray();
    this.emptyTex = this._tex1();
    this._programs();
    this._targets();
    this._texArrays();
  }
  _sh(type, src) {
    const gl = this.gl, s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  _prog(vs, fs, name) {
    const gl = this.gl, p = gl.createProgram(), a = this._sh(gl.VERTEX_SHADER, vs), b = this._sh(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    p._name = name; p._a = a; p._b = b;
    return p;
  }
  _finish(p) {
    const gl = this.gl;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`Shader ${p._name}: ` + (gl.getShaderInfoLog(p._a) || '') + (gl.getShaderInfoLog(p._b) || '') + (gl.getProgramInfoLog(p) || ''));
    }
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); const name = inf.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, inf.name); }
    p.u = u; return p;
  }
  _programs() {
    const P = (v, f, n) => this._prog(v, f, n);
    this.progs = {
      main: P(VS(false), FS_MAIN, 'main'), mainI: P(VS(true), FS_MAIN, 'mainI'),
      depth: P(VS_DEPTH(false), FS_DEPTH, 'depth'), depthI: P(VS_DEPTH(true), FS_DEPTH, 'depthI'),
      vol: P(VS_FS, FS_VOL, 'vol'), copy: P(VS_FS, FS_COPY, 'copy'), down: P(VS_FS, FS_DOWN, 'down'), up: P(VS_FS, FS_UP, 'up'),
      tone: P(VS_FS, FS_TONE, 'tone'), final: P(VS_FS, FS_FINAL, 'final'),
    };
  }
  // Wartet, bis der Treiber die Shader fertig uebersetzt hat, ohne den Browser zu blockieren.
  async ready() {
    const gl = this.gl, list = Object.values(this.progs);
    if (this.parallel) {
      const st = this.parallel.COMPLETION_STATUS_KHR;
      for (let tries = 0; tries < 1400; tries++) {
        if (list.every(p => gl.getProgramParameter(p, st))) break;
        await new Promise(r => setTimeout(r, 10));
      }
    }
    list.forEach(p => this._finish(p));
    const f = this.progs.final; gl.useProgram(f);
  }
  _tex1() { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); return t; }
  _color(w, h, ifmt, fmt, type, filter = this.gl.LINEAR, mip = false) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const levels = mip ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
    gl.texStorage2D(gl.TEXTURE_2D, levels, ifmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  _fbo(colors, depth) {
    const gl = this.gl, f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    colors.forEach((c, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, c, 0));
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    const s = gl.checkFramebufferStatus(gl.FRAMEBUFFER); if (s !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO ' + s);
    return f;
  }
  _targets() {
    const gl = this.gl, w = this.w, h = this.h;
    this.view = this._view(w, h);
    // Schatten: 8 Lampen, je 2048 Pixel.
    this.TILE = 2048;
    this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, this.TILE * 4, this.TILE * 2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    // Verschattung: eine Tiefenkarte je Teilbild, aus immer anderer Richtung.
    this.AO_SIZE = 2048;
    this.aoTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.aoTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, this.AO_SIZE, this.AO_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.aoFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.aoFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.aoTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    // Die Sonde: sechs Seiten, je 256 Pixel, ein Bild je Filmbild.
    this.PROBE = 256;
    this.probeTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.probeTex);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, Math.floor(Math.log2(this.PROBE)) + 1, gl.RGBA16F, this.PROBE, this.PROBE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.probeDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.probeDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT32F, this.PROBE, this.PROBE);
    this.probeFbos = [];
    for (let i = 0; i < 6; i++) {
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, this.probeTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.probeDepth);
      this.probeFbos.push(f);
    }
    this.probe = { on: false, room: -1, pos: [0, 0, 0], min: [0, 0, 0], max: [0, 0, 0] };
    this.plane = { on: false, y: 0 };
    // Bloom-Kette
    this.bloom = [];
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 7 && bw > 4 && bh > 4; i++) {
      const t = this._color(bw, bh, gl.RGBA16F); this.bloom.push({ t, f: this._fbo([t]), w: bw, h: bh }); bw >>= 1; bh >>= 1;
    }
    this.ldr = this._color(w, h, gl.RGBA8, 0, 0, gl.LINEAR, true); this.ldrFbo = this._fbo([this.ldr]);
  }
  // Eine Ansicht: Zwischenbild, Summe aller Teilbilder.
  _view(w, h) {
    const gl = this.gl;
    const color = this._color(w, h, gl.RGBA16F, 0, 0, gl.NEAREST);
    const depth = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, depth); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const accT = this._color(w, h, this.floatBlend ? gl.RGBA32F : gl.RGBA16F, 0, 0, gl.LINEAR);
    return { w, h, color, depth, main: this._fbo([color], depth), colorOnly: this._fbo([color]), acc: accT, accFbo: this._fbo([accT]) };
  }
  // Zwei Stapel fuer alles Gedruckte: grosse Blaetter (2048) und kleine Schilder (1024).
  _texArrays() {
    const gl = this.gl;
    const mk = (size, n) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(size)) + 1, gl.SRGB8_ALPHA8, size, size, n);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16);
      return t;
    };
    this.texA = mk(2048, 48); this.texB = mk(1024, 62); this.nA = 0; this.nB = 0;
  }
  // Legt eine Leinwand in den Stapel, gibt die Materialnummer zurueck.
  addDoc(canvas) {
    const gl = this.gl;
    const big = canvas.width > 1024 || canvas.height > 1024;
    const tex = big ? this.texA : this.texB, size = big ? 2048 : 1024;
    const n = big ? this.nA++ : this.nB++;
    if (big && n >= 48) throw new Error('Zu viele grosse Blaetter');
    if (!big && n >= 62) throw new Error('Zu viele kleine Schilder');
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    let src = canvas;
    if (canvas.width !== size || canvas.height !== size) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, size, size); src = c; }
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, n, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return big ? 64 + n : 1 + n;
  }
  finishDocs() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texA); gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texB); gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }
  // Lebende Texturen: was sich jedes Bild aendert. Quelle: Leinwand oder Bild.
  makeLive(slot, w, h, srgb = true) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16);
    this.live[slot] = t; return t;
  }
  updateLive(slot, src) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.live[slot]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  // ---------------------------------------------------------------- Geometrie hochladen
  _vao(geo, instCap = 0) {
    const gl = this.gl, nv = geo.pos.length / 3;
    const buf = new ArrayBuffer(nv * STRIDE), f = new Float32Array(buf), u = new Uint8Array(buf);
    const q = v => Math.round(Math.max(0, Math.min(1, v)) * 255);
    for (let i = 0; i < nv; i++) {
      const o = i * 11, b = i * STRIDE + 32;
      f[o] = geo.pos[i * 3]; f[o + 1] = geo.pos[i * 3 + 1]; f[o + 2] = geo.pos[i * 3 + 2];
      f[o + 3] = geo.nor[i * 3]; f[o + 4] = geo.nor[i * 3 + 1]; f[o + 5] = geo.nor[i * 3 + 2];
      f[o + 6] = geo.uv[i * 2]; f[o + 7] = geo.uv[i * 2 + 1];
      // Farben wurzelkodiert: 8 Bit reichen sonst nicht fuer dunkle Toene.
      u[b] = q(Math.sqrt(geo.col[i * 4])); u[b + 1] = q(Math.sqrt(geo.col[i * 4 + 1])); u[b + 2] = q(Math.sqrt(geo.col[i * 4 + 2])); u[b + 3] = q(geo.col[i * 4 + 3]);
      u[b + 4] = q(geo.mat[i * 4]); u[b + 5] = q(geo.mat[i * 4 + 1]); u[b + 6] = geo.mat[i * 4 + 2]; u[b + 7] = geo.mat[i * 4 + 3];
      u[b + 8] = geo.aux[i * 4]; u[b + 9] = q(Math.sqrt(geo.aux[i * 4 + 1] / 64)); u[b + 10] = geo.aux[i * 4 + 2]; u[b + 11] = geo.aux[i * 4 + 3];
    }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, STRIDE, 32);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, STRIDE, 36);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.UNSIGNED_BYTE, true, STRIDE, 40);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geo.idx), gl.STATIC_DRAW);
    let inst = null;
    if (instCap) {
      inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, instCap * 28 * 4, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 7; i++) { gl.enableVertexAttribArray(6 + i); gl.vertexAttribPointer(6 + i, 4, gl.FLOAT, false, 28 * 4, i * 16); gl.vertexAttribDivisor(6 + i, 1); }
    }
    gl.bindVertexArray(null);
    return { vao, count: geo.idx.length, inst };
  }
  // Was sich nie bewegt.
  addStatic(geo, room) {
    if (!geo.idx.length) return;
    const v = this._vao(geo);
    this.statics.push({ ...v, room, min: geo.min.slice(), max: geo.max.slice() });
  }
  // Was sich bewegt: eine Matrix je Teilbild.
  addDynamic(geo, room = -1) {
    const v = this._vao(geo);
    const o = { ...v, room, roomOv: -1, m: new Float32Array(M.id()), visible: true };
    o.set = m => { o.m.set(m); return o; };
    this.dyns.push(o); return o;
  }
  // Viele Gleiche: Blaetter, Tasten, Sitze.
  addInstanced(geo, cap) {
    const v = this._vao(geo, cap);
    const o = { ...v, cap, n: 0, data: new Float32Array(cap * 28), rooms: null, visible: true };
    o.begin = () => { o.n = 0; };
    // m: Matrix, a: Biegung, b: uv, c: Textur, Raum, Helligkeit, Deckkraft
    o.push = (m, a = [0, 0, 0, 0], b = [1, 1, 0, 0], c = [-1, -1, 1, 1]) => {
      if (o.n >= cap) return; const d = o.data, i = o.n++ * 28;
      for (let k = 0; k < 16; k++) d[i + k] = m[k];
      d[i + 16] = a[0]; d[i + 17] = a[1]; d[i + 18] = a[2]; d[i + 19] = a[3];
      d[i + 20] = b[0]; d[i + 21] = b[1]; d[i + 22] = b[2]; d[i + 23] = b[3];
      d[i + 24] = c[0]; d[i + 25] = c[1]; d[i + 26] = c[2]; d[i + 27] = c[3];
    };
    o.end = () => { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, o.inst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, o.data, 0, o.n * 28); };
    this.insts.push(o); return o;
  }

  // ---------------------------------------------------------------- Ein Filmbild
  renderFrame(t, story, { samples = 32, shutter = .5 / 30 } = {}) {
    story.frame(t, this);
    this.aoEnabled = samples >= 24;
    if (samples >= 24) this.renderProbe(t, story); else this.probe.on = false;
    this.renderView(this.view, t, story, samples, shutter);
    this.resolve(this.view, samples, t);
  }
  // Rechnet alle Teilbilder in die Summe einer Ansicht.
  renderView(view, t, story, N, shutter, onSub = null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, view.accFbo); gl.viewport(0, 0, view.w, view.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    for (let s = 0; s < N; s++) {
      const ts = t + ((s + .5) / N - .5) * shutter;
      story.sub(ts, this, s, N, view);
      this._renderSub(view, s, N, ts);
    }
  }
  _visible(box, vp) {
    // Grob: Kiste gegen die Seitenflaechen des Sichtkegels.
    const a = box.min, b = box.max;
    for (const pl of this._planes) {
      const x = pl[0] > 0 ? b[0] : a[0], y = pl[1] > 0 ? b[1] : a[1], z = pl[2] > 0 ? b[2] : a[2];
      if (pl[0] * x + pl[1] * y + pl[2] * z + pl[3] < 0) return false;
    }
    return true;
  }
  _makePlanes(m) {
    const row = i => [m[i], m[i + 4], m[i + 8], m[i + 12]], r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
    const add = (a, b, s) => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]];
    this._planes = [add(r3, r0, 1), add(r3, r0, -1), add(r3, r1, 1), add(r3, r1, -1), add(r3, r2, 1), add(r3, r2, -1)];
  }
  _renderSub(view, s, N, ts) {
    const gl = this.gl, cam = this.camera, aspect = view.w / view.h;
    const fov = cam.fov, near = cam.near || .02, far = cam.far || 340;
    const P = M.persp(fov, aspect, near, far);
    const [ax, ay] = R2(s + 1), [px, py] = R2(s + 17);
    const [dx, dy] = disc(ax, ay);
    const lensX = dx * cam.aperture, lensY = dy * cam.aperture;
    // Duennes Linsenmodell: die Ebene in der Fokusdistanz bleibt scharf.
    const base = M.lookAt(cam.eye, cam.at, cam.up);
    let V = M.mul(M.T(-lensX, -lensY, 0), base);
    if (cam.mirrorY !== undefined) V = M.mul(V, [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * cam.mirrorY, 0, 1]);
    P[8] = -P[0] * lensX / cam.focus + (px - .5) * 2 / view.w;
    P[9] = -P[5] * lensY / cam.focus + (py - .5) * 2 / view.h;
    const VP = M.mul(P, V);
    const invV = M.invert(V); const eye = [invV[12], invV[13], invV[14]];
    this._makePlanes(M.mul(M.persp(fov * 1.02, aspect, near, far), base));

    // Welche Lampen duerfen in dieses Teilbild?
    const on = this.lights.filter(l => l.power > .001 && (!l.boxMin || this._visible({ min: l.boxMin, max: l.boxMax })));
    const count = on.length;
    let chosen = on, weight = 1;
    if (count > MAXL) {
      // Immer acht der Reihe nach. Jede Lampe zaehlt mit, wie oft sie schon dran war: Das ist ihr Index in ihrer eigenen Zufallsfolge.
      chosen = []; const off = (s * MAXL) % count, q = Math.floor(s * MAXL / count);
      for (let i = 0; i < MAXL; i++) { const j = off + i, l = on[j % count]; l._k = q + (j >= count ? 1 : 0); l._lid = j % count; chosen.push(l); }
      weight = count / MAXL;
    } else on.forEach((l, i) => { l._k = s; l._lid = i; });
    const U = this._shadows(chosen, weight, s, ts);
    const nl = chosen.length;

    // Verschattung: Das Umgebungslicht kommt in diesem Teilbild aus genau einer Richtung.
    const useAO = this.aoEnabled && view === this.view && cam.mirrorY === undefined;
    const ao = useAO ? this._aoPass(s, cam) : null;
    this._makePlanes(M.mul(M.persp(fov * 1.02, aspect, near, far), base));

    // Hauptbild
    gl.bindFramebuffer(gl.FRAMEBUFFER, view.main); gl.viewport(0, 0, view.w, view.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this._drawWorld(VP, eye, s, ts, nl, U, view, { ao, probe: view === this.view && this.probe.on, plane: view === this.view && this.plane.on, cull: true, room: -1 });
    // Dunst im Licht
    gl.bindVertexArray(this.vao0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, view.colorOnly);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    if (nl && chosen.some(l => l.haze > 0)) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      const v = this.progs.vol; gl.useProgram(v); const u = v.u;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, view.depth);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.uniform1i(u.uShadow, 0); gl.uniform1i(u.uDepth, 1);
      gl.uniformMatrix4fv(u.uInvVP, false, new Float32Array(M.invert(VP))); gl.uniform3fv(u.uEye, eye); gl.uniform1f(u.uSub, s); gl.uniform1i(u.uNL, nl);
      gl.uniform4fv(u.uLPos, U.pos); gl.uniform4fv(u.uLDir, U.dir); gl.uniform4fv(u.uLCol, U.col); gl.uniform4fv(u.uLSh, U.sh);
      gl.uniformMatrix4fv(u.uLVP, false, U.vps); gl.uniform4fv(u.uLHaze, U.haze); gl.uniform4fv(u.uLBoxA, U.boxA); gl.uniform4fv(u.uLBoxB, U.boxB);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
    }
    // In die Summe
    gl.bindFramebuffer(gl.FRAMEBUFFER, view.accFbo);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const c = this.progs.copy; gl.useProgram(c); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, view.color); gl.uniform1i(c.u.uTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
  // Schatten aller gewaehlten Lampen in die Kacheln. Gibt zurueck, was der Shader ueber sie wissen muss.
  _shadows(chosen, weight, s, ts) {
    const gl = this.gl, nl = chosen.length;
    const uPos = new Float32Array(MAXL * 4), uDir = new Float32Array(MAXL * 4), uCol = new Float32Array(MAXL * 4), uSh = new Float32Array(MAXL * 4), uVPs = new Float32Array(MAXL * 16), uHaze = new Float32Array(MAXL * 4), uBoxA = new Float32Array(MAXL * 4), uBoxB = new Float32Array(MAXL * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.enable(gl.SCISSOR_TEST); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3.);
    const T = this.TILE;
    for (let i = 0; i < nl; i++) {
      const l = chosen[i], col = i % 4, row = i >> 2;
      gl.viewport(col * T, row * T, T, T); gl.scissor(col * T, row * T, T, T);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      // Die Lampe ist kein Punkt: jedes Teilbild leuchtet sie von einer anderen Stelle ihrer Flaeche.
      const r = R3(l._k + l._lid * 7 + 1), j = disc(r[0], r[1]);
      const size = l.size || 0;
      const up0 = Math.abs(l.dir[1]) > .95 ? [1, 0, 0] : [0, 1, 0];
      const X = v3.norm(v3.cross(up0, l.dir)), Y = v3.cross(l.dir, X);
      const p = [l.pos[0] + (X[0] * j[0] + Y[0] * j[1]) * size, l.pos[1] + (X[1] * j[0] + Y[1] * j[1]) * size, l.pos[2] + (X[2] * j[0] + Y[2] * j[1]) * size];
      const at = v3.add(p, l.dir);
      const LV = M.lookAt(p, at, up0), LP = M.persp(Math.min(l.angle * 2, 2.9), 1, l.near || .05, l.range);
      const LVP = M.mul(LP, LV);
      this._drawDepth(LVP, l.room, s);
      uPos.set([p[0], p[1], p[2], l.room], i * 4);
      uDir.set([l.dir[0], l.dir[1], l.dir[2], Math.cos(l.angle)], i * 4);
      const w = weight * l.power;
      uCol.set([l.color[0] * w, l.color[1] * w, l.color[2] * w, Math.cos(l.inner !== undefined ? l.inner : l.angle * .7)], i * 4);
      uSh.set([col, row, l.bias || .0015, l.range], i * 4);
      uVPs.set(LVP, i * 16);
      uHaze.set([(l.haze || 0) * (this.hazeK === undefined ? 1 : this.hazeK), ts, l._k, 0], i * 4);
      const mn = l.boxMin || [-1e4, -1e4, -1e4], mx = l.boxMax || [1e4, 1e4, 1e4];
      uBoxA.set([mn[0], mn[1], mn[2], 0], i * 4); uBoxB.set([mx[0], mx[1], mx[2], 0], i * 4);
    }
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.POLYGON_OFFSET_FILL);
    return { pos: uPos, dir: uDir, col: uCol, sh: uSh, vps: uVPs, haze: uHaze, boxA: uBoxA, boxB: uBoxB };
  }
  // Eine Tiefenkarte aus einer Richtung, die jedes Teilbild anders liegt. Der Ausschnitt folgt dem, was die Kamera anschaut.
  _aoPass(s, cam) {
    const gl = this.gl;
    const r = R3(s + 101), z = 1 - 2 * r[0], ph = r[1] * Math.PI * 2, rs = Math.sqrt(Math.max(0, 1 - z * z));
    const dir = [rs * Math.cos(ph), z, rs * Math.sin(ph)];
    const dist = v3.len(v3.sub(cam.at, cam.eye));
    const B = Math.min(14, Math.max(.45, dist * .8 + .15));
    const c = cam.at;
    const eye = v3.add(c, v3.mul(dir, B * 1.6));
    const up0 = Math.abs(dir[1]) > .95 ? [1, 0, 0] : [0, 1, 0];
    const LV = M.lookAt(eye, c, up0);
    const k = 1 / B, n = .01, f = B * 3.2, fn = 1 / (f - n);
    const LP = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, -2 * fn, 0, 0, 0, -(f + n) * fn, 1];
    const LVP = M.mul(LP, LV);
    this._makePlanes(LVP);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.aoFbo);
    gl.viewport(0, 0, this.AO_SIZE, this.AO_SIZE);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.2, 2.);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    this._drawDepth(LVP, null, s, 1);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    return { vp: new Float32Array(LVP), dir, bias: 2 * B / this.AO_SIZE * 2.2 };
  }
  // Zeichnet die Welt mit allem Licht in das aktuelle Ziel.
  _drawWorld(VP, eye, s, ts, nl, U, view, o) {
    const gl = this.gl, cam = this.camera, P0 = this.probe;
    const setCommon = (p) => {
      gl.useProgram(p); const u = p.u;
      gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uEye, eye); gl.uniform1f(u.uSub, s); gl.uniform1f(u.uT, ts);
      gl.uniform1i(u.uNL, nl);
      gl.uniform4fv(u.uLPos, U.pos); gl.uniform4fv(u.uLDir, U.dir); gl.uniform4fv(u.uLCol, U.col); gl.uniform4fv(u.uLSh, U.sh);
      gl.uniformMatrix4fv(u.uLVP, false, U.vps);
      gl.uniform4fv(u.uRoomUp, this._roomUp); gl.uniform4fv(u.uRoomDn, this._roomDn); gl.uniform4fv(u.uRoomMin, this._roomMin); gl.uniform4fv(u.uRoomMax, this._roomMax);
      gl.uniform4fv(u.uRoomFill, this._roomFill); gl.uniform1f(u.uClipY, cam.mirrorY !== undefined ? cam.mirrorY + .002 : -1e9); gl.uniform1f(u.uRefl, cam.mirrorY !== undefined ? 0 : this.refl); gl.uniform2f(u.uView, view.w, view.h);
      gl.uniform1i(u.uShadow, 0); gl.uniform1i(u.uTexA, 1); gl.uniform1i(u.uTexB, 2); gl.uniform1i(u.uLive0, 3); gl.uniform1i(u.uLive1, 4); gl.uniform1i(u.uLive2, 5); gl.uniform1i(u.uLive3, 6);
      gl.uniform1i(u.uAO, 7); gl.uniform1i(u.uProbe, 8);
      gl.uniform1f(u.uAOOn, o.ao ? 1 : 0);
      gl.uniform1f(u.uMaxCol, o.maxCol || 1e9);
      if (o.ao) { gl.uniformMatrix4fv(u.uAOVP, false, o.ao.vp); gl.uniform3fv(u.uAODir, o.ao.dir); gl.uniform1f(u.uAOBias, o.ao.bias); }
      gl.uniform1f(u.uProbeOn, o.probe ? 1 : 0);
      if (o.probe) { gl.uniform3fv(u.uProbePos, P0.pos); gl.uniform4f(u.uProbeMin, P0.min[0], P0.min[1], P0.min[2], 0); gl.uniform4f(u.uProbeMax, P0.max[0], P0.max[1], P0.max[2], P0.room); }
      if (this.hero) { gl.uniform4f(u.uHero, this.hero.pos[0], this.hero.pos[1], this.hero.pos[2], 1); gl.uniform3fv(u.uHeroA, this.hero.a); gl.uniform3fv(u.uHeroB, this.hero.b); }
      gl.uniform1f(u.uPlaneOn, o.plane ? 1 : 0); gl.uniform1f(u.uPlaneY, this.plane.y); gl.uniform1f(u.uPlaneSoft, this.plane.soft === undefined ? 1 : this.plane.soft);
    };
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texA);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texB);
    for (let i = 0; i < 4; i++) { gl.activeTexture(gl.TEXTURE3 + i); gl.bindTexture(gl.TEXTURE_2D, this.live[i] && this.live[i] !== this.liveBusy ? this.live[i] : this.emptyTex); }
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.aoTex);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_CUBE_MAP, o.probe ? this.probeTex : this.probeEmpty());
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    const main = this.progs.main; setCommon(main);
    const uM = main.u.uM, uRo = main.u.uRoomOv;
    gl.uniform1f(uRo, -1);
    const IDT = new Float32Array(M.id()); gl.uniformMatrix4fv(uM, false, IDT);
    const only = o.room;
    for (const b of this.statics) {
      if (only >= 0 && b.room !== only) continue;
      if (o.cull && !this._visible(b)) continue;
      gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    }
    for (const d of this.dyns) {
      if (!d.visible) continue;
      if (only >= 0) { const r = d.roomOv >= 0 ? d.roomOv : d.room; if (r !== only && r !== -1) continue; }
      gl.uniformMatrix4fv(uM, false, d.m); gl.uniform1f(uRo, d.roomOv);
      gl.bindVertexArray(d.vao); gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
    }
    const anyInst = this.insts.some(i => i.visible && i.n > 0);
    if (anyInst) {
      setCommon(this.progs.mainI);
      for (const i of this.insts) {
        if (!i.visible || !i.n) continue;
        if (only >= 0 && i.shadowRoom !== only) continue;
        gl.bindVertexArray(i.vao); gl.drawElementsInstanced(gl.TRIANGLES, i.count, gl.UNSIGNED_INT, 0, i.n);
      }
    }
  }
  probeEmpty() {
    if (this._probeEmpty) return this._probeEmpty;
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
    for (let i = 0; i < 6; i++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.HALF_FLOAT, new Uint16Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return this._probeEmpty = t;
  }
  // Einmal je Filmbild: Wie sieht der Raum aus, von dort, wo die Kamera hinschaut?
  renderProbe(t, story) {
    const gl = this.gl;
    story.sub(t, this, 0, 1, this.view);
    const cam = this.camera;
    const p0 = v3.mix(cam.at, cam.eye, .35);
    // Welcher Raum? Der, in dem das Ziel liegt; die offene Vorderseite zaehlt mit.
    let rid = -1;
    this.rooms.forEach((r, i) => {
      if (!r || !r.min || i === 1 || rid >= 0) return;
      const Q = cam.at;
      if (Q[0] >= r.min[0] && Q[0] <= r.max[0] && Q[1] >= r.min[1] && Q[1] <= r.max[1] && Q[2] >= r.min[2] && Q[2] <= r.max[2] + .2 && cam.eye[2] < r.max[2] + 9) rid = i;
    });
    const rm = this.rooms[rid >= 0 ? rid : 1];
    const room = rid >= 0 ? rid : 1;
    const inside = rid >= 0;
    const pos = inside ? [0, 1, 2].map(i => Math.min(rm.max[i] - .08, Math.max(rm.min[i] + .08, p0[i]))) : p0;
    this.probe.on = true; this.probe.room = room; this.probe.pos = pos;
    this.probe.min = inside ? rm.min : [-1e4, -1e4, -1e4]; this.probe.max = inside ? rm.max : [1e4, 1e4, 1e4];
    const chosen = this.lights.filter(l => l.power > .001 && l.room === room).slice(0, MAXL);
    chosen.forEach((l, i) => { l._k = 0; l._lid = i; });
    const U = this._shadows(chosen, 1, 0, t);
    const P = M.persp(Math.PI / 2, 1, .02, 400);
    const FACES = [[[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]], [[0, 1, 0], [0, 0, 1]], [[0, -1, 0], [0, 0, -1]], [[0, 0, 1], [0, -1, 0]], [[0, 0, -1], [0, -1, 0]]];
    const fake = { w: this.PROBE, h: this.PROBE };
    const up = this.rooms[room].up, k = inside ? .55 : .2;
    gl.clearColor(up[0] * k, up[1] * k, up[2] * k, 1);
    const keep = this.refl; this.refl = 0;
    for (let i = 0; i < 6; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.probeFbos[i]); gl.viewport(0, 0, this.PROBE, this.PROBE);
      gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const V = M.lookAt(pos, v3.add(pos, FACES[i][0]), FACES[i][1]);
      const VP = M.mul(P, V);
      this._drawWorld(VP, pos, 0, t, chosen.length, U, fake, { ao: null, probe: false, plane: false, cull: false, room, maxCol: 8. });
    }
    this.refl = keep;
    gl.clearColor(0, 0, 0, 0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.probeTex); gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null);
  }
  _drawDepth(LVP, room, s, noShell = 0) {
    const gl = this.gl, d = this.progs.depth, all = room === null;
    gl.useProgram(d); gl.uniformMatrix4fv(d.u.uVP, false, LVP); gl.uniform1f(d.u.uSub, s); gl.uniform1f(d.u.uNoShell, noShell);
    const IDT = new Float32Array(M.id()); gl.uniformMatrix4fv(d.u.uM, false, IDT);
    for (const b of this.statics) {
      if (all) { if (!this._visible(b)) continue; } else if (b.room !== room && b.room !== -1) continue;
      gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    }
    for (const o of this.dyns) {
      if (!o.visible) continue; const r = o.roomOv >= 0 ? o.roomOv : o.room; if (!all && r !== room && r !== -1) continue;
      gl.uniformMatrix4fv(d.u.uM, false, o.m); gl.bindVertexArray(o.vao); gl.drawElements(gl.TRIANGLES, o.count, gl.UNSIGNED_INT, 0);
    }
    if (this.insts.some(o => o.visible && o.n > 0)) {
      const di = this.progs.depthI; gl.useProgram(di); gl.uniformMatrix4fv(di.u.uVP, false, LVP); gl.uniform1f(di.u.uSub, s); gl.uniform1f(di.u.uNoShell, noShell);
      for (const o of this.insts) {
        if (!o.visible || !o.n) continue;
        if (all ? (o.shadowRoom !== undefined && o.shadowRoom < 0) : (o.shadowRoom !== undefined && o.shadowRoom !== room)) continue;
        gl.bindVertexArray(o.vao); gl.drawElementsInstanced(gl.TRIANGLES, o.count, gl.UNSIGNED_INT, 0, o.n);
      }
    }
  }
  setRooms(rooms) {
    // rooms[i] = {up:[r,g,b], dn:[r,g,b], power, gloss, min, max}
    this._roomUp = new Float32Array(MAXR * 4); this._roomDn = new Float32Array(MAXR * 4); this._roomMin = new Float32Array(MAXR * 4); this._roomMax = new Float32Array(MAXR * 4); this._roomFill = new Float32Array(MAXR * 4);
    this.rooms = rooms; this.updateRooms();
    rooms.forEach((r, i) => { if (!r) return; this._roomMin.set([...(r.min || [0, 0, 0]), 0], i * 4); this._roomMax.set([...(r.max || [0, 0, 0]), 0], i * 4); });
  }
  updateRooms() {
    this.rooms.forEach((r, i) => {
      if (!r) return; const p = r.power === undefined ? 1 : r.power, g = r.gloss === undefined ? 1 : r.gloss;
      this._roomUp.set([r.up[0] * p, r.up[1] * p, r.up[2] * p, p], i * 4);
      this._roomDn.set([r.dn[0] * p, r.dn[1] * p, r.dn[2] * p, g], i * 4);
      const fl = r.fill || [0, 0, 0]; this._roomFill.set([fl[0] * p, fl[1] * p, fl[2] * p, 0], i * 4);
    });
  }
  // Ein Bild im Bild: rechnet die Welt noch einmal in eine Textur. Monitor, Leinwand, nasse Strasse.
  // Die Textur ist sRGB kodiert; der Tone-Shader gibt dafuer linear aus (uLinOut).
  makeTarget(w, h) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.SRGB8_ALPHA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16);
    return { t, f: this._fbo([t]), w, h };
  }
  renderInto(view, target, t, story, N, shutter = .5 / 30) {
    const gl = this.gl;
    this.renderView(view, t, story, N, shutter);
    this.resolve(view, N, t, target);
    gl.bindTexture(gl.TEXTURE_2D, target.t); gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  // Vom Rechenwert zum Bild.
  resolve(view, N, t, target = null) {
    const gl = this.gl, g = this.grade, B = this.bloom;
    gl.bindVertexArray(this.vao0); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    // Bloom runter
    const d = this.progs.down; gl.useProgram(d); gl.uniform1i(d.u.uTex, 0);
    let src = view.acc, sw = view.w, sh = view.h;
    gl.activeTexture(gl.TEXTURE0);
    for (let i = 0; i < B.length; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, B[i].f); gl.viewport(0, 0, B[i].w, B[i].h);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform2f(d.u.uPx, 1 / sw, 1 / sh); gl.uniform1f(d.u.uFirst, i === 0 ? 1 : 0); gl.uniform1f(d.u.uScale, 1 / N);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = B[i].t; sw = B[i].w; sh = B[i].h;
    }
    // Bloom hoch, jede Stufe auf die naechste addiert
    const u = this.progs.up; gl.useProgram(u); gl.uniform1i(u.u.uTex, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = B.length - 1; i > 0; i--) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, B[i - 1].f); gl.viewport(0, 0, B[i - 1].w, B[i - 1].h);
      gl.bindTexture(gl.TEXTURE_2D, B[i].t);
      gl.uniform2f(u.u.uPx, 1 / B[i].w, 1 / B[i].h); gl.uniform1f(u.u.uK, .8);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    // Filmkurve
    const tn = this.progs.tone; gl.useProgram(tn);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : this.ldrFbo); gl.viewport(0, 0, target ? target.w : view.w, target ? target.h : view.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, view.acc); gl.uniform1i(tn.u.uAcc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B[0].t); gl.uniform1i(tn.u.uBloom, 1);
    gl.uniform1f(tn.u.uN, N); gl.uniform1f(tn.u.uExp, g.exp); gl.uniform3fv(tn.u.uLift, g.lift); gl.uniform3fv(tn.u.uGain, g.gain);
    gl.uniform1f(tn.u.uSat, g.sat); gl.uniform1f(tn.u.uBloomK, g.bloom); gl.uniform1f(tn.u.uVig, target && target.noVig ? 0 : g.vig); gl.uniform1f(tn.u.uFade, target ? 1 : g.fade); gl.uniform1f(tn.u.uLinOut, target ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    if (target) return;
    // Letzter Schritt
    gl.bindTexture(gl.TEXTURE_2D, this.ldr); gl.generateMipmap(gl.TEXTURE_2D);
    const f = this.progs.final; gl.useProgram(f);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h);
    gl.uniform1i(f.u.uImg, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.glyphTex || this.emptyTex); gl.uniform1i(f.u.uGlyphs, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.codeTex || this.emptyTex); gl.uniform1i(f.u.uCode, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(f.u.uFrame, Math.round(t * 30)); gl.uniform2f(f.u.uRes, this.w, this.h); gl.uniform1f(f.u.uGrain, g.grain);
    gl.uniform1f(f.u.uTextMask, this.text.mask); gl.uniform4fv(f.u.uTextGeo, this.text.geo); gl.uniform1f(f.u.uCellH, this.text.cell);
    gl.uniform2f(f.u.uCodeSize, this.codeW || 1, this.codeH || 1); gl.uniform1f(f.u.uScroll, this.text.scroll); gl.uniform2f(f.u.uCA, g.ca * .004, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  // Die Schrift fuer den Moment, in dem alles zu Text wird. Liegt als Raster von 16 x 16 Zeichen vor.
  setGlyphs(canvas) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.glyphTex = t;
  }
  setCode(chars, w, h) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, chars);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.codeTex = t; this.codeW = w; this.codeH = h;
  }
}
