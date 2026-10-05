//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, n = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
}), r = /* @__PURE__ */ t({
	InferenceSession: () => Me,
	TRACE: () => Ce,
	TRACE_EVENT_BEGIN: () => De,
	TRACE_EVENT_END: () => Oe,
	TRACE_FUNC_BEGIN: () => Te,
	TRACE_FUNC_END: () => Ee,
	Tensor: () => xe,
	default: () => kn,
	env: () => w,
	registerBackend: () => h
}), i = Object.defineProperty, a = Object.getOwnPropertyDescriptor, o = Object.getOwnPropertyNames, s = Object.prototype.hasOwnProperty, c = ((e) => typeof n < "u" ? n : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof n < "u" ? n : e)[t] }) : e)(function(e) {
	if (typeof n < "u") return n.apply(this, arguments);
	throw Error("Dynamic require of \"" + e + "\" is not supported");
}), l = (e, t, n) => () => {
	if (n) throw n[0];
	try {
		return e && (t = e(e = 0)), t;
	} catch (e) {
		throw n = [e], e;
	}
}, u = (e, t) => {
	for (var n in t) i(e, n, {
		get: t[n],
		enumerable: !0
	});
}, d = (e, t, n, r) => {
	if (t && typeof t == "object" || typeof t == "function") for (let c of o(t)) !s.call(e, c) && c !== n && i(e, c, {
		get: () => t[c],
		enumerable: !(r = a(t, c)) || r.enumerable
	});
	return e;
}, f = (e) => d(i({}, "__esModule", { value: !0 }), e), p, m, h, g, _, v = l(() => {
	p = /* @__PURE__ */ new Map(), m = [], h = (e, t, n) => {
		if (t && typeof t.init == "function" && typeof t.createInferenceSessionHandler == "function") {
			let r = p.get(e);
			if (r === void 0) p.set(e, {
				backend: t,
				priority: n
			});
			else {
				if (r.priority > n) return;
				if (r.priority === n && r.backend !== t) throw Error(`cannot register backend "${e}" using priority ${n}`);
			}
			if (n >= 0) {
				let t = m.indexOf(e);
				t !== -1 && m.splice(t, 1);
				for (let t = 0; t < m.length; t++) if (p.get(m[t]).priority <= n) {
					m.splice(t, 0, e);
					return;
				}
				m.push(e);
			}
			return;
		}
		throw TypeError("not a valid backend");
	}, g = async (e) => {
		let t = p.get(e);
		if (!t) return "backend not found.";
		if (t.initialized) return t.backend;
		if (t.aborted) return t.error;
		{
			let n = !!t.initPromise;
			try {
				return n || (t.initPromise = t.backend.init(e)), await t.initPromise, t.initialized = !0, t.backend;
			} catch (e) {
				return n || (t.error = `${e}`, t.aborted = !0), t.error;
			} finally {
				delete t.initPromise;
			}
		}
	}, _ = async (e) => {
		let t = e.executionProviders || [], n = t.map((e) => typeof e == "string" ? e : e.name), r = n.length === 0 ? m : n, i, a = [], o = /* @__PURE__ */ new Set();
		for (let e of r) {
			let t = await g(e);
			typeof t == "string" ? a.push({
				name: e,
				err: t
			}) : (i ||= t, i === t && o.add(e));
		}
		if (!i) throw Error(`no available backend found. ERR: ${a.map((e) => `[${e.name}] ${e.err}`).join(", ")}`);
		for (let { name: e, err: t } of a) n.includes(e) && console.warn(`removing requested execution provider "${e}" from session options because it is not available: ${t}`);
		let s = t.filter((e) => o.has(typeof e == "string" ? e : e.name));
		return [i, new Proxy(e, { get: (e, t) => t === "executionProviders" ? s : Reflect.get(e, t) })];
	};
}), y = l(() => {
	v();
}), b, x = l(() => {
	b = "1.31.0-dev.20260911-2a43ec07e";
}), S, C, ee = l(() => {
	x(), S = "warning", C = {
		wasm: {},
		webgl: {},
		webgpu: {},
		versions: { common: b },
		set logLevel(e) {
			if (e !== void 0) {
				if (typeof e != "string" || [
					"verbose",
					"info",
					"warning",
					"error",
					"fatal"
				].indexOf(e) === -1) throw Error(`Unsupported logging level: ${e}`);
				S = e;
			}
		},
		get logLevel() {
			return S;
		}
	}, Object.defineProperty(C, "logLevel", { enumerable: !0 });
}), w, te = l(() => {
	ee(), w = C;
}), ne, re, ie = l(() => {
	ne = (e, t) => {
		let n = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
		n.width = e.dims[3], n.height = e.dims[2];
		let r = n.getContext("2d");
		if (r != null) {
			let i, a;
			t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (i = e.dims[2], a = e.dims[3]) : (i = e.dims[3], a = e.dims[2]);
			let o = t?.format === void 0 ? "RGB" : t.format, s = t?.norm, c, l;
			s === void 0 || s.mean === void 0 ? c = [
				255,
				255,
				255,
				255
			] : typeof s.mean == "number" ? c = [
				s.mean,
				s.mean,
				s.mean,
				s.mean
			] : (c = [
				s.mean[0],
				s.mean[1],
				s.mean[2],
				0
			], s.mean[3] !== void 0 && (c[3] = s.mean[3])), s === void 0 || s.bias === void 0 ? l = [
				0,
				0,
				0,
				0
			] : typeof s.bias == "number" ? l = [
				s.bias,
				s.bias,
				s.bias,
				s.bias
			] : (l = [
				s.bias[0],
				s.bias[1],
				s.bias[2],
				0
			], s.bias[3] !== void 0 && (l[3] = s.bias[3]));
			let u = a * i, d = 0, f = u, p = u * 2, m = -1;
			o === "RGBA" ? (d = 0, f = u, p = u * 2, m = u * 3) : o === "RGB" ? (d = 0, f = u, p = u * 2) : o === "RBG" && (d = 0, p = u, f = u * 2);
			for (let t = 0; t < a; t++) for (let n = 0; n < i; n++) {
				let i = (e.data[d++] - l[0]) * c[0], a = (e.data[f++] - l[1]) * c[1], o = (e.data[p++] - l[2]) * c[2], s = m === -1 ? 255 : (e.data[m++] - l[3]) * c[3];
				r.fillStyle = "rgba(" + i + "," + a + "," + o + "," + s + ")", r.fillRect(n, t, 1, 1);
			}
			if ("toDataURL" in n) return n.toDataURL();
			throw Error("toDataURL is not supported");
		}
		throw Error("Can not access image data");
	}, re = (e, t) => {
		let n = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d"), r;
		if (n != null) {
			let i, a, o;
			t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (i = e.dims[2], a = e.dims[1], o = e.dims[3]) : (i = e.dims[3], a = e.dims[2], o = e.dims[1]);
			let s = t !== void 0 && t.format !== void 0 ? t.format : "RGB", c = t?.norm, l, u;
			c === void 0 || c.mean === void 0 ? l = [
				255,
				255,
				255,
				255
			] : typeof c.mean == "number" ? l = [
				c.mean,
				c.mean,
				c.mean,
				c.mean
			] : (l = [
				c.mean[0],
				c.mean[1],
				c.mean[2],
				255
			], c.mean[3] !== void 0 && (l[3] = c.mean[3])), c === void 0 || c.bias === void 0 ? u = [
				0,
				0,
				0,
				0
			] : typeof c.bias == "number" ? u = [
				c.bias,
				c.bias,
				c.bias,
				c.bias
			] : (u = [
				c.bias[0],
				c.bias[1],
				c.bias[2],
				0
			], c.bias[3] !== void 0 && (u[3] = c.bias[3]));
			let d = a * i;
			if (t !== void 0 && (t.format !== void 0 && o === 4 && t.format !== "RGBA" || o === 3 && t.format !== "RGB" && t.format !== "BGR")) throw Error("Tensor format doesn't match input tensor dims");
			let f = 0, p = 1, m = 2, h = 3, g = 0, _ = d, v = d * 2, y = -1;
			s === "RGBA" ? (g = 0, _ = d, v = d * 2, y = d * 3) : s === "RGB" ? (g = 0, _ = d, v = d * 2) : s === "RBG" && (g = 0, v = d, _ = d * 2), r = n.createImageData(i, a);
			for (let t = 0; t < a * i; f += 4, p += 4, m += 4, h += 4, t++) r.data[f] = (e.data[g++] - u[0]) * l[0], r.data[p] = (e.data[_++] - u[1]) * l[1], r.data[m] = (e.data[v++] - u[2]) * l[2], r.data[h] = y === -1 ? 255 : (e.data[y++] - u[3]) * l[3];
		} else throw Error("Can not access image data");
		return r;
	};
}), ae, oe, se, ce, le, ue, T = l(() => {
	be(), ae = (e, t) => {
		if (e === void 0) throw Error("Image buffer must be defined");
		if (t.height === void 0 || t.width === void 0) throw Error("Image height and width must be defined");
		if (t.tensorLayout === "NHWC") throw Error("NHWC Tensor layout is not supported yet");
		let { height: n, width: r } = t, i = t.norm ?? {
			mean: 255,
			bias: 0
		}, a, o;
		a = typeof i.mean == "number" ? [
			i.mean,
			i.mean,
			i.mean,
			i.mean
		] : [
			i.mean[0],
			i.mean[1],
			i.mean[2],
			i.mean[3] ?? 255
		], o = typeof i.bias == "number" ? [
			i.bias,
			i.bias,
			i.bias,
			i.bias
		] : [
			i.bias[0],
			i.bias[1],
			i.bias[2],
			i.bias[3] ?? 0
		];
		let s = t.format === void 0 ? "RGBA" : t.format, c = t.tensorFormat !== void 0 && t.tensorFormat !== void 0 ? t.tensorFormat : "RGB", l = n * r, u = c === "RGBA" ? new Float32Array(l * 4) : new Float32Array(l * 3), d = 4, f = 0, p = 1, m = 2, h = 3, g = 0, _ = l, v = l * 2, y = -1;
		s === "RGB" && (d = 3, f = 0, p = 1, m = 2, h = -1), c === "RGBA" ? y = l * 3 : c === "RBG" ? (g = 0, v = l, _ = l * 2) : c === "BGR" && (v = 0, _ = l, g = l * 2);
		for (let t = 0; t < l; t++, f += d, m += d, p += d, h += d) u[g++] = (e[f] + o[0]) / a[0], u[_++] = (e[p] + o[1]) / a[1], u[v++] = (e[m] + o[2]) / a[2], y !== -1 && h !== -1 && (u[y++] = (e[h] + o[3]) / a[3]);
		return c === "RGBA" ? new ye("float32", u, [
			1,
			4,
			n,
			r
		]) : new ye("float32", u, [
			1,
			3,
			n,
			r
		]);
	}, oe = async (e, t) => {
		let n = typeof HTMLImageElement < "u" && e instanceof HTMLImageElement, r = typeof ImageData < "u" && e instanceof ImageData, i = typeof ImageBitmap < "u" && e instanceof ImageBitmap, a = typeof e == "string", o, s = t ?? {}, c = () => {
			if (typeof document < "u") return document.createElement("canvas");
			if (typeof OffscreenCanvas < "u") return new OffscreenCanvas(1, 1);
			throw Error("Canvas is not supported");
		}, l = (e) => typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || e instanceof OffscreenCanvas ? e.getContext("2d") : null;
		if (n) {
			let n = c();
			n.width = e.width, n.height = e.height;
			let r = l(n);
			if (r != null) {
				let n = e.height, i = e.width;
				if (t !== void 0 && t.resizedHeight !== void 0 && t.resizedWidth !== void 0 && (n = t.resizedHeight, i = t.resizedWidth), t !== void 0) {
					if (s = t, t.tensorFormat !== void 0) throw Error("Image input config format must be RGBA for HTMLImageElement");
					s.tensorFormat = "RGBA", s.height = n, s.width = i;
				} else s.tensorFormat = "RGBA", s.height = n, s.width = i;
				r.drawImage(e, 0, 0), o = r.getImageData(0, 0, i, n).data;
			} else throw Error("Can not access image data");
		} else if (r) {
			let n, r;
			if (t !== void 0 && t.resizedWidth !== void 0 && t.resizedHeight !== void 0 ? (n = t.resizedHeight, r = t.resizedWidth) : (n = e.height, r = e.width), t !== void 0 && (s = t), s.format = "RGBA", s.height = n, s.width = r, t !== void 0) {
				let t = c();
				t.width = r, t.height = n;
				let i = l(t);
				if (i != null) i.putImageData(e, 0, 0), o = i.getImageData(0, 0, r, n).data;
				else throw Error("Can not access image data");
			} else o = e.data;
		} else if (i) {
			if (t === void 0) throw Error("Please provide image config with format for Imagebitmap");
			let n = c();
			n.width = e.width, n.height = e.height;
			let r = l(n);
			if (r != null) {
				let t = e.height, n = e.width;
				return r.drawImage(e, 0, 0, n, t), o = r.getImageData(0, 0, n, t).data, s.height = t, s.width = n, ae(o, s);
			}
			throw Error("Can not access image data");
		} else {
			if (a) return new Promise((t, n) => {
				let r = c(), i = l(r);
				if (!e || !i) return n();
				let a = new Image();
				a.crossOrigin = "Anonymous", a.src = e, a.onload = () => {
					r.width = a.width, r.height = a.height, i.drawImage(a, 0, 0, r.width, r.height);
					let e = i.getImageData(0, 0, r.width, r.height);
					s.height = r.height, s.width = r.width, t(ae(e.data, s));
				};
			});
			throw Error("Input data provided is not supported - aborted tensor creation");
		}
		if (o !== void 0) return ae(o, s);
		throw Error("Input data provided is not supported - aborted tensor creation");
	}, se = (e, t) => {
		let { width: n, height: r, download: i, dispose: a } = t;
		return new ye({
			location: "texture",
			type: "float32",
			texture: e,
			dims: [
				1,
				r,
				n,
				4
			],
			download: i,
			dispose: a
		});
	}, ce = (e, t) => {
		let { dataType: n, dims: r, download: i, dispose: a } = t;
		return new ye({
			location: "gpu-buffer",
			type: n ?? "float32",
			gpuBuffer: e,
			dims: r,
			download: i,
			dispose: a
		});
	}, le = (e, t) => {
		let { dataType: n, dims: r, download: i, dispose: a } = t;
		return new ye({
			location: "ml-tensor",
			type: n ?? "float32",
			mlTensor: e,
			dims: r,
			download: i,
			dispose: a
		});
	}, ue = (e, t, n) => new ye({
		location: "cpu-pinned",
		type: e,
		data: t,
		dims: n ?? [t.length]
	});
}), de, fe, pe, me, he = l(() => {
	de = /* @__PURE__ */ new Map([
		["float32", Float32Array],
		["uint8", Uint8Array],
		["int8", Int8Array],
		["uint16", Uint16Array],
		["int16", Int16Array],
		["int32", Int32Array],
		["bool", Uint8Array],
		["float64", Float64Array],
		["uint32", Uint32Array],
		["int4", Uint8Array],
		["uint4", Uint8Array]
	]), fe = /* @__PURE__ */ new Map([
		[Float32Array, "float32"],
		[Uint8Array, "uint8"],
		[Int8Array, "int8"],
		[Uint16Array, "uint16"],
		[Int16Array, "int16"],
		[Int32Array, "int32"],
		[Float64Array, "float64"],
		[Uint32Array, "uint32"]
	]), pe = !1, me = () => {
		if (!pe) {
			pe = !0;
			let e = typeof BigInt64Array < "u" && BigInt64Array.from, t = typeof BigUint64Array < "u" && BigUint64Array.from, n = globalThis.Float16Array, r = typeof n < "u" && n.from;
			e && (de.set("int64", BigInt64Array), fe.set(BigInt64Array, "int64")), t && (de.set("uint64", BigUint64Array), fe.set(BigUint64Array, "uint64")), r ? (de.set("float16", n), fe.set(n, "float16")) : de.set("float16", Uint16Array);
		}
	};
}), ge, _e, ve = l(() => {
	be(), ge = (e) => {
		let t = 1;
		for (let n = 0; n < e.length; n++) {
			let r = e[n];
			if (typeof r != "number" || !Number.isSafeInteger(r)) throw TypeError(`dims[${n}] must be an integer, got: ${r}`);
			if (r < 0) throw RangeError(`dims[${n}] must be a non-negative integer, got: ${r}`);
			t *= r;
		}
		return t;
	}, _e = (e, t) => {
		switch (e.location) {
			case "cpu": return new ye(e.type, e.data, t);
			case "cpu-pinned": return new ye({
				location: "cpu-pinned",
				data: e.data,
				type: e.type,
				dims: t
			});
			case "texture": return new ye({
				location: "texture",
				texture: e.texture,
				type: e.type,
				dims: t
			});
			case "gpu-buffer": return new ye({
				location: "gpu-buffer",
				gpuBuffer: e.gpuBuffer,
				type: e.type,
				dims: t
			});
			case "ml-tensor": return new ye({
				location: "ml-tensor",
				mlTensor: e.mlTensor,
				type: e.type,
				dims: t
			});
			default: throw Error(`tensorReshape: tensor location ${e.location} is not supported`);
		}
	};
}), ye, be = l(() => {
	ie(), T(), he(), ve(), ye = class {
		constructor(e, t, n) {
			me();
			let r, i;
			if (typeof e == "object" && "location" in e) switch (this.dataLocation = e.location, r = e.type, i = e.dims, e.location) {
				case "cpu-pinned": {
					let t = de.get(r);
					if (!t) throw TypeError(`unsupported type "${r}" to create tensor from pinned buffer`);
					if (!(e.data instanceof t)) throw TypeError(`buffer should be of type ${t.name}`);
					this.cpuData = e.data;
					break;
				}
				case "texture":
					if (r !== "float32") throw TypeError(`unsupported type "${r}" to create tensor from texture`);
					this.gpuTextureData = e.texture, this.downloader = e.download, this.disposer = e.dispose;
					break;
				case "gpu-buffer":
					if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw TypeError(`unsupported type "${r}" to create tensor from gpu buffer`);
					this.gpuBufferData = e.gpuBuffer, this.downloader = e.download, this.disposer = e.dispose;
					break;
				case "ml-tensor":
					if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint64" && r !== "int8" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw TypeError(`unsupported type "${r}" to create tensor from MLTensor`);
					this.mlTensorData = e.mlTensor, this.downloader = e.download, this.disposer = e.dispose;
					break;
				default: throw Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
			}
			else {
				let a, o;
				if (typeof e == "string") {
					if (r = e, o = n, e === "string") {
						if (!Array.isArray(t)) throw TypeError("A string tensor's data must be a string array.");
						a = t;
					} else {
						let n = de.get(e);
						if (n === void 0) throw TypeError(`Unsupported tensor type: ${e}.`);
						if (Array.isArray(t)) {
							if (e === "float16" && n === Uint16Array || e === "uint4" || e === "int4") throw TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${n.name} as data.`);
							a = e === "uint64" || e === "int64" ? n.from(t, BigInt) : n.from(t);
						} else if (t instanceof n) a = t;
						else if (t instanceof Uint8ClampedArray) {
							if (e === "uint8") a = Uint8Array.from(t);
							else throw TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
						} else if (e === "float16" && t instanceof Uint16Array && n !== Uint16Array) a = new globalThis.Float16Array(t.buffer, t.byteOffset, t.length);
						else throw TypeError(`A ${r} tensor's data must be type of ${n}`);
					}
				} else if (o = t, Array.isArray(e)) {
					if (e.length === 0) throw TypeError("Tensor type cannot be inferred from an empty array.");
					let t = typeof e[0];
					if (t === "string") r = "string", a = e;
					else if (t === "boolean") r = "bool", a = Uint8Array.from(e);
					else throw TypeError(`Invalid element type of data array: ${t}.`);
				} else if (e instanceof Uint8ClampedArray) r = "uint8", a = Uint8Array.from(e);
				else {
					let t = fe.get(e.constructor);
					if (t === void 0) throw TypeError(`Unsupported type for tensor data: ${e.constructor}.`);
					r = t, a = e;
				}
				if (o === void 0) o = [a.length];
				else if (!Array.isArray(o)) throw TypeError("A tensor's dims must be a number array");
				i = o, this.cpuData = a, this.dataLocation = "cpu";
			}
			let a = ge(i);
			if (this.cpuData && a !== this.cpuData.length && (r !== "uint4" && r !== "int4" || Math.ceil(a / 2) !== this.cpuData.length)) throw Error(`Tensor's size(${a}) does not match data length(${this.cpuData.length}).`);
			this.type = r, this.dims = i, this.size = a;
		}
		static async fromImage(e, t) {
			return oe(e, t);
		}
		static fromTexture(e, t) {
			return se(e, t);
		}
		static fromGpuBuffer(e, t) {
			return ce(e, t);
		}
		static fromMLTensor(e, t) {
			return le(e, t);
		}
		static fromPinnedBuffer(e, t, n) {
			return ue(e, t, n);
		}
		toDataURL(e) {
			return ne(this, e);
		}
		toImageData(e) {
			return re(this, e);
		}
		get data() {
			if (this.ensureValid(), !this.cpuData) throw Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
			return this.cpuData;
		}
		get location() {
			return this.dataLocation;
		}
		get texture() {
			if (this.ensureValid(), !this.gpuTextureData) throw Error("The data is not stored as a WebGL texture.");
			return this.gpuTextureData;
		}
		get gpuBuffer() {
			if (this.ensureValid(), !this.gpuBufferData) throw Error("The data is not stored as a WebGPU buffer.");
			return this.gpuBufferData;
		}
		get mlTensor() {
			if (this.ensureValid(), !this.mlTensorData) throw Error("The data is not stored as a WebNN MLTensor.");
			return this.mlTensorData;
		}
		async getData(e) {
			switch (this.ensureValid(), this.dataLocation) {
				case "cpu":
				case "cpu-pinned": return this.data;
				case "texture":
				case "gpu-buffer":
				case "ml-tensor":
					if (!this.downloader) throw Error("The current tensor is not created with a specified data downloader.");
					if (this.isDownloading) throw Error("The current tensor is being downloaded.");
					try {
						this.isDownloading = !0;
						let t = await this.downloader();
						return this.downloader = void 0, this.dataLocation = "cpu", this.cpuData = t, e && this.disposer && (this.disposer(), this.disposer = void 0), t;
					} finally {
						this.isDownloading = !1;
					}
				default: throw Error(`cannot get data from location: ${this.dataLocation}`);
			}
		}
		dispose() {
			if (this.isDownloading) throw Error("The current tensor is being downloaded.");
			this.disposer &&= (this.disposer(), void 0), this.cpuData = void 0, this.gpuTextureData = void 0, this.gpuBufferData = void 0, this.mlTensorData = void 0, this.downloader = void 0, this.isDownloading = void 0, this.dataLocation = "none";
		}
		ensureValid() {
			if (this.dataLocation === "none") throw Error("The tensor is disposed.");
		}
		reshape(e) {
			if (this.ensureValid(), this.downloader || this.disposer) throw Error("Cannot reshape a tensor that owns GPU resource.");
			return _e(this, e);
		}
	};
}), xe, Se = l(() => {
	be(), xe = ye;
}), Ce, we, Te, Ee, De, Oe, ke = l(() => {
	ee(), Ce = (e, t) => {
		(typeof C.trace > "u" ? !C.wasm.trace : !C.trace) || console.timeStamp(`${e}::ORT::${t}`);
	}, we = (e, t) => {
		let n = (/* @__PURE__ */ Error()).stack?.split(/\r\n|\r|\n/g) || [], r = !1;
		for (let i = 0; i < n.length; i++) {
			if (r && !n[i].includes("TRACE_FUNC")) {
				let r = `FUNC_${e}::${n[i].trim().split(" ")[1]}`;
				t && (r += `::${t}`), Ce("CPU", r);
				return;
			}
			n[i].includes("TRACE_FUNC") && (r = !0);
		}
	}, Te = (e) => {
		(typeof C.trace > "u" ? !C.wasm.trace : !C.trace) || we("BEGIN", e);
	}, Ee = (e) => {
		(typeof C.trace > "u" ? !C.wasm.trace : !C.trace) || we("END", e);
	}, De = (e) => {
		(typeof C.trace > "u" ? !C.wasm.trace : !C.trace) || console.time(`ORT::${e}`);
	}, Oe = (e) => {
		(typeof C.trace > "u" ? !C.wasm.trace : !C.trace) || console.timeEnd(`ORT::${e}`);
	};
}), Ae, je = l(() => {
	v(), Se(), ke(), Ae = class e {
		constructor(e) {
			this.handler = e;
		}
		async run(e, t, n) {
			Te(), De("InferenceSession.run");
			let r = {}, i = {};
			if (typeof e != "object" || !e || e instanceof xe || Array.isArray(e)) throw TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
			let a = !0;
			if (typeof t == "object") {
				if (t === null) throw TypeError("Unexpected argument[1]: cannot be null.");
				if (t instanceof xe) throw TypeError("'fetches' cannot be a Tensor");
				if (Array.isArray(t)) {
					if (t.length === 0) throw TypeError("'fetches' cannot be an empty array.");
					a = !1;
					for (let e of t) {
						if (typeof e != "string") throw TypeError("'fetches' must be a string array or an object.");
						if (this.outputNames.indexOf(e) === -1) throw RangeError(`'fetches' contains invalid output name: ${e}.`);
						r[e] = null;
					}
					if (typeof n == "object" && n) i = n;
					else if (typeof n < "u") throw TypeError("'options' must be an object.");
				} else {
					let e = !1, o = Object.getOwnPropertyNames(t);
					for (let n of this.outputNames) if (o.indexOf(n) !== -1) {
						let i = t[n];
						(i === null || i instanceof xe) && (e = !0, a = !1, r[n] = i);
					}
					if (e) {
						if (typeof n == "object" && n) i = n;
						else if (typeof n < "u") throw TypeError("'options' must be an object.");
					} else i = t;
				}
			} else if (typeof t < "u") throw TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
			for (let t of this.inputNames) if (typeof e[t] > "u") throw Error(`input '${t}' is missing in 'feeds'.`);
			if (a) for (let e of this.outputNames) r[e] = null;
			let o = await this.handler.run(e, r, i), s = {};
			for (let e in o) if (Object.hasOwnProperty.call(o, e)) {
				let t = o[e];
				s[e] = t instanceof xe ? t : new xe(t.type, t.data, t.dims);
			}
			return Oe("InferenceSession.run"), Ee(), s;
		}
		async release() {
			return this.handler.dispose();
		}
		static async create(t, n, r, i) {
			Te(), De("InferenceSession.create");
			let a, o = {};
			if (typeof t == "string") {
				if (a = t, typeof n == "object" && n) o = n;
				else if (typeof n < "u") throw TypeError("'options' must be an object.");
			} else if (t instanceof Uint8Array) {
				if (a = t, typeof n == "object" && n) o = n;
				else if (typeof n < "u") throw TypeError("'options' must be an object.");
			} else if (t instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && t instanceof SharedArrayBuffer) {
				let e = t, s = 0, c = t.byteLength;
				if (typeof n == "object" && n) o = n;
				else if (typeof n == "number") {
					if (s = n, !Number.isSafeInteger(s)) throw RangeError("'byteOffset' must be an integer.");
					if (s < 0 || s >= e.byteLength) throw RangeError(`'byteOffset' is out of range [0, ${e.byteLength}).`);
					if (c = t.byteLength - s, typeof r == "number") {
						if (c = r, !Number.isSafeInteger(c)) throw RangeError("'byteLength' must be an integer.");
						if (c <= 0 || s + c > e.byteLength) throw RangeError(`'byteLength' is out of range (0, ${e.byteLength - s}].`);
						if (typeof i == "object" && i) o = i;
						else if (typeof i < "u") throw TypeError("'options' must be an object.");
					} else if (typeof r < "u") throw TypeError("'byteLength' must be a number.");
				} else if (typeof n < "u") throw TypeError("'options' must be an object.");
				a = new Uint8Array(e, s, c);
			} else throw TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
			let [s, c] = await _(o), l = await s.createInferenceSessionHandler(a, c);
			return Oe("InferenceSession.create"), Ee(), new e(l);
		}
		startProfiling() {
			this.handler.startProfiling();
		}
		endProfiling() {
			this.handler.endProfiling();
		}
		get inputNames() {
			return this.handler.inputNames;
		}
		get outputNames() {
			return this.handler.outputNames;
		}
		get inputMetadata() {
			return this.handler.inputMetadata;
		}
		get outputMetadata() {
			return this.handler.outputMetadata;
		}
	};
}), Me, Ne = l(() => {
	je(), Me = Ae;
}), Pe = l(() => {}), Fe = l(() => {}), Ie = l(() => {}), Le = l(() => {}), Re = {};
u(Re, {
	InferenceSession: () => Me,
	TRACE: () => Ce,
	TRACE_EVENT_BEGIN: () => De,
	TRACE_EVENT_END: () => Oe,
	TRACE_FUNC_BEGIN: () => Te,
	TRACE_FUNC_END: () => Ee,
	Tensor: () => xe,
	env: () => w,
	registerBackend: () => h
});
var ze = l(() => {
	y(), te(), Ne(), Se(), Pe(), Fe(), ke(), Ie(), Le();
}), Be = l(() => {}), Ve = {};
u(Ve, { default: () => We });
var He, Ue, We, Ge = l(() => {
	Qt(), ht(), ot(), He = "ort-wasm-proxy-worker", Ue = globalThis.self?.name === He, Ue && (self.onmessage = (e) => {
		let { type: t, in: n } = e.data;
		try {
			switch (t) {
				case "init-wasm":
					mt(n.wasm).then(() => {
						Bt(n).then(() => {
							postMessage({ type: t });
						}, (e) => {
							postMessage({
								type: t,
								err: e
							});
						});
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				case "init-ep": {
					let { epName: e, env: r } = n;
					Vt(r, e).then(() => {
						postMessage({ type: t });
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				}
				case "copy-from": {
					let { buffer: e } = n, r = Gt(e);
					postMessage({
						type: t,
						out: r
					});
					break;
				}
				case "create": {
					let { model: e, options: r } = n;
					Kt(e, r).then((e) => {
						postMessage({
							type: t,
							out: e
						});
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				}
				case "release":
					qt(n), postMessage({ type: t });
					break;
				case "run": {
					let { sessionId: e, inputIndices: r, inputs: i, outputIndices: a, options: o } = n;
					Yt(e, r, i, a, Array(a.length).fill(null), o).then((e) => {
						e.some((e) => e[3] !== "cpu") ? postMessage({
							type: t,
							err: "Proxy does not support non-cpu tensor location."
						}) : postMessage({
							type: t,
							out: e
						}, Zt([...i, ...e]));
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				}
				case "end-profiling": Xt(n), postMessage({ type: t });
			}
		} catch (e) {
			postMessage({
				type: t,
				err: e
			});
		}
	}), We = Ue ? null : (e) => new Worker(e ?? Ye, {
		type: "module",
		name: He
	});
}), Ke, qe, Je, Ye, Xe, Ze, Qe, $e, et, tt, nt, rt, it, at, ot = l(() => {
	Be(), Ke = typeof location > "u" ? void 0 : location.origin, qe = import.meta.url > "file:" && import.meta.url < "file;", Je = () => qe ? new URL(new URL("ort.wasm.min.mjs", import.meta.url).href, Ke).href : import.meta.url, Ye = Je(), Xe = () => {
		if (Ye && !Ye.startsWith("blob:")) return Ye.substring(0, Ye.lastIndexOf("/") + 1);
	}, Ze = (e, t) => {
		try {
			let n = t ?? Ye;
			return (n ? new URL(e, n) : new URL(e)).origin === Ke;
		} catch {
			return !1;
		}
	}, Qe = (e, t) => {
		let n = t ?? Ye;
		try {
			return (n ? new URL(e, n) : new URL(e)).href;
		} catch {
			return;
		}
	}, $e = (e, t) => `${t ?? "./"}${e}`, et = async (e) => {
		let t = await (await fetch(e, { credentials: "same-origin" })).blob();
		return URL.createObjectURL(t);
	}, tt = async (e) => (await import(
		/*webpackIgnore:true*/
		/*@vite-ignore*/
		e
)).default, nt = (Ge(), f(Ve)).default, rt = async () => {
		if (!Ye) throw Error("Failed to load proxy worker: cannot determine the script source URL.");
		if (Ze(Ye)) return [void 0, nt()];
		let e = await et(Ye);
		return [e, nt(e)];
	}, it = void 0, at = async (e, t, n, r) => {
		let i = it && !(e || t);
		if (i) {
			if (Ye) i = Ze(Ye) || r && !n;
			else if (r && !n) i = !0;
			else throw Error("cannot determine the script source URL.");
		}
		if (i) return [void 0, it];
		{
			let r = "ort-wasm-simd-threaded.mjs", i = e ?? Qe(r, t), a = n && i && !Ze(i, t), o = a ? await et(i) : i ?? $e(r, t);
			return [a ? o : void 0, await tt(o)];
		}
	};
}), st, ct, lt, ut, dt, ft, pt, mt, E, ht = l(() => {
	ot(), ct = !1, lt = !1, ut = !1, dt = () => {
		if (typeof SharedArrayBuffer > "u") return !1;
		try {
			return typeof MessageChannel < "u" && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WebAssembly.validate(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				4,
				1,
				96,
				0,
				0,
				3,
				2,
				1,
				0,
				5,
				4,
				1,
				3,
				1,
				1,
				10,
				11,
				1,
				9,
				0,
				65,
				0,
				254,
				16,
				2,
				0,
				26,
				11
			]));
		} catch {
			return !1;
		}
	}, ft = () => {
		try {
			return WebAssembly.validate(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				4,
				1,
				96,
				0,
				0,
				3,
				2,
				1,
				0,
				10,
				30,
				1,
				28,
				0,
				65,
				0,
				253,
				15,
				253,
				12,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				253,
				186,
				1,
				26,
				11
			]));
		} catch {
			return !1;
		}
	}, pt = () => {
		try {
			return WebAssembly.validate(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				5,
				1,
				96,
				0,
				1,
				123,
				3,
				2,
				1,
				0,
				10,
				19,
				1,
				17,
				0,
				65,
				1,
				253,
				15,
				65,
				2,
				253,
				15,
				65,
				3,
				253,
				15,
				253,
				147,
				2,
				11
			]));
		} catch {
			return !1;
		}
	}, mt = async (e) => {
		if (ct) return Promise.resolve();
		if (lt) throw Error("multiple calls to 'initializeWebAssembly()' detected.");
		if (ut) throw Error("previous call to 'initializeWebAssembly()' failed.");
		lt = !0;
		let t = e.initTimeout, n = e.numThreads;
		if (e.simd !== !1) {
			if (e.simd === "relaxed") {
				if (!pt()) throw Error("Relaxed WebAssembly SIMD is not supported in the current environment.");
			} else if (!ft()) throw Error("WebAssembly SIMD is not supported in the current environment.");
		}
		let r = dt();
		n > 1 && !r && (typeof self < "u" && !self.crossOriginIsolated && console.warn("env.wasm.numThreads is set to " + n + ", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."), console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."), e.numThreads = n = 1);
		let i = e.wasmPaths, a = typeof i == "string" ? i : void 0, o = i?.mjs, s = o?.href ?? o, c = i?.wasm, l = c?.href ?? c, u = e.wasmBinary, [d, f] = await at(s, a, n > 1, !!u || !!l), p = !1, m = [];
		if (t > 0 && m.push(new Promise((e) => {
			setTimeout(() => {
				p = !0, e();
			}, t);
		})), m.push(new Promise((e, t) => {
			let r = { numThreads: n };
			if (u) r.wasmBinary = u, r.locateFile = (e) => e;
			else if (l || a) r.locateFile = (e) => l ?? a + e;
			else if (s && s.indexOf("blob:") !== 0) r.locateFile = (e) => new URL(e, s).href;
			else if (d) {
				let e = Xe();
				e && (r.locateFile = (t) => e + t);
			}
			f(r).then((t) => {
				lt = !1, ct = !0, st = t, e(), d && URL.revokeObjectURL(d);
			}, (e) => {
				lt = !1, ut = !0, t(e);
			});
		})), await Promise.race(m), p) throw Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`);
	}, E = () => {
		if (ct && st) return st;
		throw Error("WebAssembly is not initialized yet.");
	};
}), gt, _t, D, vt = l(() => {
	ht(), gt = (e, t) => {
		let n = E(), r = n.lengthBytesUTF8(e) + 1, i = n._malloc(r);
		return n.stringToUTF8(e, i, r), t.push(i), i;
	}, _t = (e, t, n, r) => {
		if (typeof e == "object" && e) {
			if (n.has(e)) throw Error("Circular reference in options");
			n.add(e);
		}
		Object.entries(e).forEach(([e, i]) => {
			let a = t ? t + e : e;
			if (typeof i == "object") _t(i, a + ".", n, r);
			else if (typeof i == "string" || typeof i == "number") r(a, i.toString());
			else if (typeof i == "boolean") r(a, i ? "1" : "0");
			else throw Error(`Can't handle extra config type: ${typeof i}`);
		});
	}, D = (e) => {
		let t = E(), n = t.stackSave();
		try {
			let n = t.PTR_SIZE, r = t.stackAlloc(2 * n);
			t._OrtGetLastError(r, r + n);
			let i = Number(t.getValue(r, n === 4 ? "i32" : "i64")), a = t.getValue(r + n, "*"), o = a ? t.UTF8ToString(a) : "";
			throw Error(`${e} ERROR_CODE: ${i}, ERROR_MESSAGE: ${o}`);
		} finally {
			t.stackRestore(n);
		}
	};
}), yt, bt = l(() => {
	ht(), vt(), yt = (e) => {
		let t = E(), n = 0, r = [], i = e || {};
		try {
			if (e?.logSeverityLevel === void 0) i.logSeverityLevel = 2;
			else if (typeof e.logSeverityLevel != "number" || !Number.isInteger(e.logSeverityLevel) || e.logSeverityLevel < 0 || e.logSeverityLevel > 4) throw Error(`log severity level is not valid: ${e.logSeverityLevel}`);
			if (e?.logVerbosityLevel === void 0) i.logVerbosityLevel = 0;
			else if (typeof e.logVerbosityLevel != "number" || !Number.isInteger(e.logVerbosityLevel)) throw Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);
			e?.terminate === void 0 && (i.terminate = !1);
			let a = 0;
			return e?.tag !== void 0 && (a = gt(e.tag, r)), n = t._OrtCreateRunOptions(i.logSeverityLevel, i.logVerbosityLevel, !!i.terminate, a), n === 0 && D("Can't create run options."), e?.extra !== void 0 && _t(e.extra, "", /* @__PURE__ */ new WeakSet(), (e, i) => {
				let a = gt(e, r), o = gt(i, r);
				t._OrtAddRunConfigEntry(n, a, o) !== 0 && D(`Can't set a run config entry: ${e} - ${i}.`);
			}), [n, r];
		} catch (e) {
			throw n !== 0 && t._OrtReleaseRunOptions(n), r.forEach((e) => t._free(e)), e;
		}
	};
}), xt, St, Ct, wt, Tt, Et, Dt = l(() => {
	ht(), vt(), xt = (e) => {
		switch (e) {
			case "disabled": return 0;
			case "basic": return 1;
			case "extended": return 2;
			case "layout": return 3;
			case "all": return 99;
			default: throw Error(`unsupported graph optimization level: ${e}`);
		}
	}, St = (e) => {
		switch (e) {
			case "sequential": return 0;
			case "parallel": return 1;
			default: throw Error(`unsupported execution mode: ${e}`);
		}
	}, Ct = (e) => {
		e.extra ||= {}, e.extra.session || (e.extra.session = {});
		let t = e.extra.session;
		t.use_ort_model_bytes_directly ||= "1", e.executionProviders && e.executionProviders.some((e) => (typeof e == "string" ? e : e.name) === "webgpu") && (e.enableMemPattern = !1);
	}, wt = (e, t, n, r) => {
		let i = gt(t, r), a = gt(n, r);
		E()._OrtAddSessionConfigEntry(e, i, a) !== 0 && D(`Can't set a session config entry: ${t} - ${n}.`);
	}, Tt = async (e, t, n) => {
		let r = t.executionProviders;
		for (let t of r) {
			let r = typeof t == "string" ? t : t.name, i = [];
			switch (r) {
				case "webnn":
					if (r = "WEBNN", wt(e, "session.disable_quant_qdq", "1", n), wt(e, "session.disable_qdq_constant_folding", "1", n), typeof t != "string") {
						let r = t?.deviceType;
						r && wt(e, "deviceType", r, n);
					}
					break;
				case "webgpu":
					if (r = "JS", typeof t != "string") {
						let r = t;
						if (r?.preferredLayout) {
							if (r.preferredLayout !== "NCHW" && r.preferredLayout !== "NHWC") throw Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${r.preferredLayout}`);
							wt(e, "preferredLayout", r.preferredLayout, n);
						}
					}
					break;
				case "wasm":
				case "cpu": continue;
				default: throw Error(`not supported execution provider: ${r}`);
			}
			let a = gt(r, n), o = i.length, s = 0, c = 0;
			if (o > 0) {
				s = E()._malloc(o * E().PTR_SIZE), n.push(s), c = E()._malloc(o * E().PTR_SIZE), n.push(c);
				for (let e = 0; e < o; e++) E().setValue(s + e * E().PTR_SIZE, i[e][0], "*"), E().setValue(c + e * E().PTR_SIZE, i[e][1], "*");
			}
			await E()._OrtAppendExecutionProvider(e, a, s, c, o) !== 0 && D(`Can't append execution provider: ${r}.`);
		}
	}, Et = async (e) => {
		let t = E(), n = 0, r = [], i = e || {};
		Ct(i);
		try {
			let e = xt(i.graphOptimizationLevel ?? "all"), a = St(i.executionMode ?? "sequential"), o = typeof i.logId == "string" ? gt(i.logId, r) : 0, s = i.logSeverityLevel ?? 2;
			if (!Number.isInteger(s) || s < 0 || s > 4) throw Error(`log severity level is not valid: ${s}`);
			let c = i.logVerbosityLevel ?? 0;
			if (!Number.isInteger(c) || c < 0 || c > 4) throw Error(`log verbosity level is not valid: ${c}`);
			let l = typeof i.optimizedModelFilePath == "string" ? gt(i.optimizedModelFilePath, r) : 0;
			if (n = t._OrtCreateSessionOptions(e, !!i.enableCpuMemArena, !!i.enableMemPattern, a, !!i.enableProfiling, 0, o, s, c, l), n === 0 && D("Can't create session options."), i.executionProviders && await Tt(n, i, r), i.enableGraphCapture !== void 0) {
				if (typeof i.enableGraphCapture != "boolean") throw Error(`enableGraphCapture must be a boolean value: ${i.enableGraphCapture}`);
				wt(n, "enableGraphCapture", i.enableGraphCapture.toString(), r);
			}
			if (i.freeDimensionOverrides) for (let [e, a] of Object.entries(i.freeDimensionOverrides)) {
				if (typeof e != "string") throw Error(`free dimension override name must be a string: ${e}`);
				if (typeof a != "number" || !Number.isInteger(a) || a < 0) throw Error(`free dimension override value must be a non-negative integer: ${a}`);
				let i = gt(e, r);
				t._OrtAddFreeDimensionOverride(n, i, a) !== 0 && D(`Can't set a free dimension override: ${e} - ${a}.`);
			}
			return i.extra !== void 0 && _t(i.extra, "", /* @__PURE__ */ new WeakSet(), (e, t) => {
				wt(n, e, t, r);
			}), [n, r];
		} catch (e) {
			throw n !== 0 && t._OrtReleaseSessionOptions(n) !== 0 && D("Can't release session options."), r.forEach((e) => t._free(e)), e;
		}
	};
}), Ot, kt, At, jt, Mt, Nt, Pt, Ft, It = l(() => {
	Ot = (e) => {
		switch (e) {
			case "int8": return 3;
			case "uint8": return 2;
			case "bool": return 9;
			case "int16": return 5;
			case "uint16": return 4;
			case "int32": return 6;
			case "uint32": return 12;
			case "float16": return 10;
			case "float32": return 1;
			case "float64": return 11;
			case "string": return 8;
			case "int64": return 7;
			case "uint64": return 13;
			case "int4": return 22;
			case "uint4": return 21;
			default: throw Error(`unsupported data type: ${e}`);
		}
	}, kt = (e) => {
		switch (e) {
			case 3: return "int8";
			case 2: return "uint8";
			case 9: return "bool";
			case 5: return "int16";
			case 4: return "uint16";
			case 6: return "int32";
			case 12: return "uint32";
			case 10: return "float16";
			case 1: return "float32";
			case 11: return "float64";
			case 8: return "string";
			case 7: return "int64";
			case 13: return "uint64";
			case 22: return "int4";
			case 21: return "uint4";
			default: throw Error(`unsupported data type: ${e}`);
		}
	}, At = (e, t) => {
		let n = [
			-1,
			4,
			1,
			1,
			2,
			2,
			4,
			8,
			-1,
			1,
			2,
			8,
			4,
			8,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			.5,
			.5
		][e], r = typeof t == "number" ? t : t.reduce((e, t) => e * t, 1);
		return n > 0 ? Math.ceil(r * n) : void 0;
	}, jt = (e) => {
		switch (e) {
			case "float16": return typeof Float16Array < "u" ? Float16Array : Uint16Array;
			case "float32": return Float32Array;
			case "uint8": return Uint8Array;
			case "int8": return Int8Array;
			case "uint16": return Uint16Array;
			case "int16": return Int16Array;
			case "int32": return Int32Array;
			case "bool": return Uint8Array;
			case "float64": return Float64Array;
			case "uint32": return Uint32Array;
			case "int64": return BigInt64Array;
			case "uint64": return BigUint64Array;
			default: throw Error(`unsupported type: ${e}`);
		}
	}, Mt = (e) => {
		switch (e) {
			case "verbose": return 0;
			case "info": return 1;
			case "warning": return 2;
			case "error": return 3;
			case "fatal": return 4;
			default: throw Error(`unsupported logging level: ${e}`);
		}
	}, Nt = (e) => e === "float32" || e === "float16" || e === "int32" || e === "int64" || e === "uint32" || e === "uint8" || e === "bool" || e === "uint4" || e === "int4", Pt = (e) => e === "float32" || e === "float16" || e === "int32" || e === "int64" || e === "uint32" || e === "uint64" || e === "int8" || e === "uint8" || e === "bool" || e === "uint4" || e === "int4", Ft = (e) => {
		switch (e) {
			case "none": return 0;
			case "cpu": return 1;
			case "cpu-pinned": return 2;
			case "texture": return 3;
			case "gpu-buffer": return 4;
			case "ml-tensor": return 5;
			default: throw Error(`unsupported data location: ${e}`);
		}
	};
}), Lt, Rt = l(() => {
	Be(), Lt = async (e) => {
		if (typeof e == "string") {
			let t = await fetch(e);
			if (!t.ok) throw Error(`failed to load external data file: ${e}`);
			let n = t.headers.get("Content-Length"), r = n ? parseInt(n, 10) : 0;
			if (r < 1073741824) return new Uint8Array(await t.arrayBuffer());
			{
				if (!t.body) throw Error(`failed to load external data file: ${e}, no response body.`);
				let n = t.body.getReader(), i;
				try {
					i = new ArrayBuffer(r);
				} catch (e) {
					if (e instanceof RangeError) {
						let e = Math.ceil(r / 65536);
						i = new WebAssembly.Memory({
							initial: e,
							maximum: e
						}).buffer;
					} else throw e;
				}
				let a = 0;
				for (;;) {
					let { done: e, value: t } = await n.read();
					if (e) break;
					let r = t.byteLength;
					new Uint8Array(i, a, r).set(t), a += r;
				}
				return new Uint8Array(i, 0, r);
			}
		}
		return e instanceof Blob ? new Uint8Array(await e.arrayBuffer()) : e instanceof Uint8Array ? e : new Uint8Array(e);
	};
}), zt, Bt, Vt, Ht, Ut, Wt, Gt, Kt, qt, Jt, Yt, Xt, Zt, Qt = l(() => {
	ze(), bt(), Dt(), It(), ht(), vt(), Rt(), zt = (e, t) => {
		E()._OrtInit(e, t) !== 0 && D("Can't initialize onnxruntime.");
	}, Bt = async (e) => {
		zt(e.wasm.numThreads, Mt(e.logLevel));
	}, Vt = async (e, t) => {
		E().asyncInit?.();
		let n = e.webgpu.adapter;
		if (t === "webgpu") {
			if (typeof navigator > "u" || !navigator.gpu) throw Error("WebGPU is not supported in current environment");
			if (n) {
				if (typeof n.limits != "object" || typeof n.features != "object" || typeof n.requestDevice != "function") throw Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.");
			} else {
				let t = e.webgpu.powerPreference;
				if (t !== void 0 && t !== "low-power" && t !== "high-performance") throw Error(`Invalid powerPreference setting: "${t}"`);
				let r = e.webgpu.forceFallbackAdapter;
				if (r !== void 0 && typeof r != "boolean") throw Error(`Invalid forceFallbackAdapter setting: "${r}"`);
				if (n = await navigator.gpu.requestAdapter({
					powerPreference: t,
					forceFallbackAdapter: r
				}), !n) throw Error("Failed to get GPU adapter. You may need to enable flag \"--enable-unsafe-webgpu\" if you are using Chrome.");
			}
		}
		if (t === "webnn" && (typeof navigator > "u" || !navigator.ml)) throw Error("WebNN is not supported in current environment");
	}, Ht = /* @__PURE__ */ new Map(), Ut = (e) => {
		let t = E(), n = t.stackSave();
		try {
			let n = t.PTR_SIZE, r = t.stackAlloc(2 * n);
			t._OrtGetInputOutputCount(e, r, r + n) !== 0 && D("Can't get session input/output count.");
			let i = n === 4 ? "i32" : "i64";
			return [Number(t.getValue(r, i)), Number(t.getValue(r + n, i))];
		} finally {
			t.stackRestore(n);
		}
	}, Wt = (e, t) => {
		let n = E(), r = n.stackSave(), i = 0;
		try {
			let r = n.PTR_SIZE, a = n.stackAlloc(2 * r);
			n._OrtGetInputOutputMetadata(e, t, a, a + r) !== 0 && D("Can't get session input/output metadata.");
			let o = Number(n.getValue(a, "*"));
			i = Number(n.getValue(a + r, "*"));
			let s = n.HEAP32[i / 4];
			if (s === 0) return [o, 0];
			let c = n.HEAPU32[i / 4 + 1], l = [];
			for (let e = 0; e < c; e++) {
				let t = Number(n.getValue(i + 8 + e * r, "*"));
				l.push(t === 0 ? Number(n.getValue(i + 8 + (e + c) * r, "*")) : n.UTF8ToString(t));
			}
			return [
				o,
				s,
				l
			];
		} finally {
			n.stackRestore(r), i !== 0 && n._OrtFree(i);
		}
	}, Gt = (e) => {
		let t = E(), n = t._malloc(e.byteLength);
		if (n === 0) throw Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);
		return t.HEAPU8.set(e, n), [n, e.byteLength];
	}, Kt = async (e, t) => {
		let n, r, i = E();
		Array.isArray(e) ? [n, r] = e : e.buffer === i.HEAPU8.buffer ? [n, r] = [e.byteOffset, e.byteLength] : [n, r] = Gt(e);
		let a = 0, o = 0, s = [], c = [], l = [];
		try {
			if ([o, s] = await Et(t), t?.externalData && i.mountExternalData) {
				let e = [];
				for (let n of t.externalData) {
					let t = typeof n == "string" ? n : n.path, r = typeof n == "string" ? n : n.data;
					e.push(Lt(r).then((e) => {
						i.mountExternalData(t, e);
					}));
				}
				await Promise.all(e);
			}
			for (let e of t?.executionProviders ?? []) if ((typeof e == "string" ? e : e.name) === "webnn") {
				if (i.shouldTransferToMLTensor = !1, typeof e != "string") {
					let t = e, n = t?.context, r = t?.gpuDevice, a = t?.deviceType, o = t?.powerPreference;
					i.currentContext = n || (r ? await i.webnnCreateMLContext(r) : await i.webnnCreateMLContext({
						deviceType: a,
						powerPreference: o
					}));
				} else i.currentContext = await i.webnnCreateMLContext();
				break;
			}
			a = await i._OrtCreateSession(n, r, o), i.webgpuOnCreateSession?.(a), a === 0 && D("Can't create a session."), i.jsepOnCreateSession?.(), i.currentContext && (i.webnnRegisterMLContext(a, i.currentContext), i.currentContext = void 0, i.shouldTransferToMLTensor = !0);
			let [e, u] = Ut(a), d = !!t?.enableGraphCapture, f = [], p = [], m = [], h = [];
			for (let t = 0; t < e; t++) {
				let [e, n, r] = Wt(a, t);
				e === 0 && D("Can't get an input name."), c.push(e);
				let o = i.UTF8ToString(e);
				f.push(o), m.push(n === 0 ? {
					name: o,
					isTensor: !1
				} : {
					name: o,
					isTensor: !0,
					type: kt(n),
					shape: r
				});
			}
			for (let t = 0; t < u; t++) {
				let [n, r, o] = Wt(a, t + e);
				n === 0 && D("Can't get an output name."), l.push(n);
				let s = i.UTF8ToString(n);
				p.push(s), h.push(r === 0 ? {
					name: s,
					isTensor: !1
				} : {
					name: s,
					isTensor: !0,
					type: kt(r),
					shape: o
				});
			}
			return Ht.set(a, [
				a,
				c,
				l,
				null,
				d,
				!1
			]), [
				a,
				f,
				p,
				m,
				h
			];
		} catch (e) {
			throw c.forEach((e) => i._OrtFree(e)), l.forEach((e) => i._OrtFree(e)), a !== 0 && i._OrtReleaseSession(a) !== 0 && D("Can't release session."), e;
		} finally {
			i._free(n), o !== 0 && i._OrtReleaseSessionOptions(o) !== 0 && D("Can't release session options."), s.forEach((e) => i._free(e)), i.unmountExternalData?.();
		}
	}, qt = (e) => {
		let t = E(), n = Ht.get(e);
		if (!n) throw Error(`cannot release session. invalid session id: ${e}`);
		let [r, i, a, o, s] = n;
		o && (s && t._OrtClearBoundOutputs(o.handle) !== 0 && D("Can't clear bound outputs."), t._OrtReleaseBinding(o.handle) !== 0 && D("Can't release IO binding.")), t.jsepOnReleaseSession?.(e), t.webnnOnReleaseSession?.(e), t.webgpuOnReleaseSession?.(e), i.forEach((e) => t._OrtFree(e)), a.forEach((e) => t._OrtFree(e)), t._OrtReleaseSession(r) !== 0 && D("Can't release session."), Ht.delete(e);
	}, Jt = async (e, t, n, r, i, a, o = !1) => {
		if (!e) {
			t.push(0);
			return;
		}
		let s = E(), c = s.PTR_SIZE, l = e[0], u = e[1], d = e[3], f = d, p, m;
		if (l === "string" && (d === "gpu-buffer" || d === "ml-tensor")) throw Error("String tensor is not supported on GPU.");
		if (o && d !== "gpu-buffer") throw Error(`External buffer must be provided for input/output index ${a} when enableGraphCapture is true.`);
		if (d === "gpu-buffer") {
			let t = e[2].gpuBuffer;
			m = At(Ot(l), u);
			{
				let e = s.jsepRegisterBuffer;
				if (!e) throw Error("Tensor location \"gpu-buffer\" is not supported without using WebGPU.");
				p = e(r, a, t, m);
			}
		} else if (d === "ml-tensor") {
			let t = e[2].mlTensor;
			m = At(Ot(l), u);
			let n = s.webnnRegisterMLTensor;
			if (!n) throw Error("Tensor location \"ml-tensor\" is not supported without using WebNN.");
			p = n(r, t, Ot(l), u);
		} else {
			let t = e[2];
			if (Array.isArray(t)) {
				m = c * t.length, p = s._malloc(m), n.push(p);
				for (let e = 0; e < t.length; e++) {
					if (typeof t[e] != "string") throw TypeError(`tensor data at index ${e} is not a string`);
					s.setValue(p + e * c, gt(t[e], n), "*");
				}
			} else {
				let e = s.webnnIsGraphInput, a = s.webnnIsGraphOutput;
				if (l !== "string" && e && a) {
					let o = s.UTF8ToString(i);
					if (e(r, o) || a(r, o)) {
						let e = Ot(l);
						m = At(e, u), f = "ml-tensor";
						let n = s.webnnCreateTemporaryTensor, i = s.webnnUploadTensor;
						if (!n || !i) throw Error("Tensor location \"ml-tensor\" is not supported without using WebNN.");
						let a = await n(r, e, u);
						i(a, new Uint8Array(t.buffer, t.byteOffset, t.byteLength)), p = a;
					} else m = t.byteLength, p = s._malloc(m), n.push(p), s.HEAPU8.set(new Uint8Array(t.buffer, t.byteOffset, m), p);
				} else m = t.byteLength, p = s._malloc(m), n.push(p), s.HEAPU8.set(new Uint8Array(t.buffer, t.byteOffset, m), p);
			}
		}
		let h = s.stackSave(), g = s.stackAlloc(4 * u.length);
		try {
			u.forEach((e, t) => s.setValue(g + t * c, e, c === 4 ? "i32" : "i64"));
			let e = s._OrtCreateTensor(Ot(l), p, m, g, u.length, Ft(f));
			e === 0 && D(`Can't create tensor for input/output. session=${r}, index=${a}.`), t.push(e);
		} finally {
			s.stackRestore(h);
		}
	}, Yt = async (e, t, n, r, i, a) => {
		let o = E(), s = o.PTR_SIZE, c = Ht.get(e);
		if (!c) throw Error(`cannot run inference. invalid session id: ${e}`);
		let l = c[0], u = c[1], d = c[2], f = c[3], p = c[4];
		c[5];
		let m = t.length, h = r.length, g = 0, _ = [], v = [], y = [], b = [], x = [], S = o.stackSave(), C = o.stackAlloc(m * s), ee = o.stackAlloc(m * s), w = o.stackAlloc(h * s), te = o.stackAlloc(h * s);
		try {
			[g, _] = yt(a), De("wasm prepareInputOutputTensor");
			for (let r = 0; r < m; r++) await Jt(n[r], v, b, e, u[t[r]], t[r], p);
			for (let t = 0; t < h; t++) await Jt(i[t], y, b, e, d[r[t]], m + r[t], p);
			Oe("wasm prepareInputOutputTensor");
			for (let e = 0; e < m; e++) o.setValue(C + e * s, v[e], "*"), o.setValue(ee + e * s, u[t[e]], "*");
			for (let e = 0; e < h; e++) o.setValue(w + e * s, y[e], "*"), o.setValue(te + e * s, d[r[e]], "*");
			o.jsepOnRunStart?.(l), o.webnnOnRunStart?.(l);
			let c;
			c = await o._OrtRun(l, ee, C, m, te, h, w, g), c !== 0 && D("failed to call OrtRun().");
			let S = [], ne = [];
			De("wasm ProcessOutputTensor");
			for (let t = 0; t < h; t++) {
				let n = Number(o.getValue(w + t * s, "*"));
				if (n === y[t] || x.includes(y[t])) {
					S.push(i[t]), n !== y[t] && o._OrtReleaseTensor(n) !== 0 && D("Can't release tensor.");
					continue;
				}
				let a = o.stackSave(), c = o.stackAlloc(4 * s), l = !1, u, d = 0;
				try {
					o._OrtGetTensorData(n, c, c + s, c + 2 * s, c + 3 * s) !== 0 && D(`Can't access output tensor data on index ${t}.`);
					let i = s === 4 ? "i32" : "i64", a = Number(o.getValue(c, i));
					d = o.getValue(c + s, "*");
					let p = o.getValue(c + s * 2, "*"), m = Number(o.getValue(c + s * 3, i)), h = [];
					for (let e = 0; e < m; e++) h.push(Number(o.getValue(p + e * s, i)));
					o._OrtFree(p) !== 0 && D("Can't free memory for tensor dims.");
					let g = h.reduce((e, t) => e * t, 1);
					u = kt(a);
					let _ = f?.outputPreferredLocations[r[t]];
					if (u === "string") {
						if (_ === "gpu-buffer" || _ === "ml-tensor") throw Error("String tensor is not supported on GPU.");
						let e = [];
						for (let t = 0; t < g; t++) {
							let n = o.getValue(d + t * s, "*"), r = o.getValue(d + (t + 1) * s, "*"), i = t === g - 1 ? void 0 : r - n;
							e.push(o.UTF8ToString(n, i));
						}
						S.push([
							u,
							h,
							e,
							"cpu"
						]);
					} else if (_ === "gpu-buffer" && g > 0) {
						let e = o.jsepGetBuffer;
						if (!e) throw Error("preferredLocation \"gpu-buffer\" is not supported without using WebGPU.");
						let t = e(d), r = At(a, g);
						if (r === void 0 || !Nt(u)) throw Error(`Unsupported data type: ${u}`);
						l = !0, S.push([
							u,
							h,
							{
								gpuBuffer: t,
								download: o.jsepCreateDownloader(t, r, u),
								dispose: () => {
									o._OrtReleaseTensor(n) !== 0 && D("Can't release tensor.");
								}
							},
							"gpu-buffer"
						]);
					} else if (_ === "ml-tensor" && g > 0) {
						let t = o.webnnEnsureTensor, r = o.webnnIsGraphInputOutputTypeSupported;
						if (!t || !r) throw Error("preferredLocation \"ml-tensor\" is not supported without using WebNN.");
						if (At(a, g) === void 0 || !Pt(u)) throw Error(`Unsupported data type: ${u}`);
						if (!r(e, u, !1)) throw Error(`preferredLocation "ml-tensor" for ${u} output is not supported by current WebNN Context.`);
						let i = await t(e, d, a, h, !1);
						l = !0, S.push([
							u,
							h,
							{
								mlTensor: i,
								download: o.webnnCreateMLTensorDownloader(d, u),
								dispose: () => {
									o.webnnReleaseTensorId(d), o._OrtReleaseTensor(n);
								}
							},
							"ml-tensor"
						]);
					} else if (_ === "ml-tensor-cpu-output" && g > 0) {
						let e = o.webnnCreateMLTensorDownloader(d, u)(), t = S.length;
						l = !0, ne.push((async () => {
							let r = [t, await e];
							return o.webnnReleaseTensorId(d), o._OrtReleaseTensor(n), r;
						})()), S.push([
							u,
							h,
							[],
							"cpu"
						]);
					} else {
						let e = new (jt(u))(g);
						new Uint8Array(e.buffer, e.byteOffset, e.byteLength).set(o.HEAPU8.subarray(d, d + e.byteLength)), S.push([
							u,
							h,
							e,
							"cpu"
						]);
					}
				} finally {
					o.stackRestore(a), u === "string" && d && o._free(d), l || o._OrtReleaseTensor(n);
				}
			}
			f && !p && (o._OrtClearBoundOutputs(f.handle) !== 0 && D("Can't clear bound outputs."), Ht.set(e, [
				l,
				u,
				d,
				f,
				p,
				!1
			]));
			for (let [e, t] of await Promise.all(ne)) S[e][2] = t;
			return Oe("wasm ProcessOutputTensor"), S;
		} finally {
			o.webnnOnRunEnd?.(l), o.stackRestore(S), v.forEach((e) => o._OrtReleaseTensor(e)), y.forEach((e) => o._OrtReleaseTensor(e)), b.forEach((e) => o._free(e)), g !== 0 && o._OrtReleaseRunOptions(g), _.forEach((e) => o._free(e));
		}
	}, Xt = (e) => {
		let t = E(), n = Ht.get(e);
		if (!n) throw Error("invalid session id");
		let r = n[0], i = t._OrtEndProfiling(r);
		i === 0 && D("Can't get an profile file name."), t._OrtFree(i);
	}, Zt = (e) => {
		let t = [];
		for (let n of e) {
			let e = n[2];
			!Array.isArray(e) && "buffer" in e && t.push(e.buffer);
		}
		return t;
	};
}), $t, en, tn, nn, rn, an, on, sn, cn, ln, un, dn, fn, pn, mn, hn, gn, _n, vn = l(() => {
	ze(), Qt(), ht(), ot(), $t = () => !!w.wasm.proxy && typeof document < "u", tn = !1, nn = !1, rn = !1, sn = /* @__PURE__ */ new Map(), cn = (e, t) => {
		let n = sn.get(e);
		n ? n.push(t) : sn.set(e, [t]);
	}, ln = () => {
		if (tn || !nn || rn || !en) throw Error("worker not ready");
	}, un = (e) => {
		switch (e.data.type) {
			case "init-wasm":
				tn = !1, e.data.err ? (rn = !0, on[1](e.data.err)) : (nn = !0, on[0]()), an &&= (URL.revokeObjectURL(an), void 0);
				break;
			case "init-ep":
			case "copy-from":
			case "create":
			case "release":
			case "run":
			case "end-profiling": {
				let t = sn.get(e.data.type);
				e.data.err ? t.shift()[1](e.data.err) : t.shift()[0](e.data.out);
				break;
			}
		}
	}, dn = async () => {
		if (!nn) {
			if (tn) throw Error("multiple calls to 'initWasm()' detected.");
			if (rn) throw Error("previous call to 'initWasm()' failed.");
			if (tn = !0, $t()) return new Promise((e, t) => {
				en?.terminate(), rt().then(([n, r]) => {
					try {
						en = r, en.onerror = (e) => t(e), en.onmessage = un, on = [e, t];
						let i = {
							type: "init-wasm",
							in: w
						};
						if (!i.in.wasm.wasmPaths && n) {
							let e = Xe();
							e && (i.in.wasm.wasmPaths = e);
						}
						en.postMessage(i), an = n;
					} catch (e) {
						t(e);
					}
				}, t);
			});
			try {
				await mt(w.wasm), await Bt(w), nn = !0;
			} catch (e) {
				throw rn = !0, e;
			} finally {
				tn = !1;
			}
		}
	}, fn = async (e) => {
		if ($t()) return ln(), new Promise((t, n) => {
			cn("init-ep", [t, n]);
			let r = {
				type: "init-ep",
				in: {
					epName: e,
					env: w
				}
			};
			en.postMessage(r);
		});
		await Vt(w, e);
	}, pn = async (e) => $t() ? (ln(), new Promise((t, n) => {
		cn("copy-from", [t, n]);
		let r = {
			type: "copy-from",
			in: { buffer: e }
		};
		en.postMessage(r, [e.buffer]);
	})) : Gt(e), mn = async (e, t) => {
		if ($t()) {
			if (t?.preferredOutputLocation) throw Error("session option \"preferredOutputLocation\" is not supported for proxy.");
			return ln(), new Promise((n, r) => {
				cn("create", [n, r]);
				let i = {
					type: "create",
					in: {
						model: e,
						options: { ...t }
					}
				}, a = [];
				e instanceof Uint8Array && a.push(e.buffer), en.postMessage(i, a);
			});
		}
		return Kt(e, t);
	}, hn = async (e) => {
		if ($t()) return ln(), new Promise((t, n) => {
			cn("release", [t, n]);
			let r = {
				type: "release",
				in: e
			};
			en.postMessage(r);
		});
		qt(e);
	}, gn = async (e, t, n, r, i, a) => {
		if ($t()) {
			if (n.some((e) => e[3] !== "cpu")) throw Error("input tensor on GPU is not supported for proxy.");
			if (i.some((e) => e)) throw Error("pre-allocated output tensor is not supported for proxy.");
			return ln(), new Promise((i, o) => {
				cn("run", [i, o]);
				let s = n, c = {
					type: "run",
					in: {
						sessionId: e,
						inputIndices: t,
						inputs: s,
						outputIndices: r,
						options: a
					}
				};
				en.postMessage(c, Zt(s));
			});
		}
		return Yt(e, t, n, r, i, a);
	}, _n = async (e) => {
		if ($t()) return ln(), new Promise((t, n) => {
			cn("end-profiling", [t, n]);
			let r = {
				type: "end-profiling",
				in: e
			};
			en.postMessage(r);
		});
		Xt(e);
	};
}), yn, bn, xn, Sn = l(() => {
	ze(), vn(), It(), Be(), Rt(), yn = (e, t) => {
		switch (e.location) {
			case "cpu": return [
				e.type,
				e.dims,
				e.data,
				"cpu"
			];
			case "gpu-buffer": return [
				e.type,
				e.dims,
				{ gpuBuffer: e.gpuBuffer },
				"gpu-buffer"
			];
			case "ml-tensor": return [
				e.type,
				e.dims,
				{ mlTensor: e.mlTensor },
				"ml-tensor"
			];
			default: throw Error(`invalid data location: ${e.location} for ${t()}`);
		}
	}, bn = (e) => {
		switch (e[3]) {
			case "cpu": return new xe(e[0], e[2], e[1]);
			case "gpu-buffer": {
				let t = e[0];
				if (!Nt(t)) throw Error(`not supported data type: ${t} for deserializing GPU tensor`);
				let { gpuBuffer: n, download: r, dispose: i } = e[2];
				return xe.fromGpuBuffer(n, {
					dataType: t,
					dims: e[1],
					download: r,
					dispose: i
				});
			}
			case "ml-tensor": {
				let t = e[0];
				if (!Pt(t)) throw Error(`not supported data type: ${t} for deserializing MLTensor tensor`);
				let { mlTensor: n, download: r, dispose: i } = e[2];
				return xe.fromMLTensor(n, {
					dataType: t,
					dims: e[1],
					download: r,
					dispose: i
				});
			}
			default: throw Error(`invalid data location: ${e[3]}`);
		}
	}, xn = class {
		async fetchModelAndCopyToWasmMemory(e) {
			return pn(await Lt(e));
		}
		async loadModel(e, t) {
			Te();
			let n;
			n = typeof e == "string" ? await this.fetchModelAndCopyToWasmMemory(e) : e, [this.sessionId, this.inputNames, this.outputNames, this.inputMetadata, this.outputMetadata] = await mn(n, t), Ee();
		}
		async dispose() {
			return hn(this.sessionId);
		}
		async run(e, t, n) {
			Te();
			let r = [], i = [];
			Object.entries(e).forEach((e) => {
				let t = e[0], n = e[1], a = this.inputNames.indexOf(t);
				if (a === -1) throw Error(`invalid input '${t}'`);
				r.push(n), i.push(a);
			});
			let a = [], o = [];
			Object.entries(t).forEach((e) => {
				let t = e[0], n = e[1], r = this.outputNames.indexOf(t);
				if (r === -1) throw Error(`invalid output '${t}'`);
				a.push(n), o.push(r);
			});
			let s = r.map((e, t) => yn(e, () => `input "${this.inputNames[i[t]]}"`)), c = a.map((e, t) => e ? yn(e, () => `output "${this.outputNames[o[t]]}"`) : null), l = await gn(this.sessionId, i, s, o, c, n), u = {};
			for (let e = 0; e < l.length; e++) u[this.outputNames[o[e]]] = a[e] ?? bn(l[e]);
			return Ee(), u;
		}
		startProfiling() {}
		endProfiling() {
			_n(this.sessionId);
		}
	};
}), Cn = {};
u(Cn, {
	OnnxruntimeWebAssemblyBackend: () => Tn,
	initializeFlags: () => wn,
	wasmBackend: () => En
});
var wn, Tn, En, Dn = l(() => {
	ze(), vn(), Sn(), wn = () => {
		(typeof w.wasm.initTimeout != "number" || w.wasm.initTimeout < 0) && (w.wasm.initTimeout = 0);
		let e = w.wasm.simd;
		if (typeof e != "boolean" && e !== void 0 && e !== "fixed" && e !== "relaxed" && (console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`), w.wasm.simd = !1), typeof w.wasm.proxy != "boolean" && (w.wasm.proxy = !1), typeof w.wasm.trace != "boolean" && (w.wasm.trace = !1), typeof w.wasm.numThreads != "number" || !Number.isInteger(w.wasm.numThreads) || w.wasm.numThreads <= 0) {
			if (typeof self < "u" && !self.crossOriginIsolated) w.wasm.numThreads = 1;
			else {
				let e = typeof navigator > "u" ? c("node:os").cpus().length : navigator.hardwareConcurrency;
				w.wasm.numThreads = Math.min(4, Math.ceil((e || 1) / 2));
			}
		}
	}, Tn = class {
		async init(e) {
			wn(), await dn(), await fn(e);
		}
		async createInferenceSessionHandler(e, t) {
			let n = new xn();
			return await n.loadModel(e, t), n;
		}
	}, En = new Tn();
});
ze(), ze(), ze();
var On = "1.31.0-dev.20260914-8d85527a0", kn = Re;
{
	let e = (Dn(), f(Cn)).wasmBackend;
	h("cpu", e, 10), h("wasm", e, 10);
}
Object.defineProperty(w.versions, "web", {
	value: On,
	enumerable: !0
});
//#endregion
//#region ../../tmp/mm-voice-ZQGN1H/node_modules/onnxruntime-common/dist/esm/version.js
var An = "1.30.0", jn = "warning";
Object.defineProperty({
	wasm: {},
	webgl: {},
	webgpu: {},
	versions: { common: An },
	set logLevel(e) {
		if (e !== void 0) {
			if (typeof e != "string" || [
				"verbose",
				"info",
				"warning",
				"error",
				"fatal"
			].indexOf(e) === -1) throw Error(`Unsupported logging level: ${e}`);
			jn = e;
		}
	},
	get logLevel() {
		return jn;
	}
}, "logLevel", { enumerable: !0 });
//#endregion
//#region ../../tmp/mm-voice-ZQGN1H/node_modules/onnxruntime-common/dist/esm/tensor-conversion-impl.js
var Mn = (e, t) => {
	let n = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
	n.width = e.dims[3], n.height = e.dims[2];
	let r = n.getContext("2d");
	if (r != null) {
		let i, a;
		t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (i = e.dims[2], a = e.dims[3]) : (i = e.dims[3], a = e.dims[2]);
		let o = t?.format === void 0 ? "RGB" : t.format, s = t?.norm, c, l;
		s === void 0 || s.mean === void 0 ? c = [
			255,
			255,
			255,
			255
		] : typeof s.mean == "number" ? c = [
			s.mean,
			s.mean,
			s.mean,
			s.mean
		] : (c = [
			s.mean[0],
			s.mean[1],
			s.mean[2],
			0
		], s.mean[3] !== void 0 && (c[3] = s.mean[3])), s === void 0 || s.bias === void 0 ? l = [
			0,
			0,
			0,
			0
		] : typeof s.bias == "number" ? l = [
			s.bias,
			s.bias,
			s.bias,
			s.bias
		] : (l = [
			s.bias[0],
			s.bias[1],
			s.bias[2],
			0
		], s.bias[3] !== void 0 && (l[3] = s.bias[3]));
		let u = a * i, d = 0, f = u, p = u * 2, m = -1;
		o === "RGBA" ? (d = 0, f = u, p = u * 2, m = u * 3) : o === "RGB" ? (d = 0, f = u, p = u * 2) : o === "RBG" && (d = 0, p = u, f = u * 2);
		for (let t = 0; t < a; t++) for (let n = 0; n < i; n++) {
			let i = (e.data[d++] - l[0]) * c[0], a = (e.data[f++] - l[1]) * c[1], o = (e.data[p++] - l[2]) * c[2], s = m === -1 ? 255 : (e.data[m++] - l[3]) * c[3];
			r.fillStyle = "rgba(" + i + "," + a + "," + o + "," + s + ")", r.fillRect(n, t, 1, 1);
		}
		if ("toDataURL" in n) return n.toDataURL();
		throw Error("toDataURL is not supported");
	}
	throw Error("Can not access image data");
}, Nn = (e, t) => {
	let n = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d"), r;
	if (n != null) {
		let i, a, o;
		t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (i = e.dims[2], a = e.dims[1], o = e.dims[3]) : (i = e.dims[3], a = e.dims[2], o = e.dims[1]);
		let s = t === void 0 || t.format === void 0 ? "RGB" : t.format, c = t?.norm, l, u;
		c === void 0 || c.mean === void 0 ? l = [
			255,
			255,
			255,
			255
		] : typeof c.mean == "number" ? l = [
			c.mean,
			c.mean,
			c.mean,
			c.mean
		] : (l = [
			c.mean[0],
			c.mean[1],
			c.mean[2],
			255
		], c.mean[3] !== void 0 && (l[3] = c.mean[3])), c === void 0 || c.bias === void 0 ? u = [
			0,
			0,
			0,
			0
		] : typeof c.bias == "number" ? u = [
			c.bias,
			c.bias,
			c.bias,
			c.bias
		] : (u = [
			c.bias[0],
			c.bias[1],
			c.bias[2],
			0
		], c.bias[3] !== void 0 && (u[3] = c.bias[3]));
		let d = a * i;
		if (t !== void 0 && (t.format !== void 0 && o === 4 && t.format !== "RGBA" || o === 3 && t.format !== "RGB" && t.format !== "BGR")) throw Error("Tensor format doesn't match input tensor dims");
		let f = 0, p = 1, m = 2, h = 3, g = 0, _ = d, v = d * 2, y = -1;
		s === "RGBA" ? (g = 0, _ = d, v = d * 2, y = d * 3) : s === "RGB" ? (g = 0, _ = d, v = d * 2) : s === "RBG" && (g = 0, v = d, _ = d * 2), r = n.createImageData(i, a);
		for (let t = 0; t < a * i; f += 4, p += 4, m += 4, h += 4, t++) r.data[f] = (e.data[g++] - u[0]) * l[0], r.data[p] = (e.data[_++] - u[1]) * l[1], r.data[m] = (e.data[v++] - u[2]) * l[2], r.data[h] = y === -1 ? 255 : (e.data[y++] - u[3]) * l[3];
	} else throw Error("Can not access image data");
	return r;
}, Pn = (e, t) => {
	if (e === void 0) throw Error("Image buffer must be defined");
	if (t.height === void 0 || t.width === void 0) throw Error("Image height and width must be defined");
	if (t.tensorLayout === "NHWC") throw Error("NHWC Tensor layout is not supported yet");
	let { height: n, width: r } = t, i = t.norm ?? {
		mean: 255,
		bias: 0
	}, a, o;
	a = typeof i.mean == "number" ? [
		i.mean,
		i.mean,
		i.mean,
		i.mean
	] : [
		i.mean[0],
		i.mean[1],
		i.mean[2],
		i.mean[3] ?? 255
	], o = typeof i.bias == "number" ? [
		i.bias,
		i.bias,
		i.bias,
		i.bias
	] : [
		i.bias[0],
		i.bias[1],
		i.bias[2],
		i.bias[3] ?? 0
	];
	let s = t.format === void 0 ? "RGBA" : t.format, c = t.tensorFormat === void 0 || t.tensorFormat === void 0 ? "RGB" : t.tensorFormat, l = n * r, u = c === "RGBA" ? new Float32Array(l * 4) : new Float32Array(l * 3), d = 4, f = 0, p = 1, m = 2, h = 3, g = 0, _ = l, v = l * 2, y = -1;
	s === "RGB" && (d = 3, f = 0, p = 1, m = 2, h = -1), c === "RGBA" ? y = l * 3 : c === "RBG" ? (g = 0, v = l, _ = l * 2) : c === "BGR" && (v = 0, _ = l, g = l * 2);
	for (let t = 0; t < l; t++, f += d, m += d, p += d, h += d) u[g++] = (e[f] + o[0]) / a[0], u[_++] = (e[p] + o[1]) / a[1], u[v++] = (e[m] + o[2]) / a[2], y !== -1 && h !== -1 && (u[y++] = (e[h] + o[3]) / a[3]);
	return c === "RGBA" ? new Kn("float32", u, [
		1,
		4,
		n,
		r
	]) : new Kn("float32", u, [
		1,
		3,
		n,
		r
	]);
}, Fn = async (e, t) => {
	let n = typeof HTMLImageElement < "u" && e instanceof HTMLImageElement, r = typeof ImageData < "u" && e instanceof ImageData, i = typeof ImageBitmap < "u" && e instanceof ImageBitmap, a = typeof e == "string", o, s = t ?? {}, c = () => {
		if (typeof document < "u") return document.createElement("canvas");
		if (typeof OffscreenCanvas < "u") return new OffscreenCanvas(1, 1);
		throw Error("Canvas is not supported");
	}, l = (e) => typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || e instanceof OffscreenCanvas ? e.getContext("2d") : null;
	if (n) {
		let n = c();
		n.width = e.width, n.height = e.height;
		let r = l(n);
		if (r != null) {
			let n = e.height, i = e.width;
			if (t !== void 0 && t.resizedHeight !== void 0 && t.resizedWidth !== void 0 && (n = t.resizedHeight, i = t.resizedWidth), t !== void 0) {
				if (s = t, t.tensorFormat !== void 0) throw Error("Image input config format must be RGBA for HTMLImageElement");
				s.tensorFormat = "RGBA", s.height = n, s.width = i;
			} else s.tensorFormat = "RGBA", s.height = n, s.width = i;
			r.drawImage(e, 0, 0), o = r.getImageData(0, 0, i, n).data;
		} else throw Error("Can not access image data");
	} else if (r) {
		let n, r;
		if (t !== void 0 && t.resizedWidth !== void 0 && t.resizedHeight !== void 0 ? (n = t.resizedHeight, r = t.resizedWidth) : (n = e.height, r = e.width), t !== void 0 && (s = t), s.format = "RGBA", s.height = n, s.width = r, t !== void 0) {
			let t = c();
			t.width = r, t.height = n;
			let i = l(t);
			if (i != null) i.putImageData(e, 0, 0), o = i.getImageData(0, 0, r, n).data;
			else throw Error("Can not access image data");
		} else o = e.data;
	} else if (i) {
		if (t === void 0) throw Error("Please provide image config with format for Imagebitmap");
		let n = c();
		n.width = e.width, n.height = e.height;
		let r = l(n);
		if (r != null) {
			let t = e.height, n = e.width;
			return r.drawImage(e, 0, 0, n, t), o = r.getImageData(0, 0, n, t).data, s.height = t, s.width = n, Pn(o, s);
		}
		throw Error("Can not access image data");
	} else if (a) return new Promise((t, n) => {
		let r = c(), i = l(r);
		if (!e || !i) return n();
		let a = new Image();
		a.crossOrigin = "Anonymous", a.src = e, a.onload = () => {
			r.width = a.width, r.height = a.height, i.drawImage(a, 0, 0, r.width, r.height);
			let e = i.getImageData(0, 0, r.width, r.height);
			s.height = r.height, s.width = r.width, t(Pn(e.data, s));
		};
	});
	else throw Error("Input data provided is not supported - aborted tensor creation");
	if (o !== void 0) return Pn(o, s);
	throw Error("Input data provided is not supported - aborted tensor creation");
}, In = (e, t) => {
	let { width: n, height: r, download: i, dispose: a } = t;
	return new Kn({
		location: "texture",
		type: "float32",
		texture: e,
		dims: [
			1,
			r,
			n,
			4
		],
		download: i,
		dispose: a
	});
}, Ln = (e, t) => {
	let { dataType: n, dims: r, download: i, dispose: a } = t;
	return new Kn({
		location: "gpu-buffer",
		type: n ?? "float32",
		gpuBuffer: e,
		dims: r,
		download: i,
		dispose: a
	});
}, Rn = (e, t) => {
	let { dataType: n, dims: r, download: i, dispose: a } = t;
	return new Kn({
		location: "ml-tensor",
		type: n ?? "float32",
		mlTensor: e,
		dims: r,
		download: i,
		dispose: a
	});
}, zn = (e, t, n) => new Kn({
	location: "cpu-pinned",
	type: e,
	data: t,
	dims: n ?? [t.length]
}), Bn = /* @__PURE__ */ new Map([
	["float32", Float32Array],
	["uint8", Uint8Array],
	["int8", Int8Array],
	["uint16", Uint16Array],
	["int16", Int16Array],
	["int32", Int32Array],
	["bool", Uint8Array],
	["float64", Float64Array],
	["uint32", Uint32Array],
	["int4", Uint8Array],
	["uint4", Uint8Array]
]), Vn = /* @__PURE__ */ new Map([
	[Float32Array, "float32"],
	[Uint8Array, "uint8"],
	[Int8Array, "int8"],
	[Uint16Array, "uint16"],
	[Int16Array, "int16"],
	[Int32Array, "int32"],
	[Float64Array, "float64"],
	[Uint32Array, "uint32"]
]), Hn = !1, Un = () => {
	if (!Hn) {
		Hn = !0;
		let e = typeof BigInt64Array < "u" && BigInt64Array.from, t = typeof BigUint64Array < "u" && BigUint64Array.from, n = globalThis.Float16Array, r = n !== void 0 && n.from;
		e && (Bn.set("int64", BigInt64Array), Vn.set(BigInt64Array, "int64")), t && (Bn.set("uint64", BigUint64Array), Vn.set(BigUint64Array, "uint64")), r ? (Bn.set("float16", n), Vn.set(n, "float16")) : Bn.set("float16", Uint16Array);
	}
}, Wn = (e) => {
	let t = 1;
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (typeof r != "number" || !Number.isSafeInteger(r)) throw TypeError(`dims[${n}] must be an integer, got: ${r}`);
		if (r < 0) throw RangeError(`dims[${n}] must be a non-negative integer, got: ${r}`);
		t *= r;
	}
	return t;
}, Gn = (e, t) => {
	switch (e.location) {
		case "cpu": return new Kn(e.type, e.data, t);
		case "cpu-pinned": return new Kn({
			location: "cpu-pinned",
			data: e.data,
			type: e.type,
			dims: t
		});
		case "texture": return new Kn({
			location: "texture",
			texture: e.texture,
			type: e.type,
			dims: t
		});
		case "gpu-buffer": return new Kn({
			location: "gpu-buffer",
			gpuBuffer: e.gpuBuffer,
			type: e.type,
			dims: t
		});
		case "ml-tensor": return new Kn({
			location: "ml-tensor",
			mlTensor: e.mlTensor,
			type: e.type,
			dims: t
		});
		default: throw Error(`tensorReshape: tensor location ${e.location} is not supported`);
	}
}, Kn = class {
	constructor(e, t, n) {
		Un();
		let r, i;
		if (typeof e == "object" && "location" in e) switch (this.dataLocation = e.location, r = e.type, i = e.dims, e.location) {
			case "cpu-pinned": {
				let t = Bn.get(r);
				if (!t) throw TypeError(`unsupported type "${r}" to create tensor from pinned buffer`);
				if (!(e.data instanceof t)) throw TypeError(`buffer should be of type ${t.name}`);
				this.cpuData = e.data;
				break;
			}
			case "texture":
				if (r !== "float32") throw TypeError(`unsupported type "${r}" to create tensor from texture`);
				this.gpuTextureData = e.texture, this.downloader = e.download, this.disposer = e.dispose;
				break;
			case "gpu-buffer":
				if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw TypeError(`unsupported type "${r}" to create tensor from gpu buffer`);
				this.gpuBufferData = e.gpuBuffer, this.downloader = e.download, this.disposer = e.dispose;
				break;
			case "ml-tensor":
				if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint64" && r !== "int8" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw TypeError(`unsupported type "${r}" to create tensor from MLTensor`);
				this.mlTensorData = e.mlTensor, this.downloader = e.download, this.disposer = e.dispose;
				break;
			default: throw Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
		}
		else {
			let a, o;
			if (typeof e == "string") {
				if (r = e, o = n, e === "string") {
					if (!Array.isArray(t)) throw TypeError("A string tensor's data must be a string array.");
					a = t;
				} else {
					let n = Bn.get(e);
					if (n === void 0) throw TypeError(`Unsupported tensor type: ${e}.`);
					if (Array.isArray(t)) {
						if (e === "float16" && n === Uint16Array || e === "uint4" || e === "int4") throw TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${n.name} as data.`);
						a = e === "uint64" || e === "int64" ? n.from(t, BigInt) : n.from(t);
					} else if (t instanceof n) a = t;
					else if (t instanceof Uint8ClampedArray) {
						if (e === "uint8") a = Uint8Array.from(t);
						else throw TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
					} else if (e === "float16" && t instanceof Uint16Array && n !== Uint16Array) a = new globalThis.Float16Array(t.buffer, t.byteOffset, t.length);
					else throw TypeError(`A ${r} tensor's data must be type of ${n}`);
				}
			} else if (o = t, Array.isArray(e)) {
				if (e.length === 0) throw TypeError("Tensor type cannot be inferred from an empty array.");
				let t = typeof e[0];
				if (t === "string") r = "string", a = e;
				else if (t === "boolean") r = "bool", a = Uint8Array.from(e);
				else throw TypeError(`Invalid element type of data array: ${t}.`);
			} else if (e instanceof Uint8ClampedArray) r = "uint8", a = Uint8Array.from(e);
			else {
				let t = Vn.get(e.constructor);
				if (t === void 0) throw TypeError(`Unsupported type for tensor data: ${e.constructor}.`);
				r = t, a = e;
			}
			if (o === void 0) o = [a.length];
			else if (!Array.isArray(o)) throw TypeError("A tensor's dims must be a number array");
			i = o, this.cpuData = a, this.dataLocation = "cpu";
		}
		let a = Wn(i);
		if (this.cpuData && a !== this.cpuData.length && (r !== "uint4" && r !== "int4" || Math.ceil(a / 2) !== this.cpuData.length)) throw Error(`Tensor's size(${a}) does not match data length(${this.cpuData.length}).`);
		this.type = r, this.dims = i, this.size = a;
	}
	static async fromImage(e, t) {
		return Fn(e, t);
	}
	static fromTexture(e, t) {
		return In(e, t);
	}
	static fromGpuBuffer(e, t) {
		return Ln(e, t);
	}
	static fromMLTensor(e, t) {
		return Rn(e, t);
	}
	static fromPinnedBuffer(e, t, n) {
		return zn(e, t, n);
	}
	toDataURL(e) {
		return Mn(this, e);
	}
	toImageData(e) {
		return Nn(this, e);
	}
	get data() {
		if (this.ensureValid(), !this.cpuData) throw Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
		return this.cpuData;
	}
	get location() {
		return this.dataLocation;
	}
	get texture() {
		if (this.ensureValid(), !this.gpuTextureData) throw Error("The data is not stored as a WebGL texture.");
		return this.gpuTextureData;
	}
	get gpuBuffer() {
		if (this.ensureValid(), !this.gpuBufferData) throw Error("The data is not stored as a WebGPU buffer.");
		return this.gpuBufferData;
	}
	get mlTensor() {
		if (this.ensureValid(), !this.mlTensorData) throw Error("The data is not stored as a WebNN MLTensor.");
		return this.mlTensorData;
	}
	async getData(e) {
		switch (this.ensureValid(), this.dataLocation) {
			case "cpu":
			case "cpu-pinned": return this.data;
			case "texture":
			case "gpu-buffer":
			case "ml-tensor":
				if (!this.downloader) throw Error("The current tensor is not created with a specified data downloader.");
				if (this.isDownloading) throw Error("The current tensor is being downloaded.");
				try {
					this.isDownloading = !0;
					let t = await this.downloader();
					return this.downloader = void 0, this.dataLocation = "cpu", this.cpuData = t, e && this.disposer && (this.disposer(), this.disposer = void 0), t;
				} finally {
					this.isDownloading = !1;
				}
			default: throw Error(`cannot get data from location: ${this.dataLocation}`);
		}
	}
	dispose() {
		if (this.isDownloading) throw Error("The current tensor is being downloaded.");
		this.disposer &&= (this.disposer(), void 0), this.cpuData = void 0, this.gpuTextureData = void 0, this.gpuBufferData = void 0, this.mlTensorData = void 0, this.downloader = void 0, this.isDownloading = void 0, this.dataLocation = "none";
	}
	ensureValid() {
		if (this.dataLocation === "none") throw Error("The tensor is disposed.");
	}
	reshape(e) {
		if (this.ensureValid(), this.downloader || this.disposer) throw Error("Cannot reshape a tensor that owns GPU resource.");
		return Gn(this, e);
	}
}, qn = Kn, Jn = Object.defineProperty, Yn = (e, t) => {
	for (var n in t) Jn(e, n, {
		get: t[n],
		enumerable: !0
	});
}, Xn = {}, Zn = {}, Qn = {}, $n = "4.3.0", er = typeof self < "u", tr = !Tr(Xn), nr = !Tr(Zn), rr = er && "caches" in self, ir = globalThis.Deno !== void 0;
globalThis.Bun;
var ar = ir && rr && !tr, or = typeof process < "u", sr = or && process?.release?.name === "node" && !ar, cr = typeof window < "u" && window.document !== void 0, lr = er && [
	"DedicatedWorkerGlobalScope",
	"ServiceWorkerGlobalScope",
	"SharedWorkerGlobalScope"
].includes(self.constructor?.name), ur = cr || lr || ar, dr = sr || typeof navigator < "u" && "gpu" in navigator, fr = typeof navigator < "u" && "ml" in navigator, pr = typeof crypto < "u" && typeof crypto.getRandomValues == "function", mr = typeof chrome < "u" && chrome.runtime !== void 0 && typeof chrome.runtime.id == "string", hr = typeof ServiceWorkerGlobalScope < "u" && er && self instanceof ServiceWorkerGlobalScope, gr = (() => {
	if (typeof navigator > "u") return !1;
	let e = navigator.userAgent;
	if (!((navigator.vendor || "").indexOf("Apple") > -1 && !e.match(/CriOS|FxiOS|EdgiOS|OPiOS|mercury|brave/i) && !e.includes("Chrome") && !e.includes("Android"))) return !1;
	let t = e.match(/Version\/(\d+)/);
	return t ? parseInt(t[1], 10) < 26 : !1;
})(), O = Object.freeze({
	IS_BROWSER_ENV: cr,
	IS_WEBWORKER_ENV: lr,
	IS_WEB_ENV: ur,
	IS_SERVICE_WORKER_ENV: hr,
	IS_DENO_WEB_RUNTIME: ar,
	IS_WEB_CACHE_AVAILABLE: rr,
	IS_WEBGPU_AVAILABLE: dr,
	IS_WEBNN_AVAILABLE: fr,
	IS_SAFARI_BELOW_26: gr,
	IS_PROCESS_AVAILABLE: or,
	IS_NODE_ENV: sr,
	IS_FS_AVAILABLE: tr,
	IS_PATH_AVAILABLE: nr,
	IS_CRYPTO_AVAILABLE: pr,
	IS_CHROME_AVAILABLE: mr
}), _r = tr && nr, vr = "./";
if (_r) {
	let e = import.meta.url;
	e ? vr = Zn.dirname(Zn.dirname(Qn.fileURLToPath(e))) : typeof __dirname < "u" && (vr = Zn.dirname(__dirname));
}
var yr = _r ? Zn.join(vr, "/.cache/") : null, br = "/models/", xr = _r ? Zn.join(vr, br) : br, Sr = typeof globalThis.fetch == "function" ? globalThis.fetch.bind(globalThis) : void 0, Cr = Object.freeze({
	DEBUG: 10,
	INFO: 20,
	WARNING: 30,
	ERROR: 40,
	NONE: 50
}), wr = Cr.WARNING, k = {
	version: $n,
	backends: { onnx: {} },
	get logLevel() {
		return wr;
	},
	set logLevel(e) {
		wr = e, k.backends.onnx?.setLogLevel?.(e);
	},
	allowRemoteModels: !0,
	remoteHost: "https://huggingface.co/",
	remotePathTemplate: "{model}/resolve/{revision}/",
	allowLocalModels: !(cr || lr || ar),
	localModelPath: xr,
	useFS: tr,
	useBrowserCache: rr,
	useFSCache: tr,
	cacheDir: yr,
	useCustomCache: !1,
	customCache: null,
	useWasmCache: rr || tr,
	cacheKey: "transformers-cache",
	experimental_useCrossOriginStorage: !1,
	fetch: Sr
};
function Tr(e) {
	return Object.keys(e).length === 0;
}
var Er = class {
	constructor() {
		let e = function(...t) {
			return e._call(...t);
		};
		return Object.setPrototypeOf(e, new.target.prototype);
	}
	_call(...e) {
		throw Error("Must implement _call method in subclass");
	}
};
function Dr(e, t) {
	e && e(t);
}
var Or = class extends Er {
	constructor(e, t) {
		super(), this.callback = e, this.files_loading = t, this.loads = /* @__PURE__ */ new Map();
	}
	_call(e) {
		if (e.status === "progress") {
			this.files_loading[e.file] = {
				loaded: e.loaded,
				total: e.total
			};
			let t = Object.values(this.files_loading).reduce((e, t) => e + t.loaded, 0), n = Object.values(this.files_loading).reduce((e, t) => e + t.total, 0), r = n > 0 ? t / n * 100 : 0;
			this.callback({
				status: "progress_total",
				name: e.name,
				progress: r,
				loaded: t,
				total: n,
				files: structuredClone(this.files_loading)
			});
		}
		this.callback(e);
	}
};
function kr(e) {
	return Number.isInteger(e) || typeof e == "bigint";
}
function Ar(e) {
	return e == null || e === -1;
}
function jr(e) {
	let t = [], n = e;
	for (; Array.isArray(n);) t.push(n.length), n = n[0];
	return t;
}
function Mr(...e) {
	return Array.prototype.concat.apply([], e);
}
function Nr(...e) {
	return e.reduce((e, t) => e.flatMap((e) => t.map((t) => [e, t])));
}
function Pr(e, t) {
	return Math.abs((e + t) % (2 * t) - t);
}
function Fr(e, t) {
	return Object.assign({}, ...t.map((t) => {
		if (e[t] !== void 0) return { [t]: e[t] };
	}));
}
function Ir(e, t) {
	let n = 0;
	for (let r of e) r === t && ++n;
	return n;
}
var A = {
	error(...e) {
		k.logLevel <= Cr.ERROR && console.error(...e);
	},
	warn(...e) {
		k.logLevel <= Cr.WARNING && console.warn(...e);
	},
	info(...e) {
		k.logLevel <= Cr.INFO && console.log(...e);
	},
	debug(...e) {
		k.logLevel <= Cr.DEBUG && console.log(...e);
	},
	log(...e) {
		this.info(...e);
	}
}, Lr = class {
	constructor(e) {
		this.trie = this._build_trie(e);
	}
	_build_trie(e) {
		let t = /* @__PURE__ */ Object.create(null);
		for (let n of e) {
			let e = t;
			for (let t = 0; t < n.length; ++t) {
				let r = n[t];
				e = e[r] ??= /* @__PURE__ */ Object.create(null);
			}
			e.end = n;
		}
		return t;
	}
	split(e) {
		let t = [], n = e.length, r = 0, i = 0;
		for (; i < n;) {
			let a = this.trie, o = null, s = i;
			for (; s < n && (a = a[e[s]]);) a.end && (o = a.end), ++s;
			o ? (i > r && t.push(e.slice(r, i)), t.push(o), i += o.length, r = i) : ++i;
		}
		return r < n && t.push(e.slice(r)), t;
	}
}, Rr = class {
	constructor(e) {
		this.content = e.content, this.id = e.id, this.single_word = e.single_word ?? !1, this.lstrip = e.lstrip ?? !1, this.rstrip = e.rstrip ?? !1, this.special = e.special ?? !1, this.normalized = e.normalized ?? !this.special;
	}
}, zr = (e, t) => {
	try {
		return new RegExp(e, t);
	} catch (n) {
		if (!(n instanceof SyntaxError)) throw n;
		let r = /* @__PURE__ */ new Map(), i = e.replace(/(\\[pP])\{([^}=]+)\}/g, (t, n, i, a) => {
			let o = 0;
			for (let t = a - 1; t >= 0 && e[t] === "\\"; --t) ++o;
			if (o % 2 == 1) return t;
			let s = r.get(i);
			if (s === void 0) {
				try {
					RegExp(`\\p{${i}}`, "u"), s = i;
				} catch {
					s = `Script=${i}`;
				}
				r.set(i, s);
			}
			return `${n}{${s}}`;
		});
		if (i === e) throw n;
		try {
			return new RegExp(i, t);
		} catch {
			throw n;
		}
	}
}, Br = (e) => e.replace(/ \./g, ".").replace(/ \?/g, "?").replace(/ \!/g, "!").replace(/ ,/g, ",").replace(/ \' /g, "'").replace(/ n't/g, "n't").replace(/ 'm/g, "'m").replace(/ 's/g, "'s").replace(/ 've/g, "'ve").replace(/ 're/g, "'re"), Vr = (e, t = !0) => {
	if (e.Regex !== void 0) return zr(Ti(pi(e.Regex)), "gu");
	if (e.String !== void 0) {
		let n = Ei(e.String);
		return new RegExp(t ? n : `(${n})`, "gu");
	}
	return console.warn("Unknown pattern type:", e), null;
}, Hr = "\\p{Alphabetic}\\p{M}\\p{Nd}\\p{Pc}", Ur = `${Hr}\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE`, Wr = `[${Ur}]`, Gr = `[^${Ur}]`, Kr = `(?:(?<!${Wr})(?=${Wr})|(?<=${Wr})(?!${Wr}))`, qr = `(?:(?<!${Wr})(?!${Wr})|(?<=${Wr})(?=${Wr}))`, Jr = "(?:(?<![\\s\\S])|(?<=\\n))", Yr = "(?:(?=\\n)|(?![\\s\\S]))", Xr = "0-9A-Fa-f", Zr = /* @__PURE__ */ new Map([
	["A", "(?<![\\s\\S])"],
	["z", "(?![\\s\\S])"],
	["Z", "(?=\\n?(?![\\s\\S]))"],
	["h", `[${Xr}]`],
	["H", `[^${Xr}]`],
	["w", Wr],
	["W", Gr],
	["d", "\\p{Nd}"],
	["D", "\\P{Nd}"],
	["s", "\\p{White_Space}"],
	["S", "\\P{White_Space}"],
	["b", Kr],
	["B", qr],
	["a", "\\x07"],
	["e", "\\x1B"]
]), Qr = /* @__PURE__ */ new Map([
	["h", Xr],
	["w", Hr],
	["d", "\\p{Nd}"],
	["D", "\\P{Nd}"],
	["s", "\\p{White_Space}"],
	["S", "\\P{White_Space}"],
	["a", "\\x07"],
	["e", "\\x1B"]
]), $r = /* @__PURE__ */ new Map([["W", `[^${Hr}]`], ["H", `[^${Xr}]`]]), ei = /* @__PURE__ */ new Map([
	["\n", "\\n"],
	["\r", "\\r"],
	["	", "\\t"],
	["\f", "\\f"],
	["\v", "\\v"]
]), ti = /* @__PURE__ */ new Map([
	["alpha", "\\p{Alphabetic}"],
	["alnum", "\\p{Alphabetic}\\p{Nd}"],
	["digit", "\\p{Nd}"],
	["lower", "\\p{Lowercase}"],
	["upper", "\\p{Uppercase}"],
	["space", "\\p{White_Space}"],
	["blank", "\\t\\p{Zs}"],
	["punct", "\\p{P}\\p{S}"],
	["cntrl", "\\p{Cc}"],
	["word", Hr],
	["xdigit", Xr]
]), ni = "^$\\.*+?()[]{}|/", ri = /^\(\?(?:<[=!]|<[A-Za-z_][A-Za-z0-9_]*>|[:=!>])/, ii = /^\\([pPxu])\{([^}]*)\}/, ai = /^\{(\d+(?:,\d*)?|,\d+)\}/, oi = /^\[:(\^?)(\p{Alphabetic}+):\]/u, si = /^\[:\^:\]/, ci = /^\[(?:\.[^\]]*\.\]|=[^\]]*=\])/, li = /^(?:\\x[0-9A-Fa-f]{2}|\\u[0-9A-Fa-f]{4}|\\c[A-Za-z])/, ui = (e) => e >= "A" && e <= "Z" || e >= "a" && e <= "z", di = (e, t) => String.fromCodePoint(e.codePointAt(t)), fi = (e) => {
	if (!/^[0-9A-Fa-f]{1,8}$/.test(e)) return null;
	let t = Number.parseInt(e, 16);
	if (t > 127) return null;
	let n = String.fromCharCode(t);
	return ui(n) ? `[${n.toLowerCase()}${n.toUpperCase()}]` : null;
}, pi = (e) => e.replace(/\[\^\(\\s\|\[([^\]]+)\]\)\]/g, "[^()|\\s$1]"), mi = "[\\s\\S]", hi = 256, gi = () => ({
	fragment: "",
	alternatives: [],
	tail: null,
	contains_complex_set: !1
}), _i = (e) => {
	throw SyntaxError(`Unsupported range with a set-valued character-class operand at index ${e}`);
}, vi = (e, t, n, r = !0) => {
	e.tail === "range" && _i(n), e.alternatives.push(t), e.tail = "set", e.contains_complex_set = e.contains_complex_set || r;
}, yi = (e, t, n = !1, r = -1) => {
	if (n && e.tail === "range" && _i(r), e.tail === "range") {
		e.fragment += t, e.tail = "complete_range";
		return;
	}
	e.fragment += t, e.tail = n ? "set" : "scalar", e.contains_complex_set = e.contains_complex_set || n;
}, bi = (e, t, n) => {
	let r = ii.exec(e.slice(t));
	if (r) {
		let [e, i, a] = r;
		return i === "P" && a === "Word" ? vi(n, `[^${Hr}]`, t) : yi(n, i === "x" ? `\\u{${a}}` : i === "p" && a === "Word" ? Hr : e, i === "p" || i === "P", t), t + e.length;
	}
	let i = li.exec(e.slice(t));
	if (i) return yi(n, i[0]), t + i[0].length;
	if (t + 1 >= e.length) throw SyntaxError(`Unterminated escape in character class at index ${t}`);
	let a = di(e, t + 1), o = t + 1 + a.length, s = ei.get(a);
	if (s !== void 0) return yi(n, s), o;
	let c = $r.get(a);
	if (c !== void 0) return vi(n, c, t), o;
	let l = Qr.get(a), u, d = !1;
	return l === void 0 ? u = /[A-Za-z0-9]/.test(a) || ni.includes(a) || a === "-" ? `\\${a}` : a : (u = l, d = a !== "a" && a !== "e"), yi(n, u, d, t), o;
}, xi = (e) => e.length === 1 ? e[0] : `(?:(?=(?:${e.join("|")}))${mi})`, Si = (e) => xi(e.fragment.length === 0 ? e.alternatives : [`[${e.fragment}]`, ...e.alternatives]), Ci = (e) => {
	let t = zr(`^(?:${e})$`, "u"), n = "";
	for (let e = 0; e < 26; ++e) {
		let r = String.fromCharCode(65 + e), i = String.fromCharCode(97 + e), a = t.test(r);
		a !== t.test(i) && (n += a ? i : r);
	}
	return n;
}, wi = (e, t, n, r = !0, i = 1) => {
	if (i > hi) throw SyntaxError(`Maximum character-class nesting depth of ${hi} exceeded at index ${t}`);
	let a = t + 1, o = e[a] === "^";
	o && ++a;
	let s = a, c = [gi()], l = c[0], u = !1;
	for (; a < e.length;) {
		let d = di(e, a);
		if (d === "\\") {
			a = bi(e, a, l);
			continue;
		}
		if (d === "]") {
			if (a === s) {
				yi(l, "\\]"), ++a;
				continue;
			}
			if (l.tail === null) throw c.length > 1 ? SyntaxError(`Malformed character-class intersection with an empty operand at index ${a}`) : SyntaxError(`Empty character class at index ${t}`);
			let e = c.some((e) => e.contains_complex_set);
			if (o && c.length > 1 && u) throw SyntaxError(`Unsupported outer-negated character-class intersection with a nested negated class containing a Unicode property, POSIX class, or shorthand at index ${t}`);
			let i = Si(c[0]), d = i;
			if (c.length > 1) {
				let e = "";
				for (let t = 1; t < c.length; ++t) e += `(?=${Si(c[t])})`;
				d = `(?:${e}${i})`;
			}
			let f = c.length === 1 && l.alternatives.length === 0, p = l.fragment;
			if (n && r) {
				let e = Ci(d);
				e.length > 0 && (f ? (p += e, d = `[${p}]`) : d = xi([d, `[${e}]`]));
			}
			return {
				atom: o ? f ? `[^${p}]` : `(?:(?!${d})${mi})` : d,
				end: a + 1,
				negated: o,
				contains_complex_set: e,
				contains_nested_negated_complex_set: u
			};
		}
		if (e.startsWith("&&", a)) {
			if (l.tail === null) throw SyntaxError(`Malformed character-class intersection with an empty operand at index ${a}`);
			l = gi(), c.push(l), a += 2;
			continue;
		}
		if (d === "[") {
			let t = e.slice(a);
			if (si.test(t)) throw SyntaxError(`Malformed empty negated POSIX character class at index ${a}`);
			let r = oi.exec(t);
			if (r) {
				let [, e, t] = r, i = ti.get(t);
				if (i === void 0) throw SyntaxError(`Unsupported POSIX character class "${t}" at index ${a}`);
				if (n && e && (t === "lower" || t === "upper")) throw SyntaxError(`Unsupported negated POSIX ${t} class inside an inline case-insensitive group`);
				e ? vi(l, `[^${i}]`, a) : yi(l, i, !0, a), a += r[0].length;
				continue;
			}
			if (ci.test(t)) throw SyntaxError(`Unsupported POSIX collating or equivalence bracket expression at index ${a}`);
			let o = wi(e, a, n, !1, i + 1);
			vi(l, o.atom, a, o.contains_complex_set), u ||= o.contains_nested_negated_complex_set || o.negated && o.contains_complex_set, a = o.end;
			continue;
		}
		if (d === "-") {
			let t = e[a + 1] === "]" || e.startsWith("&&", a + 1);
			l.tail === "set" && !t && _i(a), l.tail === null || l.tail === "range" || l.tail === "complete_range" || t ? yi(l, "\\-") : (l.fragment += "-", l.tail = "range"), ++a;
			continue;
		}
		yi(l, d === "^" && l.fragment.length === 0 ? "\\^" : d), a += d.length;
	}
	throw SyntaxError(`${c.length > 1 ? "Unterminated character-class intersection" : "Unterminated character class"} at index ${t}`);
}, Ti = (e) => {
	let t = "", n = -1, r = !1, i = !1, a = [], o = (e) => {
		n = t.length, t += e, r = !1;
	};
	for (let s = 0; s < e.length;) {
		let c = di(e, s);
		if (c === "\\") {
			let n = ii.exec(e.slice(s));
			if (n) {
				let [e, t, r] = n, a = e;
				if (t === "x") {
					let e = `\\u{${r}}`;
					a = i ? fi(r) ?? e : e;
				} else r === "Word" && (a = t === "p" ? Wr : Gr);
				o(a), s += e.length;
				continue;
			}
			let r = li.exec(e.slice(s));
			if (r) {
				let e = r[0];
				o(i && e[1] !== "c" ? fi(e.slice(2)) ?? e : e), s += e.length;
				continue;
			}
			if (s + 1 >= e.length) {
				t += c;
				break;
			}
			let a = di(e, s + 1);
			if (s += 1 + a.length, a === "G") continue;
			let l = ei.get(a);
			if (l !== void 0) {
				o(l);
				continue;
			}
			let u = Zr.get(a), d;
			d = u === void 0 ? /[A-Za-z0-9]/.test(a) || ni.includes(a) ? `\\${a}` : a : u, o(d);
			continue;
		}
		switch (c) {
			case "[": {
				let t = wi(e, s, i);
				o(t.atom), s = t.end;
				continue;
			}
			case "]":
				o("\\]"), ++s;
				continue;
			case ".":
				o("[^\\n]"), ++s;
				continue;
			case "^":
				o(Jr), ++s;
				continue;
			case "$":
				o(Yr), ++s;
				continue;
			case "(": {
				let n = e.startsWith("(?i:", s), o = n ? "(?i:" : ri.exec(e.slice(s))?.[0] ?? "(", c = n || o === "(?>" ? "(?:" : o;
				a.push([t.length, i]), n && (i = !0), t += c, r = !1, s += o.length;
				continue;
			}
			case ")":
				t += c, [n, i] = a.pop() ?? [-1, !1], r = !1, ++s;
				continue;
			case "|":
				t += c, n = -1, r = !1, ++s;
				continue;
			case "{": {
				let i = ai.exec(e.slice(s));
				if (!i || n < 0) {
					o("\\{"), ++s;
					continue;
				}
				let a = i[1].startsWith(",") ? `0${i[1]}` : i[1];
				s += i[0].length;
				let c = e[s];
				c === "+" || c === "*" ? (t = `${t.slice(0, n)}(?:${t.slice(n)}{${a}})${c}`, ++s) : t += `{${a}}`, r = !0;
				continue;
			}
			case "}":
				o("\\}"), ++s;
				continue;
			case "+":
				if (r) {
					++s;
					continue;
				}
				t += c, r = !0, ++s;
				continue;
			case "*":
			case "?":
				t += c, r = !0, ++s;
				continue;
			default:
				o(i && ui(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c), s += c.length;
				continue;
		}
	}
	return t;
}, Ei = (e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), Di = (e, t, n) => {
	let r = [], i = 0;
	for (; i < e.length;) {
		if (r.push(e[i]), (t.get(e[i]) ?? n) !== n) {
			++i;
			continue;
		}
		for (; ++i < e.length && (t.get(e[i]) ?? n) === n;) t.get(r.at(-1)) !== n && (r[r.length - 1] += e[i]);
	}
	return r;
}, Oi = (e) => e >= 19968 && e <= 40959 || e >= 13312 && e <= 19903 || e >= 131072 && e <= 173791 || e >= 173824 && e <= 177983 || e >= 177984 && e <= 178207 || e >= 178208 && e <= 183983 || e >= 63744 && e <= 64255 || e >= 194560 && e <= 195103, ki = (e) => Number.isInteger(e) || typeof e == "bigint", Ai = (e) => {
	let t = 0;
	for (let n of e) ++t;
	return t;
}, ji = (e) => Fi(e.toLowerCase()), Mi = (...e) => Array.prototype.concat.apply([], e), Ni = (e) => new Map(Object.entries(e)), Pi = (e, t) => {
	let n = [], r = 0;
	for (let i of e.matchAll(t)) {
		let t = i[0];
		r < i.index && n.push(e.slice(r, i.index)), t.length > 0 && n.push(t), r = i.index + t.length;
	}
	return r < e.length && n.push(e.slice(r)), n;
}, Fi = (e) => e.replace(/\p{M}/gu, ""), Ii = (e, t, n = []) => {
	if (!e || Array.isArray(e) || typeof e != "object") return `${t} must be a valid object`;
	for (let r of n) if (!(r in e)) return `${t} must contain a "${r}" property`;
	return null;
}, Li = (e) => e.match(/\S+/g) || [], Ri = class {
	constructor() {
		let e = function(...t) {
			return e._call(...t);
		};
		return Object.setPrototypeOf(e, new.target.prototype);
	}
}, zi = class extends Ri {
	constructor(e) {
		super(), this.config = e;
	}
	_call(e) {
		return this.normalize(e);
	}
}, Bi = class extends zi {
	tokenize_chinese_chars(e) {
		let t = [];
		for (let n = 0; n < e.length; ++n) {
			let r = e[n];
			Oi(r.charCodeAt(0)) ? (t.push(" "), t.push(r), t.push(" ")) : t.push(r);
		}
		return t.join("");
	}
	strip_accents(e) {
		return e.normalize("NFD").replace(/\p{Mn}/gu, "");
	}
	is_control(e) {
		switch (e) {
			case "	":
			case "\n":
			case "\r": return !1;
			default: return /^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u.test(e);
		}
	}
	clean_text(e) {
		let t = [];
		for (let n of e) {
			let e = n.charCodeAt(0);
			e === 0 || e === 65533 || this.is_control(n) || (/^\s$/.test(n) ? t.push(" ") : t.push(n));
		}
		return t.join("");
	}
	normalize(e) {
		return this.config.clean_text && (e = this.clean_text(e)), this.config.handle_chinese_chars && (e = this.tokenize_chinese_chars(e)), this.config.lowercase ? (e = e.toLowerCase(), this.config.strip_accents !== !1 && (e = this.strip_accents(e))) : this.config.strip_accents && (e = this.strip_accents(e)), e;
	}
}, Vi = class extends zi {
	constructor(e) {
		super(e), this.charsmap = e.precompiled_charsmap ?? null;
	}
	normalize(e) {
		return e = e.replace(/[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/gm, ""), e = e.replace(/[\u0009\u000A\u000C\u000D\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2581\u3000\uFEFF\uFFFD]/gm, " "), e = e.includes("～") ? e.split("～").map((e) => e.normalize("NFKC")).join("～") : e.normalize("NFKC"), e;
	}
}, Hi = class extends zi {
	constructor(e) {
		super(e), this.normalizers = (e.normalizers ?? []).map((e) => ea(e));
	}
	normalize(e) {
		return this.normalizers.reduce((e, t) => t ? t.normalize(e) : e, e);
	}
}, Ui = class extends zi {
	constructor(e) {
		super(e), this.pattern = Vr(this.config.pattern ?? {});
	}
	normalize(e) {
		return this.pattern === null ? e : e.replaceAll(this.pattern, this.config.content ?? "");
	}
}, Wi = class extends zi {
	constructor() {
		super(...arguments), this.form = "NFC";
	}
	normalize(e) {
		return e = e.normalize(this.form), e;
	}
}, Gi = class extends Wi {
	constructor() {
		super(...arguments), this.form = "NFC";
	}
}, Ki = class extends Wi {
	constructor() {
		super(...arguments), this.form = "NFD";
	}
}, qi = class extends Wi {
	constructor() {
		super(...arguments), this.form = "NFKC";
	}
}, Ji = class extends Wi {
	constructor() {
		super(...arguments), this.form = "NFKD";
	}
}, Yi = class extends zi {
	normalize(e) {
		return this.config.strip_left && this.config.strip_right ? e = e.trim() : (this.config.strip_left && (e = e.trimStart()), this.config.strip_right && (e = e.trimEnd())), e;
	}
}, Xi = class extends zi {
	normalize(e) {
		return Fi(e);
	}
}, Zi = class extends zi {
	normalize(e) {
		return e.toLowerCase();
	}
}, Qi = class extends zi {
	normalize(e) {
		return e = this.config.prepend + e, e;
	}
};
function $i(e) {
	if (e === null) return null;
	switch (e.type) {
		case "BertNormalizer": return new Bi(e);
		case "Precompiled": return new Vi(e);
		case "Sequence": return new Hi(e);
		case "Replace": return new Ui(e);
		case "NFC": return new Gi(e);
		case "NFD": return new Ki(e);
		case "NFKC": return new qi(e);
		case "NFKD": return new Ji(e);
		case "Strip": return new Yi(e);
		case "StripAccents": return new Xi(e);
		case "Lowercase": return new Zi(e);
		case "Prepend": return new Qi(e);
		default: throw Error(`Unknown Normalizer type: ${e.type}`);
	}
}
var ea = $i, ta = class extends Ri {
	pre_tokenize(e, t) {
		return (Array.isArray(e) ? e.map((e) => this.pre_tokenize_text(e, t)) : this.pre_tokenize_text(e, t)).flat();
	}
	_call(e, t) {
		return this.pre_tokenize(e, t);
	}
}, na = (() => {
	let e = [
		...Array.from({ length: 94 }, (e, t) => t + 33),
		...Array.from({ length: 12 }, (e, t) => t + 161),
		...Array.from({ length: 82 }, (e, t) => t + 174)
	], t = e.slice(), n = 0;
	for (let r = 0; r < 256; ++r) e.includes(r) || (e.push(r), t.push(256 + n), n += 1);
	let r = t.map((e) => String.fromCharCode(e));
	return Object.fromEntries(e.map((e, t) => [e, r[t]]));
})(), ra = ((e) => Object.fromEntries(Object.entries(e).map(([e, t]) => [t, e])))(na), ia = "\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E", aa = class extends ta {
	constructor(e) {
		super(), this.config = e, this.add_prefix_space = this.config.add_prefix_space ?? !1, this.trim_offsets = this.config.trim_offsets ?? !1, this.use_regex = this.config.use_regex ?? !0, this.pattern = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu, this.byte_encoder = na, this.text_encoder = new TextEncoder();
	}
	pre_tokenize_text(e, t) {
		return this.add_prefix_space && !e.startsWith(" ") && (e = " " + e), (this.use_regex ? e.match(this.pattern) || [] : [e]).map((e) => Array.from(this.text_encoder.encode(e), (e) => this.byte_encoder[e]).join(""));
	}
}, oa = class extends ta {
	pre_tokenize_text(e, t) {
		return e.match(/\w+|[^\w\s]+/g) || [];
	}
}, sa = class extends ta {
	constructor(e) {
		super(), this.replacement = e.replacement ?? "▁", this.str_rep = e.str_rep || this.replacement, this.prepend_scheme = e.prepend_scheme ?? "always";
	}
	pre_tokenize_text(e, t) {
		let { section_index: n = void 0 } = t ?? {}, r = e.replaceAll(" ", this.str_rep);
		return !r.startsWith(this.replacement) && (this.prepend_scheme === "always" || this.prepend_scheme === "first" && n === 0) && (r = this.str_rep + r), [r];
	}
}, ca = class extends ta {
	constructor(e) {
		super(), this.config = e, this.pattern = Vr(this.config.pattern ?? {}, this.config.invert ?? !0);
	}
	pre_tokenize_text(e) {
		return this.pattern === null ? [] : this.config.invert ? (e.match(this.pattern) || []).filter((e) => e) : this.config.behavior?.toLowerCase() === "removed" ? e.split(this.pattern).filter((e) => e) : Pi(e, this.pattern);
	}
}, la = class extends ta {
	constructor(e) {
		super(), this.config = e, this.pattern = RegExp(`[^${ia}]+|[${ia}]+`, "gu");
	}
	pre_tokenize_text(e) {
		return e.match(this.pattern) || [];
	}
}, ua = class extends ta {
	constructor(e) {
		super(), this.config = e;
		let t = `[^\\d]+|\\d${this.config.individual_digits ? "" : "+"}`;
		this.pattern = new RegExp(t, "gu");
	}
	pre_tokenize_text(e) {
		return e.match(this.pattern) || [];
	}
}, da = class extends ta {
	constructor() {
		super(), this.pattern = RegExp(`[^\\s${ia}]+|[${ia}]`, "gu");
	}
	pre_tokenize_text(e, t) {
		return e.trim().match(this.pattern) || [];
	}
}, fa = class extends ta {
	constructor(e) {
		super(), this.config = e, this.pattern = Vr(this.config.pattern ?? {}), this.content = this.config.content ?? "";
	}
	pre_tokenize_text(e) {
		return this.pattern === null ? [e] : [e.replaceAll(this.pattern, this.config.content ?? "")];
	}
}, pa = class extends ta {
	constructor(e) {
		super(), this.tokenizers = (e.pretokenizers ?? []).map((e) => _a(e));
	}
	pre_tokenize_text(e, t) {
		return this.tokenizers.reduce((e, n) => n ? n.pre_tokenize(e, t) : e, [e]);
	}
}, ma = class extends ta {
	pre_tokenize_text(e) {
		return Li(e);
	}
}, ha = class extends ta {
	constructor(e) {
		super(), this.config = e, this._length = e.length;
	}
	pre_tokenize_text(e) {
		let t = [];
		for (let n = 0; n < e.length; n += this._length) t.push(e.slice(n, n + this._length));
		return t;
	}
};
function ga(e) {
	if (e === null) return null;
	switch (e.type) {
		case "BertPreTokenizer": return new da();
		case "Sequence": return new pa(e);
		case "Whitespace": return new oa();
		case "WhitespaceSplit": return new ma();
		case "Metaspace": return new sa(e);
		case "ByteLevel": return new aa(e);
		case "Split": return new ca(e);
		case "Punctuation": return new la(e);
		case "Digits": return new ua(e);
		case "Replace": return new fa(e);
		case "FixedLength": return new ha(e);
		default: throw Error(`Unknown PreTokenizer type: ${e.type}`);
	}
}
var _a = ga, va = class extends Ri {
	constructor(e) {
		super(), this.config = e, this.vocab = [], this.tokens_to_ids = /* @__PURE__ */ new Map(), this.unk_token_id = void 0, this.unk_token = void 0, this.end_of_word_suffix = void 0, this.fuse_unk = this.config.fuse_unk ?? !1;
	}
	_call(e) {
		let t = this.encode(e);
		return this.fuse_unk && (t = Di(t, this.tokens_to_ids, this.unk_token_id)), t;
	}
}, ya = class extends va {
	constructor(e) {
		super(e), this.max_input_chars_per_word = 100, this.tokens_to_ids = Ni(e.vocab), this.unk_token_id = this.tokens_to_ids.get(e.unk_token), this.unk_token = e.unk_token, this.max_input_chars_per_word = e.max_input_chars_per_word ?? 100, this.vocab = Array(this.tokens_to_ids.size);
		for (let [e, t] of this.tokens_to_ids) this.vocab[t] = e;
	}
	encode(e) {
		let t = [];
		for (let n of e) {
			let e = [...n];
			if (e.length > this.max_input_chars_per_word) {
				t.push(this.unk_token);
				continue;
			}
			let r = !1, i = 0, a = [];
			for (; i < e.length;) {
				let t = e.length, n = null;
				for (; i < t;) {
					let r = e.slice(i, t).join("");
					if (i > 0 && (r = this.config.continuing_subword_prefix + r), this.tokens_to_ids.has(r)) {
						n = r;
						break;
					}
					--t;
				}
				if (n === null) {
					r = !0;
					break;
				}
				a.push(n), i = t;
			}
			r ? t.push(this.unk_token) : t.push(...a);
		}
		return t;
	}
}, ba = class e {
	constructor(e, t) {
		this.is_leaf = e, this.children = t;
	}
	static default() {
		return new e(!1, /* @__PURE__ */ new Map());
	}
}, xa = class {
	constructor() {
		this.root = ba.default();
	}
	extend(e) {
		for (let t of e) this.push(t);
	}
	push(e) {
		let t = this.root;
		for (let n of e) {
			let e = t.children.get(n);
			e === void 0 && (e = ba.default(), t.children.set(n, e)), t = e;
		}
		t.is_leaf = !0;
	}
	*common_prefix_search(e, t = 0) {
		let n = this.root;
		if (n === void 0) return;
		let r = "";
		for (let i = t; i < e.length; ++i) {
			let t = e[i];
			if (r += t, n = n.children.get(t), n === void 0) return;
			n.is_leaf && (yield r);
		}
	}
}, Sa = class e {
	constructor(e, t, n, r, i) {
		this.token_id = e, this.node_id = t, this.pos = n, this.length = r, this.score = i, this.prev = null, this.backtrace_score = 0;
	}
	clone() {
		let t = new e(this.token_id, this.node_id, this.pos, this.length, this.score);
		return t.prev = this.prev, t.backtrace_score = this.backtrace_score, t;
	}
}, Ca = class {
	constructor(e, t, n) {
		this.chars = Array.from(e), this.len = this.chars.length, this.bos_token_id = t, this.eos_token_id = n, this.nodes = [], this.begin_nodes = Array.from({ length: this.len + 1 }, () => []), this.end_nodes = Array.from({ length: this.len + 1 }, () => []);
		let r = new Sa(this.bos_token_id ?? 0, 0, 0, 0, 0), i = new Sa(this.eos_token_id ?? 0, 1, this.len, 0, 0);
		this.nodes.push(r.clone()), this.nodes.push(i.clone()), this.begin_nodes[this.len].push(i), this.end_nodes[0].push(r);
	}
	insert(e, t, n, r) {
		let i = this.nodes.length, a = new Sa(r, i, e, t, n);
		this.begin_nodes[e].push(a), this.end_nodes[e + t].push(a), this.nodes.push(a);
	}
	viterbi() {
		let e = this.len, t = 0;
		for (; t <= e;) {
			if (this.begin_nodes[t].length == 0) return [];
			for (let e of this.begin_nodes[t]) {
				e.prev = null;
				let n = 0, r = null;
				for (let i of this.end_nodes[t]) {
					let t = i.backtrace_score + e.score;
					(r === null || t > n) && (r = i.clone(), n = t);
				}
				if (r !== null) e.prev = r, e.backtrace_score = n;
				else return [];
			}
			++t;
		}
		let n = [], r = this.begin_nodes[e][0].prev;
		if (r === null) return [];
		let i = r.clone();
		for (; i.prev !== null;) n.push(i.clone()), i = i.clone().prev.clone();
		return n.reverse(), n;
	}
	piece(e) {
		return this.chars.slice(e.pos, e.pos + e.length).join("");
	}
	tokens() {
		return this.viterbi().map((e) => this.piece(e));
	}
	token_ids() {
		return this.viterbi().map((e) => e.token_id);
	}
};
function wa(e) {
	if (e.length === 0) throw Error("Array must not be empty");
	let t = e[0], n = 0;
	for (let r = 1; r < e.length; ++r) e[r] < t && (t = e[r], n = r);
	return [t, n];
}
var Ta = class extends va {
	constructor(e, t) {
		super(e);
		let n = e.vocab.length;
		this.vocab = Array(n), this.scores = Array(n);
		for (let t = 0; t < n; ++t) [this.vocab[t], this.scores[t]] = e.vocab[t];
		this.unk_token_id = e.unk_id, this.unk_token = this.vocab[e.unk_id], this.tokens_to_ids = new Map(this.vocab.map((e, t) => [e, t])), this.bos_token = " ", this.bos_token_id = this.tokens_to_ids.get(this.bos_token), this.eos_token = t, this.eos_token_id = this.tokens_to_ids.get(this.eos_token), this.unk_token = this.vocab[this.unk_token_id], this.min_score = wa(this.scores)[0], this.unk_score = this.min_score - 10, this.scores[this.unk_token_id] = this.unk_score, this.trie = new xa(), this.trie.extend(this.vocab), this.fuse_unk = !0;
	}
	populate_nodes(e) {
		let t = e.chars, n = 0;
		for (; n < t.length;) {
			let r = !1, i = this.trie.common_prefix_search(t, n);
			for (let t of i) {
				let i = this.tokens_to_ids.get(t), a = this.scores[i], o = Ai(t);
				e.insert(n, o, a, i), !r && o === 1 && (r = !0);
			}
			r || e.insert(n, 1, this.unk_score, this.unk_token_id), n += 1;
		}
	}
	tokenize(e) {
		let t = new Ca(e, this.bos_token_id, this.eos_token_id);
		return this.populate_nodes(t), t.tokens();
	}
	encode(e) {
		let t = [];
		for (let n of e) {
			let e = this.tokenize(n);
			t.push(...e);
		}
		return t;
	}
}, Ea = class {
	constructor(e = (e, t) => e > t, t = Infinity) {
		this._heap = [], this._comparator = e, this._max_size = t;
	}
	get size() {
		return this._heap.length;
	}
	is_empty() {
		return this.size === 0;
	}
	peek() {
		return this._heap[0];
	}
	push(...e) {
		return this.extend(e);
	}
	extend(e) {
		for (let t of e) if (this.size < this._max_size) this._heap.push(t), this._sift_up();
		else {
			let e = this._smallest();
			this._comparator(t, this._heap[e]) && (this._heap[e] = t, this._sift_up_from(e));
		}
		return this.size;
	}
	pop() {
		let e = this.peek(), t = this.size - 1;
		return t > 0 && this._swap(0, t), this._heap.pop(), this._sift_down(), e;
	}
	replace(e) {
		let t = this.peek();
		return this._heap[0] = e, this._sift_down(), t;
	}
	_parent(e) {
		return (e + 1 >>> 1) - 1;
	}
	_left(e) {
		return (e << 1) + 1;
	}
	_right(e) {
		return e + 1 << 1;
	}
	_greater(e, t) {
		return this._comparator(this._heap[e], this._heap[t]);
	}
	_swap(e, t) {
		let n = this._heap[e];
		this._heap[e] = this._heap[t], this._heap[t] = n;
	}
	_sift_up() {
		this._sift_up_from(this.size - 1);
	}
	_sift_up_from(e) {
		for (; e > 0 && this._greater(e, this._parent(e));) this._swap(e, this._parent(e)), e = this._parent(e);
	}
	_sift_down() {
		let e = 0;
		for (; this._left(e) < this.size && this._greater(this._left(e), e) || this._right(e) < this.size && this._greater(this._right(e), e);) {
			let t = this._right(e) < this.size && this._greater(this._right(e), this._left(e)) ? this._right(e) : this._left(e);
			this._swap(e, t), e = t;
		}
	}
	_smallest() {
		return 2 ** Math.floor(Math.log2(this.size)) - 1;
	}
}, Da = class {
	constructor(e) {
		this.capacity = e, this.cache = /* @__PURE__ */ new Map();
	}
	get(e) {
		if (!this.cache.has(e)) return;
		let t = this.cache.get(e);
		return this.cache.delete(e), this.cache.set(e, t), t;
	}
	put(e, t) {
		this.cache.has(e) && this.cache.delete(e), this.cache.set(e, t), this.cache.size > this.capacity && this.cache.delete(this.cache.keys().next().value);
	}
	clear() {
		this.cache.clear();
	}
}, Oa = class extends va {
	constructor(e) {
		super(e), this.tokens_to_ids = Ni(e.vocab), this.unk_token_id = this.tokens_to_ids.get(e.unk_token), this.unk_token = e.unk_token, this.vocab = Array(this.tokens_to_ids.size);
		for (let [e, t] of this.tokens_to_ids) this.vocab[t] = e;
		let t = Array.isArray(e.merges[0]);
		this.merges = t ? e.merges : e.merges.map((e) => e.split(" ", 2)), this.bpe_ranks = new Map(this.merges.map((e, t) => [JSON.stringify(e), t])), this.end_of_word_suffix = e.end_of_word_suffix, this.continuing_subword_suffix = e.continuing_subword_suffix ?? null, this.byte_fallback = this.config.byte_fallback ?? !1, this.byte_fallback && (this.text_encoder = new TextEncoder()), this.ignore_merges = this.config.ignore_merges ?? !1, this.max_length_to_cache = 256, this.cache_capacity = 1e4, this.cache = new Da(this.cache_capacity);
	}
	clear_cache() {
		this.cache.clear();
	}
	bpe(e) {
		if (e.length === 0) return [];
		let t = this.cache.get(e);
		if (t !== void 0) return t;
		let n = Array.from(e);
		this.end_of_word_suffix && (n[n.length - 1] += this.end_of_word_suffix);
		let r = [];
		if (n.length > 1) {
			let e = new Ea((e, t) => e.score < t.score), t = {
				token: n[0],
				bias: 0,
				prev: null,
				next: null
			}, i = t;
			for (let t = 1; t < n.length; ++t) {
				let r = {
					bias: t / n.length,
					token: n[t],
					prev: i,
					next: null
				};
				i.next = r, this.add_node(e, i), i = r;
			}
			for (; !e.is_empty();) {
				let n = e.pop();
				if (n.deleted || !n.next || n.next.deleted) continue;
				if (n.deleted = !0, n.next.deleted = !0, n.prev) {
					let e = { ...n.prev };
					n.prev.deleted = !0, n.prev = e, e.prev ? e.prev.next = e : t = e;
				}
				let r = {
					token: n.token + n.next.token,
					bias: n.bias,
					prev: n.prev,
					next: n.next.next
				};
				r.prev ? (r.prev.next = r, this.add_node(e, r.prev)) : t = r, r.next && (r.next.prev = r, this.add_node(e, r));
			}
			for (let e = t; e !== null; e = e.next) r.push(e.token);
		} else r = n;
		if (this.continuing_subword_suffix) for (let e = 0; e < r.length - 1; ++e) r[e] += this.continuing_subword_suffix;
		return e.length < this.max_length_to_cache && this.cache.put(e, r), r;
	}
	add_node(e, t) {
		let n = this.bpe_ranks.get(JSON.stringify([t.token, t.next.token]));
		n !== void 0 && (t.score = n + t.bias, e.push(t));
	}
	encode(e) {
		let t = [];
		for (let n of e) {
			if (this.ignore_merges && this.tokens_to_ids.has(n)) {
				t.push(n);
				continue;
			}
			let e = this.bpe(n);
			for (let n of e) if (this.tokens_to_ids.has(n)) t.push(n);
			else if (this.byte_fallback) {
				let e = Array.from(this.text_encoder.encode(n)).map((e) => `<0x${e.toString(16).toUpperCase().padStart(2, "0")}>`);
				e.every((e) => this.tokens_to_ids.has(e)) ? t.push(...e) : this.unk_token != null && t.push(this.unk_token);
			} else this.unk_token != null && t.push(this.unk_token);
		}
		return t;
	}
}, ka = class extends va {
	constructor(e, t) {
		super(e);
		let n = e.vocab;
		this.tokens_to_ids = Ni(t.target_lang ? n[t.target_lang] : n), this.bos_token = t.bos_token, this.bos_token_id = this.tokens_to_ids.get(this.bos_token), this.eos_token = t.eos_token, this.eos_token_id = this.tokens_to_ids.get(this.eos_token), this.pad_token = t.pad_token, this.pad_token_id = this.tokens_to_ids.get(this.pad_token), this.unk_token = t.unk_token, this.unk_token_id = this.tokens_to_ids.get(this.unk_token), this.vocab = Array(this.tokens_to_ids.size);
		for (let [e, t] of this.tokens_to_ids) this.vocab[t] = e;
	}
	encode(e) {
		return e;
	}
};
function Aa(e, t) {
	switch (e.type) {
		case "WordPiece": return new ya(e);
		case "Unigram": return new Ta(e, t.eos_token);
		case "BPE": return new Oa(e);
		default:
			if (e.vocab) return Array.isArray(e.vocab) ? new Ta(e, t.eos_token) : Object.hasOwn(e, "continuing_subword_prefix") && Object.hasOwn(e, "unk_token") ? Object.hasOwn(e, "merges") ? new Oa(e) : new ya(e) : new ka(e, {
				target_lang: t.target_lang,
				bos_token: t.bos_token,
				eos_token: t.eos_token,
				pad_token: t.pad_token,
				unk_token: t.unk_token
			});
			throw Error(`Unknown TokenizerModel type: ${e?.type}`);
	}
}
var ja = Aa, Ma = class extends Ri {
	constructor(e) {
		super(), this.config = e;
	}
	_call(e, ...t) {
		return this.post_process(e, ...t);
	}
}, Na = class extends Ma {
	post_process(e, t = null, n = !0) {
		let r = t === null ? this.config.single : this.config.pair, i = [], a = [];
		for (let o of r) "SpecialToken" in o ? n && (i.push(o.SpecialToken.id), a.push(o.SpecialToken.type_id)) : "Sequence" in o && (o.Sequence.id === "A" ? (i = Mi(i, e), a = Mi(a, Array(e.length).fill(o.Sequence.type_id))) : o.Sequence.id === "B" && (i = Mi(i, t), a = Mi(a, Array(t.length).fill(o.Sequence.type_id))));
		return {
			tokens: i,
			token_type_ids: a
		};
	}
}, Pa = class extends Ma {
	post_process(e, t = null) {
		return {
			tokens: e,
			tokens_pair: t
		};
	}
}, Fa = class extends Ma {
	constructor(e) {
		super(e), this.sep = e.sep, this.cls = e.cls;
	}
	post_process(e, t = null, n = !0) {
		n && (e = Mi([this.cls[0]], e, [this.sep[0]]));
		let r = Array(e.length).fill(0);
		if (t) {
			let i = [], a = n ? [this.sep[0]] : [];
			e = Mi(e, i, t, a), r = Mi(r, Array(t.length + i.length + a.length).fill(1));
		}
		return {
			tokens: e,
			token_type_ids: r
		};
	}
}, Ia = class extends Ma {
	constructor(e) {
		super(e), this.sep = e.sep, this.cls = e.cls;
	}
	post_process(e, t, n = !0) {
		n && (e = Mi([this.cls[0]], e, [this.sep[0]]));
		let r = Array(e.length).fill(0);
		if (t) {
			let i = n ? [this.sep[0]] : [], a = n ? [this.sep[0]] : [];
			e = Mi(e, i, t, a), r = Mi(r, Array(t.length + i.length + a.length).fill(1));
		}
		return {
			tokens: e,
			token_type_ids: r
		};
	}
}, La = class extends Ma {
	constructor(e) {
		super(e), this.processors = (e.processors ?? []).map((e) => za(e));
	}
	post_process(e, t = null, n = !0) {
		let r = {
			tokens: e,
			tokens_pair: t
		};
		for (let e of this.processors) r = e.post_process(r.tokens, r.tokens_pair, n);
		return r;
	}
};
function Ra(e) {
	if (e === null) return null;
	switch (e.type) {
		case "TemplateProcessing": return new Na(e);
		case "ByteLevel": return new Pa(e);
		case "BertProcessing": return new Fa(e);
		case "RobertaProcessing": return new Ia(e);
		case "Sequence": return new La(e);
		default: throw Error(`Unknown PostProcessor type: ${e.type}`);
	}
}
var za = Ra, Ba = class extends Ri {
	constructor(e) {
		super(), this.config = e, this.added_tokens = [], this.end_of_word_suffix = null, this.trim_offsets = "trim_offsets" in e && e.trim_offsets;
	}
	_call(e) {
		return this.decode(e);
	}
	decode(e) {
		return this.decode_chain(e).join("");
	}
}, Va = class extends Ba {
	constructor(e) {
		super(e), this.byte_decoder = ra, this.text_decoder = new TextDecoder("utf-8", {
			fatal: !1,
			ignoreBOM: !0
		}), this.end_of_word_suffix = null;
	}
	convert_tokens_to_string(e) {
		let t = e.join(""), n = new Uint8Array([...t].map((e) => this.byte_decoder[e]));
		return this.text_decoder.decode(n);
	}
	decode_chain(e) {
		let t = [], n = [];
		for (let r of e) this.added_tokens.find((e) => e.content === r) === void 0 ? n.push(r) : (n.length > 0 && (t.push(this.convert_tokens_to_string(n)), n = []), t.push(r));
		return n.length > 0 && t.push(this.convert_tokens_to_string(n)), t;
	}
}, Ha = class extends Ba {
	constructor(e) {
		super(e), this.cleanup = e.cleanup;
	}
	decode_chain(e) {
		return e.map((e, t) => {
			if (t !== 0) {
				let t = this.config.prefix;
				e = t && e.startsWith(t) ? e.replace(t, "") : " " + e;
			}
			return this.cleanup && (e = Br(e)), e;
		});
	}
}, Ua = class extends Ba {
	constructor(e) {
		super(e), this.replacement = e.replacement ?? "▁";
	}
	decode_chain(e) {
		let t = [];
		for (let n = 0; n < e.length; ++n) {
			let r = e[n].replaceAll(this.replacement, " ");
			n == 0 && r.startsWith(" ") && (r = r.substring(1)), t.push(r);
		}
		return t;
	}
}, Wa = class extends Ba {
	constructor(e) {
		super(e), this.suffix = e.suffix ?? "";
	}
	decode_chain(e) {
		return e.map((t, n) => t.replaceAll(this.suffix, n === e.length - 1 ? "" : " "));
	}
}, Ga = class extends Ba {
	constructor(e) {
		super(e), this.pad_token = e.pad_token ?? "", this.word_delimiter_token = e.word_delimiter_token ?? "", this.cleanup = e.cleanup;
	}
	convert_tokens_to_string(e) {
		if (e.length === 0) return "";
		let t = [e[0]];
		for (let n = 1; n < e.length; ++n) e[n] !== t.at(-1) && t.push(e[n]);
		let n = t.filter((e) => e !== this.pad_token).join("");
		return this.cleanup && (n = Br(n).replaceAll(this.word_delimiter_token, " ").trim()), n;
	}
	decode_chain(e) {
		return [this.convert_tokens_to_string(e)];
	}
}, Ka = class extends Ba {
	constructor(e) {
		super(e), this.decoders = (e.decoders ?? []).map((e) => Qa(e));
	}
	decode_chain(e) {
		return this.decoders.reduce((e, t) => t.decode_chain(e), e);
	}
}, qa = class extends Ba {
	constructor(e) {
		super(e), this.pattern = Vr(this.config.pattern);
	}
	decode_chain(e) {
		let t = this.config.content ?? "", n = this.pattern;
		return n === null ? e : e.map((e) => e.replaceAll(n, t));
	}
}, Ja = class extends Ba {
	decode_chain(e) {
		return [e.join("")];
	}
}, Ya = class extends Ba {
	constructor(e) {
		super(e), this.content = e.content ?? "", this.start = e.start ?? 0, this.stop = e.stop ?? 0;
	}
	decode_chain(e) {
		return e.map((e) => {
			let t = 0;
			for (let n = 0; n < this.start && e[n] === this.content; ++n) t = n + 1;
			let n = e.length;
			for (let t = 0; t < this.stop; ++t) {
				let r = e.length - t - 1;
				if (e[r] === this.content) {
					n = r;
					continue;
				}
				break;
			}
			return e.slice(t, n);
		});
	}
}, Xa = class extends Ba {
	constructor(e) {
		super(e), this.text_decoder = new TextDecoder();
	}
	decode_chain(e) {
		let t = [], n = [];
		for (let r of e) {
			let e = null;
			if (r.length === 6 && r.startsWith("<0x") && r.endsWith(">")) {
				let t = parseInt(r.slice(3, 5), 16);
				isNaN(t) || (e = t);
			}
			if (e !== null) n.push(e);
			else {
				if (n.length > 0) {
					let e = this.text_decoder.decode(Uint8Array.from(n));
					t.push(e), n = [];
				}
				t.push(r);
			}
		}
		if (n.length > 0) {
			let e = this.text_decoder.decode(Uint8Array.from(n));
			t.push(e), n = [];
		}
		return t;
	}
};
function Za(e) {
	if (e === null) return null;
	switch (e.type) {
		case "ByteLevel": return new Va(e);
		case "WordPiece": return new Ha(e);
		case "Metaspace": return new Ua(e);
		case "BPEDecoder": return new Wa(e);
		case "CTC": return new Ga(e);
		case "Sequence": return new Ka(e);
		case "Replace": return new qa(e);
		case "Fuse": return new Ja(e);
		case "Strip": return new Ya(e);
		case "ByteFallback": return new Xa(e);
		default: throw Error(`Unknown Decoder type: ${e.type}`);
	}
}
var Qa = Za, $a = class {
	constructor(e, t) {
		let n = Ii(e, "Tokenizer", [
			"model",
			"decoder",
			"post_processor",
			"pre_tokenizer",
			"normalizer"
		]);
		if (n) throw Error(n);
		let r = Ii(t, "Config");
		if (r) throw Error(r);
		this.tokenizer = e, this.config = t, this.normalizer = ea(this.tokenizer.normalizer), this.pre_tokenizer = _a(this.tokenizer.pre_tokenizer), this.model = ja(this.tokenizer.model, this.config), this.post_processor = za(this.tokenizer.post_processor), this.decoder = Qa(this.tokenizer.decoder), this.special_tokens = [], this.all_special_ids = [], this.added_tokens = [];
		let i = [], a = [];
		this.added_tokens_map = /* @__PURE__ */ new Map();
		for (let e of this.tokenizer.added_tokens) {
			let t = new Rr(e);
			if (this.added_tokens.push(t), this.model.tokens_to_ids.set(t.content, t.id), this.model.vocab[t.id] = t.content, t.special && (this.special_tokens.push(t.content), this.all_special_ids.push(t.id)), this.added_tokens_map.set(t.content, t), t.normalized && this.normalizer !== null) {
				let e = this.normalizer(t.content);
				a.push(e), this.added_tokens_map.set(e, t);
			} else i.push(t.content);
		}
		(this.config.additional_special_tokens ?? []).forEach((e) => {
			this.special_tokens.includes(e) || this.special_tokens.push(e);
		}), this.decoder && (this.decoder.added_tokens = this.added_tokens, this.decoder.end_of_word_suffix = this.model.end_of_word_suffix), this.splitter_unnormalized = new Lr(i), this.splitter_normalized = new Lr(a), this.remove_space = this.config.remove_space, this.clean_up_tokenization_spaces = this.config.clean_up_tokenization_spaces ?? !0, this.do_lowercase_and_remove_accent = this.config.do_lowercase_and_remove_accent ?? !1;
	}
	encode(e, { text_pair: t = null, add_special_tokens: n = !0, return_token_type_ids: r = null } = {}) {
		let { tokens: i, token_type_ids: a } = this.tokenize_helper(e, {
			text_pair: t,
			add_special_tokens: n
		}), o = i.map((e) => this.added_tokens_map.get(e)?.id ?? this.model.tokens_to_ids.get(e) ?? this.model.unk_token_id), s = {
			ids: o,
			tokens: i,
			attention_mask: Array(o.length).fill(1)
		};
		return r && a && (s.token_type_ids = a), s;
	}
	decode(e, t = {}) {
		if (!Array.isArray(e) || e.length === 0 || !ki(e[0])) throw Error("token_ids must be a non-empty array of integers.");
		let n = e.map((e) => this.model.vocab[Number(e)] ?? this.model.unk_token);
		t.skip_special_tokens && (n = n.filter((e) => !this.special_tokens.includes(e)));
		let r = this.decoder ? this.decoder(n) : n.join(" ");
		return this.decoder && this.decoder.end_of_word_suffix && (r = r.replaceAll(this.decoder.end_of_word_suffix, " "), t.skip_special_tokens && (r = r.trim())), (t.clean_up_tokenization_spaces ?? this.clean_up_tokenization_spaces) && (r = Br(r)), r;
	}
	tokenize(e, { text_pair: t = null, add_special_tokens: n = !1 } = {}) {
		return this.tokenize_helper(e, {
			text_pair: t,
			add_special_tokens: n
		}).tokens;
	}
	encode_text(e) {
		if (e === null) return null;
		let t = this.splitter_unnormalized.split(e);
		return t.forEach((e, n) => {
			let r = this.added_tokens_map.get(e);
			r && (r.lstrip && n > 0 && (t[n - 1] = t[n - 1].trimEnd()), r.rstrip && n < t.length - 1 && (t[n + 1] = t[n + 1].trimStart()));
		}), t.flatMap((e, t) => {
			if (e.length === 0) return [];
			if (this.added_tokens_map.has(e)) return [e];
			if (this.remove_space === !0 && (e = e.trim().split(/\s+/).join(" ")), this.do_lowercase_and_remove_accent && (e = ji(e)), this.normalizer !== null && (e = this.normalizer(e)), e.length === 0) return [];
			let n = this.splitter_normalized.split(e);
			return n.forEach((e, t) => {
				let r = this.added_tokens_map.get(e);
				r && (r.lstrip && t > 0 && (n[t - 1] = n[t - 1].trimEnd()), r.rstrip && t < n.length - 1 && (n[t + 1] = n[t + 1].trimStart()));
			}), n.flatMap((e) => {
				if (e.length === 0) return [];
				if (this.added_tokens_map.has(e)) return [e];
				let n = this.pre_tokenizer === null ? [e] : this.pre_tokenizer(e, { section_index: t });
				return this.model(n);
			});
		});
	}
	tokenize_helper(e, { text_pair: t = null, add_special_tokens: n = !0 }) {
		let r = this.encode_text(e), i = this.encode_text(t || null);
		return this.post_processor ? this.post_processor(r, i, n) : { tokens: Mi(r ?? [], i ?? []) };
	}
	token_to_id(e) {
		return this.model.tokens_to_ids.get(e);
	}
	id_to_token(e) {
		return this.model.vocab[e];
	}
	get_added_tokens_decoder() {
		let e = /* @__PURE__ */ new Map();
		for (let t of this.added_tokens) e.set(t.id, t);
		return e;
	}
	get_vocab(e = !0) {
		let t = /* @__PURE__ */ new Map();
		for (let n = 0; n < this.model.vocab.length; ++n) {
			let r = this.model.vocab[n];
			(e || !this.added_tokens_map.has(r)) && t.set(r, n);
		}
		return t;
	}
}, eo = Object.defineProperty, to = (e, t, n) => t in e ? eo(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, no = (e, t, n) => (to(e, typeof t == "symbol" ? t : t + "", n), n), j = Object.freeze({
	Text: "Text",
	NumericLiteral: "NumericLiteral",
	StringLiteral: "StringLiteral",
	Identifier: "Identifier",
	Equals: "Equals",
	OpenParen: "OpenParen",
	CloseParen: "CloseParen",
	OpenStatement: "OpenStatement",
	CloseStatement: "CloseStatement",
	OpenExpression: "OpenExpression",
	CloseExpression: "CloseExpression",
	OpenSquareBracket: "OpenSquareBracket",
	CloseSquareBracket: "CloseSquareBracket",
	OpenCurlyBracket: "OpenCurlyBracket",
	CloseCurlyBracket: "CloseCurlyBracket",
	Comma: "Comma",
	Dot: "Dot",
	Colon: "Colon",
	Pipe: "Pipe",
	CallOperator: "CallOperator",
	AdditiveBinaryOperator: "AdditiveBinaryOperator",
	MultiplicativeBinaryOperator: "MultiplicativeBinaryOperator",
	ExponentiationBinaryOperator: "ExponentiationBinaryOperator",
	ComparisonBinaryOperator: "ComparisonBinaryOperator",
	UnaryOperator: "UnaryOperator",
	Comment: "Comment"
}), ro = class {
	constructor(e, t) {
		this.value = e, this.type = t;
	}
};
function io(e) {
	return /\w/.test(e);
}
function ao(e) {
	return /[0-9]/.test(e);
}
function oo(e) {
	return /\s/.test(e);
}
var so = [
	["{%", j.OpenStatement],
	["%}", j.CloseStatement],
	["{{", j.OpenExpression],
	["}}", j.CloseExpression],
	["(", j.OpenParen],
	[")", j.CloseParen],
	["{", j.OpenCurlyBracket],
	["}", j.CloseCurlyBracket],
	["[", j.OpenSquareBracket],
	["]", j.CloseSquareBracket],
	[",", j.Comma],
	[".", j.Dot],
	[":", j.Colon],
	["|", j.Pipe],
	["<=", j.ComparisonBinaryOperator],
	[">=", j.ComparisonBinaryOperator],
	["==", j.ComparisonBinaryOperator],
	["!=", j.ComparisonBinaryOperator],
	["<", j.ComparisonBinaryOperator],
	[">", j.ComparisonBinaryOperator],
	["+", j.AdditiveBinaryOperator],
	["-", j.AdditiveBinaryOperator],
	["~", j.AdditiveBinaryOperator],
	["**", j.ExponentiationBinaryOperator],
	["*", j.MultiplicativeBinaryOperator],
	["//", j.MultiplicativeBinaryOperator],
	["/", j.MultiplicativeBinaryOperator],
	["%", j.MultiplicativeBinaryOperator],
	["=", j.Equals]
], co = /* @__PURE__ */ new Map([
	["n", "\n"],
	["t", "	"],
	["r", "\r"],
	["b", "\b"],
	["f", "\f"],
	["v", "\v"],
	["'", "'"],
	["\"", "\""],
	["\\", "\\"]
]);
function lo(e, t = {}) {
	return e.endsWith("\n") && (e = e.slice(0, -1)), t.lstrip_blocks && (e = e.replace(/^[ \t]*({[#%-])/gm, "$1")), t.trim_blocks && (e = e.replace(/([#%-]})\n/g, "$1")), e.replace(/(\s*){%(-?)\s*(?:end)?generation\s*(-?)%}(\s*)/gs, (e, t, n, r, i) => (n ? "" : t) + (r ? "" : i));
}
function uo(e, t = {}) {
	let n = [], r = lo(e, t), i = 0, a = 0, o = (e) => {
		let t = "";
		for (; e(r[i]);) {
			if (r[i] === "\\") {
				if (++i, i >= r.length) throw SyntaxError("Unexpected end of input");
				let e = r[i++], n = co.get(e);
				if (n === void 0) throw SyntaxError(`Unexpected escaped character: ${e}`);
				t += n;
				continue;
			}
			if (t += r[i++], i >= r.length) throw SyntaxError("Unexpected end of input");
		}
		return t;
	}, s = () => {
		let e = n.at(-1);
		e && e.type === j.Text && (e.value = e.value.trimEnd(), e.value === "" && n.pop());
	}, c = () => {
		for (; i < r.length && oo(r[i]);) ++i;
	};
	main: for (; i < r.length;) {
		let e = n.at(-1)?.type;
		if (e === void 0 || e === j.CloseStatement || e === j.CloseExpression || e === j.Comment) {
			let e = "";
			for (; i < r.length && (r[i] !== "{" || r[i + 1] !== "%" && r[i + 1] !== "{" && r[i + 1] !== "#");) e += r[i++];
			if (e.length > 0) {
				n.push(new ro(e, j.Text));
				continue;
			}
		}
		if (r[i] === "{" && r[i + 1] === "#") {
			i += 2;
			let e = r[i] === "-";
			e && ++i;
			let t = "";
			for (; r[i] !== "#" || r[i + 1] !== "}";) {
				if (i + 2 >= r.length) throw SyntaxError("Missing end of comment tag");
				t += r[i++];
			}
			let a = t.endsWith("-");
			a && (t = t.slice(0, -1)), e && s(), n.push(new ro(t, j.Comment)), i += 2, a && c();
			continue;
		}
		if (r.slice(i, i + 3) === "{%-") {
			s(), n.push(new ro("{%", j.OpenStatement)), i += 3;
			continue;
		}
		if (r.slice(i, i + 3) === "{{-") {
			s(), n.push(new ro("{{", j.OpenExpression)), a = 0, i += 3;
			continue;
		}
		if (o(oo), r.slice(i, i + 3) === "-%}") {
			n.push(new ro("%}", j.CloseStatement)), i += 3, c();
			continue;
		}
		if (r.slice(i, i + 3) === "-}}") {
			n.push(new ro("}}", j.CloseExpression)), i += 3, c();
			continue;
		}
		let t = r[i];
		if (t === "-" || t === "+") {
			let e = n.at(-1)?.type;
			if (e === j.Text || e === void 0) throw SyntaxError(`Unexpected character: ${t}`);
			switch (e) {
				case j.Identifier:
				case j.NumericLiteral:
				case j.StringLiteral:
				case j.CloseParen:
				case j.CloseSquareBracket: break;
				default: {
					++i;
					let e = o(ao);
					if (e.length > 0 && r[i] === "." && ao(r[i + 1])) {
						++i;
						let t = o(ao);
						e = `${e}.${t}`;
					}
					n.push(new ro(`${t}${e}`, e.length > 0 ? j.NumericLiteral : j.UnaryOperator));
					continue;
				}
			}
		}
		for (let [e, t] of so) if (!(e === "}}" && a > 0) && r.slice(i, i + e.length) === e) {
			n.push(new ro(e, t)), t === j.OpenExpression ? a = 0 : t === j.OpenCurlyBracket ? ++a : t === j.CloseCurlyBracket && --a, i += e.length;
			continue main;
		}
		if (t === "'" || t === "\"") {
			++i;
			let e = o((e) => e !== t);
			n.push(new ro(e, j.StringLiteral)), ++i;
			continue;
		}
		if (ao(t)) {
			let e = o(ao);
			if (n.at(-1)?.type !== j.Dot && r[i] === "." && ao(r[i + 1])) {
				++i;
				let t = o(ao);
				e = `${e}.${t}`;
			}
			n.push(new ro(e, j.NumericLiteral));
			continue;
		}
		if (io(t)) {
			let e = o(io);
			n.push(new ro(e, j.Identifier));
			continue;
		}
		throw SyntaxError(`Unexpected character: ${t}`);
	}
	return n;
}
var fo = class {
	type = "Statement";
}, po = class extends fo {
	constructor(e) {
		super(), this.body = e;
	}
	type = "Program";
}, mo = class extends fo {
	constructor(e, t, n) {
		super(), this.test = e, this.body = t, this.alternate = n;
	}
	type = "If";
}, ho = class extends fo {
	constructor(e, t, n, r) {
		super(), this.loopvar = e, this.iterable = t, this.body = n, this.defaultBlock = r;
	}
	type = "For";
}, go = class extends fo {
	type = "Break";
}, _o = class extends fo {
	type = "Continue";
}, vo = class extends fo {
	constructor(e, t, n) {
		super(), this.assignee = e, this.value = t, this.body = n;
	}
	type = "Set";
}, yo = class extends fo {
	constructor(e, t, n) {
		super(), this.name = e, this.args = t, this.body = n;
	}
	type = "Macro";
}, bo = class extends fo {
	constructor(e) {
		super(), this.value = e;
	}
	type = "Comment";
}, xo = class extends fo {
	type = "Expression";
}, So = class extends xo {
	constructor(e, t, n) {
		super(), this.object = e, this.property = t, this.computed = n;
	}
	type = "MemberExpression";
}, Co = class extends xo {
	constructor(e, t) {
		super(), this.callee = e, this.args = t;
	}
	type = "CallExpression";
}, wo = class extends xo {
	constructor(e) {
		super(), this.value = e;
	}
	type = "Identifier";
}, To = class extends xo {
	constructor(e) {
		super(), this.value = e;
	}
	type = "Literal";
}, Eo = class extends To {
	type = "IntegerLiteral";
}, Do = class extends To {
	type = "FloatLiteral";
}, Oo = class extends To {
	type = "StringLiteral";
}, ko = class extends To {
	type = "ArrayLiteral";
}, Ao = class extends To {
	type = "TupleLiteral";
}, jo = class extends To {
	type = "ObjectLiteral";
}, Mo = class extends xo {
	constructor(e, t, n) {
		super(), this.operator = e, this.left = t, this.right = n;
	}
	type = "BinaryExpression";
}, No = class extends xo {
	constructor(e, t) {
		super(), this.operand = e, this.filter = t;
	}
	type = "FilterExpression";
}, Po = class extends fo {
	constructor(e, t) {
		super(), this.filter = e, this.body = t;
	}
	type = "FilterStatement";
}, Fo = class extends xo {
	constructor(e, t) {
		super(), this.lhs = e, this.test = t;
	}
	type = "SelectExpression";
}, Io = class extends xo {
	constructor(e, t, n) {
		super(), this.operand = e, this.negate = t, this.test = n;
	}
	type = "TestExpression";
}, Lo = class extends xo {
	constructor(e, t) {
		super(), this.operator = e, this.argument = t;
	}
	type = "UnaryExpression";
}, Ro = class extends xo {
	constructor(e = void 0, t = void 0, n = void 0) {
		super(), this.start = e, this.stop = t, this.step = n;
	}
	type = "SliceExpression";
}, zo = class extends xo {
	constructor(e, t) {
		super(), this.key = e, this.value = t;
	}
	type = "KeywordArgumentExpression";
}, Bo = class extends xo {
	constructor(e) {
		super(), this.argument = e;
	}
	type = "SpreadExpression";
}, Vo = class extends xo {
	constructor(e) {
		super(), this.argument = e;
	}
	type = "KeywordSpreadExpression";
}, Ho = class extends fo {
	constructor(e, t, n) {
		super(), this.call = e, this.callerArgs = t, this.body = n;
	}
	type = "CallStatement";
}, Uo = class extends xo {
	constructor(e, t, n) {
		super(), this.condition = e, this.trueExpr = t, this.falseExpr = n;
	}
	type = "Ternary";
};
function Wo(e) {
	let t = new po([]), n = 0;
	function r(t, r) {
		let i = e[n++];
		if (!i || i.type !== t) throw Error(`Parser Error: ${r}. ${i.type} !== ${t}.`);
		return i;
	}
	function i(e) {
		if (!c(e)) throw SyntaxError(`Expected ${e}`);
		++n;
	}
	function a() {
		switch (e[n].type) {
			case j.Comment: return new bo(e[n++].value);
			case j.Text: return l();
			case j.OpenStatement: return u();
			case j.OpenExpression: return d();
			default: throw SyntaxError(`Unexpected token type: ${e[n].type}`);
		}
	}
	function o(...t) {
		return n + t.length <= e.length && t.every((t, r) => t === e[n + r].type);
	}
	function s(...t) {
		return e[n]?.type === j.OpenStatement && e[n + 1]?.type === j.Identifier && t.includes(e[n + 1]?.value);
	}
	function c(...t) {
		return n + t.length <= e.length && t.every((t, r) => e[n + r].type === "Identifier" && t === e[n + r].value);
	}
	function l() {
		return new Oo(r(j.Text, "Expected text token").value);
	}
	function u() {
		if (r(j.OpenStatement, "Expected opening statement token"), e[n].type !== j.Identifier) throw SyntaxError(`Unknown statement, got ${e[n].type}`);
		let t = e[n].value, c;
		switch (t) {
			case "set":
				++n, c = f();
				break;
			case "if":
				++n, c = p(), r(j.OpenStatement, "Expected {% token"), i("endif"), r(j.CloseStatement, "Expected %} token");
				break;
			case "macro":
				++n, c = m(), r(j.OpenStatement, "Expected {% token"), i("endmacro"), r(j.CloseStatement, "Expected %} token");
				break;
			case "for":
				++n, c = g(), r(j.OpenStatement, "Expected {% token"), i("endfor"), r(j.CloseStatement, "Expected %} token");
				break;
			case "call": {
				++n;
				let e = null;
				o(j.OpenParen) && (e = te("parameters"));
				let t = ue();
				if (t.type !== "Identifier") throw SyntaxError("Expected identifier following call statement");
				let l = te("call");
				r(j.CloseStatement, "Expected closing statement token");
				let u = [];
				for (; !s("endcall");) u.push(a());
				r(j.OpenStatement, "Expected '{%'"), i("endcall"), r(j.CloseStatement, "Expected closing statement token"), c = new Ho(new Co(t, l), e, u);
				break;
			}
			case "break":
				++n, r(j.CloseStatement, "Expected closing statement token"), c = new go();
				break;
			case "continue":
				++n, r(j.CloseStatement, "Expected closing statement token"), c = new _o();
				break;
			case "filter": {
				++n;
				let e = ue();
				e instanceof wo && o(j.OpenParen) && (e = w(e)), r(j.CloseStatement, "Expected closing statement token");
				let t = [];
				for (; !s("endfilter");) t.push(a());
				r(j.OpenStatement, "Expected '{%'"), i("endfilter"), r(j.CloseStatement, "Expected '%}'"), c = new Po(e, t);
				break;
			}
			default: throw SyntaxError(`Unknown statement type: ${t}`);
		}
		return c;
	}
	function d() {
		r(j.OpenExpression, "Expected opening expression token");
		let e = _();
		return r(j.CloseExpression, "Expected closing expression token"), e;
	}
	function f() {
		let e = h(), t = null, c = [];
		if (o(j.Equals)) ++n, t = h();
		else {
			for (r(j.CloseStatement, "Expected %} token"); !s("endset");) c.push(a());
			r(j.OpenStatement, "Expected {% token"), i("endset");
		}
		return r(j.CloseStatement, "Expected closing statement token"), new vo(e, t, c);
	}
	function p() {
		let e = _();
		r(j.CloseStatement, "Expected closing statement token");
		let t = [], i = [];
		for (; !s("elif", "else", "endif");) t.push(a());
		if (s("elif")) {
			++n, ++n;
			let e = p();
			i.push(e);
		} else if (s("else")) for (++n, ++n, r(j.CloseStatement, "Expected closing statement token"); !s("endif");) i.push(a());
		return new mo(e, t, i);
	}
	function m() {
		let e = ue();
		if (e.type !== "Identifier") throw SyntaxError("Expected identifier following macro statement");
		let t = te("parameters");
		r(j.CloseStatement, "Expected closing statement token");
		let n = [];
		for (; !s("endmacro");) n.push(a());
		return new yo(e, t, n);
	}
	function h(e = !1) {
		let t = e ? ue : _, r = [t()], i = o(j.Comma);
		for (; i && (++n, r.push(t()), o(j.Comma)););
		return i ? new Ao(r) : r[0];
	}
	function g() {
		let e = h(!0);
		if (!(e instanceof wo || e instanceof Ao)) throw SyntaxError(`Expected identifier/tuple for the loop variable, got ${e.type} instead`);
		if (!c("in")) throw SyntaxError("Expected `in` keyword following loop variable");
		++n;
		let t = _();
		r(j.CloseStatement, "Expected closing statement token");
		let i = [];
		for (; !s("endfor", "else");) i.push(a());
		let o = [];
		if (s("else")) for (++n, ++n, r(j.CloseStatement, "Expected closing statement token"); !s("endfor");) o.push(a());
		return new ho(e, t, i, o);
	}
	function _() {
		return v();
	}
	function v() {
		let e = y();
		if (c("if")) {
			++n;
			let t = y();
			return c("else") ? (++n, new Uo(t, e, v())) : new Fo(e, t);
		}
		return e;
	}
	function y() {
		let t = b();
		for (; c("or");) {
			let r = e[n];
			++n;
			let i = b();
			t = new Mo(r, t, i);
		}
		return t;
	}
	function b() {
		let t = x();
		for (; c("and");) {
			let r = e[n];
			++n;
			let i = x();
			t = new Mo(r, t, i);
		}
		return t;
	}
	function x() {
		let t;
		for (; c("not");) {
			let r = e[n];
			++n, t = new Lo(r, x());
		}
		return t ?? S();
	}
	function S() {
		let t = C();
		for (;;) {
			let r;
			if (c("not", "in")) r = new ro("not in", j.Identifier), n += 2;
			else if (c("in")) r = e[n++];
			else if (o(j.ComparisonBinaryOperator)) r = e[n++];
			else break;
			let i = C();
			t = new Mo(r, t, i);
		}
		return t;
	}
	function C() {
		let t = ae();
		for (; o(j.AdditiveBinaryOperator);) {
			let r = e[n];
			++n;
			let i = ae();
			t = new Mo(r, t, i);
		}
		return t;
	}
	function ee() {
		let e = ie(ue());
		return o(j.OpenParen) ? w(e) : e;
	}
	function w(e) {
		let t = new Co(e, te("call"));
		return t = ie(t), o(j.OpenParen) && (t = w(t)), t;
	}
	function te(e) {
		r(j.OpenParen, "Expected opening parenthesis for arguments list");
		let t = ne(e);
		return r(j.CloseParen, "Expected closing parenthesis for arguments list"), t;
	}
	function ne(t) {
		let r = [], i = /* @__PURE__ */ new Set(), a = !1, s = !1;
		for (; !o(j.CloseParen);) {
			let c = o(j.ExponentiationBinaryOperator), l = o(j.MultiplicativeBinaryOperator) && e[n].value === "*";
			if (t === "parameters" && (c || l)) throw SyntaxError("Argument unpacking is not allowed in parameter declarations");
			if (c) {
				if (++n, r.push(new Vo(_())), o(j.Comma) && ++n, !o(j.CloseParen)) throw SyntaxError("Expected closing parenthesis: `**` must be applied to the final argument");
				break;
			}
			let u;
			if (l) {
				if (s) throw SyntaxError("Only one `*` argument unpacking is allowed");
				s = !0, ++n, u = new Bo(_());
			} else {
				if (u = _(), o(j.Equals)) {
					if (++n, !(u instanceof wo)) throw SyntaxError(t === "parameters" ? "Expected identifier for parameter declaration" : "Expected identifier for keyword argument");
					let e = _();
					u = new zo(u, e);
				}
				if (t === "parameters") {
					if (!(u instanceof wo || u instanceof zo)) throw SyntaxError("Expected identifier for parameter declaration");
					let e = u instanceof wo ? u.value : u.key.value;
					if (i.has(e)) throw SyntaxError(`Duplicate parameter name: ${e}`);
					i.add(e);
				}
				if (u instanceof zo) a = !0;
				else if (a) throw SyntaxError(t === "call" ? "Positional arguments must come before keyword arguments" : "Non-default argument follows default argument");
				else if (s) throw SyntaxError("Positional arguments must not follow `*` argument unpacking");
			}
			r.push(u), o(j.Comma) && ++n;
		}
		return r;
	}
	function re() {
		let e = [], t = !1;
		for (; !o(j.CloseSquareBracket);) o(j.Colon) ? (e.push(void 0), ++n, t = !0) : (e.push(_()), o(j.Colon) && (++n, t = !0));
		if (e.length === 0) throw SyntaxError("Expected at least one argument for member/slice expression");
		if (t) {
			if (e.length > 3) throw SyntaxError("Expected 0-3 arguments for slice expression");
			return new Ro(...e);
		}
		return e[0];
	}
	function ie(t) {
		for (; o(j.Dot) || o(j.OpenSquareBracket);) {
			let i = e[n];
			++n;
			let a, o = i.type === j.OpenSquareBracket;
			if (o) a = re(), r(j.CloseSquareBracket, "Expected closing square bracket");
			else if (a = ue(), a.type !== "Identifier" && a.type !== "IntegerLiteral") throw SyntaxError("Expected identifier or integer following dot operator");
			t = new So(t, a, o);
		}
		return t;
	}
	function ae() {
		let t = oe();
		for (; o(j.MultiplicativeBinaryOperator);) {
			let r = e[n++], i = oe();
			t = new Mo(r, t, i);
		}
		return t;
	}
	function oe() {
		let t = se();
		for (; o(j.ExponentiationBinaryOperator);) {
			let r = e[n++], i = se();
			t = new Mo(r, t, i);
		}
		return t;
	}
	function se() {
		let e = ce();
		for (; c("is");) {
			++n;
			let t = c("not");
			t && ++n;
			let r = ue();
			if (!(r instanceof wo)) throw SyntaxError("Expected identifier for the test");
			e = new Io(e, t, r);
		}
		return e;
	}
	function ce() {
		let e = le();
		for (; o(j.Pipe);) {
			++n;
			let t = ue();
			if (!(t instanceof wo)) throw SyntaxError("Expected identifier for the filter");
			o(j.OpenParen) && (t = w(t)), e = new No(e, t);
		}
		return e;
	}
	function le() {
		let t = e[n];
		if (t && (t.type === j.UnaryOperator || t.type === j.AdditiveBinaryOperator) && (t.value === "-" || t.value === "+")) {
			let t = e[n++];
			return new Lo(t, le());
		}
		return ee();
	}
	function ue() {
		let t = e[n++];
		switch (t.type) {
			case j.NumericLiteral: {
				let e = t.value;
				return e.includes(".") ? new Do(Number(e)) : new Eo(Number(e));
			}
			case j.StringLiteral: {
				let r = t.value;
				for (; o(j.StringLiteral);) r += e[n++].value;
				return new Oo(r);
			}
			case j.Identifier: return new wo(t.value);
			case j.OpenParen: {
				let e = h();
				return r(j.CloseParen, "Expected closing parenthesis, got ${tokens[current].type} instead."), e;
			}
			case j.OpenSquareBracket: {
				let e = [];
				for (; !o(j.CloseSquareBracket);) e.push(_()), o(j.Comma) && ++n;
				return ++n, new ko(e);
			}
			case j.OpenCurlyBracket: {
				let e = /* @__PURE__ */ new Map();
				for (; !o(j.CloseCurlyBracket);) {
					let t = _();
					r(j.Colon, "Expected colon between key and value in object literal");
					let i = _();
					e.set(t, i), o(j.Comma) && ++n;
				}
				return ++n, new jo(e);
			}
			default: throw SyntaxError(`Unexpected token: ${t.type}`);
		}
	}
	for (; n < e.length;) t.body.push(a());
	return t;
}
function Go(e, t, n = 1) {
	if (t === void 0 && (t = e, e = 0), n === 0) throw Error("range() step must not be zero");
	let r = [];
	if (n > 0) for (let i = e; i < t; i += n) r.push(i);
	else for (let i = e; i > t; i += n) r.push(i);
	return r;
}
function Ko(e, t, n, r = 1) {
	let i = Math.sign(r);
	i >= 0 ? (t = (t ??= 0) < 0 ? Math.max(e.length + t, 0) : Math.min(t, e.length), n = (n ??= e.length) < 0 ? Math.max(e.length + n, 0) : Math.min(n, e.length)) : (t = (t ??= e.length - 1) < 0 ? Math.max(e.length + t, -1) : Math.min(t, e.length - 1), n = (n ??= -1) < -1 ? Math.max(e.length + n, -1) : Math.min(n, e.length - 1));
	let a = [];
	for (let o = t; i * o < i * n; o += r) a.push(e[o]);
	return a;
}
function qo(e) {
	return e.replace(/\b\w/g, (e) => e.toUpperCase());
}
function Jo(e) {
	return Yo(/* @__PURE__ */ new Date(), e);
}
function Yo(e, t) {
	let n = new Intl.DateTimeFormat(void 0, { month: "long" }), r = new Intl.DateTimeFormat(void 0, { month: "short" }), i = (e) => e < 10 ? "0" + e : e.toString();
	return t.replace(/%[YmdbBHM%]/g, (t) => {
		switch (t) {
			case "%Y": return e.getFullYear().toString();
			case "%m": return i(e.getMonth() + 1);
			case "%d": return i(e.getDate());
			case "%b": return r.format(e);
			case "%B": return n.format(e);
			case "%H": return i(e.getHours());
			case "%M": return i(e.getMinutes());
			case "%%": return "%";
			default: return t;
		}
	});
}
function Xo(e) {
	return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Zo(e, t, n, r) {
	if (r === 0) return e;
	let i = r == null || r < 0 ? Infinity : r, a = t.length === 0 ? /* @__PURE__ */ RegExp("(?=)", "gu") : new RegExp(Xo(t), "gu");
	return e.replaceAll(a, (e) => i > 0 ? (--i, n) : e);
}
var Qo = class extends Error {}, $o = class extends Error {}, es = /* @__PURE__ */ new Map(), ts = class {
	type = "RuntimeValue";
	value;
	get builtins() {
		return es;
	}
	constructor(e = void 0) {
		this.value = e;
	}
	__bool__() {
		return new F(!!this.value);
	}
	toString() {
		return String(this.value);
	}
}, M = class extends ts {
	type = "IntegerValue";
}, N = class extends ts {
	type = "FloatValue";
	toString() {
		return Object.is(this.value, -0) ? "-0.0" : this.value % 1 == 0 ? this.value.toFixed(1) : this.value.toString();
	}
}, P = class extends ts {
	type = "StringValue";
	_builtins;
	get builtins() {
		return this._builtins ??= /* @__PURE__ */ new Map([
			["upper", new L(() => new P(this.value.toUpperCase()))],
			["lower", new L(() => new P(this.value.toLowerCase()))],
			["strip", new L(() => new P(this.value.trim()))],
			["title", new L(() => new P(qo(this.value)))],
			["capitalize", new L(() => new P(this.value.charAt(0).toUpperCase() + this.value.slice(1)))],
			["length", new M(this.value.length)],
			["rstrip", new L(() => new P(this.value.trimEnd()))],
			["lstrip", new L(() => new P(this.value.trimStart()))],
			["startswith", new L((e) => {
				if (e.length === 0) throw Error("startswith() requires at least one argument");
				let t = e[0];
				if (t instanceof P) return new F(this.value.startsWith(t.value));
				if (t instanceof I) {
					for (let e of t.value) {
						if (!(e instanceof P)) throw Error("startswith() tuple elements must be strings");
						if (this.value.startsWith(e.value)) return new F(!0);
					}
					return new F(!1);
				}
				throw Error("startswith() argument must be a string or tuple of strings");
			})],
			["endswith", new L((e) => {
				if (e.length === 0) throw Error("endswith() requires at least one argument");
				let t = e[0];
				if (t instanceof P) return new F(this.value.endsWith(t.value));
				if (t instanceof I) {
					for (let e of t.value) {
						if (!(e instanceof P)) throw Error("endswith() tuple elements must be strings");
						if (this.value.endsWith(e.value)) return new F(!0);
					}
					return new F(!1);
				}
				throw Error("endswith() argument must be a string or tuple of strings");
			})],
			["split", new L((e) => {
				let t = e[0] ?? new R();
				if (!(t instanceof P || t instanceof R)) throw Error("sep argument must be a string or null");
				let n = e[1] ?? new M(-1);
				if (!(n instanceof M)) throw Error("maxsplit argument must be a number");
				let r = [];
				if (t instanceof R) {
					let e = this.value.trimStart();
					for (let { 0: t, index: i } of e.matchAll(/\S+/g)) {
						if (n.value !== -1 && r.length >= n.value && i !== void 0) {
							r.push(t + e.slice(i + t.length));
							break;
						}
						r.push(t);
					}
				} else {
					if (t.value === "") throw Error("empty separator");
					r = this.value.split(t.value), n.value !== -1 && r.length > n.value && r.push(r.splice(n.value).join(t.value));
				}
				return new I(r.map((e) => new P(e)));
			})],
			["replace", new L((e) => {
				if (e.length < 2) throw Error("replace() requires at least two arguments");
				let t = e[0], n = e[1];
				if (!(t instanceof P && n instanceof P)) throw Error("replace() arguments must be strings");
				let r;
				if (r = e.length > 2 ? e[2].type === "KeywordArgumentsValue" ? e[2].value.get("count") ?? new R() : e[2] : new R(), !(r instanceof M || r instanceof R)) throw Error("replace() count argument must be a number or null");
				return new P(Zo(this.value, t.value, n.value, r.value));
			})]
		]);
	}
}, F = class extends ts {
	type = "BooleanValue";
}, ns = /[\x7f-\uffff]/g;
function rs(e) {
	return e.replace(ns, (e) => "\\u" + e.charCodeAt(0).toString(16).padStart(4, "0"));
}
function is(e, t = {}, n = 0, r = !0) {
	let { indent: i = null, ensureAscii: a = !1, separators: o = null, sortKeys: s = !1 } = t, c, l;
	switch (o ? [c, l] = o : i ? (c = ",", l = ": ") : (c = ", ", l = ": "), e.type) {
		case "NullValue": return "null";
		case "UndefinedValue": return r ? "null" : "undefined";
		case "IntegerValue":
		case "FloatValue":
		case "BooleanValue": return JSON.stringify(e.value);
		case "StringValue": {
			let t = JSON.stringify(e.value);
			return a && (t = rs(t)), t;
		}
		case "ArrayValue":
		case "NamespaceValue":
		case "ObjectValue": {
			let o = i ? " ".repeat(i) : "", u = "\n" + o.repeat(n), d = u + o;
			if (e.type === "ArrayValue") {
				let a = e.value.map((e) => is(e, t, n + 1, r));
				return i ? `[${d}${a.join(`${c}${d}`)}${u}]` : `[${a.join(c)}]`;
			}
			{
				let o = Array.from(e.value.entries());
				s && (o = o.sort(([e], [t]) => e.localeCompare(t)));
				let f = o.map(([e, o]) => {
					let s = JSON.stringify(e);
					a && (s = rs(s));
					let c = `${s}${l}${is(o, t, n + 1, r)}`;
					return i ? `${d}${c}` : c;
				});
				return i ? `{${f.join(c)}${u}}` : `{${f.join(c)}}`;
			}
		}
		default: throw Error(`Cannot convert to JSON: ${e.type}`);
	}
}
var as = class extends ts {
	type = "ObjectValue";
	_builtins;
	__bool__() {
		return new F(this.value.size > 0);
	}
	get builtins() {
		return this._builtins ??= /* @__PURE__ */ new Map([
			["get", new L(([e, t]) => {
				if (!(e instanceof P)) throw Error(`Object key must be a string: got ${e.type}`);
				return this.value.get(e.value) ?? t ?? new R();
			})],
			["items", new L(() => this.items())],
			["keys", new L(() => this.keys())],
			["values", new L(() => this.values())],
			["dictsort", new L((e) => {
				let t = /* @__PURE__ */ new Map(), n = e.filter((e) => e instanceof os ? (t = e.value, !1) : !0), r = n.at(0) ?? t.get("case_sensitive") ?? new F(!1);
				if (!(r instanceof F)) throw Error("case_sensitive must be a boolean");
				let i = n.at(1) ?? t.get("by") ?? new P("key");
				if (!(i instanceof P)) throw Error("by must be a string");
				if (!["key", "value"].includes(i.value)) throw Error("by must be either 'key' or 'value'");
				let a = n.at(2) ?? t.get("reverse") ?? new F(!1);
				if (!(a instanceof F)) throw Error("reverse must be a boolean");
				return new I(Array.from(this.value.entries()).map(([e, t]) => new I([new P(e), t])).sort((e, t) => {
					let n = i.value === "key" ? 0 : 1, o = e.value[n], s = t.value[n], c = _s(o, s, r.value);
					return a.value ? -c : c;
				}));
			})]
		]);
	}
	items() {
		return new I(Array.from(this.value.entries()).map(([e, t]) => new I([new P(e), t])));
	}
	keys() {
		return new I(Array.from(this.value.keys()).map((e) => new P(e)));
	}
	values() {
		return new I(Array.from(this.value.values()));
	}
	toString() {
		return is(this, {}, 0, !1);
	}
}, os = class extends as {
	type = "KeywordArgumentsValue";
}, ss = class extends ts {
	type = "NamespaceValue";
	toString() {
		return is(this, {}, 0, !1);
	}
}, I = class extends ts {
	type = "ArrayValue";
	_builtins;
	get builtins() {
		return this._builtins ??= /* @__PURE__ */ new Map([["length", new M(this.value.length)]]);
	}
	__bool__() {
		return new F(this.value.length > 0);
	}
	toString() {
		return is(this, {}, 0, !1);
	}
}, cs = class extends I {
	type = "TupleValue";
}, L = class extends ts {
	type = "FunctionValue";
}, R = class extends ts {
	type = "NullValue";
}, z = class extends ts {
	type = "UndefinedValue";
};
function ls(e) {
	let t;
	if (e instanceof I ? t = e.value : e instanceof P && (t = Array.from(e.value, (e) => new P(e))), !t || t.length !== 2) throw Error("namespace expected an object or an iterable of [key, value] pairs");
	let [n, r] = t;
	if (!(n instanceof P)) throw Error("namespace keys must be strings");
	return [n, r];
}
var us = class {
	constructor(e) {
		this.parent = e;
	}
	variables = /* @__PURE__ */ new Map([["namespace", new L((e) => {
		let t = e.slice(), n;
		if (t.at(-1) instanceof os && (n = t.pop()), t.length > 1) throw Error(`namespace expected at most 1 argument, got ${t.length}`);
		let r = /* @__PURE__ */ new Map();
		if (t.length === 1) {
			let e = t[0];
			if (e instanceof as) for (let [t, n] of e.value) r.set(t, n);
			else if (e instanceof I) for (let t of e.value) {
				let [e, n] = ls(t);
				r.set(e.value, n);
			}
			else throw Error(`'${e.type}' object is not iterable`);
		}
		if (n) for (let [e, t] of n.value) r.set(e, t);
		return new ss(r);
	})]]);
	tests = us.TESTS;
	set(e, t) {
		return this.declareVariable(e, Ss(t));
	}
	declareVariable(e, t) {
		if (this.variables.has(e)) throw SyntaxError(`Variable already declared: ${e}`);
		return this.variables.set(e, t), t;
	}
	setVariable(e, t) {
		return this.variables.set(e, t), t;
	}
	resolve(e) {
		if (this.variables.has(e)) return this;
		if (this.parent) return this.parent.resolve(e);
		throw Error(`Unknown variable: ${e}`);
	}
	lookupVariable(e) {
		try {
			return this.resolve(e).variables.get(e) ?? new z();
		} catch {
			return new z();
		}
	}
}, ds = us;
no(ds, "TESTS", /* @__PURE__ */ new Map([
	["boolean", (e) => e.type === "BooleanValue"],
	["callable", (e) => e instanceof L],
	["odd", (e) => {
		if (!(e instanceof M)) throw Error(`cannot odd on ${e.type}`);
		return e.value % 2 != 0;
	}],
	["even", (e) => {
		if (!(e instanceof M)) throw Error(`cannot even on ${e.type}`);
		return e.value % 2 == 0;
	}],
	["false", (e) => e.type === "BooleanValue" && !e.value],
	["true", (e) => e.type === "BooleanValue" && e.value],
	["none", (e) => e.type === "NullValue"],
	["string", (e) => e.type === "StringValue"],
	["number", (e) => e instanceof M || e instanceof N],
	["integer", (e) => e instanceof M],
	["iterable", (e) => e.type === "ArrayValue" || e.type === "StringValue"],
	["mapping", (e) => e instanceof as],
	["sequence", (e) => e instanceof I || e instanceof as || e instanceof P],
	["lower", (e) => {
		let t = e.value;
		return e.type === "StringValue" && t === t.toLowerCase();
	}],
	["upper", (e) => {
		let t = e.value;
		return e.type === "StringValue" && t === t.toUpperCase();
	}],
	["none", (e) => e.type === "NullValue"],
	["defined", (e) => e.type !== "UndefinedValue"],
	["undefined", (e) => e.type === "UndefinedValue"],
	["equalto", (e, t) => e.value === t.value],
	["eq", (e, t) => e.value === t.value]
]));
function fs(e) {
	e.set("false", !1), e.set("true", !0), e.set("none", null), e.set("raise_exception", (e) => {
		throw Error(e);
	}), e.set("range", Go), e.set("strftime_now", Jo), e.set("True", !0), e.set("False", !1), e.set("None", null);
}
function ps(e) {
	return e instanceof as || e instanceof ss;
}
function ms(e) {
	return e instanceof M || e instanceof N || e instanceof F;
}
function hs(e) {
	return e instanceof F ? Number(e.value) : e.value;
}
function gs(e, t) {
	let n = t.split("."), r = e;
	for (let e of n) if (ps(r)) r = r.value.get(e) ?? new z();
	else if (r instanceof I) {
		let t = parseInt(e, 10);
		if (!isNaN(t) && t >= 0 && t < r.value.length) r = r.value[t];
		else return new z();
	} else return new z();
	return r;
}
function _s(e, t, n = !1) {
	if (e instanceof R && t instanceof R) return 0;
	if (e instanceof R || t instanceof R) throw Error(`Cannot compare ${e.type} with ${t.type}`);
	if (e instanceof z && t instanceof z) return 0;
	if (e instanceof z || t instanceof z) throw Error(`Cannot compare ${e.type} with ${t.type}`);
	if (ms(e) && ms(t)) {
		let n = hs(e), r = hs(t);
		return n < r ? -1 : +(n > r);
	}
	if (e.type !== t.type) throw Error(`Cannot compare different types: ${e.type} and ${t.type}`);
	switch (e.type) {
		case "StringValue": {
			let r = e.value, i = t.value;
			return n || (r = r.toLowerCase(), i = i.toLowerCase()), r < i ? -1 : +(r > i);
		}
		default: throw Error(`Cannot compare type: ${e.type}`);
	}
}
function vs(e) {
	if (e.type === "Identifier") return { name: e.value };
	let t = e;
	return {
		name: t.key.value,
		defaultValue: t.value
	};
}
function ys(e) {
	return e === "kwargs" || e === "varargs";
}
function bs(e, t) {
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = (e) => {
		ys(e) && n.add(e);
	}, a = (e) => {
		if (e.type === "Identifier") i(e.value);
		else if (e.type === "TupleLiteral") for (let t of e.value) a(t);
	}, o = (e) => {
		i(vs(e).name);
	}, s = (e) => {
		for (let t of e) {
			let e = vs(t);
			e.defaultValue && l(e.defaultValue);
		}
	}, c = (e) => {
		e.type === "CallExpression" && l(e.args);
	}, l = (e) => {
		if (Array.isArray(e)) {
			for (let t of e) l(t);
			return;
		}
		if (e instanceof Map) {
			for (let [t, n] of e) l(t), l(n);
			return;
		}
		if (e instanceof fo) switch (e.type) {
			case "For": {
				let t = e;
				if (a(t.loopvar), t.iterable.type === "SelectExpression") {
					let e = t.iterable;
					l(e.lhs), l(t.body), l(t.defaultBlock), l(e.test);
					return;
				}
				l(t.iterable), l(t.body), l(t.defaultBlock);
				return;
			}
			case "Set": {
				let t = e;
				a(t.assignee), l(t.value), l(t.body);
				return;
			}
			case "Macro": {
				let t = e;
				for (let e of t.args) o(e);
				s(t.args), l(t.body);
				return;
			}
			case "CallStatement": {
				let t = e;
				l(t.call);
				for (let e of t.callerArgs ?? []) o(e);
				s(t.callerArgs ?? []), l(t.body);
				return;
			}
			case "FilterStatement": {
				let t = e;
				l(t.body), c(t.filter);
				return;
			}
			case "Identifier": {
				let t = e.value;
				ys(t) && !n.has(t) && r.add(t);
				return;
			}
			case "MemberExpression": {
				let t = e;
				l(t.object), t.computed && l(t.property);
				return;
			}
			case "FilterExpression": {
				let t = e;
				l(t.operand), c(t.filter);
				return;
			}
			case "TestExpression":
				l(e.operand);
				return;
			case "SelectExpression": {
				let t = e;
				l(t.test), l(t.lhs);
				return;
			}
			case "KeywordArgumentExpression":
				l(e.value);
				return;
			default: for (let t of Object.values(e)) l(t);
		}
	};
	for (let t of e) o(t);
	return l(t), r;
}
var xs = class {
	global;
	constructor(e) {
		this.global = e ?? new ds();
	}
	run(e) {
		return this.evaluate(e, this.global);
	}
	evaluateBinaryExpression(e, t) {
		let n = this.evaluate(e.left, t);
		switch (e.operator.value) {
			case "and": return n.__bool__().value ? this.evaluate(e.right, t) : n;
			case "or": return n.__bool__().value ? n : this.evaluate(e.right, t);
		}
		let r = this.evaluate(e.right, t);
		switch (e.operator.value) {
			case "==": return new F(n.value == r.value);
			case "!=": return new F(n.value != r.value);
		}
		if (n instanceof z || r instanceof z) {
			if (r instanceof z && ["in", "not in"].includes(e.operator.value)) return new F(e.operator.value === "not in");
			throw Error(`Cannot perform operation ${e.operator.value} on undefined values`);
		}
		if (n instanceof R || r instanceof R) throw Error("Cannot perform operation on null values");
		if (e.operator.value === "~") return new P(n.value.toString() + r.value.toString());
		if (e.operator.value === "**" && ms(n) && ms(r)) {
			let e = hs(n), t = hs(r);
			if (e === 0 && t < 0) throw Error("0.0 cannot be raised to a negative power");
			let i = e ** t;
			if (!Number.isFinite(i)) throw Error("Exponentiation result is not a finite real number");
			return n instanceof N || r instanceof N || t < 0 ? new N(i) : new M(i);
		}
		if ((n instanceof M || n instanceof N) && (r instanceof M || r instanceof N)) {
			let t = n.value, i = r.value;
			switch (e.operator.value) {
				case "+":
				case "-":
				case "*": {
					let a = e.operator.value === "+" ? t + i : e.operator.value === "-" ? t - i : t * i;
					return n instanceof N || r instanceof N ? new N(a) : new M(a);
				}
				case "/": return new N(t / i);
				case "//": {
					let e = Math.floor(t / i);
					return n instanceof N || r instanceof N ? new N(e) : new M(e);
				}
				case "%": {
					let e = t % i;
					return n instanceof N || r instanceof N ? new N(e) : new M(e);
				}
				case "<": return new F(t < i);
				case ">": return new F(t > i);
				case ">=": return new F(t >= i);
				case "<=": return new F(t <= i);
			}
		} else if (n instanceof I && r instanceof I) switch (e.operator.value) {
			case "+": return new I(n.value.concat(r.value));
		}
		else if (r instanceof I) {
			let t = r.value.find((e) => e.value === n.value) !== void 0;
			switch (e.operator.value) {
				case "in": return new F(t);
				case "not in": return new F(!t);
			}
		}
		if (n instanceof P || r instanceof P) switch (e.operator.value) {
			case "+": return new P(n.value.toString() + r.value.toString());
		}
		if (n instanceof P && r instanceof P) switch (e.operator.value) {
			case "in": return new F(r.value.includes(n.value));
			case "not in": return new F(!r.value.includes(n.value));
		}
		if (n instanceof P && r instanceof as) switch (e.operator.value) {
			case "in": return new F(r.value.has(n.value));
			case "not in": return new F(!r.value.has(n.value));
		}
		throw SyntaxError(`Unknown operator "${e.operator.value}" between ${n.type} and ${r.type}`);
	}
	evaluateArguments(e, t) {
		let n = [], r = /* @__PURE__ */ new Map(), i = (e, t) => {
			if (r.has(e)) throw Error(`Got multiple values for keyword argument '${e}'`);
			r.set(e, t);
		};
		for (let r of e) if (r.type === "SpreadExpression") {
			let e = r, i = this.evaluate(e.argument, t);
			if (!(i instanceof I)) throw Error(`Cannot unpack non-iterable type: ${i.type}`);
			for (let e of i.value) n.push(e);
		} else r.type !== "KeywordArgumentExpression" && r.type !== "KeywordSpreadExpression" && n.push(this.evaluate(r, t));
		for (let n of e) if (n.type === "KeywordArgumentExpression") {
			let e = n;
			i(e.key.value, this.evaluate(e.value, t));
		} else if (n.type === "KeywordSpreadExpression") {
			let e = n, r = this.evaluate(e.argument, t);
			if (!(r instanceof as)) throw Error(`Argument after ** must be a mapping, not ${r.type}`);
			for (let [e, t] of r.value) i(e, t);
		}
		return [n, r];
	}
	applyFilter(e, t, n) {
		if (t.type === "Identifier") {
			let r = t;
			if (r.value === "safe") return e;
			if (r.value === "tojson") return new P(is(e, {}));
			if (e instanceof I) switch (r.value) {
				case "list": return e;
				case "first": return e.value[0];
				case "last": return e.value[e.value.length - 1];
				case "length": return new M(e.value.length);
				case "reverse": return new I(e.value.slice().reverse());
				case "sort": return new I(e.value.slice().sort((e, t) => _s(e, t, !1)));
				case "join": return new P(e.value.map((e) => e.value).join(""));
				case "string": return new P(is(e, {}, 0, !1));
				case "unique": {
					let t = /* @__PURE__ */ new Set(), n = [];
					for (let r of e.value) t.has(r.value) || (t.add(r.value), n.push(r));
					return new I(n);
				}
				default: throw Error(`Unknown ArrayValue filter: ${r.value}`);
			}
			else if (e instanceof P) switch (r.value) {
				case "length":
				case "upper":
				case "lower":
				case "title":
				case "capitalize": {
					let t = e.builtins.get(r.value);
					if (t instanceof L) return t.value([], n);
					if (t instanceof M) return t;
					throw Error(`Unknown StringValue filter: ${r.value}`);
				}
				case "trim": return new P(e.value.trim());
				case "indent": return new P(e.value.split("\n").map((e, t) => t === 0 || e.length === 0 ? e : "    " + e).join("\n"));
				case "join":
				case "string": return e;
				case "int": {
					let t = parseInt(e.value, 10);
					return new M(isNaN(t) ? 0 : t);
				}
				case "float": {
					let t = parseFloat(e.value);
					return new N(isNaN(t) ? 0 : t);
				}
				default: throw Error(`Unknown StringValue filter: ${r.value}`);
			}
			else if (e instanceof M || e instanceof N) switch (r.value) {
				case "abs": return e instanceof M ? new M(Math.abs(e.value)) : new N(Math.abs(e.value));
				case "int": return new M(Math.floor(e.value));
				case "float": return new N(e.value);
				case "string": return new P(e.toString());
				default: throw Error(`Unknown NumericValue filter: ${r.value}`);
			}
			else if (e instanceof as) switch (r.value) {
				case "items": return new I(Array.from(e.value.entries()).map(([e, t]) => new I([new P(e), t])));
				case "length": return new M(e.value.size);
				default: {
					let t = e.builtins.get(r.value);
					if (t) return t instanceof L ? t.value([], n) : t;
					throw Error(`Unknown ObjectValue filter: ${r.value}`);
				}
			}
			else if (e instanceof F) switch (r.value) {
				case "bool": return new F(e.value);
				case "int": return new M(+!!e.value);
				case "float": return new N(+!!e.value);
				case "string": return new P(e.value ? "true" : "false");
				default: throw Error(`Unknown BooleanValue filter: ${r.value}`);
			}
			throw Error(`Cannot apply filter "${r.value}" to type: ${e.type}`);
		}
		if (t.type === "CallExpression") {
			let r = t;
			if (r.callee.type !== "Identifier") throw Error(`Unknown filter: ${r.callee.type}`);
			let i = r.callee.value;
			if (i === "tojson") {
				let [, t] = this.evaluateArguments(r.args, n), i = t.get("indent") ?? new R();
				if (!(i instanceof M || i instanceof R)) throw Error("If set, indent must be a number");
				let a = t.get("ensure_ascii") ?? new F(!1);
				if (!(a instanceof F)) throw Error("If set, ensure_ascii must be a boolean");
				let o = t.get("sort_keys") ?? new F(!1);
				if (!(o instanceof F)) throw Error("If set, sort_keys must be a boolean");
				let s = t.get("separators") ?? new R(), c = null;
				if (s instanceof I || s instanceof cs) {
					if (s.value.length !== 2) throw Error("separators must be a tuple of two strings");
					let [e, t] = s.value;
					if (!(e instanceof P) || !(t instanceof P)) throw Error("separators must be a tuple of two strings");
					c = [e.value, t.value];
				} else if (!(s instanceof R)) throw Error("If set, separators must be a tuple of two strings");
				return new P(is(e, {
					indent: i.value,
					ensureAscii: a.value,
					sortKeys: o.value,
					separators: c
				}));
			}
			if (i === "join") {
				let t;
				if (e instanceof P) t = Array.from(e.value);
				else if (e instanceof I) t = e.value.map((e) => e.value);
				else throw Error(`Cannot apply filter "${i}" to type: ${e.type}`);
				let [a, o] = this.evaluateArguments(r.args, n), s = a.at(0) ?? o.get("separator") ?? new P("");
				if (!(s instanceof P)) throw Error("separator must be a string");
				return new P(t.join(s.value));
			}
			if (i === "int" || i === "float") {
				let [t, a] = this.evaluateArguments(r.args, n), o = t.at(0) ?? a.get("default") ?? (i === "int" ? new M(0) : new N(0));
				if (e instanceof P) {
					let t = i === "int" ? parseInt(e.value, 10) : parseFloat(e.value);
					return isNaN(t) ? o : i === "int" ? new M(t) : new N(t);
				}
				if (e instanceof M || e instanceof N) return e;
				if (e instanceof F) return i === "int" ? new M(+!!e.value) : new N(+!!e.value);
				throw Error(`Cannot apply filter "${i}" to type: ${e.type}`);
			}
			if (i === "default") {
				let [t, i] = this.evaluateArguments(r.args, n), a = t[0] ?? new P(""), o = t[1] ?? i.get("boolean") ?? new F(!1);
				if (!(o instanceof F)) throw Error("`default` filter flag must be a boolean");
				return e instanceof z || o.value && !e.__bool__().value ? a : e;
			}
			if (e instanceof I) {
				switch (i) {
					case "sort": {
						let [t, i] = this.evaluateArguments(r.args, n), a = t.at(0) ?? i.get("reverse") ?? new F(!1);
						if (!(a instanceof F)) throw Error("reverse must be a boolean");
						let o = t.at(1) ?? i.get("case_sensitive") ?? new F(!1);
						if (!(o instanceof F)) throw Error("case_sensitive must be a boolean");
						let s = t.at(2) ?? i.get("attribute") ?? new R();
						if (!(s instanceof P || s instanceof M || s instanceof R)) throw Error("attribute must be a string, integer, or null");
						let c = (e) => s instanceof R ? e : gs(e, s instanceof M ? String(s.value) : s.value);
						return new I(e.value.slice().sort((e, t) => {
							let n = _s(c(e), c(t), o.value);
							return a.value ? -n : n;
						}));
					}
					case "selectattr":
					case "rejectattr": {
						let t = i === "selectattr";
						if (e.value.some((e) => !ps(e))) throw Error(`\`${i}\` can only be applied to array of objects`);
						if (r.args.some((e) => e.type !== "StringLiteral")) throw Error(`arguments of \`${i}\` must be strings`);
						let [a, o, s] = r.args.map((e) => this.evaluate(e, n)), c;
						if (o) {
							let e = n.tests.get(o.value);
							if (!e) throw Error(`Unknown test: ${o.value}`);
							c = e;
						} else c = (...e) => e[0].__bool__().value;
						return new I(e.value.filter((e) => {
							let n = e.value.get(a.value), r = n ? c(n, s) : !1;
							return t ? r : !r;
						}));
					}
					case "map": {
						let [, t] = this.evaluateArguments(r.args, n);
						if (t.has("attribute")) {
							let n = t.get("attribute");
							if (!(n instanceof P)) throw Error("attribute must be a string");
							let r = t.get("default");
							return new I(e.value.map((e) => {
								if (!ps(e)) throw Error("items in map must be an object");
								let t = gs(e, n.value);
								return t instanceof z ? r ?? new z() : t;
							}));
						}
						throw Error("`map` expressions without `attribute` set are not currently supported.");
					}
				}
				throw Error(`Unknown ArrayValue filter: ${i}`);
			}
			if (e instanceof P) {
				switch (i) {
					case "indent": {
						let [t, i] = this.evaluateArguments(r.args, n), a = t.at(0) ?? i.get("width") ?? new M(4);
						if (!(a instanceof M)) throw Error("width must be a number");
						let o = t.at(1) ?? i.get("first") ?? new F(!1), s = t.at(2) ?? i.get("blank") ?? new F(!1), c = e.value.split("\n"), l = " ".repeat(a.value);
						return new P(c.map((e, t) => !o.value && t === 0 || !s.value && e.length === 0 ? e : l + e).join("\n"));
					}
					case "replace": {
						let t = e.builtins.get("replace");
						if (!(t instanceof L)) throw Error("replace filter not available");
						let [i, a] = this.evaluateArguments(r.args, n);
						return t.value([...i, new os(a)], n);
					}
				}
				throw Error(`Unknown StringValue filter: ${i}`);
			}
			if (e instanceof as) {
				let t = e.builtins.get(i);
				if (t && t instanceof L) {
					let [e, i] = this.evaluateArguments(r.args, n);
					return i.size > 0 && e.push(new os(i)), t.value(e, n);
				}
				throw Error(`Unknown ObjectValue filter: ${i}`);
			}
			throw Error(`Cannot apply filter "${i}" to type: ${e.type}`);
		}
		throw Error(`Unknown filter: ${t.type}`);
	}
	evaluateFilterExpression(e, t) {
		let n = this.evaluate(e.operand, t);
		return this.applyFilter(n, e.filter, t);
	}
	evaluateTestExpression(e, t) {
		let n = this.evaluate(e.operand, t), r = t.tests.get(e.test.value);
		if (!r) throw Error(`Unknown test: ${e.test.value}`);
		let i = r(n);
		return new F(e.negate ? !i : i);
	}
	evaluateSelectExpression(e, t) {
		return this.evaluate(e.test, t).__bool__().value ? this.evaluate(e.lhs, t) : new z();
	}
	evaluateUnaryExpression(e, t) {
		let n = this.evaluate(e.argument, t);
		switch (e.operator.value) {
			case "not": return new F(!n.value);
			case "+":
			case "-": {
				let t = e.operator.value === "-" ? -1 : 1;
				if (n instanceof M || n instanceof N || n instanceof F) {
					let e = t * (n instanceof F ? +!!n.value : n.value);
					return n instanceof N ? new N(e) : new M(e);
				}
				throw SyntaxError(`Unknown operator "${e.operator.value}" for ${n.type}`);
			}
			default: throw SyntaxError(`Unknown operator: ${e.operator.value}`);
		}
	}
	evaluateTernaryExpression(e, t) {
		return this.evaluate(e.condition, t).__bool__().value ? this.evaluate(e.trueExpr, t) : this.evaluate(e.falseExpr, t);
	}
	evalProgram(e, t) {
		return this.evaluateBlock(e.body, t);
	}
	evaluateBlock(e, t) {
		let n = "";
		for (let r of e) {
			let e = this.evaluate(r, t);
			e.type !== "NullValue" && e.type !== "UndefinedValue" && (n += e.toString());
		}
		return new P(n);
	}
	evaluateIdentifier(e, t) {
		return t.lookupVariable(e.value);
	}
	evaluateCallExpression(e, t) {
		let [n, r] = this.evaluateArguments(e.args, t);
		r.size > 0 && n.push(new os(r));
		let i = this.evaluate(e.callee, t);
		if (i.type !== "FunctionValue") throw Error(`Cannot call something that is not a function: got ${i.type}`);
		return i.value(n, t);
	}
	evaluateSliceExpression(e, t, n) {
		if (!(e instanceof I || e instanceof P)) throw Error("Slice object must be an array or string");
		let r = this.evaluate(t.start, n), i = this.evaluate(t.stop, n), a = this.evaluate(t.step, n);
		if (!(r instanceof M || r instanceof z)) throw Error("Slice start must be numeric or undefined");
		if (!(i instanceof M || i instanceof z)) throw Error("Slice stop must be numeric or undefined");
		if (!(a instanceof M || a instanceof z)) throw Error("Slice step must be numeric or undefined");
		return e instanceof I ? new I(Ko(e.value, r.value, i.value, a.value)) : new P(Ko(Array.from(e.value), r.value, i.value, a.value).join(""));
	}
	evaluateMemberExpression(e, t) {
		let n = this.evaluate(e.object, t), r;
		if (e.computed) {
			if (e.property.type === "SliceExpression") return this.evaluateSliceExpression(n, e.property, t);
			r = this.evaluate(e.property, t);
		} else r = e.property.type === "IntegerLiteral" ? new M(e.property.value) : new P(e.property.value);
		let i;
		if (ps(n)) {
			if (!(r instanceof P)) throw Error(`Cannot access property with non-string: got ${r.type}`);
			i = n.value.get(r.value) ?? (n instanceof as ? n.builtins.get(r.value) : void 0);
		} else if (n instanceof I || n instanceof P) {
			if (r instanceof M) i = n.value.at(r.value), n instanceof P && (i = new P(n.value.at(r.value)));
			else if (r instanceof P) i = n.builtins.get(r.value);
			else throw Error(`Cannot access property with non-string/non-number: got ${r.type}`);
		} else {
			if (!(r instanceof P)) throw Error(`Cannot access property with non-string: got ${r.type}`);
			i = n.builtins.get(r.value);
		}
		return i instanceof ts ? i : new z();
	}
	evaluateSet(e, t) {
		let n = e.value ? this.evaluate(e.value, t) : this.evaluateBlock(e.body, t);
		if (e.assignee.type === "Identifier") {
			let r = e.assignee.value;
			t.setVariable(r, n);
		} else if (e.assignee.type === "TupleLiteral") {
			let r = e.assignee;
			if (!(n instanceof I)) throw Error(`Cannot unpack non-iterable type in set: ${n.type}`);
			let i = n.value;
			if (i.length !== r.value.length) throw Error(`Too ${r.value.length > i.length ? "few" : "many"} items to unpack in set`);
			for (let e = 0; e < r.value.length; ++e) {
				let n = r.value[e];
				if (n.type !== "Identifier") throw Error(`Cannot unpack to non-identifier in set: ${n.type}`);
				t.setVariable(n.value, i[e]);
			}
		} else if (e.assignee.type === "MemberExpression") {
			let r = e.assignee, i = this.evaluate(r.object, t);
			if (!(i instanceof ss)) throw Error("cannot assign attribute on non-namespace object");
			if (r.property.type !== "Identifier") throw Error("Cannot assign to member with non-identifier property");
			i.value.set(r.property.value, n);
		} else throw Error(`Invalid LHS inside assignment expression: ${JSON.stringify(e.assignee)}`);
		return new R();
	}
	evaluateIf(e, t) {
		let n = this.evaluate(e.test, t);
		return this.evaluateBlock(n.__bool__().value ? e.body : e.alternate, t);
	}
	evaluateFor(e, t) {
		let n = new ds(t), r, i;
		if (e.iterable.type === "SelectExpression") {
			let t = e.iterable;
			i = this.evaluate(t.lhs, n), r = t.test;
		} else i = this.evaluate(e.iterable, n);
		if (!(i instanceof I || i instanceof as)) throw Error(`Expected iterable or object type in for loop: got ${i.type}`);
		i instanceof as && (i = i.keys());
		let a = [], o = [];
		for (let t = 0; t < i.value.length; ++t) {
			let s = new ds(n), c = i.value[t], l;
			if (e.loopvar.type === "Identifier") l = (t) => t.setVariable(e.loopvar.value, c);
			else if (e.loopvar.type === "TupleLiteral") {
				let t = e.loopvar;
				if (c.type !== "ArrayValue") throw Error(`Cannot unpack non-iterable type: ${c.type}`);
				let n = c;
				if (t.value.length !== n.value.length) throw Error(`Too ${t.value.length > n.value.length ? "few" : "many"} items to unpack`);
				l = (e) => {
					for (let r = 0; r < t.value.length; ++r) {
						if (t.value[r].type !== "Identifier") throw Error(`Cannot unpack non-identifier type: ${t.value[r].type}`);
						e.setVariable(t.value[r].value, n.value[r]);
					}
				};
			} else throw Error(`Invalid loop variable(s): ${e.loopvar.type}`);
			r && (l(s), !this.evaluate(r, s).__bool__().value) || (a.push(c), o.push(l));
		}
		let s = "", c = !0;
		for (let t = 0; t < a.length; ++t) {
			let r = /* @__PURE__ */ new Map([
				["index", new M(t + 1)],
				["index0", new M(t)],
				["revindex", new M(a.length - t)],
				["revindex0", new M(a.length - t - 1)],
				["first", new F(t === 0)],
				["last", new F(t === a.length - 1)],
				["length", new M(a.length)],
				["previtem", t > 0 ? a[t - 1] : new z()],
				["nextitem", t < a.length - 1 ? a[t + 1] : new z()]
			]);
			n.setVariable("loop", new as(r)), o[t](n);
			try {
				let t = this.evaluateBlock(e.body, n);
				s += t.value;
			} catch (e) {
				if (e instanceof $o) continue;
				if (e instanceof Qo) break;
				throw e;
			}
			c = !1;
		}
		if (c) {
			let t = this.evaluateBlock(e.defaultBlock, n);
			s += t.value;
		}
		return new P(s);
	}
	bindMacroArguments(e, t, n, r, i) {
		let a = r.slice(), o = /* @__PURE__ */ new Map();
		a.at(-1) instanceof os && (o = new Map(a.pop().value));
		let s = [];
		for (let e = 0; e < t.length; ++e) {
			let { name: n, defaultValue: r } = vs(t[e]), c = a[e];
			c === void 0 && o.has(n) && (c = o.get(n), o.delete(n)), c === void 0 && r !== void 0 && s.push([n, r]), i.setVariable(n, c ?? new z());
		}
		if (n.has("kwargs")) i.setVariable("kwargs", new as(o));
		else if (o.size > 0) throw Error(`macro ${e} takes no keyword argument '${o.keys().next().value}'`);
		if (n.has("varargs")) i.setVariable("varargs", new I(a.slice(t.length)));
		else if (a.length > t.length) throw Error(`macro ${e} takes not more than ${t.length} argument(s)`);
		for (let [e, t] of s) i.setVariable(e, this.evaluate(t, i));
	}
	evaluateMacro(e, t) {
		let n = bs(e.args, e.body);
		return t.setVariable(e.name.value, new L((t, r) => {
			let i = new ds(r);
			return this.bindMacroArguments(`'${e.name.value}'`, e.args, n, t, i), this.evaluateBlock(e.body, i);
		})), new R();
	}
	evaluateCallStatement(e, t) {
		let n = e.callerArgs ?? [], r = bs(n, e.body), i = new L((i) => {
			let a = new ds(t);
			return this.bindMacroArguments("None", n, r, i, a), this.evaluateBlock(e.body, a);
		}), [a, o] = this.evaluateArguments(e.call.args, t);
		a.push(new os(o));
		let s = this.evaluate(e.call.callee, t);
		if (s.type !== "FunctionValue") throw Error(`Cannot call something that is not a function: got ${s.type}`);
		let c = new ds(t);
		return c.setVariable("caller", i), s.value(a, c);
	}
	evaluateFilterStatement(e, t) {
		let n = this.evaluateBlock(e.body, t);
		return this.applyFilter(n, e.filter, t);
	}
	evaluate(e, t) {
		if (!e) return new z();
		switch (e.type) {
			case "Program": return this.evalProgram(e, t);
			case "Set": return this.evaluateSet(e, t);
			case "If": return this.evaluateIf(e, t);
			case "For": return this.evaluateFor(e, t);
			case "Macro": return this.evaluateMacro(e, t);
			case "CallStatement": return this.evaluateCallStatement(e, t);
			case "Break": throw new Qo();
			case "Continue": throw new $o();
			case "IntegerLiteral": return new M(e.value);
			case "FloatLiteral": return new N(e.value);
			case "StringLiteral": return new P(e.value);
			case "ArrayLiteral": return new I(e.value.map((e) => this.evaluate(e, t)));
			case "TupleLiteral": return new cs(e.value.map((e) => this.evaluate(e, t)));
			case "ObjectLiteral": {
				let n = /* @__PURE__ */ new Map();
				for (let [r, i] of e.value) {
					let e = this.evaluate(r, t);
					if (!(e instanceof P)) throw Error(`Object keys must be strings: got ${e.type}`);
					n.set(e.value, this.evaluate(i, t));
				}
				return new as(n);
			}
			case "Identifier": return this.evaluateIdentifier(e, t);
			case "CallExpression": return this.evaluateCallExpression(e, t);
			case "MemberExpression": return this.evaluateMemberExpression(e, t);
			case "UnaryExpression": return this.evaluateUnaryExpression(e, t);
			case "BinaryExpression": return this.evaluateBinaryExpression(e, t);
			case "FilterExpression": return this.evaluateFilterExpression(e, t);
			case "FilterStatement": return this.evaluateFilterStatement(e, t);
			case "TestExpression": return this.evaluateTestExpression(e, t);
			case "SelectExpression": return this.evaluateSelectExpression(e, t);
			case "Ternary": return this.evaluateTernaryExpression(e, t);
			case "Comment": return new R();
			default: throw SyntaxError(`Unknown node type: ${e.type}`);
		}
	}
};
function Ss(e) {
	switch (typeof e) {
		case "number": return Number.isInteger(e) ? new M(e) : new N(e);
		case "string": return new P(e);
		case "boolean": return new F(e);
		case "undefined": return new z();
		case "object": return e === null ? new R() : Array.isArray(e) ? new I(e.map(Ss)) : new as(new Map(Object.entries(e).map(([e, t]) => [e, Ss(t)])));
		case "function": return new L((t, n) => Ss(e(...t.map((e) => e.value)) ?? null));
		default: throw Error(`Cannot convert to runtime value: ${e}`);
	}
}
var Cs = "\n", ws = "{%- ", Ts = " -%}", Es = Object.freeze({
	CONDITIONAL: 0,
	LOGICAL_OR: 1,
	LOGICAL_AND: 2,
	LOGICAL_NOT: 3,
	COMPARISON: 4,
	ADDITIVE: 5,
	MULTIPLICATIVE: 6,
	EXPONENTIATION: 7,
	TEST: 8,
	FILTER: 9,
	UNARY_SIGN: 10,
	ATOM: 11
});
function Ds(e) {
	switch (e.operator.type) {
		case "ExponentiationBinaryOperator": return Es.EXPONENTIATION;
		case "MultiplicativeBinaryOperator": return Es.MULTIPLICATIVE;
		case "AdditiveBinaryOperator": return Es.ADDITIVE;
		case "ComparisonBinaryOperator": return Es.COMPARISON;
		case "Identifier": return e.operator.value === "and" ? Es.LOGICAL_AND : e.operator.value === "in" || e.operator.value === "not in" ? Es.COMPARISON : Es.LOGICAL_OR;
	}
	return Es.LOGICAL_OR;
}
function Os(e) {
	switch (e.type) {
		case "SelectExpression":
		case "Ternary": return Es.CONDITIONAL;
		case "BinaryExpression": return Ds(e);
		case "UnaryExpression": return e.operator.value === "not" ? Es.LOGICAL_NOT : Es.UNARY_SIGN;
		case "TestExpression": return Es.TEST;
		case "FilterExpression": return Es.FILTER;
		default: return Es.ATOM;
	}
}
function ks(e, t) {
	let n = B(e);
	return Os(e) < t ? `(${n})` : n;
}
function As(e, t = "	") {
	let n = typeof t == "number" ? " ".repeat(t) : t;
	return Ms(e.body, 0, n).replace(/\n$/, "");
}
function js(...e) {
	return ws + e.join(" ") + Ts;
}
function Ms(e, t, n) {
	return e.map((e) => Ps(e, t, n)).join(Cs);
}
function Ns(e) {
	return e.map((e) => B(e)).join(", ");
}
function Ps(e, t, n) {
	let r = n.repeat(t);
	switch (e.type) {
		case "Program": return Ms(e.body, t, n);
		case "If": return Fs(e, t, n);
		case "For": return Is(e, t, n);
		case "Set": return Ls(e, t, n);
		case "Macro": return Rs(e, t, n);
		case "Break": return r + js("break");
		case "Continue": return r + js("continue");
		case "CallStatement": return zs(e, t, n);
		case "FilterStatement": return Bs(e, t, n);
		case "Comment": return r + "{# " + e.value + " #}";
		default: return r + "{{- " + B(e) + " -}}";
	}
}
function Fs(e, t, n) {
	let r = n.repeat(t), i = [], a = e;
	for (; a && (i.push({
		test: a.test,
		body: a.body
	}), a.alternate.length === 1 && a.alternate[0].type === "If");) a = a.alternate[0];
	let o = r + js("if", B(i[0].test)) + Cs + Ms(i[0].body, t + 1, n);
	for (let e = 1; e < i.length; ++e) o += Cs + r + js("elif", B(i[e].test)) + Cs + Ms(i[e].body, t + 1, n);
	return a && a.alternate.length > 0 && (o += Cs + r + js("else") + Cs + Ms(a.alternate, t + 1, n)), o += Cs + r + js("endif"), o;
}
function Is(e, t, n) {
	let r = n.repeat(t), i = "";
	if (e.iterable.type === "SelectExpression") {
		let t = e.iterable;
		i = `${B(t.lhs)} if ${B(t.test)}`;
	} else i = B(e.iterable);
	let a = r + js("for", B(e.loopvar), "in", i) + Cs + Ms(e.body, t + 1, n);
	return e.defaultBlock.length > 0 && (a += Cs + r + js("else") + Cs + Ms(e.defaultBlock, t + 1, n)), a += Cs + r + js("endfor"), a;
}
function Ls(e, t, n) {
	let r = n.repeat(t), i = B(e.assignee), a = e.value ? B(e.value) : "", o = r + js("set", `${i}${e.value ? " = " + a : ""}`);
	return e.body.length === 0 ? o : o + Cs + Ms(e.body, t + 1, n) + Cs + r + js("endset");
}
function Rs(e, t, n) {
	let r = n.repeat(t), i = Ns(e.args);
	return r + js("macro", `${e.name.value}(${i})`) + Cs + Ms(e.body, t + 1, n) + Cs + r + js("endmacro");
}
function zs(e, t, n) {
	let r = n.repeat(t), i = e.callerArgs && e.callerArgs.length > 0 ? `(${Ns(e.callerArgs)})` : "", a = B(e.call), o = r + js(`call${i}`, a) + Cs;
	return o += Ms(e.body, t + 1, n) + Cs, o += r + js("endcall"), o;
}
function Bs(e, t, n) {
	let r = n.repeat(t), i = r + js("filter", e.filter.type === "Identifier" ? e.filter.value : B(e.filter)) + Cs;
	return i += Ms(e.body, t + 1, n) + Cs, i += r + js("endfilter"), i;
}
function B(e) {
	switch (e.type) {
		case "SpreadExpression": return `*${B(e.argument)}`;
		case "KeywordSpreadExpression": return `**${B(e.argument)}`;
		case "Identifier": return e.value;
		case "IntegerLiteral": return `${e.value}`;
		case "FloatLiteral": {
			let t = e.value;
			return Object.is(t, -0) ? "-0.0" : t % 1 == 0 ? t.toFixed(1) : t.toString();
		}
		case "StringLiteral": return JSON.stringify(e.value);
		case "BinaryExpression": {
			let t = e, n = Ds(t), r = ks(t.left, n), i = ks(t.right, n + 1);
			return `${r} ${t.operator.value} ${i}`;
		}
		case "UnaryExpression": {
			let t = e, n = t.argument.type === "UnaryExpression" ? Os(t) : Es.ATOM;
			return t.operator.value + (t.operator.value === "not" ? " " : "") + ks(t.argument, n);
		}
		case "CallExpression": {
			let t = e, n = Ns(t.args);
			return `${B(t.callee)}(${n})`;
		}
		case "MemberExpression": {
			let t = e, n = ks(t.object, Es.ATOM), r = B(t.property);
			return !t.computed && t.property.type !== "Identifier" && t.property.type !== "IntegerLiteral" && (r = `(${r})`), t.computed ? `${n}[${r}]` : `${n}.${r}`;
		}
		case "FilterExpression": {
			let t = e, n = ks(t.operand, Es.FILTER);
			return t.filter.type === "CallExpression" ? `${n} | ${B(t.filter)}` : `${n} | ${t.filter.value}`;
		}
		case "SelectExpression": {
			let t = e;
			return `${ks(t.lhs, Es.LOGICAL_OR)} if ${ks(t.test, Es.LOGICAL_OR)}`;
		}
		case "TestExpression": {
			let t = e;
			return `${ks(t.operand, Es.TEST)} is${t.negate ? " not" : ""} ${t.test.value}`;
		}
		case "ArrayLiteral":
		case "TupleLiteral": {
			let t = Ns(e.value), n = e.type === "ArrayLiteral" ? "[]" : "()";
			return `${n[0]}${t}${n[1]}`;
		}
		case "ObjectLiteral": return `{${Array.from(e.value.entries()).map(([e, t]) => `${B(e)}: ${B(t)}`).join(", ")}}`;
		case "SliceExpression": {
			let t = e;
			return `${t.start ? B(t.start) : ""}:${t.stop ? B(t.stop) : ""}${t.step ? `:${B(t.step)}` : ""}`;
		}
		case "KeywordArgumentExpression": {
			let t = e;
			return `${t.key.value}=${B(t.value)}`;
		}
		case "Ternary": {
			let t = e;
			return `${ks(t.trueExpr, Es.LOGICAL_OR)} if ${ks(t.condition, Es.LOGICAL_OR)} else ${ks(t.falseExpr, Es.CONDITIONAL)}`;
		}
		default: throw Error(`Unknown expression type: ${e.type}`);
	}
}
var Vs = class {
	parsed;
	constructor(e) {
		let t = uo(e, {
			lstrip_blocks: !0,
			trim_blocks: !0
		});
		this.parsed = Wo(t);
	}
	render(e) {
		let t = new ds();
		if (fs(t), e) for (let [n, r] of Object.entries(e)) t.set(n, r);
		return new xs(t).run(this.parsed).value;
	}
	format(e) {
		return As(this.parsed, e?.indent || "	");
	}
}, Hs = {
	txt: "text/plain",
	html: "text/html",
	css: "text/css",
	js: "text/javascript",
	json: "application/json",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif"
}, Us = class e {
	constructor(e) {
		if (this.filePath = e, this.headers = new Headers(), this.exists = Xn.existsSync(e), this.exists) {
			this.status = 200, this.statusText = "OK";
			let t = Xn.statSync(e);
			this.headers.set("content-length", t.size.toString()), this.updateContentType();
			let n = Xn.createReadStream(e);
			this.body = new ReadableStream({
				start(e) {
					n.on("data", (t) => e.enqueue(t)), n.on("end", () => e.close()), n.on("error", (t) => e.error(t));
				},
				cancel() {
					n.destroy();
				}
			});
		} else this.status = 404, this.statusText = "Not Found", this.body = null;
	}
	updateContentType() {
		let e = this.filePath.toString().split(".").pop().toLowerCase();
		this.headers.set("content-type", Hs[e] ?? "application/octet-stream");
	}
	clone() {
		let t = new e(this.filePath);
		return t.exists = this.exists, t.status = this.status, t.statusText = this.statusText, t.headers = new Headers(this.headers), t;
	}
	async arrayBuffer() {
		return (await Xn.promises.readFile(this.filePath)).buffer;
	}
	async blob() {
		let e = await Xn.promises.readFile(this.filePath);
		return new Blob([e], { type: this.headers.get("content-type") });
	}
	async text() {
		return await Xn.promises.readFile(this.filePath, "utf8");
	}
	async json() {
		return JSON.parse(await this.text());
	}
}, Ws = class {
	constructor(e) {
		this._mt = /* @__PURE__ */ new Uint32Array(624), this._idx = 625, this._gauss_next = null, this._random_fn = this.random.bind(this), this.seed(e);
	}
	seed(e) {
		if (e == null) {
			if (O.IS_CRYPTO_AVAILABLE) {
				let t = /* @__PURE__ */ new Uint32Array(1);
				crypto.getRandomValues(t), e = t[0];
			} else e = Date.now() >>> 0;
		}
		let t = this._mt, n = (e, t) => Math.imul(e, t) >>> 0, r = [];
		for (let t = e || 0; t > 0; t = Math.floor(t / 4294967296)) r.push(t & 4294967295);
		r.length || r.push(0), t[0] = 19650218;
		for (let e = 1; e < 624; ++e) t[e] = n(1812433253, t[e - 1] ^ t[e - 1] >>> 30) + e >>> 0;
		let i = 1, a = 0;
		for (let e = Math.max(624, r.length); e > 0; --e, ++i, ++a) i >= 624 && (t[0] = t[623], i = 1), a >= r.length && (a = 0), t[i] = (t[i] ^ n(t[i - 1] ^ t[i - 1] >>> 30, 1664525)) + r[a] + a >>> 0;
		for (let e = 623; e > 0; --e, ++i) i >= 624 && (t[0] = t[623], i = 1), t[i] = (t[i] ^ n(t[i - 1] ^ t[i - 1] >>> 30, 1566083941)) - i >>> 0;
		t[0] = 2147483648, this._idx = 624, this._gauss_next = null;
	}
	_int32() {
		let e = this._mt;
		if (this._idx >= 624) {
			for (let t = 0; t < 624; ++t) {
				let n = e[t] & 2147483648 | e[(t + 1) % 624] & 2147483647;
				e[t] = (e[(t + 397) % 624] ^ n >>> 1 ^ (n & 1 ? 2567483615 : 0)) >>> 0;
			}
			this._idx = 0;
		}
		let t = e[this._idx++];
		return t ^= t >>> 11, t ^= t << 7 & 2636928640, t ^= t << 15 & 4022730752, t ^= t >>> 18, t >>> 0;
	}
	random() {
		return ((this._int32() >>> 5) * 67108864 + (this._int32() >>> 6)) / 9007199254740992;
	}
	gauss(e = 0, t = 1) {
		let n = this._gauss_next;
		if (this._gauss_next = null, n === null) {
			let e = this.random() * 2 * Math.PI, t = Math.sqrt(-2 * Math.log(1 - this.random()));
			n = Math.cos(e) * t, this._gauss_next = Math.sin(e) * t;
		}
		return e + n * t;
	}
	shuffle(e) {
		for (let t = e.length - 1; t > 0; --t) {
			let n = 32 - Math.clz32(t + 1), r = this._int32() >>> 32 - n;
			for (; r > t;) r = this._int32() >>> 32 - n;
			let i = e[t];
			e[t] = e[r], e[r] = i;
		}
	}
	choices(e, t) {
		return e[Gs(this._random_fn, t)];
	}
};
function Gs(e, t) {
	let n = 0;
	for (let e = 0; e < t.length; ++e) n += t[e];
	let r = e() * n;
	for (let e = 0; e < t.length; ++e) if (r -= t[e], r < 0) return e;
	return t.length - 1;
}
var Ks = new Ws(), qs = Object.freeze({
	Random: Ws,
	seed: Ks.seed.bind(Ks),
	random: Ks.random.bind(Ks),
	gauss: Ks.gauss.bind(Ks),
	shuffle: Ks.shuffle.bind(Ks),
	choices: Ks.choices.bind(Ks)
}), Js = (e) => Gs(qs.random, e), Ys = new Ws(), Xs = class {
	constructor(e) {
		this.path = e;
	}
	async match(e) {
		let t = new Us(Zn.join(this.path, e));
		if (t.exists) return t;
	}
	async put(e, t, n = void 0) {
		let r = Zn.join(this.path, e), i = r + `.tmp.${O.IS_PROCESS_AVAILABLE ? process.pid : Date.now()}.${Ys._int32().toString(36)}`;
		try {
			let e = t.headers.get("Content-Length"), a = parseInt(e ?? "0"), o = 0;
			await Xn.promises.mkdir(Zn.dirname(r), { recursive: !0 });
			let s = Xn.createWriteStream(i), c = t.body.getReader();
			for (;;) {
				let { done: e, value: t } = await c.read();
				if (e) break;
				await new Promise((e, n) => {
					s.write(t, (t) => {
						if (t) {
							n(t);
							return;
						}
						e();
					});
				}), o += t.length;
				let r = a ? o / a * 100 : 0;
				n?.({
					progress: r,
					loaded: o,
					total: a
				});
			}
			await new Promise((e, t) => {
				s.close((n) => n ? t(n) : e());
			}), await Xn.promises.rename(i, r);
		} catch (e) {
			try {
				await Xn.promises.unlink(i);
			} catch {}
			throw e;
		}
	}
	async delete(e) {
		let t = Zn.join(this.path, e);
		try {
			return await Xn.promises.unlink(t), !0;
		} catch {
			return !1;
		}
	}
}, Zs = {
	400: "Bad request error occurred while trying to load file",
	401: "Unauthorized access to file",
	403: "Forbidden access to file",
	404: "Could not locate file",
	408: "Request timeout error occurred while trying to load file",
	500: "Internal server error error occurred while trying to load file",
	502: "Bad gateway error occurred while trying to load file",
	503: "Service unavailable error occurred while trying to load file",
	504: "Gateway timeout error occurred while trying to load file"
}, Qs = 100, $s = /^(\b[\w\-.]+\b\/)?\b[\w\-.]{1,96}\b$/;
function ec(...e) {
	return e = e.map((t, n) => (n && (t = t.replace(/* @__PURE__ */ RegExp("^/"), "")), n !== e.length - 1 && (t = t.replace(/* @__PURE__ */ RegExp("/$"), "")), t)), e.join("/");
}
function tc(e, t = null, n = null) {
	let r;
	try {
		r = new URL(e);
	} catch {
		return !1;
	}
	return !(t && !t.includes(r.protocol) || n && !n.includes(r.hostname));
}
function nc(e) {
	return !(!$s.test(e) || e.includes("..") || e.includes("--") || e.endsWith(".git") || e.endsWith(".ipynb"));
}
function rc(e, t = {}, ...n) {
	return JSON.stringify([
		e,
		t.revision ?? "main",
		t.cache_dir ?? null,
		t.local_files_only ?? !1,
		...n
	]);
}
var ic = class extends Error {
	constructor(e, { status: t = null } = {}) {
		super(e), this.name = "ModelFileNotFoundError", this.status = t;
	}
}, ac = /* @__PURE__ */ new Set([
	401,
	403,
	404
]);
function oc(e, t, n) {
	if (!n) return null;
	let r = `${Zs[e] ?? `Error (${e}) occurred while trying to load file`}: "${t}".`;
	throw ac.has(e) ? new ic(r, { status: e }) : Error(r);
}
async function sc(e, t, n) {
	let r = e.headers.get("Content-Length"), i = r ? parseInt(r, 10) : n ?? 0;
	r === null && !n && A.warn("Unable to determine content-length from response headers. Will expand buffer when needed.");
	let a = new Uint8Array(i), o = 0, s = e.body.getReader();
	async function c() {
		let { done: e, value: n } = await s.read();
		if (e) return;
		let r = o + n.length;
		if (r > i) {
			i = r;
			let e = new Uint8Array(i);
			e.set(a), a = e;
		}
		return a.set(n, o), o = r, t({
			progress: o / i * 100,
			loaded: o,
			total: i
		}), c();
	}
	return await c(), a;
}
function cc(e) {
	return tc(e, ["blob:"]);
}
function lc(e, { allowUnresolved: t = !1 } = {}) {
	let n;
	if (typeof location < "u" && location.href) n = location.href;
	else if (import.meta.url) n = import.meta.url;
	else return e;
	try {
		return new URL(e, n).href;
	} catch (n) {
		if (!t) throw n;
		return e;
	}
}
var uc = "SHA-256", dc = "experimental_transformers-hash-cache", fc = (e) => ({
	algorithm: uc,
	value: e
}), pc = class {
	#e = null;
	_getHashCache = () => (this.#e ??= caches.open(dc), this.#e);
	static isAvailable = () => typeof navigator < "u" && "crossOriginStorage" in navigator;
	match = async (e) => {
		let t = await this._getFileHash(e);
		if (t) try {
			let e = await (await navigator.crossOriginStorage.requestFileHandle(fc(t))).getFile();
			return new Response(e, { headers: { "Content-Length": String(e.size) } });
		} catch {
			return;
		}
	};
	put = async (e, t) => {
		let n = await this._getFileHash(e);
		if (n) {
			let e = await t.blob();
			await this._storeBlobInCOS(e, n);
		} else this._processAndStore(e, t.body);
	};
	_storeBlobInCOS = async (e, t) => {
		let n = await (await navigator.crossOriginStorage.requestFileHandle(fc(t), {
			create: !0,
			origins: "*"
		})).createWritable();
		await n.write(e), await n.close();
	};
	_processAndStore = async (e, t) => {
		try {
			let n = [];
			for await (let e of t) n.push(e);
			let r = new Blob(n), i = await this._getBlobHash(r);
			await this._storeBlobInCOS(r, i);
			try {
				await (await this._getHashCache()).put(e, new Response(i));
			} catch {}
		} catch {}
	};
	delete = async (e) => {
		try {
			return await (await this._getHashCache()).delete(e);
		} catch {
			return !1;
		}
	};
	_getFileHash = async (e) => {
		try {
			let t = await this._getHashCache(), n = await t.match(e);
			if (n) return n.text();
			let r = await this._getLfsFileHash(e);
			return r ? (await t.put(e, new Response(r)), r) : null;
		} catch {
			return null;
		}
	};
	_getLfsFileHash = async (e) => {
		if (!e.includes("/resolve/")) return null;
		let t = e.replace("/resolve/", "/raw/");
		try {
			let e = (await fetch(t).then((e) => e.text())).match(/^oid sha256:([0-9a-f]+)$/m);
			return e ? e[1] : null;
		} catch {
			return null;
		}
	};
	_getBlobHash = async (e) => {
		let t = await e.arrayBuffer(), n = await crypto.subtle.digest(uc, t);
		return Array.from(new Uint8Array(n)).map((e) => e.toString(16).padStart(2, "0")).join("");
	};
};
async function mc(e = null) {
	let t = null;
	if (k.useCustomCache) {
		if (!k.customCache) throw Error("`env.useCustomCache=true`, but `env.customCache` is not defined.");
		if (!k.customCache.match || !k.customCache.put) throw Error("`env.customCache` must be an object which implements the `match` and `put` functions of the Web Cache API. For more information, see https://developer.mozilla.org/en-US/docs/Web/API/Cache");
		t = k.customCache;
	}
	if (!t && k.experimental_useCrossOriginStorage && pc.isAvailable() && (t = new pc()), !t && k.useBrowserCache) {
		if (typeof caches > "u") throw Error("Browser cache is not available in this environment.");
		try {
			t = await caches.open(k.cacheKey);
		} catch (e) {
			A.warn("An error occurred while opening the browser cache:", e);
		}
	}
	if (!t && k.useFSCache) {
		if (!O.IS_FS_AVAILABLE) throw Error("File System Cache is not available in this environment.");
		t = new Xs(e ?? k.cacheDir);
	}
	return t;
}
async function hc(e, ...t) {
	for (let n of t) try {
		let t = await e.match(n);
		if (t) return t;
	} catch {
		continue;
	}
}
var gc = new class {
	#e;
	#t;
	constructor(e) {
		this.#e = e, this.#t = /* @__PURE__ */ new Map();
	}
	get(e) {
		if (!this.#t.has(e)) return;
		let t = this.#t.get(e);
		return this.#t.delete(e), this.#t.set(e, t), t;
	}
	put(e, t) {
		this.#t.has(e) && this.#t.delete(e), this.#t.set(e, t), this.#t.size > this.#e && this.#t.delete(this.#t.keys().next().value);
	}
	delete(e) {
		return this.#t.delete(e);
	}
	clear() {
		this.#t.clear();
	}
}(100);
function _c(e, t) {
	let n = gc.get(e);
	if (n !== void 0) return n;
	let r = t().then((e) => e, (t) => (gc.delete(e), Promise.reject(t)));
	return gc.put(e, r), r;
}
async function vc(e) {
	if (!tc(e, ["http:", "https:"])) return null;
	let t = Sc(e);
	return t.set("Range", "bytes=0-0"), k.fetch(e, {
		method: "GET",
		headers: t,
		cache: "no-store"
	});
}
function yc(e, t, n = {}) {
	return _c(rc(e, n, t), () => bc(e, t, n));
}
async function bc(e, t, n) {
	let r = await mc(n?.cache_dir), { localPath: i, remoteURL: a, proposedCacheKey: o, validModelId: s } = Cc(e, t, n, r), c = await wc(r, i, o);
	if (c !== void 0 && typeof c != "string") {
		let e = c.headers.get("content-length"), t = c.headers.get("content-type");
		return {
			exists: !0,
			size: e ? parseInt(e, 10) : void 0,
			contentType: t || void 0,
			fromCache: !0
		};
	}
	if (k.allowLocalModels && !tc(i, ["http:", "https:"])) try {
		let e = await xc(i);
		if (typeof e != "string" && e.status !== 404) {
			let t = e.headers.get("content-length"), n = e.headers.get("content-type");
			return {
				exists: !0,
				size: t ? parseInt(t, 10) : void 0,
				contentType: n || void 0,
				fromCache: !1
			};
		}
	} catch {}
	if (k.allowRemoteModels && !n.local_files_only && s) {
		let e = await vc(a);
		if (e && e.status >= 200 && e.status < 300) {
			let t, n = e.headers.get("content-type");
			if (e.status === 206) {
				let n = e.headers.get("content-range");
				if (n) {
					let e = n.match(/bytes \d+-\d+\/(\d+)/);
					e && (t = parseInt(e[1], 10));
				}
			} else if (e.status === 200) try {
				await e.body?.cancel();
			} catch {}
			if (t === void 0) {
				let n = e.headers.get("content-length");
				t = n ? parseInt(n, 10) : void 0;
			}
			return {
				exists: !0,
				size: t,
				contentType: n || void 0,
				fromCache: !1
			};
		}
		e && e.status !== 404 && e.status !== 416 && oc(e.status, a, !0);
	}
	return {
		exists: !1,
		fromCache: !1
	};
}
async function xc(e) {
	return k.useFS && !tc(e, [
		"http:",
		"https:",
		"blob:"
	]) ? new Us(e instanceof URL ? e.protocol === "file:" ? e.pathname : e.toString() : e) : k.fetch(e, { headers: Sc(e) });
}
function Sc(e) {
	let t = typeof process < "u" && process?.release?.name === "node", n = new Headers();
	if (t) {
		let t = !!process.env?.TESTING_REMOTELY, r = k.version;
		if (n.set("User-Agent", `transformers.js/${r}; is_ci/${t};`), tc(e, ["http:", "https:"], ["huggingface.co", "hf.co"])) {
			let e = process.env?.HF_TOKEN ?? process.env?.HF_ACCESS_TOKEN;
			e && n.set("Authorization", `Bearer ${e}`);
		}
	}
	return n;
}
function Cc(e, t, n = {}, r = null) {
	let i = n.revision ?? "main", a = ec(e, t), o = nc(e), s = o ? ec(k.localModelPath, a) : a, c = ec(k.remoteHost, k.remotePathTemplate.replaceAll("{model}", e).replaceAll("{revision}", encodeURIComponent(i)), t);
	return {
		requestURL: a,
		localPath: s,
		remoteURL: c,
		proposedCacheKey: r instanceof Xs ? i === "main" ? a : ec(e, i, t) : c,
		validModelId: o
	};
}
async function wc(e, t, n) {
	if (e) return await hc(e, t, n);
}
async function Tc(e, t, n, r, i, a, o = {}) {
	if (await n.match(r) === void 0 && !(typeof Cache < "u" && n instanceof Cache && !tc(lc(r, { allowUnresolved: !0 }), ["http:", "https:"]))) {
		if (!a) {
			let a = o.progress_callback ? (n) => Dr(o.progress_callback, {
				status: "progress",
				name: e,
				file: t,
				...n
			}) : void 0;
			await n.put(r, i, a);
		} else if (typeof i != "string") {
			let e = new Headers(i.headers);
			e.set("content-length", a.byteLength.toString()), await n.put(r, new Response(a, { headers: e })).catch((e) => {
				A.warn(`Unable to add response to browser cache: ${e}.`);
			});
		}
	}
}
async function Ec(e, t, n = !0, r = {}, i = !1, a = null) {
	let { requestURL: o, localPath: s, remoteURL: c, proposedCacheKey: l, validModelId: u } = Cc(e, t, r, a), d, f = !1, p;
	p = await wc(a, s, l);
	let m = p !== void 0;
	if (m) d = l;
	else {
		if (k.allowLocalModels) {
			if (!tc(o, ["http:", "https:"])) try {
				p = await xc(s), d = s;
			} catch (e) {
				A.warn(`Unable to load from local path "${s}": "${e}"`);
			}
			else if (r.local_files_only) throw Error(`\`local_files_only=true\`, but attempted to load a remote file from: ${o}.`);
			else if (!k.allowRemoteModels) throw Error(`\`env.allowRemoteModels=false\`, but attempted to load a remote file from: ${o}.`);
		}
		if (p === void 0 || typeof p != "string" && p.status === 404) {
			if (r.local_files_only || !k.allowRemoteModels) {
				if (n) throw new ic(`\`local_files_only=true\` or \`env.allowRemoteModels=false\` and file was not found locally at "${s}".`);
				return null;
			}
			if (!u) throw new ic(`Local file missing at "${s}" and download aborted due to invalid model ID "${e}".`);
			if (p = await xc(c), p.status !== 200) return oc(p.status, c, n);
			d = l;
		}
		f = a && typeof Response < "u" && p instanceof Response && p.status === 200;
	}
	Dr(r.progress_callback, {
		status: "download",
		name: e,
		file: t
	});
	let h;
	if (!(O.IS_NODE_ENV && i)) {
		let n;
		if (typeof p != "string") {
			if (!r.progress_callback) n = new Uint8Array(await p.arrayBuffer());
			else if (m && typeof navigator < "u" && /firefox/i.test(navigator.userAgent)) n = new Uint8Array(await p.arrayBuffer()), Dr(r.progress_callback, {
				status: "progress",
				name: e,
				file: t,
				progress: 100,
				loaded: n.length,
				total: n.length
			});
			else {
				let i, a = p.headers.get("content-length");
				if (a) i = parseInt(a, 10);
				else try {
					let n = await yc(e, t, r);
					n.size && (i = n.size);
				} catch {}
				n = await sc(p, (n) => {
					Dr(r.progress_callback, {
						status: "progress",
						name: e,
						file: t,
						...n
					});
				}, i);
			}
		}
		h = n;
	}
	if (f && d && typeof p != "string" && await Tc(e, t, a, d, p, h, r), O.IS_NODE_ENV && i && r.progress_callback && typeof p != "string") {
		let n = parseInt(p.headers.get("content-length"), 10) || 0;
		Dr(r.progress_callback, {
			status: "progress",
			name: e,
			file: t,
			progress: 100,
			loaded: n,
			total: n
		});
	}
	if (Dr(r.progress_callback, {
		status: "done",
		name: e,
		file: t
	}), h) {
		if (!O.IS_NODE_ENV && i) throw Error("Cannot return path in a browser environment.");
		return h;
	}
	if (p instanceof Us) return p.filePath;
	let g = await a?.match(d);
	if (g instanceof Us) return g.filePath;
	if (g instanceof Response) return new Uint8Array(await g.arrayBuffer());
	if (typeof g == "string") return g;
	throw Error("Unable to get model file path or buffer.");
}
var Dc = /* @__PURE__ */ new Map();
async function Oc(e, t, n = !0, r = {}, i = !1) {
	if (!k.allowLocalModels) {
		if (r.local_files_only) throw Error("Invalid configuration detected: local models are disabled (`env.allowLocalModels=false`) but you have requested to only use local models (`local_files_only=true`).");
		if (!k.allowRemoteModels) throw Error("Invalid configuration detected: both local and remote models are disabled. Fix by setting `env.allowLocalModels` or `env.allowRemoteModels` to `true`.");
	}
	let a = rc(e, r, t, n, i), { progress_callback: o } = r, s = o instanceof Or ? o.loads : Dc, c = s.get(a);
	return c || (Dr(o, {
		status: "initiate",
		name: e,
		file: t
	}), c = mc(r.cache_dir).then((a) => Ec(e, t, n, r, i, a)), s === Dc && (c = c.finally(() => Dc.delete(a))), s.set(a, c)), await c;
}
async function kc(e, t, n = !0, r = {}) {
	let i = await Oc(e, t, n, r, !1);
	return i === null ? null : new TextDecoder("utf-8").decode(i);
}
async function Ac(e, t, n = !0, r = {}) {
	let i = await kc(e, t, n, r);
	return i === null ? {} : JSON.parse(i);
}
function jc(e, [t, n, r], [i, a], o = "bilinear", s = !1) {
	let c = a / r, l = i / n, u = new e.constructor(i * a * t), d = n * r, f = i * a;
	for (let o = 0; o < i; ++o) for (let i = 0; i < a; ++i) {
		let s = o * a + i, p = (i + .5) / c - .5, m = (o + .5) / l - .5, h = Math.floor(p), g = Math.floor(m), _ = Math.min(h + 1, r - 1), v = Math.min(g + 1, n - 1);
		h = Math.max(h, 0), g = Math.max(g, 0);
		let y = p - h, b = m - g, x = (1 - y) * (1 - b), S = y * (1 - b), C = (1 - y) * b, ee = y * b, w = g * r, te = v * r, ne = w + h, re = w + _, ie = te + h, ae = te + _;
		for (let n = 0; n < t; ++n) {
			let t = n * d;
			u[n * f + s] = x * e[t + ne] + S * e[t + re] + C * e[t + ie] + ee * e[t + ae];
		}
	}
	return u;
}
function Mc(e, t, n) {
	let r = Array(n.length), i = Array(n.length);
	for (let e = n.length - 1, a = 1; e >= 0; --e) i[e] = a, r[e] = t[n[e]], a *= r[e];
	let a = n.map((e, t) => i[n.indexOf(t)]), o = new e.constructor(e.length);
	for (let n = 0; n < e.length; ++n) {
		let r = 0;
		for (let e = t.length - 1, i = n; e >= 0; --e) r += i % t[e] * a[e], i = Math.floor(i / t[e]);
		o[r] = e[n];
	}
	return [o, r];
}
function Nc(e) {
	let t = Ic(e)[0], n = e.map((e) => Math.exp(e - t)), r = n.reduce((e, t) => e + t, 0);
	return n.map((e) => e / r);
}
function Pc(e) {
	let t = Ic(e)[0], n = 0;
	for (let r = 0; r < e.length; ++r) n += Math.exp(e[r] - t);
	let r = Math.log(n);
	return e.map((e) => e - t - r);
}
function Fc(e) {
	if (e.length === 0) throw Error("Array must not be empty");
	let t = e[0], n = 0;
	for (let r = 1; r < e.length; ++r) e[r] < t && (t = e[r], n = r);
	return [t, n];
}
function Ic(e) {
	if (e.length === 0) throw Error("Array must not be empty");
	let t = e[0], n = 0;
	for (let r = 1; r < e.length; ++r) e[r] > t && (t = e[r], n = r);
	return [t, n];
}
function Lc(e) {
	return e > 0 && !(e & e - 1);
}
var Rc = class {
	constructor(e) {
		if (this.size = e | 0, this.size <= 1 || !Lc(this.size)) throw Error("FFT size must be a power of two larger than 1");
		this._csize = e << 1, this.table = new Float64Array(this.size * 2);
		for (let e = 0; e < this.table.length; e += 2) {
			let t = Math.PI * e / this.size;
			this.table[e] = Math.cos(t), this.table[e + 1] = -Math.sin(t);
		}
		let t = 0;
		for (let e = 1; this.size > e; e <<= 1) ++t;
		this._width = t % 2 == 0 ? t - 1 : t, this._bitrev = new Int32Array(1 << this._width);
		for (let e = 0; e < this._bitrev.length; ++e) {
			this._bitrev[e] = 0;
			for (let t = 0; t < this._width; t += 2) {
				let n = this._width - t - 2;
				this._bitrev[e] |= (e >>> t & 3) << n;
			}
		}
	}
	createComplexArray() {
		return new Float64Array(this._csize);
	}
	fromComplexArray(e, t) {
		let n = t || Array(e.length >>> 1);
		for (let t = 0; t < e.length; t += 2) n[t >>> 1] = e[t];
		return n;
	}
	toComplexArray(e, t) {
		let n = t || this.createComplexArray();
		for (let t = 0; t < n.length; t += 2) n[t] = e[t >>> 1], n[t + 1] = 0;
		return n;
	}
	transform(e, t) {
		if (e === t) throw Error("Input and output buffers must be different");
		this._transform4(e, t, 1);
	}
	realTransform(e, t) {
		if (e === t) throw Error("Input and output buffers must be different");
		this._realTransform4(e, t, 1);
	}
	inverseTransform(e, t) {
		if (e === t) throw Error("Input and output buffers must be different");
		this._transform4(e, t, -1);
		for (let t = 0; t < e.length; ++t) e[t] /= this.size;
	}
	_transform4(e, t, n) {
		let r = this._csize, i = 1 << this._width, a = r / i << 1, o, s, c = this._bitrev;
		if (a === 4) for (o = 0, s = 0; o < r; o += a, ++s) {
			let n = c[s];
			this._singleTransform2(t, e, o, n, i);
		}
		else for (o = 0, s = 0; o < r; o += a, ++s) {
			let r = c[s];
			this._singleTransform4(t, e, o, r, i, n);
		}
		let l = this.table;
		for (i >>= 2; i >= 2; i >>= 2) {
			a = r / i << 1;
			let t = a >>> 2;
			for (o = 0; o < r; o += a) {
				let r = o + t - 1;
				for (let a = o, s = 0; a < r; a += 2, s += i) {
					let r = a, i = r + t, o = i + t, c = o + t, u = e[r], d = e[r + 1], f = e[i], p = e[i + 1], m = e[o], h = e[o + 1], g = e[c], _ = e[c + 1], v = l[s], y = n * l[s + 1], b = f * v - p * y, x = f * y + p * v, S = l[2 * s], C = n * l[2 * s + 1], ee = m * S - h * C, w = m * C + h * S, te = l[3 * s], ne = n * l[3 * s + 1], re = g * te - _ * ne, ie = g * ne + _ * te, ae = u + ee, oe = d + w, se = u - ee, ce = d - w, le = b + re, ue = x + ie, T = n * (b - re), de = n * (x - ie);
					e[r] = ae + le, e[r + 1] = oe + ue, e[i] = se + de, e[i + 1] = ce - T, e[o] = ae - le, e[o + 1] = oe - ue, e[c] = se - de, e[c + 1] = ce + T;
				}
			}
		}
	}
	_singleTransform2(e, t, n, r, i) {
		let a = e[r], o = e[r + 1], s = e[r + i], c = e[r + i + 1];
		t[n] = a + s, t[n + 1] = o + c, t[n + 2] = a - s, t[n + 3] = o - c;
	}
	_singleTransform4(e, t, n, r, i, a) {
		let o = i * 2, s = i * 3, c = e[r], l = e[r + 1], u = e[r + i], d = e[r + i + 1], f = e[r + o], p = e[r + o + 1], m = e[r + s], h = e[r + s + 1], g = c + f, _ = l + p, v = c - f, y = l - p, b = u + m, x = d + h, S = a * (u - m), C = a * (d - h);
		t[n] = g + b, t[n + 1] = _ + x, t[n + 2] = v + C, t[n + 3] = y - S, t[n + 4] = g - b, t[n + 5] = _ - x, t[n + 6] = v - C, t[n + 7] = y + S;
	}
	_realTransform4(e, t, n) {
		let r = this._csize, i = 1 << this._width, a = r / i << 1, o, s, c = this._bitrev;
		if (a === 4) for (o = 0, s = 0; o < r; o += a, ++s) {
			let n = c[s];
			this._singleRealTransform2(t, e, o, n >>> 1, i >>> 1);
		}
		else for (o = 0, s = 0; o < r; o += a, ++s) {
			let r = c[s];
			this._singleRealTransform4(t, e, o, r >>> 1, i >>> 1, n);
		}
		let l = this.table;
		for (i >>= 2; i >= 2; i >>= 2) {
			a = r / i << 1;
			let t = a >>> 1, s = t >>> 1, c = s >>> 1;
			for (o = 0; o < r; o += a) for (let r = 0, a = 0; r <= c; r += 2, a += i) {
				let i = o + r, u = i + s, d = u + s, f = d + s, p = e[i], m = e[i + 1], h = e[u], g = e[u + 1], _ = e[d], v = e[d + 1], y = e[f], b = e[f + 1], x = p, S = m, C = l[a], ee = n * l[a + 1], w = h * C - g * ee, te = h * ee + g * C, ne = l[2 * a], re = n * l[2 * a + 1], ie = _ * ne - v * re, ae = _ * re + v * ne, oe = l[3 * a], se = n * l[3 * a + 1], ce = y * oe - b * se, le = y * se + b * oe, ue = x + ie, T = S + ae, de = x - ie, fe = S - ae, pe = w + ce, me = te + le, he = n * (w - ce), ge = n * (te - le);
				if (e[i] = ue + pe, e[i + 1] = T + me, e[u] = de + ge, e[u + 1] = fe - he, r === 0) {
					e[d] = ue - pe, e[d + 1] = T - me;
					continue;
				}
				if (r === c) continue;
				let _e = o + s - r, ve = o + t - r;
				e[_e] = de - n * ge, e[_e + 1] = -fe - n * he, e[ve] = ue - n * pe, e[ve + 1] = -T + n * me;
			}
		}
		let u = r >>> 1;
		for (let t = 2; t < u; t += 2) e[r - t] = e[t], e[r - t + 1] = -e[t + 1];
	}
	_singleRealTransform2(e, t, n, r, i) {
		let a = e[r], o = e[r + i];
		t[n] = a + o, t[n + 1] = 0, t[n + 2] = a - o, t[n + 3] = 0;
	}
	_singleRealTransform4(e, t, n, r, i, a) {
		let o = i * 2, s = i * 3, c = e[r], l = e[r + i], u = e[r + o], d = e[r + s], f = c + u, p = c - u, m = l + d, h = a * (l - d);
		t[n] = f + m, t[n + 1] = 0, t[n + 2] = p, t[n + 3] = -h, t[n + 4] = f - m, t[n + 5] = 0, t[n + 6] = p, t[n + 7] = h;
	}
}, zc = class {
	constructor(e) {
		let t = 2 * (e - 1), n = 2 * (2 * e - 1), r = 2 ** Math.ceil(Math.log2(n));
		this.bufferSize = r, this._a = t;
		let i = new Float64Array(n), a = new Float64Array(r);
		this._chirpBuffer = new Float64Array(r), this._buffer1 = new Float64Array(r), this._buffer2 = new Float64Array(r), this._outBuffer1 = new Float64Array(r), this._outBuffer2 = new Float64Array(r);
		let o = -2 * Math.PI / e, s = Math.cos(o), c = Math.sin(o);
		for (let t = 0; t < n >> 1; ++t) {
			let n = (t + 1 - e) ** 2 / 2, r = Math.sqrt(s ** 2 + c ** 2) ** n, o = n * Math.atan2(c, s), l = 2 * t;
			i[l] = r * Math.cos(o), i[l + 1] = r * Math.sin(o), a[l] = i[l], a[l + 1] = -i[l + 1];
		}
		this._slicedChirpBuffer = i.subarray(t, n), this._f = new Rc(r >> 1), this._f.transform(this._chirpBuffer, a);
	}
	_transform(e, t, n) {
		let r = this._buffer1, i = this._buffer2, a = this._outBuffer1, o = this._outBuffer2, s = this._chirpBuffer, c = this._slicedChirpBuffer, l = this._a;
		if (n) for (let e = 0; e < c.length; e += 2) {
			let n = e + 1, i = t[e >> 1];
			r[e] = i * c[e], r[n] = i * c[n];
		}
		else for (let e = 0; e < c.length; e += 2) {
			let n = e + 1;
			r[e] = t[e] * c[e] - t[n] * c[n], r[n] = t[e] * c[n] + t[n] * c[e];
		}
		this._f.transform(a, r);
		for (let e = 0; e < s.length; e += 2) {
			let t = e + 1;
			i[e] = a[e] * s[e] - a[t] * s[t], i[t] = a[e] * s[t] + a[t] * s[e];
		}
		this._f.inverseTransform(o, i);
		for (let t = 0; t < o.length; t += 2) {
			let n = o[t + l], r = o[t + l + 1], i = c[t], a = c[t + 1];
			e[t] = n * i - r * a, e[t + 1] = n * a + r * i;
		}
	}
	transform(e, t) {
		this._transform(e, t, !1);
	}
	realTransform(e, t) {
		this._transform(e, t, !0);
	}
}, Bc = class {
	constructor(e) {
		this.fft_length = e, this.isPowerOfTwo = Lc(e), this.isPowerOfTwo ? (this.fft = new Rc(e), this.outputBufferSize = 2 * e) : (this.fft = new zc(e), this.outputBufferSize = this.fft.bufferSize);
	}
	realTransform(e, t) {
		this.fft.realTransform(e, t);
	}
	transform(e, t) {
		this.fft.transform(e, t);
	}
};
function Vc(e, t) {
	if (t % 2 == 0 || t <= 0) throw Error("Window size must be a positive odd number");
	let n = new e.constructor(e.length), r = new e.constructor(t), i = Math.floor(t / 2);
	for (let t = 0; t < e.length; ++t) {
		let a = 0;
		for (let n = -i; n <= i; ++n) {
			let i = t + n;
			i < 0 ? i = Math.abs(i) : i >= e.length && (i = 2 * (e.length - 1) - i), r[a++] = e[i];
		}
		r.sort(), n[t] = r[i];
	}
	return n;
}
function Hc(e, t) {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}
function Uc(e) {
	let t = Math.round(e);
	return Math.abs(e) % 1 == .5 ? t % 2 == 0 ? t : t - 1 : t;
}
function Wc(e) {
	let t = e.length, n = e[0].length, r = [t + 1, n + 1], i = Array.from({ length: r[0] }, () => Array(r[1]).fill(Infinity));
	i[0][0] = 0;
	let a = Array.from({ length: r[0] }, () => Array(r[1]).fill(-1));
	for (let t = 1; t < r[1]; ++t) for (let n = 1; n < r[0]; ++n) {
		let r = i[n - 1][t - 1], o = i[n - 1][t], s = i[n][t - 1], c, l;
		r < o && r < s ? (c = r, l = 0) : o < r && o < s ? (c = o, l = 1) : (c = s, l = 2), i[n][t] = e[n - 1][t - 1] + c, a[n][t] = l;
	}
	for (let e = 0; e < r[1]; ++e) a[0][e] = 2;
	for (let e = 0; e < r[0]; ++e) a[e][0] = 1;
	let o = t, s = n, c = [], l = [];
	for (; o > 0 || s > 0;) switch (c.push(o - 1), l.push(s - 1), a[o][s]) {
		case 0:
			--o, --s;
			break;
		case 1:
			--o;
			break;
		case 2:
			--s;
			break;
		default: throw Error(`Internal error in dynamic time warping. Unexpected trace[${o}, ${s}]. Please file a bug report.`);
	}
	return c.reverse(), l.reverse(), [c, l];
}
var Gc = /* @__PURE__ */ (function() {
	let e = null;
	return function(t) {
		if (!e) {
			e = /* @__PURE__ */ new Float32Array(65536);
			let t = /* @__PURE__ */ new ArrayBuffer(4), n = new Uint32Array(t), r = new Float32Array(t);
			for (let t = 0; t < e.length; ++t) {
				let i = 0, a = (t & 32768) << 16, o = (t & 31744) >> 10, s = t & 1023;
				if (o === 31) i = a | 2139095040 | s << 13;
				else if (o === 0) {
					if (s === 0) i = a;
					else {
						let e = 113;
						for (; !(s & 1024);) s <<= 1, --e;
						s &= -1025, i = a | e << 23 | s << 13;
					}
				} else i = a | o + 112 << 23 | s << 13;
				n[0] = i, e[t] = r[0];
			}
		}
		let n = t.length, r = e, i = new Float32Array(n);
		for (let e = 0; e < n; ++e) i[e] = r[t[e]];
		return i;
	};
})(), Kc = {};
async function qc(e) {
	let t = e.split("/").pop(), n;
	try {
		if (n = await mc(), n) {
			let t = await n.match(e);
			if (t) return t;
		}
	} catch (e) {
		A.warn(`Failed to load ${t} from cache:`, e);
	}
	let r = await k.fetch(e);
	if (!r.ok) throw Error(`Failed to fetch ${t}: ${r.status} ${r.statusText}`);
	if (n) try {
		await n.put(e, r.clone());
	} catch (e) {
		A.warn(`Failed to cache ${t}:`, e);
	}
	return r;
}
async function Jc(e) {
	let t = await qc(e);
	if (!t || typeof t == "string") return null;
	try {
		return await t.arrayBuffer();
	} catch (e) {
		return A.warn("Failed to read WASM binary:", e), null;
	}
}
async function Yc(e) {
	if (O.IS_SERVICE_WORKER_ENV || O.IS_CHROME_AVAILABLE) return e;
	let t = await qc(e);
	if (!t || typeof t == "string") return null;
	try {
		let e = await t.text();
		e = e.replaceAll("globalThis.process?.versions?.node", "false");
		let n = new Blob([e], { type: "text/javascript" });
		return URL.createObjectURL(n);
	} catch (e) {
		return A.warn("Failed to read WASM factory:", e), null;
	}
}
var Xc = Object.freeze({
	auto: null,
	gpu: null,
	cpu: "cpu",
	wasm: "wasm",
	webgpu: "webgpu",
	cuda: "cuda",
	dml: "dml",
	coreml: "coreml",
	webnn: {
		name: "webnn",
		deviceType: "cpu"
	},
	"webnn-npu": {
		name: "webnn",
		deviceType: "npu"
	},
	"webnn-gpu": {
		name: "webnn",
		deviceType: "gpu"
	},
	"webnn-cpu": {
		name: "webnn",
		deviceType: "cpu"
	}
});
function Zc(e) {
	return e <= Cr.DEBUG ? 0 : e <= Cr.INFO ? 2 : e <= Cr.WARNING || e <= Cr.ERROR ? 3 : 4;
}
var Qc = {
	0: "verbose",
	1: "info",
	2: "warning",
	3: "error",
	4: "fatal"
}, $c = [], el, tl, nl = /* @__PURE__ */ Symbol.for("onnxruntime");
if (nl in globalThis) tl = globalThis[nl];
else if (O.IS_NODE_ENV) {
	switch (tl = Kc, process.platform) {
		case "win32":
			$c.push("dml");
			break;
		case "linux":
			process.arch === "x64" && $c.push("cuda");
			break;
		case "darwin": $c.push("coreml");
	}
	$c.push("webgpu"), $c.push("cpu"), el = ["cpu"];
} else tl = r, O.IS_WEBNN_AVAILABLE && $c.push("webnn-npu", "webnn-gpu", "webnn-cpu", "webnn"), O.IS_WEBGPU_AVAILABLE && $c.push("webgpu"), $c.push("wasm"), el = ["wasm"];
var rl = tl.InferenceSession;
function il(e = null) {
	if (!e) return el;
	switch (e) {
		case "auto": return $c;
		case "gpu": return $c.filter((e) => [
			"webgpu",
			"cuda",
			"dml",
			"webnn-gpu"
		].includes(e));
	}
	if ($c.includes(e)) return [Xc[e] ?? e];
	throw Error(`Unsupported device: "${e}". Should be one of: ${$c.join(", ")}.`);
}
var al = Promise.resolve(), ol = null;
async function sl() {
	if (ol) return ol;
	if (!(k.useWasmCache && typeof fl?.wasm?.wasmPaths == "object" && fl?.wasm?.wasmPaths?.wasm && fl?.wasm?.wasmPaths?.mjs)) {
		if (O.IS_DENO_WEB_RUNTIME) throw Error("env.useWasmCache=false is not supported in Deno's web runtime. Remove the useWasmCache override.");
		return ol = Promise.resolve(), ol;
	}
	return ol = (async () => {
		let e = fl.wasm.wasmPaths, t = !1;
		await Promise.all([e.wasm && !cc(e.wasm) ? (async () => {
			try {
				let n = await Jc(lc(e.wasm));
				n && (fl.wasm.wasmBinary = n, t = !0);
			} catch (e) {
				A.warn("Failed to pre-load WASM binary:", e);
			}
		})() : Promise.resolve(), e.mjs && !cc(e.mjs) ? (async () => {
			try {
				let t = await Yc(lc(e.mjs));
				t && (fl.wasm.wasmPaths.mjs = t);
			} catch (e) {
				A.warn("Failed to pre-load WASM factory:", e);
			}
		})() : Promise.resolve()]), t || (fl.wasm.wasmPaths.mjs = e.mjs);
	})(), ol;
}
async function cl(e, t, n) {
	await sl();
	let r = Zc(k.logLevel ?? Cr.WARNING), i = () => rl.create(e, {
		logSeverityLevel: r,
		...t
	}), a = await (O.IS_WEB_ENV ? al = al.then(i) : i());
	return a.config = n, a;
}
var ll = Promise.resolve();
async function ul(e, t) {
	let n = () => e.run(t);
	return O.IS_WEB_ENV ? ll = ll.then(n) : n();
}
function dl(e) {
	return e instanceof tl.Tensor;
}
var fl = tl?.env;
function pl() {
	return fl?.wasm?.proxy;
}
if (fl) {
	let e = function(e) {
		fl.logLevel = Qc[Zc(e)];
	};
	if (fl.wasm) {
		if (!(typeof ServiceWorkerGlobalScope < "u" && self instanceof ServiceWorkerGlobalScope) && fl.versions?.web && !fl.wasm.wasmPaths) {
			let e = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${fl.versions.web}/dist/`, t = ".asyncify";
			O.IS_SAFARI_BELOW_26 && !O.IS_WEBGPU_AVAILABLE && (t = ""), fl.wasm.wasmPaths = {
				mjs: `${e}ort-wasm-simd-threaded${t}.mjs`,
				wasm: `${e}ort-wasm-simd-threaded${t}.wasm`
			};
		}
		fl.wasm.proxy = !1;
	}
	fl.webgpu && (fl.webgpu.powerPreference = "high-performance"), e(k.logLevel ?? Cr.WARNING), k.backends.onnx = {
		...fl,
		setLogLevel: e
	};
}
var ml = async (e, t, n) => {
	let r = await cl(new Uint8Array(e), t);
	return (async (e) => {
		let t = pl(), i = Object.fromEntries(Object.entries(e).map(([e, n]) => [e, (t ? n.clone() : n).ort_tensor])), a = await ul(r, i);
		return Array.isArray(n) ? n.map((e) => new V(a[e])) : new V(a[n]);
	});
}, hl = class {
	static session_options = {};
	static get nearest_interpolate_4d() {
		return this._nearest_interpolate_4d ||= ml([
			8,
			10,
			18,
			0,
			58,
			129,
			1,
			10,
			41,
			10,
			1,
			120,
			10,
			0,
			10,
			0,
			10,
			1,
			115,
			18,
			1,
			121,
			34,
			6,
			82,
			101,
			115,
			105,
			122,
			101,
			42,
			18,
			10,
			4,
			109,
			111,
			100,
			101,
			34,
			7,
			110,
			101,
			97,
			114,
			101,
			115,
			116,
			160,
			1,
			3,
			18,
			1,
			114,
			90,
			31,
			10,
			1,
			120,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			99,
			10,
			3,
			18,
			1,
			104,
			10,
			3,
			18,
			1,
			119,
			90,
			15,
			10,
			1,
			115,
			18,
			10,
			10,
			8,
			8,
			7,
			18,
			4,
			10,
			2,
			8,
			4,
			98,
			31,
			10,
			1,
			121,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			99,
			10,
			3,
			18,
			1,
			104,
			10,
			3,
			18,
			1,
			119,
			66,
			2,
			16,
			21
		], this.session_options, "y"), this._nearest_interpolate_4d;
	}
	static get bilinear_interpolate_4d() {
		return this._bilinear_interpolate_4d ||= ml([
			8,
			9,
			18,
			0,
			58,
			128,
			1,
			10,
			40,
			10,
			1,
			120,
			10,
			0,
			10,
			0,
			10,
			1,
			115,
			18,
			1,
			121,
			34,
			6,
			82,
			101,
			115,
			105,
			122,
			101,
			42,
			17,
			10,
			4,
			109,
			111,
			100,
			101,
			34,
			6,
			108,
			105,
			110,
			101,
			97,
			114,
			160,
			1,
			3,
			18,
			1,
			114,
			90,
			31,
			10,
			1,
			120,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			99,
			10,
			3,
			18,
			1,
			104,
			10,
			3,
			18,
			1,
			119,
			90,
			15,
			10,
			1,
			115,
			18,
			10,
			10,
			8,
			8,
			7,
			18,
			4,
			10,
			2,
			8,
			4,
			98,
			31,
			10,
			1,
			121,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			99,
			10,
			3,
			18,
			1,
			104,
			10,
			3,
			18,
			1,
			119,
			66,
			2,
			16,
			20
		], this.session_options, "y"), this._bilinear_interpolate_4d;
	}
	static get bicubic_interpolate_4d() {
		return this._bicubic_interpolate_4d ||= ml([
			8,
			9,
			18,
			0,
			58,
			127,
			10,
			39,
			10,
			1,
			120,
			10,
			0,
			10,
			0,
			10,
			1,
			115,
			18,
			1,
			121,
			34,
			6,
			82,
			101,
			115,
			105,
			122,
			101,
			42,
			16,
			10,
			4,
			109,
			111,
			100,
			101,
			34,
			5,
			99,
			117,
			98,
			105,
			99,
			160,
			1,
			3,
			18,
			1,
			114,
			90,
			31,
			10,
			1,
			120,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			99,
			10,
			3,
			18,
			1,
			104,
			10,
			3,
			18,
			1,
			119,
			90,
			15,
			10,
			1,
			115,
			18,
			10,
			10,
			8,
			8,
			7,
			18,
			4,
			10,
			2,
			8,
			4,
			98,
			31,
			10,
			1,
			121,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			99,
			10,
			3,
			18,
			1,
			104,
			10,
			3,
			18,
			1,
			119,
			66,
			2,
			16,
			20
		], this.session_options, "y"), this._bicubic_interpolate_4d;
	}
	static get matmul() {
		return this._matmul ||= ml([
			8,
			9,
			18,
			0,
			58,
			55,
			10,
			17,
			10,
			1,
			97,
			10,
			1,
			98,
			18,
			1,
			99,
			34,
			6,
			77,
			97,
			116,
			77,
			117,
			108,
			18,
			1,
			114,
			90,
			9,
			10,
			1,
			97,
			18,
			4,
			10,
			2,
			8,
			1,
			90,
			9,
			10,
			1,
			98,
			18,
			4,
			10,
			2,
			8,
			1,
			98,
			9,
			10,
			1,
			99,
			18,
			4,
			10,
			2,
			8,
			1,
			66,
			2,
			16,
			20
		], this.session_options, "c"), this._matmul;
	}
	static get stft() {
		return this._stft ||= ml([
			8,
			7,
			18,
			0,
			58,
			148,
			1,
			10,
			38,
			10,
			1,
			115,
			10,
			1,
			106,
			10,
			1,
			119,
			10,
			1,
			108,
			18,
			1,
			111,
			34,
			4,
			83,
			84,
			70,
			84,
			42,
			15,
			10,
			8,
			111,
			110,
			101,
			115,
			105,
			100,
			101,
			100,
			24,
			1,
			160,
			1,
			2,
			18,
			1,
			115,
			90,
			26,
			10,
			1,
			115,
			18,
			21,
			10,
			19,
			8,
			1,
			18,
			15,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			115,
			10,
			3,
			18,
			1,
			99,
			90,
			11,
			10,
			1,
			106,
			18,
			6,
			10,
			4,
			8,
			7,
			18,
			0,
			90,
			16,
			10,
			1,
			119,
			18,
			11,
			10,
			9,
			8,
			1,
			18,
			5,
			10,
			3,
			18,
			1,
			119,
			90,
			11,
			10,
			1,
			108,
			18,
			6,
			10,
			4,
			8,
			7,
			18,
			0,
			98,
			31,
			10,
			1,
			111,
			18,
			26,
			10,
			24,
			8,
			1,
			18,
			20,
			10,
			3,
			18,
			1,
			98,
			10,
			3,
			18,
			1,
			102,
			10,
			3,
			18,
			1,
			100,
			10,
			3,
			18,
			1,
			99,
			66,
			2,
			16,
			17
		], this.session_options, "o"), this._stft;
	}
	static get rfft() {
		return this._rfft ||= ml([
			8,
			9,
			58,
			93,
			10,
			33,
			10,
			1,
			120,
			10,
			0,
			10,
			1,
			97,
			18,
			1,
			121,
			34,
			3,
			68,
			70,
			84,
			42,
			15,
			10,
			8,
			111,
			110,
			101,
			115,
			105,
			100,
			101,
			100,
			24,
			1,
			160,
			1,
			2,
			18,
			1,
			100,
			90,
			19,
			10,
			1,
			120,
			18,
			14,
			10,
			12,
			8,
			1,
			18,
			8,
			10,
			0,
			10,
			0,
			10,
			2,
			8,
			1,
			90,
			11,
			10,
			1,
			97,
			18,
			6,
			10,
			4,
			8,
			7,
			18,
			0,
			98,
			19,
			10,
			1,
			121,
			18,
			14,
			10,
			12,
			8,
			1,
			18,
			8,
			10,
			0,
			10,
			0,
			10,
			2,
			8,
			2,
			66,
			2,
			16,
			20
		], this.session_options, "y"), this._rfft;
	}
	static get top_k() {
		return this._top_k ||= ml([
			8,
			10,
			18,
			0,
			58,
			73,
			10,
			18,
			10,
			1,
			120,
			10,
			1,
			107,
			18,
			1,
			118,
			18,
			1,
			105,
			34,
			4,
			84,
			111,
			112,
			75,
			18,
			1,
			116,
			90,
			9,
			10,
			1,
			120,
			18,
			4,
			10,
			2,
			8,
			1,
			90,
			15,
			10,
			1,
			107,
			18,
			10,
			10,
			8,
			8,
			7,
			18,
			4,
			10,
			2,
			8,
			1,
			98,
			9,
			10,
			1,
			118,
			18,
			4,
			10,
			2,
			8,
			1,
			98,
			9,
			10,
			1,
			105,
			18,
			4,
			10,
			2,
			8,
			7,
			66,
			2,
			16,
			21
		], this.session_options, ["v", "i"]), this._top_k;
	}
	static get slice() {
		return this._slice ||= ml([
			8,
			7,
			18,
			0,
			58,
			96,
			10,
			25,
			10,
			1,
			120,
			10,
			1,
			115,
			10,
			1,
			101,
			10,
			1,
			97,
			10,
			1,
			116,
			18,
			1,
			121,
			34,
			5,
			83,
			108,
			105,
			99,
			101,
			18,
			1,
			114,
			90,
			9,
			10,
			1,
			120,
			18,
			4,
			10,
			2,
			8,
			1,
			90,
			9,
			10,
			1,
			115,
			18,
			4,
			10,
			2,
			8,
			7,
			90,
			9,
			10,
			1,
			101,
			18,
			4,
			10,
			2,
			8,
			7,
			90,
			9,
			10,
			1,
			97,
			18,
			4,
			10,
			2,
			8,
			7,
			90,
			9,
			10,
			1,
			116,
			18,
			4,
			10,
			2,
			8,
			7,
			98,
			9,
			10,
			1,
			121,
			18,
			4,
			10,
			2,
			8,
			1,
			66,
			2,
			16,
			13
		], this.session_options, "y"), this._slice;
	}
}, gl = Object.freeze({
	auto: "auto",
	gpu: "gpu",
	cpu: "cpu",
	wasm: "wasm",
	webgpu: "webgpu",
	cuda: "cuda",
	dml: "dml",
	coreml: "coreml",
	webnn: "webnn",
	"webnn-npu": "webnn-npu",
	"webnn-gpu": "webnn-gpu",
	"webnn-cpu": "webnn-cpu"
}), _l = O.IS_NODE_ENV ? "cpu" : "wasm";
function vl(e, t, { warn: n } = {}) {
	return e ? typeof e == "string" ? e : e.hasOwnProperty(t) ? e[t] : (n && n(`device not specified for "${t}". Using the default device (${_l}).`), _l) : _l;
}
var yl = /* @__PURE__ */ (function() {
	let e;
	return async function() {
		if (e === void 0) {
			if (!O.IS_WEBGPU_AVAILABLE) e = !1;
			else try {
				e = (await navigator.gpu.requestAdapter()).features.has("shader-f16");
			} catch {
				e = !1;
			}
		}
		return e;
	};
})(), bl = Object.freeze({
	auto: "auto",
	fp32: "fp32",
	fp16: "fp16",
	q8: "q8",
	int8: "int8",
	uint8: "uint8",
	q4: "q4",
	bnb4: "bnb4",
	q4f16: "q4f16",
	q2: "q2",
	q2f16: "q2f16",
	q1: "q1",
	q1f16: "q1f16"
}), xl = bl.fp32, Sl = Object.freeze({ [gl.wasm]: bl.q8 }), Cl = Object.freeze({
	[bl.fp32]: "",
	[bl.fp16]: "_fp16",
	[bl.int8]: "_int8",
	[bl.uint8]: "_uint8",
	[bl.q8]: "_quantized",
	[bl.q4]: "_q4",
	[bl.q2]: "_q2",
	[bl.q1]: "_q1",
	[bl.q4f16]: "_q4f16",
	[bl.q2f16]: "_q2f16",
	[bl.q1f16]: "_q1f16",
	[bl.bnb4]: "_bnb4"
});
function wl(e, t, n, { configDtype: r = null, warn: i } = {}) {
	let a, o = !1;
	e && typeof e != "string" ? e.hasOwnProperty(t) ? a = e[t] : (a = null, o = !0) : a = e;
	let s;
	if (a === bl.auto) {
		if (r) {
			let e = typeof r == "string" ? r : r?.[t];
			if (e && e !== bl.auto && bl.hasOwnProperty(e)) return e;
		}
		s = Sl[n] ?? xl;
	} else s = a && bl.hasOwnProperty(a) ? a : Sl[n] ?? xl;
	return o && i && i(`dtype not specified for "${t}". Using the default dtype (${s}) for this device (${n}).`), s;
}
var Tl = Object.freeze({
	float32: Float32Array,
	float16: typeof Float16Array < "u" ? Float16Array : Uint16Array,
	float64: Float64Array,
	string: Array,
	int8: Int8Array,
	uint8: Uint8Array,
	int16: Int16Array,
	uint16: Uint16Array,
	int32: Int32Array,
	uint32: Uint32Array,
	int64: BigInt64Array,
	uint64: BigUint64Array,
	bool: Uint8Array,
	uint4: Uint8Array,
	int4: Int8Array
}), V = class e {
	get dims() {
		return this.ort_tensor.dims;
	}
	set dims(e) {
		this.ort_tensor.dims = e;
	}
	get type() {
		return this.ort_tensor.type;
	}
	get data() {
		return this.ort_tensor.data;
	}
	get size() {
		return this.ort_tensor.size;
	}
	get location() {
		return this.ort_tensor.location;
	}
	ort_tensor;
	constructor(...e) {
		return this.ort_tensor = dl(e[0]) ? e[0] : new qn(e[0], e[1], e[2]), new Proxy(this, {
			get: (e, t) => {
				if (typeof t == "string") {
					let n = Number(t);
					if (Number.isInteger(n)) return e._getitem(n);
				}
				return e[t];
			},
			set: (e, t, n) => e[t] = n
		});
	}
	dispose() {
		this.ort_tensor.dispose();
	}
	*[Symbol.iterator]() {
		let [e, ...t] = this.dims;
		if (t.length > 0) {
			let n = t.reduce((e, t) => e * t);
			for (let r = 0; r < e; ++r) yield this._subarray(r, n, t);
		} else yield* this.data;
	}
	_getitem(t) {
		let [n, ...r] = this.dims;
		if (t = Ll(t, n), r.length > 0) {
			let e = r.reduce((e, t) => e * t);
			return this._subarray(t, e, r);
		}
		return new e(this.type, [this.data[t]], r);
	}
	_subarray(t, n, r) {
		let i = t * n, a = (t + 1) * n, o = "subarray" in this.data ? this.data.subarray(i, a) : this.data.slice(i, a);
		return new e(this.type, o, r);
	}
	item() {
		let e = this.data;
		if (e.length !== 1) throw Error(`a Tensor with ${e.length} elements cannot be converted to Scalar`);
		return e[0];
	}
	tolist() {
		return El(this.data, this.dims);
	}
	sigmoid() {
		return this.clone().sigmoid_();
	}
	sigmoid_() {
		let e = this.data;
		for (let t = 0; t < e.length; ++t) e[t] = 1 / (1 + Math.exp(-e[t]));
		return this;
	}
	map(e) {
		return this.clone().map_(e);
	}
	map_(e) {
		let t = this.data;
		for (let n = 0; n < t.length; ++n) t[n] = e(t[n], n, t);
		return this;
	}
	mul(e) {
		return this.clone().mul_(e);
	}
	mul_(e) {
		let t = this.data;
		for (let n = 0; n < t.length; ++n) t[n] *= e;
		return this;
	}
	div(e) {
		return this.clone().div_(e);
	}
	div_(e) {
		let t = this.data;
		for (let n = 0; n < t.length; ++n) t[n] /= e;
		return this;
	}
	add(e) {
		return this.clone().add_(e);
	}
	add_(e) {
		let t = this.data;
		for (let n = 0; n < t.length; ++n) t[n] += e;
		return this;
	}
	sub(e) {
		return this.clone().sub_(e);
	}
	sub_(e) {
		let t = this.data;
		for (let n = 0; n < t.length; ++n) t[n] -= e;
		return this;
	}
	remainder(e) {
		return this.clone().remainder_(e);
	}
	remainder_(e) {
		let t = this.data, n = t instanceof BigInt64Array || t instanceof BigUint64Array ? BigInt(e) : Number(e);
		if ((n === 0 || n === 0n) && (this.type.includes("int") || this.type === "bool")) throw RangeError("Division by zero");
		if (n < 0 && (this.type.startsWith("uint") || this.type === "bool")) throw RangeError("Negative divisors are not supported for unsigned or boolean tensors");
		for (let e = 0; e < t.length; ++e) {
			let r = t[e] % n;
			t[e] = r < 0 && n > 0 || r > 0 && n < 0 ? r + n : r;
		}
		return this;
	}
	clone() {
		return new e(this.type, this.data.slice(), this.dims.slice());
	}
	slice(...t) {
		let n = [], r = [];
		for (let e = 0; e < this.dims.length; ++e) {
			let i = t[e];
			if (i == null) r.push([0, this.dims[e]]), n.push(this.dims[e]);
			else if (typeof i == "number") i = Ll(i, this.dims[e], e), r.push([i, i + 1]);
			else if (Array.isArray(i) && i.length === 2) {
				let [t, a] = i;
				if (t = t === null ? 0 : Ll(t, this.dims[e], e, !1), a = a === null ? this.dims[e] : Ll(a, this.dims[e], e, !1), t > a) throw Error(`Invalid slice: ${i}`);
				let o = [Math.max(t, 0), Math.min(a, this.dims[e])];
				r.push(o), n.push(o[1] - o[0]);
			} else throw Error(`Invalid slice: ${i}`);
		}
		let i = r.map(([e, t]) => t - e), a = i.reduce((e, t) => e * t), o = this.data, s = new o.constructor(a), c = this.stride(), l = !0;
		for (let e = 1; e < i.length; ++e) if (r[e][0] !== 0 || r[e][1] !== this.dims[e]) {
			l = !1;
			break;
		}
		if (l) {
			let e = r[0][0] * c[0], t = r[0][1] * c[0];
			if (ArrayBuffer.isView(o)) s.set(o.subarray(e, t));
			else if (Array.isArray(o)) {
				let n = o.slice(e, t);
				for (let e = 0; e < n.length; ++e) s[e] = n[e];
			} else throw Error("Unsupported data type for slicing");
		} else for (let e = 0; e < a; ++e) {
			let t = 0;
			for (let n = i.length - 1, a = e; n >= 0; --n) {
				let e = i[n];
				t += (a % e + r[n][0]) * c[n], a = Math.floor(a / e);
			}
			s[e] = o[t];
		}
		return new e(this.type, s, n);
	}
	permute(...e) {
		return Dl(this, e);
	}
	transpose(...e) {
		return this.permute(...e);
	}
	sum(e = null, t = !1) {
		return this.norm(1, e, t);
	}
	norm(t = "fro", n = null, r = !1) {
		if (t === "fro") t = 2;
		else if (typeof t == "string") throw Error(`Unsupported norm: ${t}`);
		let i = this.data, a = i instanceof BigInt64Array || i instanceof BigUint64Array;
		if (a && t !== 1) throw Error(`Expected a floating point tensor as input. Got ${this.type}`);
		let o, s;
		if (a ? (o = (e, t) => e + t, s = 0n) : (o = (e, n) => e + n ** t, s = 0), n === null) {
			let n = i.reduce(o, s);
			return t !== 1 && (n **= 1 / t), new e(this.type, [n], []);
		}
		let [c, l, u] = zl(o, this, n, r);
		if (t !== 1) for (let e = 0; e < l.length; ++e) l[e] = l[e] ** (1 / t);
		return new e(c, l, u);
	}
	normalize_(e = 2, t = 1) {
		t = Ll(t, this.dims.length);
		let n = this.norm(e, t, !0), r = this.data, i = n.data;
		for (let e = 0; e < r.length; ++e) {
			let n = 0;
			for (let r = this.dims.length - 1, i = e, a = 1; r >= 0; --r) {
				let e = this.dims[r];
				if (r !== t) {
					let t = i % e;
					n += t * a, a *= this.dims[r];
				}
				i = Math.floor(i / e);
			}
			r[e] /= i[n];
		}
		return this;
	}
	normalize(e = 2, t = 1) {
		return this.clone().normalize_(e, t);
	}
	stride() {
		return Hl(this.dims);
	}
	squeeze(t = null) {
		return new e(this.type, this.data, Fl(this.dims, t));
	}
	squeeze_(e = null) {
		return this.dims = Fl(this.dims, e), this;
	}
	unsqueeze(t) {
		return new e(this.type, this.data, Il(this.dims, t));
	}
	unsqueeze_(e) {
		return this.dims = Il(this.dims, e), this;
	}
	flatten_(e = 0, t = -1) {
		t = (t + this.dims.length) % this.dims.length;
		let n = this.dims.slice(0, e), r = this.dims.slice(e, t + 1), i = this.dims.slice(t + 1);
		return this.dims = [
			...n,
			r.reduce((e, t) => e * t, 1),
			...i
		], this;
	}
	flatten(e = 0, t = -1) {
		return this.clone().flatten_(e, t);
	}
	view(...t) {
		let n = -1;
		for (let e = 0; e < t.length; ++e) if (t[e] === -1) {
			if (n !== -1) throw Error("Only one dimension can be inferred");
			n = e;
		}
		let r = this.data;
		if (n !== -1) {
			let e = t.reduce((e, t, r) => r === n ? e : e * t, 1);
			t[n] = r.length / e;
		}
		return new e(this.type, r, t);
	}
	neg_() {
		let e = this.data;
		for (let t = 0; t < e.length; ++t) e[t] = -e[t];
		return this;
	}
	neg() {
		return this.clone().neg_();
	}
	gt(t) {
		let n = new Uint8Array(this.data.length), r = this.data;
		for (let e = 0; e < r.length; ++e) n[e] = +(r[e] > t);
		return new e("bool", n, this.dims);
	}
	lt(t) {
		let n = new Uint8Array(this.data.length), r = this.data;
		for (let e = 0; e < r.length; ++e) n[e] = +(r[e] < t);
		return new e("bool", n, this.dims);
	}
	clamp_(e, t) {
		let n = this.data;
		for (let r = 0; r < n.length; ++r) n[r] = Math.min(Math.max(n[r], e), t);
		return this;
	}
	clamp(e, t) {
		return this.clone().clamp_(e, t);
	}
	round_() {
		let e = this.data;
		for (let t = 0; t < e.length; ++t) e[t] = Math.round(e[t]);
		return this;
	}
	round() {
		return this.clone().round_();
	}
	mean(e = null, t = !1) {
		return Vl(this, e, t);
	}
	min(t = null, n = !1) {
		if (t === null) {
			let t = Fc(this.data)[0];
			return new e(this.type, [t], []);
		}
		let [r, i, a] = zl((e, t) => Math.min(e, t), this, t, n, Infinity);
		return new e(r, i, a);
	}
	max(t = null, n = !1) {
		if (t === null) {
			let t = Ic(this.data)[0];
			return new e(this.type, [t], []);
		}
		let [r, i, a] = zl((e, t) => Math.max(e, t), this, t, n, -Infinity);
		return new e(r, i, a);
	}
	argmin(t = null, n = !1) {
		if (t !== null) throw Error("`dim !== null` not yet implemented.");
		let r = Fc(this.data)[1];
		return new e("int64", [BigInt(r)], []);
	}
	argmax(t = null, n = !1) {
		if (t !== null) throw Error("`dim !== null` not yet implemented.");
		let r = Ic(this.data)[1];
		return new e("int64", [BigInt(r)], []);
	}
	repeat(...t) {
		if (t.length < this.dims.length) throw Error(`Number of dimensions of repeat dims (${t.length}) cannot be smaller than number of dimensions of tensor (${this.dims.length})`);
		if (t.every((e) => e === 1)) {
			if (t.length === this.dims.length) return this.clone();
			let n = t.length - this.dims.length, r = Array(n).fill(1).concat(this.dims);
			return new e(this.type, this.data.slice(), r);
		}
		let n = t.length - this.dims.length, r = Array(n).fill(1).concat(this.dims), i = r.map((e, n) => e * t[n]), a = i.reduce((e, t) => e * t, 1), o = this.data, s = new o.constructor(a), c = Hl(r), l = Hl(i);
		for (let e = 0; e < a; ++e) {
			let t = e, n = 0;
			for (let e = 0; e < i.length; ++e) {
				let i = Math.floor(t / l[e]);
				t %= l[e];
				let a = i % r[e];
				n += a * c[e];
			}
			s[e] = o[n];
		}
		return new e(this.type, s, i);
	}
	tile(...e) {
		if (e.length < this.dims.length) {
			let t = this.dims.length - e.length;
			e = Array(t).fill(1).concat(e);
		}
		return this.repeat(...e);
	}
	to(t) {
		if (this.type === t) return this;
		if (!Tl.hasOwnProperty(t)) throw Error(`Unsupported type: ${t}`);
		let n, r = ["int64", "uint64"].includes(this.type), i = ["int64", "uint64"].includes(t);
		if (r && !i) n = Number;
		else if (!r && i) n = [
			"float16",
			"float32",
			"float64"
		].includes(this.type) ? (e) => BigInt(Math.floor(e)) : BigInt;
		else if (this.type === "float16" && t == "float32" && this.data instanceof Uint16Array) return new e(t, Gc(this.data), this.dims);
		return new e(t, Tl[t].from(this.data, n), this.dims);
	}
};
function El(e, t) {
	let n = e.length;
	if (n !== (t.length === 0 ? 1 : t.reduce((e, t) => e * t))) throw Error(`cannot reshape array of size ${n} into shape (${t})`);
	let r = e;
	for (let e = t.length - 1; e >= 0; e--) r = r.reduce((n, r) => {
		let i = n[n.length - 1];
		return i.length < t[e] ? i.push(r) : n.push([r]), n;
	}, [[]]);
	return r[0];
}
function Dl(e, t) {
	let [n, r] = Mc(e.data, e.dims, t);
	return new V(e.type, n, r);
}
function Ol(e, [t, n], r = "bilinear", i = !1) {
	let a = e.dims.at(-3) ?? 1, o = e.dims.at(-2), s = e.dims.at(-1), c = jc(e.data, [
		a,
		o,
		s
	], [t, n], r, i);
	return new V(e.type, c, [
		a,
		t,
		n
	]);
}
async function kl(e, { size: t = null, mode: n = "bilinear" } = {}) {
	if (e.dims.length !== 4) throw Error("`interpolate_4d` currently only supports 4D input.");
	if (!t) throw Error("`interpolate_4d` requires a `size` argument.");
	let r;
	if (t.length === 2) r = [...e.dims.slice(0, 2), ...t];
	else if (t.length === 3) r = [e.dims[0], ...t];
	else if (t.length === 4) r = t;
	else throw Error("`size` must be of length 2, 3, or 4.");
	let i;
	if (n === "nearest") i = await hl.nearest_interpolate_4d;
	else if (n === "bilinear") i = await hl.bilinear_interpolate_4d;
	else if (n === "bicubic") i = await hl.bicubic_interpolate_4d;
	else throw Error(`Unsupported mode: ${n}`);
	let a = new V("int64", new BigInt64Array(r.map(BigInt)), [r.length]);
	return await i({
		x: e,
		s: a
	});
}
async function Al(e, t) {
	return await (await hl.matmul)({
		a: e,
		b: t
	});
}
async function jl(e, t) {
	let n = await hl.top_k;
	return t = t == null ? e.dims.at(-1) : Math.min(t, e.dims.at(-1)), await n({
		x: e,
		k: new V("int64", [BigInt(t)], [1])
	});
}
var Ml = (e) => new V("int64", e, [e.length]);
async function Nl(e, t, n, r, i) {
	return await (await hl.slice)({
		x: e,
		s: Ml(t),
		e: Ml(n),
		a: Ml(r),
		t: Ml(i ?? Array(r.length).fill(1))
	});
}
function Pl(e, t) {
	let n = e.data, r = t.data, i = [e.dims[0], e.dims[2]], a = new n.constructor(i[0] * i[1]), [o, s, c] = e.dims, l = 0;
	for (let e = 0; e < o; ++e) {
		let t = e * c * s;
		for (let i = 0; i < c; ++i) {
			let o = 0, u = 0, d = e * s, f = t + i;
			for (let e = 0; e < s; ++e) {
				let t = Number(r[d + e]);
				u += t, o += n[f + e * c] * t;
			}
			let p = o / u;
			a[l++] = p;
		}
	}
	return new V(e.type, a, i);
}
function Fl(e, t) {
	return e = e.slice(), t === null ? e = e.filter((e) => e !== 1) : typeof t == "number" ? e[t] === 1 && e.splice(t, 1) : Array.isArray(t) && (e = e.filter((e, n) => e !== 1 || !t.includes(n))), e;
}
function Il(e, t) {
	return t = Ll(t, e.length + 1), e = e.slice(), e.splice(t, 0, 1), e;
}
function Ll(e, t, n = null, r = !0) {
	if (e < -t || e >= t) {
		if (r) throw Error(`IndexError: index ${e} is out of bounds for dimension${n === null ? "" : " " + n} with size ${t}`);
		return e < -t ? 0 : t;
	}
	return e < 0 && (e = (e % t + t) % t), e;
}
function H(e, t = 0) {
	t = Ll(t, e[0].dims.length);
	let n = e[0].dims.slice();
	n[t] = e.reduce((e, n) => e + n.dims[t], 0);
	let r = n.reduce((e, t) => e * t, 1), i = new e[0].data.constructor(r), a = e[0].type;
	if (t === 0) {
		let t = 0;
		for (let n of e) {
			let e = n.data;
			i.set(e, t), t += e.length;
		}
	} else {
		let r = 0;
		for (let a = 0; a < e.length; ++a) {
			let { data: o, dims: s } = e[a];
			for (let e = 0; e < o.length; ++e) {
				let a = 0;
				for (let i = s.length - 1, o = e, c = 1; i >= 0; --i) {
					let e = s[i], l = o % e;
					i === t && (l += r), a += l * c, c *= n[i], o = Math.floor(o / e);
				}
				i[a] = o[e];
			}
			r += s[t];
		}
	}
	return new V(a, i, n);
}
function Rl(e, t = 0) {
	return H(e.map((e) => e.unsqueeze(t)), t);
}
function zl(e, t, n, r = !1, i = null) {
	let a = t.data, o = t.dims;
	n = Ll(n, o.length);
	let s = o.slice();
	s[n] = 1;
	let c = new a.constructor(a.length / o[n]);
	i !== null && c.fill(i);
	for (let t = 0; t < a.length; ++t) {
		let r = 0;
		for (let e = o.length - 1, i = t, a = 1; e >= 0; --e) {
			let t = o[e];
			if (e !== n) {
				let n = i % t;
				r += n * a, a *= s[e];
			}
			i = Math.floor(i / t);
		}
		c[r] = e(c[r], a[t], t, r);
	}
	return r || s.splice(n, 1), [
		t.type,
		c,
		s
	];
}
function Bl(e, t = null, n = 1, r = !1) {
	let i = e.data, a = e.dims;
	if (t === null) {
		let t = i.reduce((e, t) => e + t, 0) / i.length, r = Math.sqrt(i.reduce((e, n) => e + (n - t) ** 2, 0) / (i.length - n)), a = new V(e.type, [t], []);
		return [new V(e.type, [r], []), a];
	}
	t = Ll(t, a.length);
	let o = Vl(e, t, r), s = o.data, [c, l, u] = zl((e, t, n, r) => e + (t - s[r]) ** 2, e, t, r);
	for (let e = 0; e < l.length; ++e) l[e] = Math.sqrt(l[e] / (a[t] - n));
	return [new V(c, l, u), o];
}
function Vl(e, t = null, n = !1) {
	let r = e.dims, i = e.data;
	if (t === null) {
		let t = i.reduce((e, t) => e + t, 0);
		return new V(e.type, [t / i.length], []);
	}
	t = Ll(t, r.length);
	let [a, o, s] = zl((e, t) => e + t, e, t, n);
	if (r[t] !== 1) for (let e = 0; e < o.length; ++e) o[e] /= r[t];
	return new V(a, o, s);
}
function Hl(e) {
	let t = Array(e.length);
	for (let n = e.length - 1, r = 1; n >= 0; --n) t[n] = r, r *= e[n];
	return t;
}
function Ul(e, t, n, r) {
	return new V(n, new r(e.reduce((e, t) => e * t, 1)).fill(t), e);
}
function Wl(e, t) {
	let n, r;
	if (typeof t == "number") n = "float32", r = Float32Array;
	else if (typeof t == "bigint") n = "int64", r = BigInt64Array;
	else if (typeof t == "boolean") n = "bool", r = Uint8Array;
	else throw Error(`Unsupported data type: ${typeof t}`);
	return Ul(e, t, n, r);
}
function Gl(e, t) {
	return Wl(e.dims, t);
}
function Kl(e) {
	return Ul(e, 1n, "int64", BigInt64Array);
}
function ql(e) {
	return Kl(e.dims);
}
function Jl(e) {
	return Ul(e, 0n, "int64", BigInt64Array);
}
function Yl(e) {
	return Jl(e.dims);
}
function Xl(e) {
	let t = e.reduce((e, t) => e * t, 1);
	return new V("float32", Float32Array.from({ length: t }, () => qs.gauss()), e);
}
function Zl(e, t) {
	if (e.dims.length !== 2) throw Error("The tensor must have 2 dimensions");
	if (e.dims.at(-1) % 8 != 0) throw Error("The last dimension of the tensor must be a multiple of 8");
	if (!["binary", "ubinary"].includes(t)) throw Error("The precision must be either 'binary' or 'ubinary'");
	let n = t === "binary", r = n ? "int8" : "uint8", i = n ? Int8Array : Uint8Array, a = e.data, o = new i(a.length / 8);
	for (let e = 0; e < a.length; ++e) {
		let t = +(a[e] > 0), r = Math.floor(e / 8), i = e % 8;
		o[r] |= t << 7 - i, n && i === 0 && (o[r] -= 128);
	}
	return new V(r, o, [e.dims[0], e.dims[1] / 8]);
}
async function Ql(e) {
	if (!e) throw Error("modelId is required for get_tokenizer_files");
	return (await yc(e, "tokenizer_config.json", {})).exists ? ["tokenizer.json", "tokenizer_config.json"] : [];
}
async function $l(e, t) {
	let n = await Ql(e);
	return await Promise.all(n.map((n) => Ac(e, n, !0, t)));
}
function eu(e) {
	let t = e.dims;
	switch (t.length) {
		case 1: return e.tolist();
		case 2:
			if (t[0] !== 1) throw Error("Unable to decode tensor with `batch size !== 1`. Use `tokenizer.batch_decode(...)` for batched inputs.");
			return e.tolist()[0];
		default: throw Error(`Expected tensor to have 1-2 dimensions, got ${t.length}.`);
	}
}
var tu = [
	"bos_token",
	"eos_token",
	"unk_token",
	"sep_token",
	"pad_token",
	"cls_token",
	"mask_token"
];
function nu(e, t, n, r) {
	for (let i of Object.keys(e)) {
		let a = t - e[i].length, o = n(i), s = Array(a).fill(o);
		e[i] = r === "right" ? Mr(e[i], s) : Mr(s, e[i]);
	}
}
function ru(e, t) {
	for (let n of Object.keys(e)) e[n].length = t;
}
function iu(e, ...t) {
	for (let n of t) {
		if (!Object.hasOwn(e, n)) continue;
		let t = e[n];
		if (t) {
			if (typeof t == "object") {
				if (t.__type === "AddedToken") return t.content;
				throw Error(`Unknown token: ${t}`);
			}
			return t;
		}
	}
	return null;
}
function au(e) {
	let t = [];
	for (let n of e.get_added_tokens_decoder().values()) n.special && t.push(n);
	return t;
}
var U = class extends Er {
	return_token_type_ids = !1;
	padding_side = "right";
	constructor(e, t) {
		if (super(), this._tokenizerJSON = e, this._tokenizerConfig = t, this._tokenizer = new $a(e, t), this.config = t, this.padding_side = t.padding_side ?? this.padding_side, this.mask_token = iu(t, "mask_token"), this.mask_token_id = this._tokenizer.token_to_id(this.mask_token), this.pad_token = iu(t, "pad_token", "eos_token"), this.pad_token_id = this._tokenizer.token_to_id(this.pad_token), this.sep_token = iu(t, "sep_token"), this.sep_token_id = this._tokenizer.token_to_id(this.sep_token), this.unk_token = iu(t, "unk_token"), this.unk_token_id = this._tokenizer.token_to_id(this.unk_token), this.bos_token = iu(t, "bos_token"), this.bos_token_id = this._tokenizer.token_to_id(this.bos_token), this.eos_token = iu(t, "eos_token"), this.eos_token_id = this._tokenizer.token_to_id(this.eos_token), this.chat_template = t.chat_template ?? null, Array.isArray(this.chat_template)) {
			let e = /* @__PURE__ */ Object.create(null);
			for (let { name: t, template: n } of this.chat_template) {
				if (typeof t != "string" || typeof n != "string") throw Error("Chat template must be a list of objects with \"name\" and \"template\" properties");
				e[t] = n;
			}
			this.chat_template = e;
		}
		this._compiled_template_cache = /* @__PURE__ */ new Map();
		let n = au(this._tokenizer);
		this.all_special_ids = n.map((e) => e.id), this.all_special_tokens = n.map((e) => e.content);
	}
	static async from_pretrained(e, { progress_callback: t = null, config: n = null, cache_dir: r = null, local_files_only: i = !1, revision: a = "main" } = {}) {
		let o = await $l(e, {
			progress_callback: t,
			config: n,
			cache_dir: r,
			local_files_only: i,
			revision: a
		});
		return new this(...o);
	}
	get_vocab() {
		return this._tokenizer.get_vocab();
	}
	get model_max_length() {
		return this._tokenizerConfig.model_max_length ?? Infinity;
	}
	get add_eos_token() {
		return this._tokenizerConfig.add_eos_token;
	}
	get add_bos_token() {
		return this._tokenizerConfig.add_bos_token;
	}
	convert_tokens_to_ids(e) {
		return typeof e == "string" ? this._tokenizer.token_to_id(e) : e.map((e) => this._tokenizer.token_to_id(e));
	}
	_call(e, t = {}) {
		let { text_pair: n = null, add_special_tokens: r = !0, padding: i = !1, return_token_type_ids: a = null } = t, { truncation: o = null, max_length: s = null } = t, c = t.return_tensor ?? !0, l = Array.isArray(e), u;
		if (l) {
			if (e.length === 0) throw Error("text array must be non-empty");
			if (n !== null) {
				if (!Array.isArray(n)) throw Error("text_pair must also be an array");
				if (e.length !== n.length) throw Error("text and text_pair must have the same length");
				u = e.map((e, t) => this._encode_plus(e, {
					text_pair: n[t],
					add_special_tokens: r,
					return_token_type_ids: a
				}));
			} else u = e.map((e) => this._encode_plus(e, {
				add_special_tokens: r,
				return_token_type_ids: a
			}));
		} else {
			if (e == null) throw Error("text may not be null or undefined");
			if (Array.isArray(n)) throw Error("When specifying `text_pair`, since `text` is a string, `text_pair` must also be a string (i.e., not an array).");
			u = [this._encode_plus(e, {
				text_pair: n,
				add_special_tokens: r,
				return_token_type_ids: a
			})];
		}
		if (s === null ? s = this.model_max_length : o === null && (i === !0 ? (A.warn("`max_length` is ignored when `padding: true` and there is no truncation strategy. To pad to max length, use `padding: 'max_length'`."), s = this.model_max_length) : i === !1 && (A.warn("Truncation was not explicitly activated but `max_length` is provided a specific value, please use `truncation: true` to explicitly truncate examples to max length."), o = !0)), i === !0 && (s = Math.min(Ic(u.map((e) => e.input_ids.length))[0], s ?? Infinity)), s = Math.min(s, this.model_max_length ?? Infinity), i || o) for (let e = 0; e < u.length; ++e) if (u[e].input_ids.length === s) continue;
		else u[e].input_ids.length > s ? o && ru(u[e], s) : i && nu(u[e], s, (e) => e === "input_ids" ? this.pad_token_id : 0, this.padding_side);
		let d = {};
		if (c) {
			if (!(i && o) && u.some((e) => {
				for (let t of Object.keys(e)) if (e[t].length !== u[0][t]?.length) return !0;
				return !1;
			})) throw Error("Unable to create tensor, you should probably activate truncation and/or padding with 'padding=true' and 'truncation=true' to have batched tensors with the same length.");
			let e = [u.length, u[0].input_ids.length];
			for (let t of Object.keys(u[0])) d[t] = new V("int64", BigInt64Array.from(u.flatMap((e) => e[t]).map(BigInt)), e);
		} else {
			for (let e of Object.keys(u[0])) d[e] = u.map((t) => t[e]);
			if (!l) for (let e of Object.keys(d)) d[e] = d[e][0];
		}
		return d;
	}
	_encode_text(e) {
		return e === null ? null : this._tokenizer.encode(e).tokens;
	}
	_encode_plus(e, { text_pair: t = null, add_special_tokens: n = !0, return_token_type_ids: r = null } = {}) {
		let { ids: i, attention_mask: a, token_type_ids: o } = this._tokenizer.encode(e, {
			text_pair: t,
			add_special_tokens: n,
			return_token_type_ids: r ?? this.return_token_type_ids
		});
		return {
			input_ids: i,
			attention_mask: a,
			...o ? { token_type_ids: o } : {}
		};
	}
	tokenize(e, { pair: t = null, add_special_tokens: n = !1 } = {}) {
		return this._tokenizer.tokenize(e, {
			text_pair: t,
			add_special_tokens: n
		});
	}
	encode(e, { text_pair: t = null, add_special_tokens: n = !0, return_token_type_ids: r = null } = {}) {
		return this._tokenizer.encode(e, {
			text_pair: t,
			add_special_tokens: n,
			return_token_type_ids: r
		}).ids;
	}
	batch_decode(e, t = {}) {
		return e instanceof V && (e = e.tolist()), e.map((e) => this.decode(e, t));
	}
	decode(e, t = {}) {
		if (e instanceof V && (e = eu(e)), !Array.isArray(e) || e.length === 0 || !kr(e[0])) throw Error("token_ids must be a non-empty array of integers.");
		return this.decode_single(e, t);
	}
	decode_single(e, { skip_special_tokens: t = !1, clean_up_tokenization_spaces: n = null }) {
		return this._tokenizer.decode(e, {
			skip_special_tokens: t,
			clean_up_tokenization_spaces: n
		});
	}
	get_chat_template({ chat_template: e = null, tools: t = null } = {}) {
		if (this.chat_template && typeof this.chat_template == "object") {
			let n = this.chat_template;
			if (e !== null && Object.hasOwn(n, e)) e = n[e];
			else if (e === null) {
				if (t !== null && "tool_use" in n) e = n.tool_use;
				else if ("default" in n) e = n.default;
				else throw Error(`This model has multiple chat templates with no default specified! Please either pass a chat template or the name of the template you wish to use to the 'chat_template' argument. Available template names are ${Object.keys(n).sort()}.`);
			}
		} else if (e === null) {
			if (this.chat_template) e = this.chat_template;
			else throw Error("Cannot use apply_chat_template() because tokenizer.chat_template is not set and no template argument was passed! For information about writing templates and setting the tokenizer.chat_template attribute, please see the documentation at https://huggingface.co/docs/transformers/main/en/chat_templating");
		}
		return e;
	}
	apply_chat_template(e, t = {}) {
		let { tools: n = null, documents: r = null, chat_template: i = null, add_generation_prompt: a = !1, tokenize: o = !0, padding: s = !1, truncation: c = !1, max_length: l = null, return_tensor: u = !0, return_dict: d = !0, tokenizer_kwargs: f = {}, ...p } = t;
		if (i = this.get_chat_template({
			chat_template: i,
			tools: n
		}), typeof i != "string") throw Error(`chat_template must be a string, but got ${typeof i}`);
		let m = this._compiled_template_cache.get(i);
		m === void 0 && (m = new Vs(i), this._compiled_template_cache.set(i, m));
		let h = /* @__PURE__ */ Object.create(null);
		for (let e of tu) {
			let t = iu(this.config, e);
			t && (h[e] = t);
		}
		let g = m.render({
			messages: e,
			add_generation_prompt: a,
			tools: n,
			documents: r,
			...h,
			...p
		});
		if (o) {
			let e = this._call(g, {
				add_special_tokens: !1,
				padding: s,
				truncation: c,
				max_length: l,
				return_tensor: u,
				...f
			});
			return d ? e : e.input_ids;
		}
		return g;
	}
};
function ou(e, t, n, r) {
	if (!("language_codes" in e) || !Array.isArray(e.language_codes)) throw Error("Tokenizer must have `language_codes` attribute set and it should be an array of language ids.");
	if (!("languageRegex" in e) || !(e.languageRegex instanceof RegExp)) throw Error("Tokenizer must have `languageRegex` attribute set and it should be a regular expression.");
	if (!("lang_to_token" in e) || typeof e.lang_to_token != "function") throw Error("Tokenizer must have `lang_to_token` attribute set and it should be a function.");
	let i = r.src_lang, a = r.tgt_lang;
	if (!e.language_codes.includes(a)) throw Error(`Target language code "${a}" is not valid. Must be one of: {${e.language_codes.join(", ")}}`);
	if (i !== void 0) {
		if (!e.language_codes.includes(i)) throw Error(`Source language code "${i}" is not valid. Must be one of: {${e.language_codes.join(", ")}}`);
		let t = e._tokenizer.post_processor?.config;
		if (t && "single" in t) {
			for (let n of t.single) if ("SpecialToken" in n && e.languageRegex.test(n.SpecialToken.id)) {
				n.SpecialToken.id = e.lang_to_token(i);
				break;
			}
		}
	}
	return r.forced_bos_token_id = e._tokenizer.token_to_id(e.lang_to_token(a)), e._call(t, n);
}
var su = {};
Yn(su, {
	AlbertTokenizer: () => cu,
	AutoTokenizer: () => W,
	BartTokenizer: () => lu,
	BertTokenizer: () => uu,
	BlenderbotSmallTokenizer: () => du,
	BlenderbotTokenizer: () => fu,
	BloomTokenizer: () => pu,
	CLIPTokenizer: () => hu,
	CamembertTokenizer: () => mu,
	CodeGenTokenizer: () => _u,
	CodeLlamaTokenizer: () => gu,
	CohereAsrTokenizer: () => yu,
	CohereTokenizer: () => vu,
	ConvBertTokenizer: () => bu,
	DebertaTokenizer: () => Su,
	DebertaV2Tokenizer: () => xu,
	DistilBertTokenizer: () => Cu,
	ElectraTokenizer: () => wu,
	EsmTokenizer: () => Tu,
	FalconTokenizer: () => Eu,
	GPT2Tokenizer: () => ku,
	GPTNeoXTokenizer: () => Ou,
	GemmaTokenizer: () => Du,
	HerbertTokenizer: () => Au,
	LlamaTokenizer: () => ju,
	M2M100Tokenizer: () => Mu,
	MBart50Tokenizer: () => Fu,
	MBartTokenizer: () => Pu,
	MPNetTokenizer: () => Ru,
	MarianTokenizer: () => Nu,
	MgpstrTokenizer: () => Iu,
	MobileBertTokenizer: () => Lu,
	NllbTokenizer: () => zu,
	NougatTokenizer: () => Bu,
	PreTrainedTokenizer: () => U,
	Qwen2Tokenizer: () => Vu,
	RoFormerTokenizer: () => Uu,
	RobertaTokenizer: () => Hu,
	SiglipTokenizer: () => Wu,
	SpeechT5Tokenizer: () => Gu,
	SqueezeBertTokenizer: () => Ku,
	T5Tokenizer: () => qu,
	TokenizersBackend: () => U,
	VitsTokenizer: () => Yu,
	Wav2Vec2CTCTokenizer: () => Xu,
	WhisperTokenizer: () => rd,
	XLMRobertaTokenizer: () => id,
	XLMTokenizer: () => ad
});
var cu = class extends U {
	return_token_type_ids = !0;
}, lu = class extends U {}, uu = class extends U {
	return_token_type_ids = !0;
}, du = class extends U {}, fu = class extends U {}, pu = class extends U {}, mu = class extends U {}, hu = class extends U {}, gu = class extends U {}, _u = class extends U {}, vu = class extends U {}, yu = class extends U {}, bu = class extends U {
	return_token_type_ids = !0;
}, xu = class extends U {
	return_token_type_ids = !0;
}, Su = class extends U {
	return_token_type_ids = !0;
}, Cu = class extends U {}, wu = class extends U {
	return_token_type_ids = !0;
}, Tu = class extends U {}, Eu = class extends U {}, Du = class extends U {}, Ou = class extends U {}, ku = class extends U {}, Au = class extends U {
	return_token_type_ids = !0;
}, ju = class extends U {
	padding_side = "left";
}, Mu = class extends U {
	constructor(e, t) {
		super(e, t), this.languageRegex = /^__[a-z]{2,3}__$/, this.language_codes = this.all_special_tokens.filter((e) => this.languageRegex.test(e)).map((e) => e.slice(2, -2)), this.lang_to_token = (e) => `__${e}__`;
	}
	_build_translation_inputs(e, t, n) {
		return ou(this, e, t, n);
	}
}, Nu = class extends U {
	constructor(e, t) {
		super(e, t), this.languageRegex = /^(>>\w+<<)\s*/g, this.supported_language_codes = Array.from(this.get_vocab().keys()).filter((e) => this.languageRegex.test(e)), A.warn("WARNING: `MarianTokenizer` is not yet supported by Hugging Face's \"fast\" tokenizers library. Therefore, you may experience slightly inaccurate results.");
	}
	_encode_text(e) {
		if (e === null) return null;
		let [t, ...n] = e.trim().split(this.languageRegex);
		if (n.length === 0) return super._encode_text(t);
		if (n.length === 2) {
			let [e, t] = n;
			return this.supported_language_codes.includes(e) || A.warn(`Unsupported language code "${e}" detected, which may lead to unexpected behavior. Should be one of: ${JSON.stringify(this.supported_language_codes)}`), Mr([e], super._encode_text(t));
		}
	}
}, Pu = class extends U {
	constructor(e, t) {
		super(e, t), this.languageRegex = /^[a-z]{2}_[A-Z]{2}$/, this.language_codes = this.all_special_tokens.filter((e) => this.languageRegex.test(e)).map((e) => e), this.lang_to_token = (e) => e;
	}
	_build_translation_inputs(e, t, n) {
		return ou(this, e, t, n);
	}
}, Fu = class extends Pu {}, Iu = class extends U {}, Lu = class extends U {
	return_token_type_ids = !0;
}, Ru = class extends U {}, zu = class extends U {
	constructor(e, t) {
		super(e, t), this.languageRegex = /^[a-z]{3}_[A-Z][a-z]{3}$/, this.language_codes = this.all_special_tokens.filter((e) => this.languageRegex.test(e)), this.lang_to_token = (e) => e;
	}
	_build_translation_inputs(e, t, n) {
		return ou(this, e, t, n);
	}
}, Bu = class extends U {}, Vu = class extends U {}, Hu = class extends U {}, Uu = class extends U {
	return_token_type_ids = !0;
}, Wu = class extends U {}, Gu = class extends U {}, Ku = class extends U {
	return_token_type_ids = !0;
}, qu = class extends U {}, Ju = class extends Ba {
	decode_chain(e) {
		let t = "";
		for (let n = 1; n < e.length; n += 2) t += e[n];
		return [t];
	}
}, Yu = class extends U {
	constructor(e, t) {
		super(e, t), this._tokenizer.decoder = new Ju({ type: "VitsDecoder" });
	}
}, Xu = class extends U {}, Zu = [
	["en", "english"],
	["zh", "chinese"],
	["de", "german"],
	["es", "spanish"],
	["ru", "russian"],
	["ko", "korean"],
	["fr", "french"],
	["ja", "japanese"],
	["pt", "portuguese"],
	["tr", "turkish"],
	["pl", "polish"],
	["ca", "catalan"],
	["nl", "dutch"],
	["ar", "arabic"],
	["sv", "swedish"],
	["it", "italian"],
	["id", "indonesian"],
	["hi", "hindi"],
	["fi", "finnish"],
	["vi", "vietnamese"],
	["he", "hebrew"],
	["uk", "ukrainian"],
	["el", "greek"],
	["ms", "malay"],
	["cs", "czech"],
	["ro", "romanian"],
	["da", "danish"],
	["hu", "hungarian"],
	["ta", "tamil"],
	["no", "norwegian"],
	["th", "thai"],
	["ur", "urdu"],
	["hr", "croatian"],
	["bg", "bulgarian"],
	["lt", "lithuanian"],
	["la", "latin"],
	["mi", "maori"],
	["ml", "malayalam"],
	["cy", "welsh"],
	["sk", "slovak"],
	["te", "telugu"],
	["fa", "persian"],
	["lv", "latvian"],
	["bn", "bengali"],
	["sr", "serbian"],
	["az", "azerbaijani"],
	["sl", "slovenian"],
	["kn", "kannada"],
	["et", "estonian"],
	["mk", "macedonian"],
	["br", "breton"],
	["eu", "basque"],
	["is", "icelandic"],
	["hy", "armenian"],
	["ne", "nepali"],
	["mn", "mongolian"],
	["bs", "bosnian"],
	["kk", "kazakh"],
	["sq", "albanian"],
	["sw", "swahili"],
	["gl", "galician"],
	["mr", "marathi"],
	["pa", "punjabi"],
	["si", "sinhala"],
	["km", "khmer"],
	["sn", "shona"],
	["yo", "yoruba"],
	["so", "somali"],
	["af", "afrikaans"],
	["oc", "occitan"],
	["ka", "georgian"],
	["be", "belarusian"],
	["tg", "tajik"],
	["sd", "sindhi"],
	["gu", "gujarati"],
	["am", "amharic"],
	["yi", "yiddish"],
	["lo", "lao"],
	["uz", "uzbek"],
	["fo", "faroese"],
	["ht", "haitian creole"],
	["ps", "pashto"],
	["tk", "turkmen"],
	["nn", "nynorsk"],
	["mt", "maltese"],
	["sa", "sanskrit"],
	["lb", "luxembourgish"],
	["my", "myanmar"],
	["bo", "tibetan"],
	["tl", "tagalog"],
	["mg", "malagasy"],
	["as", "assamese"],
	["tt", "tatar"],
	["haw", "hawaiian"],
	["ln", "lingala"],
	["ha", "hausa"],
	["ba", "bashkir"],
	["jw", "javanese"],
	["su", "sundanese"]
], Qu = new Map(Zu), $u = new Map([
	...Zu.map(([e, t]) => [t, e]),
	["burmese", "my"],
	["valencian", "ca"],
	["flemish", "nl"],
	["haitian", "ht"],
	["letzeburgesch", "lb"],
	["pushto", "ps"],
	["panjabi", "pa"],
	["moldavian", "ro"],
	["moldovan", "ro"],
	["sinhalese", "si"],
	["castilian", "es"]
]);
function ed(e) {
	e = e.toLowerCase();
	let t = $u.get(e);
	if (t === void 0) {
		let n = e.match(/^<\|([a-z]{2})\|>$/);
		if (n && (e = n[1]), Qu.has(e)) t = e;
		else {
			let t = e.length === 2 ? Qu.keys() : Qu.values();
			throw Error(`Language "${e}" is not supported. Must be one of: ${JSON.stringify(Array.from(t))}`);
		}
	}
	return t;
}
var td = /* @__PURE__ */ RegExp("^[\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E]+$", "gu"), nd = .1, rd = class extends U {
	get timestamp_begin() {
		return this._tokenizer.token_to_id("<|notimestamps|>") + 1;
	}
	_decode_asr(e, { return_timestamps: t = !1, return_language: n = !1, time_precision: r = null, force_full_sequences: i = !0 } = {}) {
		if (r === null) throw Error("Must specify time_precision");
		let a = null, o = t === "word";
		function s() {
			return {
				language: a,
				timestamp: [null, null],
				text: ""
			};
		}
		let c = [], l = s(), u = 0, d = this.timestamp_begin, f = d + 1500, p = [], m = [], h = !1, g = null, _ = new Set(this.all_special_ids);
		for (let n of e) {
			let e = n.tokens, i = o ? n.token_timestamps : null, v = null, y = d;
			if ("stride" in n) {
				let [t, i, a] = n.stride;
				if (u -= i, g = t - a, i && (y = i / r + d), a) for (let t = e.length - 1; t >= 0; --t) {
					let n = Number(e[t]);
					if (n >= d) {
						if (v !== null && (n - d) * r < g) break;
						v = n;
					}
				}
			}
			let b = [], x = [];
			for (let n = 0; n < e.length; ++n) {
				let g = Number(e[n]);
				if (_.has(g)) {
					let e = this.decode([g]), n = Qu.get(e.slice(2, -2));
					if (n !== void 0) {
						if (a !== null && n !== a && !t) {
							p.push(b);
							let e = this.findLongestCommonSequence(p)[0], t = this.decode(e);
							l.text = t, c.push(l), p = [], b = [], l = s();
						}
						a = l.language = n;
					}
				} else if (g >= d && g <= f) {
					let e = Hc((g - d) * r + u, 2);
					if (v !== null && g >= v) h = !0;
					else if (h || p.length > 0 && g < y) h = !1;
					else if (l.timestamp[0] === null) l.timestamp[0] = e;
					else if (e !== l.timestamp[0]) {
						l.timestamp[1] = e, p.push(b), o && m.push(x);
						let [t, n] = this.findLongestCommonSequence(p, m), r = this.decode(t);
						if (l.text = r, o && (l.words = this.collateWordTimestamps(t, n, a), l.words.length > 0 && l.timestamp[1] !== null)) for (let e of l.words) e.timestamp[1] > l.timestamp[1] && l.timestamp[1] >= e.timestamp[0] && (e.timestamp[1] = l.timestamp[1]);
						c.push(l), p = [], b = [], m = [], x = [], l = s();
					}
				} else if (b.push(g), o) {
					let e = Hc(i[n] + u, 2), t;
					if (n + 1 < i.length) {
						t = Hc(i[n + 1] + u, 2);
						let a = this.decode([g]);
						td.test(a) && (t = Hc(Math.min(e + r, t), 2));
					} else t = null;
					x.push([e, t]);
				}
			}
			if ("stride" in n) {
				let [e, t, r] = n.stride;
				u += e - r;
			}
			b.length > 0 ? (p.push(b), o && m.push(x)) : p.every((e) => e.length === 0) && (l = s(), p = [], b = [], m = [], x = []);
		}
		if (p.length > 0) {
			if (i && t) throw Error("Whisper did not predict an ending timestamp, which can happen if audio is cut off in the middle of a word. Also make sure WhisperTimeStampLogitsProcessor was used during generation.");
			let [e, n] = this.findLongestCommonSequence(p, m), r = this.decode(e);
			l.text = r, o && (l.words = this.collateWordTimestamps(e, n, a)), c.push(l);
		}
		let v = /* @__PURE__ */ Object.create(null), y = c.map((e) => e.text).join("");
		if (t || n) {
			for (let e = 0; e < c.length; ++e) {
				let r = c[e];
				t || delete r.timestamp, n || delete r.language;
			}
			if (o) {
				let e = [];
				for (let t of c) for (let n of t.words) e.push(n);
				v = { chunks: e };
			} else v = { chunks: c };
		}
		return [y, v];
	}
	findLongestCommonSequence(e, t = null) {
		let n = e[0], r = n.length, i = [], a = Array.isArray(t) && t.length > 0, o = a ? [] : null, s = a ? t[0] : null;
		for (let c = 1; c < e.length; ++c) {
			let l = e[c], u = 0, d = [
				r,
				r,
				0,
				0
			], f = l.length;
			for (let e = 1; e < r + f; ++e) {
				let i = Math.max(0, r - e), o = Math.min(r, r + f - e), p = n.slice(i, o), m = Math.max(0, e - r), h = Math.min(f, e), g = l.slice(m, h);
				if (p.length !== g.length) throw Error("There is a bug within whisper `decode_asr` function, please report it. Dropping to prevent bad inference.");
				let _;
				_ = a ? p.filter((e, n) => e === g[n] && s[i + n][0] - nd <= t[c][m + n][0]).length : p.filter((e, t) => e === g[t]).length;
				let v = e / 1e4, y = _ / e + v;
				_ > 1 && y > u && (u = y, d = [
					i,
					o,
					m,
					h
				]);
			}
			let [p, m, h, g] = d, _ = Math.floor((m + p) / 2), v = Math.floor((g + h) / 2);
			if (a && u === 0 && r > 0) {
				let e = s[r - 1][0], n = t[c].findIndex((t) => t[0] >= e);
				v = n === -1 ? l.length : n;
			}
			i.push(...n.slice(0, _)), n = l.slice(v), r = n.length, a && (o.push(...s.slice(0, _)), s = t[c].slice(v));
		}
		return i.push(...n), a ? (o.push(...s), [i, o]) : [i, []];
	}
	collateWordTimestamps(e, t, n) {
		let [r, i, a] = this.combineTokensIntoWords(e, n), o = [];
		for (let e = 0; e < r.length; ++e) {
			let n = a[e];
			o.push({
				text: r[e],
				timestamp: [t[n.at(0)][0], t[n.at(-1)][1]]
			});
		}
		return o;
	}
	combineTokensIntoWords(e, t, n = "\"'“¡¿([{-", r = "\"'.。,，!！?？:：”)]}、") {
		t ??= "english";
		let i, a, o;
		return [
			"chinese",
			"japanese",
			"thai",
			"lao",
			"myanmar"
		].includes(t) ? [i, a, o] = this.splitTokensOnUnicode(e) : [i, a, o] = this.splitTokensOnSpaces(e), this.mergePunctuations(i, a, o, n, r);
	}
	decode(e, t) {
		let n;
		return t?.decode_with_timestamps ? (e instanceof V && (e = eu(e)), n = this.decodeWithTimestamps(e, t)) : n = super.decode(e, t), n;
	}
	decodeWithTimestamps(e, t) {
		let n = t?.time_precision ?? .02, r = this.all_special_ids.at(-1) + 1, i = [[]];
		for (let t of e) if (t = Number(t), t >= r) {
			let e = ((t - r) * n).toFixed(2);
			i.push(`<|${e}|>`), i.push([]);
		} else i[i.length - 1].push(t);
		return i = i.map((e) => typeof e == "string" ? e : super.decode(e, t)), i.join("");
	}
	splitTokensOnUnicode(e) {
		let t = this.decode(e, { decode_with_timestamps: !0 }), n = [], r = [], i = [], a = [], o = [], s = 0;
		for (let c = 0; c < e.length; ++c) {
			let l = e[c];
			a.push(l), o.push(c);
			let u = this.decode(a, { decode_with_timestamps: !0 });
			(!u.includes("�") || t[s + u.indexOf("�")] === "�") && (n.push(u), r.push(a), i.push(o), a = [], o = [], s += u.length);
		}
		return [
			n,
			r,
			i
		];
	}
	splitTokensOnSpaces(e) {
		let [t, n, r] = this.splitTokensOnUnicode(e), i = [], a = [], o = [];
		for (let e = 0; e < t.length; ++e) {
			let s = t[e], c = n[e], l = r[e], u = c[0] >= this._tokenizer.token_to_id("<|endoftext|>"), d = s.startsWith(" "), f = s.trim(), p = td.test(f);
			if (u || d || p || i.length === 0) i.push(s), a.push(c), o.push(l);
			else {
				let e = i.length - 1;
				i[e] += s, a[e].push(...c), o[e].push(...l);
			}
		}
		return [
			i,
			a,
			o
		];
	}
	mergePunctuations(e, t, n, r, i) {
		let a = structuredClone(e), o = structuredClone(t), s = structuredClone(n), c = a.length - 2, l = a.length - 1;
		for (; c >= 0;) a[c].startsWith(" ") && r.includes(a[c].trim()) ? (a[l] = a[c] + a[l], o[l] = Mr(o[c], o[l]), s[l] = Mr(s[c], s[l]), a[c] = "", o[c] = [], s[c] = []) : l = c, --c;
		for (c = 0, l = 1; l < a.length;) !a[c].endsWith(" ") && i.includes(a[l]) ? (a[c] += a[l], o[c] = Mr(o[c], o[l]), s[c] = Mr(s[c], s[l]), a[l] = "", o[l] = [], s[l] = []) : c = l, ++l;
		return [
			a.filter((e) => e),
			o.filter((e) => e.length > 0),
			s.filter((e) => e.length > 0)
		];
	}
}, id = class extends U {}, ad = class extends U {
	return_token_type_ids = !0;
	constructor(e, t) {
		super(e, t), A.warn("WARNING: `XLMTokenizer` is not yet supported by Hugging Face's \"fast\" tokenizers library. Therefore, you may experience slightly inaccurate results.");
	}
}, W = class {
	static async from_pretrained(e, { progress_callback: t = null, config: n = null, cache_dir: r = null, local_files_only: i = !1, revision: a = "main" } = {}) {
		let [o, s] = await $l(e, {
			progress_callback: t,
			config: n,
			cache_dir: r,
			local_files_only: i,
			revision: a
		}), c = s.tokenizer_class?.replace(/Fast$/, "") ?? "PreTrainedTokenizer", l = su[c];
		return l ||= (A.warn(`Unknown tokenizer class "${c}", attempting to construct from base class.`), U), new l(o, s);
	}
}, od = "https://github.com/huggingface/transformers.js/issues/new/choose", sd = "preprocessor_config.json", cd = "preprocessor_config.json", ld = "processor_config.json", ud = "chat_template.jinja", G = class extends Er {
	static classes = [
		"image_processor_class",
		"tokenizer_class",
		"feature_extractor_class"
	];
	static uses_processor_config = !1;
	static uses_chat_template_file = !1;
	constructor(e, t, n) {
		super(), this.config = e, this.components = t, this.chat_template = n;
	}
	get image_processor() {
		return this.components.image_processor;
	}
	get tokenizer() {
		return this.components.tokenizer;
	}
	get feature_extractor() {
		return this.components.feature_extractor;
	}
	apply_chat_template(e, t = {}) {
		if (!this.tokenizer) throw Error("Unable to apply chat template without a tokenizer.");
		return this.tokenizer.apply_chat_template(e, {
			tokenize: !1,
			chat_template: this.chat_template ?? void 0,
			...t
		});
	}
	batch_decode(...e) {
		if (!this.tokenizer) throw Error("Unable to decode without a tokenizer.");
		return this.tokenizer.batch_decode(...e);
	}
	decode(...e) {
		if (!this.tokenizer) throw Error("Unable to decode without a tokenizer.");
		return this.tokenizer.decode(...e);
	}
	async _call(e, ...t) {
		for (let n of [
			this.image_processor,
			this.feature_extractor,
			this.tokenizer
		]) if (n) return n(e, ...t);
		throw Error("No image processor, feature extractor, or tokenizer found.");
	}
	static async from_pretrained(e, t = {}) {
		let [n, r, i] = await Promise.all([
			this.uses_processor_config ? Ac(e, ld, !0, t) : {},
			Promise.all(this.classes.filter((e) => e in this).map(async (n) => {
				let r = await this[n].from_pretrained(e, t);
				return [n.replace(/_class$/, ""), r];
			})).then(Object.fromEntries),
			this.uses_chat_template_file ? kc(e, ud, !0, t) : null
		]);
		return new this(n, r, i);
	}
}, dd = {};
Yn(dd, {
	ChatterboxProcessor: () => of,
	CohereAsrProcessor: () => cf,
	Florence2Processor: () => Xp,
	Gemma3Processor: () => Zp,
	Gemma3nProcessor: () => Qp,
	Gemma4Processor: () => $p,
	Glm46VProcessor: () => tm,
	GraniteSpeechProcessor: () => nm,
	GroundingDinoProcessor: () => im,
	Idefics3Processor: () => cm,
	JinaCLIPProcessor: () => um,
	Lfm2VlProcessor: () => dm,
	LlavaProcessor: () => fm,
	MgpstrProcessor: () => mm,
	MoonshineProcessor: () => hm,
	OwlViTProcessor: () => gm,
	PaliGemmaProcessor: () => ym,
	Phi3VProcessor: () => Sm,
	PixtralProcessor: () => Cm,
	Processor: () => G,
	PyAnnoteProcessor: () => wm,
	Qwen2VLProcessor: () => em,
	Qwen2_5_VLProcessor: () => Tm,
	Qwen3VLProcessor: () => Em,
	Sam2Processor: () => Om,
	Sam2VideoProcessor: () => km,
	SamProcessor: () => Dm,
	SmolVLMProcessor: () => cm,
	SpeechT5Processor: () => Am,
	UltravoxProcessor: () => jm,
	VLChatProcessor: () => lm,
	VoxtralProcessor: () => Im,
	VoxtralRealtimeProcessor: () => Hm,
	Wav2Vec2Processor: () => Um,
	Wav2Vec2ProcessorWithLM: () => Wm,
	WhisperProcessor: () => Gm
});
var fd = class extends Er {
	constructor(e) {
		super(), this.config = e;
	}
	static async from_pretrained(e, t = {}) {
		let n = await Ac(e, sd, !0, t);
		return new this(n);
	}
};
function pd(e, t) {
	if (!(e instanceof Float32Array || e instanceof Float64Array)) throw Error(`${t} expects input to be a Float32Array or a Float64Array, but got ${e?.constructor?.name ?? typeof e} instead. If using the feature extractor directly, remember to use \`load_audio(url, sampling_rate)\` to obtain the raw audio data of the file/url.`);
}
var md = {};
Yn(md, {
	ASTFeatureExtractor: () => Rd,
	ChatterboxFeatureExtractor: () => Bd,
	ClapFeatureExtractor: () => Vd,
	CohereAsrFeatureExtractor: () => Wd,
	DacFeatureExtractor: () => Gd,
	EncodecFeatureExtractor: () => zd,
	FeatureExtractor: () => fd,
	Gemma3nAudioFeatureExtractor: () => Kd,
	Gemma4AudioFeatureExtractor: () => qd,
	GraniteSpeechFeatureExtractor: () => Jd,
	MoonshineFeatureExtractor: () => Yd,
	ParakeetFeatureExtractor: () => Ud,
	PyAnnoteFeatureExtractor: () => Xd,
	SeamlessM4TFeatureExtractor: () => Zd,
	SnacFeatureExtractor: () => Qd,
	SpeechT5FeatureExtractor: () => $d,
	VoxtralRealtimeFeatureExtractor: () => nf,
	Wav2Vec2FeatureExtractor: () => ef,
	WeSpeakerFeatureExtractor: () => tf,
	WhisperFeatureExtractor: () => rf
});
var hd = { fromWeb: () => {} };
async function gd(e, t) {
	if (O.IS_BROWSER_ENV) {
		if (O.IS_WEBWORKER_ENV) throw Error("Unable to save a file from a Web Worker.");
		let n = URL.createObjectURL(t), r = document.createElement("a");
		r.href = n, r.download = e, r.click(), r.remove(), URL.revokeObjectURL(n);
	} else if (O.IS_FS_AVAILABLE) {
		let n = t.stream();
		hd.fromWeb(n), Xn.createWriteStream(e), await void 0;
	} else throw Error("Unable to save because filesystem is disabled in this environment.");
}
async function _d(e, t) {
	if (typeof AudioContext > "u") throw Error("Unable to load audio from path/URL since `AudioContext` is not available in your environment. Instead, audio data should be passed directly to the pipeline/processor. For more information and some example code, see https://huggingface.co/docs/transformers.js/guides/node-audio-processing.");
	let n = await (await xc(e)).arrayBuffer(), r = new AudioContext({ sampleRate: t });
	t === void 0 && A.warn(`No sampling rate provided, using default of ${r.sampleRate}Hz.`);
	let i = await r.decodeAudioData(n), a;
	if (i.numberOfChannels === 2) {
		let e = Math.sqrt(2), t = i.getChannelData(0), n = i.getChannelData(1);
		a = new Float32Array(t.length);
		for (let r = 0; r < i.length; ++r) a[r] = e * (t[r] + n[r]) / 2;
	} else a = i.getChannelData(0);
	return a;
}
async function vd(e, t) {
	return await _d(e, t);
}
function yd(e, t) {
	if (e < 1) return /* @__PURE__ */ new Float64Array();
	if (e === 1) return new Float64Array([1]);
	let n = 1 - t, r = 2 * Math.PI / (e - 1), i = new Float64Array(e);
	for (let a = 0; a < e; ++a) i[a] = t - n * Math.cos(a * r);
	return i;
}
function bd(e) {
	return yd(e, .5);
}
function xd(e) {
	return yd(e, .54);
}
var Sd = {
	htk: (e) => 2595 * Math.log10(1 + e / 700),
	kaldi: (e) => 1127 * Math.log(1 + e / 700),
	slaney: (e, t = 1e3, n = 15, r = 27 / Math.log(6.4)) => e >= t ? n + Math.log(e / t) * r : 3 * e / 200
};
function Cd(e, t = "htk") {
	let n = Sd[t];
	if (!n) throw Error("mel_scale should be one of \"htk\", \"slaney\" or \"kaldi\".");
	return typeof e == "number" ? n(e) : e.map((e) => n(e));
}
var wd = {
	htk: (e) => 700 * (10 ** (e / 2595) - 1),
	kaldi: (e) => 700 * (Math.exp(e / 1127) - 1),
	slaney: (e, t = 1e3, n = 15, r = Math.log(6.4) / 27) => e >= n ? t * Math.exp(r * (e - n)) : 200 * e / 3
};
function Td(e, t = "htk") {
	let n = wd[t];
	if (!n) throw Error("mel_scale should be one of \"htk\", \"slaney\" or \"kaldi\".");
	return typeof e == "number" ? n(e) : e.map((e) => n(e));
}
function Ed(e, t) {
	let n = Float64Array.from({ length: t.length - 1 }, (e, n) => t[n + 1] - t[n]), r = Array.from({ length: e.length }, () => Array(t.length));
	for (let n = 0; n < e.length; ++n) {
		let i = r[n];
		for (let r = 0; r < t.length; ++r) i[r] = t[r] - e[n];
	}
	let i = t.length - 2, a = Array.from({ length: i }, () => Array(e.length));
	for (let t = 0; t < e.length; ++t) {
		let e = r[t];
		for (let r = 0; r < i; ++r) {
			let i = -e[r] / n[r], o = e[r + 2] / n[r + 1];
			a[r][t] = Math.max(0, Math.min(i, o));
		}
	}
	return a;
}
function Dd(e, t, n) {
	let r = (t - e) / (n - 1);
	return Float64Array.from({ length: n }, (t, n) => e + r * n);
}
function Od(e, t, n, r, i, a = null, o = "htk", s = !1) {
	if (a !== null && a !== "slaney") throw Error("norm must be one of null or \"slaney\"");
	if (e < 2) throw Error(`Require num_frequency_bins: ${e} >= 2`);
	if (n > r) throw Error(`Require min_frequency: ${n} <= max_frequency: ${r}`);
	let c = Dd(Cd(n, o), Cd(r, o), t + 2), l = Td(c, o), u;
	if (s) {
		let t = i / ((e - 1) * 2);
		u = Cd(Float64Array.from({ length: e }, (e, n) => n * t), o), l = c;
	} else u = Dd(0, Math.floor(i / 2), e);
	let d = Ed(u, l);
	if (a !== null && a === "slaney") for (let n = 0; n < t; ++n) {
		let t = d[n], r = 2 / (l[n + 2] - l[n]);
		for (let n = 0; n < e; ++n) t[n] *= r;
	}
	return d;
}
function kd(e, t, n) {
	let r = new e.constructor(e.length + t + n), i = e.length - 1;
	for (let n = 0; n < e.length; ++n) r[t + n] = e[n];
	for (let n = 1; n <= t; ++n) r[t - n] = e[Pr(n, i)];
	for (let a = 1; a <= n; ++a) r[i + t + a] = e[Pr(i - a, i)];
	return r;
}
function Ad(e, t, n, r, i) {
	if (n <= 0) throw Error("reference must be greater than zero");
	if (r <= 0) throw Error("min_value must be greater than zero");
	n = Math.max(r, n);
	let a = Math.log10(n);
	for (let n = 0; n < e.length; ++n) e[n] = t * Math.log10(Math.max(r, e[n]) - a);
	if (i !== null) {
		if (i <= 0) throw Error("db_range must be greater than zero");
		let t = Ic(e)[0] - i;
		for (let n = 0; n < e.length; ++n) e[n] = Math.max(e[n], t);
	}
	return e;
}
function jd(e, t = 1, n = 1e-5, r = null) {
	return Ad(e, 20, t, n, r);
}
function Md(e, t = 1, n = 1e-10, r = null) {
	return Ad(e, 10, t, n, r);
}
async function Nd(e, t, n, r, { fft_length: i = null, power: a = 1, center: o = !0, pad_mode: s = "reflect", onesided: c = !0, preemphasis: l = null, preemphasis_htk_flavor: u = !0, mel_filters: d = null, mel_floor: f = 1e-10, log_mel: p = null, max_log_mel: m = null, reference: h = 1, min_value: g = 1e-10, db_range: _ = null, remove_dc_offset: v = null, min_num_frames: y = null, max_num_frames: b = null, do_pad: x = !0, transpose: S = !1, mel_offset: C = 0, mel_floor_mode: ee = "clamp" } = {}) {
	let w = t.length;
	if (i === null && (i = n), n > i) throw Error(`frame_length (${n}) may not be larger than fft_length (${i})`);
	if (w !== n) throw Error(`Length of the window (${w}) must equal frame_length (${n})`);
	if (r <= 0) throw Error("hop_length must be greater than zero");
	if (a === null && d !== null) throw Error("You have provided `mel_filters` but `power` is `None`. Mel spectrogram computation is not yet supported for complex-valued spectrogram. Specify `power` to fix this issue.");
	if (!u) throw Error("`preemphasis_htk_flavor=false` is not currently supported.");
	if (o) {
		let t = Math.floor(n / 2);
		switch (s) {
			case "reflect":
				e = kd(e, t, t);
				break;
			case "constant": {
				let n = new e.constructor(e.length + 2 * t);
				n.set(e, t), e = n;
				break;
			}
			case "semicausal": {
				let n = new e.constructor(e.length + t);
				n.set(e, t), e = n;
				break;
			}
			default: throw Error(`pad_mode="${s}" not implemented yet.`);
		}
	}
	let te = Math.floor(1 + Math.floor((e.length - n) / r));
	y !== null && te < y && (te = y);
	let ne = c ? Math.floor(i / 2) + 1 : i, re = te, ie = te;
	b !== null && (b > te ? x && (ie = b) : ie = re = b);
	let ae = new Bc(i), oe = new Float64Array(i), se = new Float64Array(ae.outputBufferSize), ce = new Float32Array(ne * ie);
	for (let i = 0; i < re; ++i) {
		let a = i * r, o = Math.min(e.length - a, n);
		o !== n && oe.fill(0, 0, n);
		for (let t = 0; t < o; ++t) oe[t] = e[a + t];
		if (v) {
			let e = 0;
			for (let t = 0; t < o; ++t) e += oe[t];
			let t = e / o;
			for (let e = 0; e < o; ++e) oe[e] -= t;
		}
		if (l !== null) {
			for (let e = o - 1; e >= 1; --e) oe[e] -= l * oe[e - 1];
			oe[0] *= 1 - l;
		}
		for (let e = 0; e < t.length; ++e) oe[e] *= t[e];
		ae.realTransform(se, oe);
		for (let e = 0; e < ne; ++e) {
			let t = e << 1;
			ce[e * ie + i] = se[t] ** 2 + se[t + 1] ** 2;
		}
	}
	if (a !== null && a !== 2) {
		let e = a / 2;
		for (let t = 0; t < ce.length; ++t) ce[t] **= e;
	}
	let le = d.length, ue = await Al(new V("float32", d.flat(), [le, ne]), new V("float32", ce, [ne, ie]));
	S && (ue = ue.transpose(1, 0));
	let T = ue.data;
	if (ee === "add") for (let e = 0; e < T.length; ++e) T[e] = C + T[e] + f;
	else for (let e = 0; e < T.length; ++e) T[e] = C + Math.max(f, T[e]);
	if (a !== null && p !== null) {
		let e = Math.min(T.length, re * le);
		switch (p) {
			case "log":
				for (let t = 0; t < e; ++t) T[t] = Math.log(T[t]);
				break;
			case "log10":
				for (let t = 0; t < e; ++t) T[t] = Math.log10(T[t]);
				break;
			case "log10_max_norm": {
				for (let t = 0; t < e; ++t) T[t] = Math.log10(T[t]);
				let t = (m ?? Ic(T)[0]) - 8;
				for (let n = 0; n < e; ++n) T[n] = (Math.max(T[n], t) + 4) / 4;
				break;
			}
			case "dB":
				if (a === 1) jd(T, h, g, _);
				else if (a === 2) Md(T, h, g, _);
				else throw Error(`Cannot use log_mel option '${p}' with power ${a}`);
				break;
			default: throw Error(`log_mel must be one of null, 'log', 'log10', 'log10_max_norm', or 'dB'. Got '${p}'`);
		}
	}
	return ue;
}
function Pd(e, t, { periodic: n = !0, frame_length: r = null, center: i = !0 } = {}) {
	let a = n ? e + 1 : e, o;
	switch (t) {
		case "boxcar":
			o = new Float64Array(a).fill(1);
			break;
		case "hann":
		case "hann_window":
			o = bd(a);
			break;
		case "hamming":
			o = xd(a);
			break;
		case "povey":
			o = bd(a).map((e) => e ** .85);
			break;
		default: throw Error(`Unknown window type ${t}.`);
	}
	if (n && (o = o.subarray(0, e)), r === null || e === r) return o;
	if (e > r) throw Error(`Length of the window (${e}) may not be larger than frame_length (${r})`);
	let s = new Float64Array(r), c = i ? Math.floor((r - e) / 2) : 0;
	return s.set(o, c), s;
}
function Fd(e, t) {
	let n = e.reduce((e, t) => e + t.length, 0), r = /* @__PURE__ */ new ArrayBuffer(44), i = new DataView(r);
	return Id(i, 0, "RIFF"), i.setUint32(4, 36 + n * 4, !0), Id(i, 8, "WAVE"), Id(i, 12, "fmt "), i.setUint32(16, 16, !0), i.setUint16(20, 3, !0), i.setUint16(22, 1, !0), i.setUint32(24, t, !0), i.setUint32(28, t * 4, !0), i.setUint16(32, 4, !0), i.setUint16(34, 32, !0), Id(i, 36, "data"), i.setUint32(40, n * 4, !0), new Blob([r, ...e.map((e) => e.buffer instanceof ArrayBuffer ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength) : e.slice())], { type: "audio/wav" });
}
function Id(e, t, n) {
	for (let r = 0; r < n.length; ++r) e.setUint8(t + r, n.charCodeAt(r));
}
var Ld = class {
	constructor(e, t) {
		this.audio = e, this.sampling_rate = t;
	}
	get data() {
		if (Array.isArray(this.audio)) {
			if (this.audio.length === 0) return /* @__PURE__ */ new Float32Array();
			if (this.audio.length === 1) return this.audio[0];
			let e = this.audio.reduce((e, t) => e + t.length, 0), t = new Float32Array(e), n = 0;
			for (let e of this.audio) t.set(e, n), n += e.length;
			return t;
		}
		return this.audio;
	}
	toBlob() {
		let e = this.audio;
		return e instanceof Float32Array && (e = [e]), Fd(e, this.sampling_rate);
	}
	async save(e) {
		return gd(e, this.toBlob());
	}
}, Rd = class extends fd {
	constructor(e) {
		super(e);
		let t = this.config.sampling_rate, n = Od(257, this.config.num_mel_bins, 20, Math.floor(t / 2), t, null, "kaldi", !0);
		this.mel_filters = n, this.window = Pd(400, "hann", { periodic: !1 }), this.mean = this.config.mean, this.std = this.config.std;
	}
	async _extract_fbank_features(e, t) {
		return Nd(e, this.window, 400, 160, {
			fft_length: 512,
			power: 2,
			center: !1,
			preemphasis: .97,
			mel_filters: this.mel_filters,
			log_mel: "log",
			mel_floor: 1.192092955078125e-7,
			remove_dc_offset: !0,
			max_num_frames: t,
			transpose: !0
		});
	}
	async _call(e) {
		pd(e, "ASTFeatureExtractor");
		let t = await this._extract_fbank_features(e, this.config.max_length);
		if (this.config.do_normalize) {
			let e = this.std * 2, n = t.data;
			for (let t = 0; t < n.length; ++t) n[t] = (n[t] - this.mean) / e;
		}
		return { input_values: t.unsqueeze_(0) };
	}
}, zd = class extends fd {
	async _call(e) {
		pd(e, "EncodecFeatureExtractor"), e instanceof Float64Array && (e = new Float32Array(e));
		let t = this.config.feature_size;
		if (e.length % t !== 0) throw Error(`The length of the audio data must be a multiple of the number of channels (${t}).`);
		let n = [
			1,
			t,
			e.length / t
		];
		return { input_values: new V("float32", e, n) };
	}
}, Bd = class extends fd {
	async _call(e) {
		pd(e, "ChatterboxFeatureExtractor"), e instanceof Float64Array && (e = new Float32Array(e));
		let t = [1, e.length];
		return { input_values: new V("float32", e, t) };
	}
}, Vd = class extends fd {
	constructor(e) {
		super(e), this.mel_filters = Od(this.config.nb_frequency_bins, this.config.feature_size, this.config.frequency_min, this.config.frequency_max, this.config.sampling_rate, null, "htk"), this.mel_filters_slaney = Od(this.config.nb_frequency_bins, this.config.feature_size, this.config.frequency_min, this.config.frequency_max, this.config.sampling_rate, "slaney", "slaney"), this.window = Pd(this.config.fft_window_size, "hann");
	}
	async _get_input_mel(e, t, n, r) {
		let i, a = e.length - t;
		if (a > 0) {
			if (n === "rand_trunc") {
				let n = Math.floor(qs.random() * (a + 1));
				e = e.subarray(n, n + t), i = await this._extract_fbank_features(e, this.mel_filters_slaney, this.config.nb_max_samples);
			} else throw Error(`Truncation strategy "${n}" not implemented`);
		} else {
			if (a < 0) {
				let n = new Float64Array(t);
				if (n.set(e), r === "repeat") for (let r = e.length; r < t; r += e.length) n.set(e.subarray(0, Math.min(e.length, t - r)), r);
				else if (r === "repeatpad") for (let t = e.length; t < -a; t += e.length) n.set(e, t);
				e = n;
			}
			if (n === "fusion") throw Error(`Truncation strategy "${n}" not implemented`);
			i = await this._extract_fbank_features(e, this.mel_filters_slaney, this.config.nb_max_samples);
		}
		return i.unsqueeze_(0);
	}
	async _extract_fbank_features(e, t, n = null) {
		return Nd(e, this.window, this.config.fft_window_size, this.config.hop_length, {
			power: 2,
			mel_filters: t,
			log_mel: "dB",
			max_num_frames: n,
			do_pad: !1,
			transpose: !0
		});
	}
	async _call(e, { max_length: t = null } = {}) {
		return pd(e, "ClapFeatureExtractor"), { input_features: (await this._get_input_mel(e, t ?? this.config.nb_max_samples, this.config.truncation, this.config.padding)).unsqueeze_(0) };
	}
}, Hd = 1e-5, Ud = class extends fd {
	constructor(e) {
		super(e), this.config.mel_filters ??= Od(Math.floor(1 + this.config.n_fft / 2), this.config.feature_size, 0, this.config.sampling_rate / 2, this.config.sampling_rate, "slaney", "slaney");
		let t = Pd(this.config.win_length, "hann", { periodic: !1 });
		this.window = new Float64Array(this.config.n_fft);
		let n = Math.floor((this.config.n_fft - this.config.win_length) / 2);
		this.window.set(t, n);
	}
	async _extract_fbank_features(e) {
		let t = this.config.preemphasis;
		e = new Float64Array(e);
		for (let n = e.length - 1; n >= 1; --n) e[n] -= t * e[n - 1];
		return await Nd(e, this.window, this.window.length, this.config.hop_length, {
			fft_length: this.config.n_fft,
			power: 2,
			mel_filters: this.config.mel_filters,
			log_mel: "log",
			mel_floor: -Infinity,
			pad_mode: "constant",
			center: !0,
			transpose: !0,
			mel_offset: 2 ** -24
		});
	}
	async _call(e) {
		pd(e, "ParakeetFeatureExtractor");
		let t = await this._extract_fbank_features(e), n = Math.floor((e.length + Math.floor(this.config.n_fft / 2) * 2 - this.config.n_fft) / this.config.hop_length), r = t.data;
		r.fill(0, n * t.dims[1]);
		let [i, a] = t.dims, o = new Float64Array(a), s = new Float64Array(a);
		for (let e = 0; e < n; ++e) {
			let t = e * a;
			for (let e = 0; e < a; ++e) {
				let n = r[t + e];
				o[e] += n, s[e] += n * n;
			}
		}
		let c = n > 1 ? n - 1 : 1;
		for (let e = 0; e < a; ++e) {
			let t = o[e] / n, i = (s[e] - n * t * t) / c, l = 1 / (Math.sqrt(i) + Hd);
			for (let i = 0; i < n; ++i) {
				let n = i * a + e;
				r[n] = (r[n] - t) * l;
			}
		}
		let l = new BigInt64Array(i);
		return l.fill(1n, 0, n), {
			input_features: t.unsqueeze_(0),
			attention_mask: new V("int64", l, [1, i])
		};
	}
}, Wd = class extends Ud {
	_apply_dither(e) {
		let t = this.config.dither ?? 0;
		if (t <= 0) return e;
		let n = new Ws(e.length);
		for (let r = 0; r < e.length; ++r) e[r] += t * n.gauss();
		return e;
	}
	split_audio(e) {
		let t = this.config.max_audio_clip_s ?? 35, n = this.config.overlap_chunk_second ?? 5, r = this.config.min_energy_window_samples ?? 1600, i = this.config.sampling_rate, a = Math.max(1, Math.round(t * i)), o = Math.max(1, Math.round(n * i));
		if (e.length <= a) return [e];
		let s = [], c = 0, l = e.length;
		for (; c < l;) {
			if (c + a >= l) {
				s.push(e.slice(c, l));
				break;
			}
			let t = Math.max(c, c + a - o), n = Math.min(c + a, l), i;
			i = n <= t ? c + a : this._find_split_point_energy(e, t, n, r), i = Math.max(c + 1, Math.min(i, l)), s.push(e.slice(c, i)), c = i;
		}
		return s;
	}
	_find_split_point_energy(e, t, n, r) {
		let i = n - t;
		if (i <= r) return Math.floor((t + n) / 2);
		let a = Infinity, o = t, s = i - r;
		for (let n = 0; n <= s; n += r) {
			let i = 0;
			for (let a = 0; a < r; ++a) {
				let r = e[t + n + a];
				i += r * r;
			}
			i = Math.sqrt(i / r), i < a && (a = i, o = t + n);
		}
		return o;
	}
	async _call(e) {
		pd(e, "CohereAsrFeatureExtractor");
		let t = new Float64Array(e);
		return this._apply_dither(t), super._call(t);
	}
}, Gd = class extends zd {}, Kd = class extends fd {
	constructor(e) {
		super(e);
		let { fft_length: t, feature_size: n, min_frequency: r, max_frequency: i, sampling_rate: a, frame_length: o } = this.config, s = Od(Math.floor(1 + t / 2), n, r, i, a, null, "htk", !1);
		this.mel_filters = s, this.window = Pd(o, "hann");
	}
	async _extract_fbank_features(e, t) {
		return Nd(e, this.window, this.config.frame_length, this.config.hop_length, {
			fft_length: this.config.fft_length,
			center: !1,
			onesided: !0,
			preemphasis: this.config.preemphasis,
			preemphasis_htk_flavor: this.config.preemphasis_htk_flavor,
			mel_filters: this.mel_filters,
			log_mel: "log",
			mel_floor: this.config.mel_floor,
			remove_dc_offset: !1,
			transpose: !0
		});
	}
	async _call(e, { max_length: t = 48e4, truncation: n = !0, padding: r = !0, pad_to_multiple_of: i = 128 } = {}) {
		if (pd(e, "Gemma3nAudioFeatureExtractor"), n && e.length > t && (e = e.slice(0, t)), r && e.length % i !== 0) {
			let t = i - e.length % i, n = new Float64Array(e.length + t);
			n.set(e), this.config.padding_value !== 0 && n.fill(this.config.padding_value, e.length), e = n;
		}
		let a = await this._extract_fbank_features(e, this.config.max_length), o = Wl([1, a.dims[0]], !0);
		return {
			input_features: a.unsqueeze_(0),
			input_features_mask: o
		};
	}
}, qd = class extends Kd {
	async _extract_fbank_features(e, t) {
		let { frame_length: n, hop_length: r, fft_length: i } = this.config, a = Math.floor(n / 2), o = Math.floor((e.length + a - (n + 1)) / r) + 1;
		return Nd(e, this.window, n, r, {
			fft_length: i,
			center: !0,
			pad_mode: "semicausal",
			onesided: !0,
			preemphasis: this.config.preemphasis,
			preemphasis_htk_flavor: this.config.preemphasis_htk_flavor,
			mel_filters: this.mel_filters,
			log_mel: "log",
			mel_floor: this.config.mel_floor,
			mel_floor_mode: "add",
			remove_dc_offset: !1,
			transpose: !0,
			max_num_frames: o
		});
	}
	async _call(e, t = {}) {
		pd(e, "Gemma4AudioFeatureExtractor");
		let n = e.length, r = await super._call(e, t), { input_features: i } = r, [, a, o] = i.dims, { frame_length: s, hop_length: c } = this.config, l = Math.floor(s / 2), u = s + 1, d = new Uint8Array(n + l + (t.pad_to_multiple_of ?? 128));
		d.fill(1, l, l + n);
		let f = new Uint8Array(a);
		for (let e = 0; e < a; ++e) f[e] = +!!d[e * c + u - 1];
		let p = i.data;
		for (let e = 0; e < a; ++e) f[e] || p.fill(0, e * o, (e + 1) * o);
		return r.input_features_mask = new V("bool", f, [1, a]), r;
	}
}, Jd = class extends fd {
	constructor(e) {
		super(e);
		let { n_fft: t, win_length: n, n_mels: r, sample_rate: i } = e.melspec_kwargs;
		this.mel_filters = Od(Math.floor(1 + t / 2), r, 0, i / 2, i, null, "htk");
		let a = Pd(n, "hann");
		this.window = new Float64Array(t);
		let o = Math.floor((t - n) / 2);
		this.window.set(a, o);
	}
	async _call(e) {
		pd(e, "GraniteSpeechFeatureExtractor");
		let { n_fft: t, hop_length: n, n_mels: r } = this.config.melspec_kwargs, i = Math.floor(e.length / n) + 1, a = i - i % 2;
		return { input_features: (await Nd(e, this.window, t, n, {
			power: 2,
			mel_filters: this.mel_filters,
			log_mel: "log10_max_norm",
			transpose: !0,
			max_num_frames: a,
			do_pad: !1
		})).view(-1, 2 * r).unsqueeze_(0) };
	}
}, Yd = class extends fd {
	async _call(e) {
		pd(e, "MoonshineFeatureExtractor"), e instanceof Float64Array && (e = new Float32Array(e));
		let t = [1, e.length];
		return { input_values: new V("float32", e, t) };
	}
}, Xd = class extends fd {
	async _call(e) {
		pd(e, "PyAnnoteFeatureExtractor"), e instanceof Float64Array && (e = new Float32Array(e));
		let t = [
			1,
			1,
			e.length
		];
		return { input_values: new V("float32", e, t) };
	}
	samples_to_frames(e) {
		return (e - this.config.offset) / this.config.step;
	}
	post_process_speaker_diarization(e, t) {
		let n = t / this.samples_to_frames(t) / this.config.sampling_rate, r = [];
		for (let t of e.tolist()) {
			let e = [], i = -1;
			for (let n = 0; n < t.length; ++n) {
				let [r, a] = Ic(Nc(t[n])), [o, s] = [n, n + 1];
				a === i ? (e.at(-1).end = s, e.at(-1).score += r) : (i = a, e.push({
					id: a,
					start: o,
					end: s,
					score: r
				}));
			}
			r.push(e.map(({ id: e, start: t, end: r, score: i }) => ({
				id: e,
				start: t * n,
				end: r * n,
				confidence: i / (r - t)
			})));
		}
		return r;
	}
}, Zd = class extends fd {
	constructor(e) {
		super(e);
		let t = this.config.sampling_rate, n = Od(257, this.config.num_mel_bins, 20, Math.floor(t / 2), t, null, "kaldi", !0);
		this.mel_filters = n, this.window = Pd(400, "povey", { periodic: !1 });
	}
	async _extract_fbank_features(e, t) {
		return e = e.map((e) => e * 32768), Nd(e, this.window, 400, 160, {
			fft_length: 512,
			power: 2,
			center: !1,
			preemphasis: .97,
			mel_filters: this.mel_filters,
			log_mel: "log",
			mel_floor: 1.192092955078125e-7,
			remove_dc_offset: !0,
			max_num_frames: t,
			transpose: !0
		});
	}
	async _call(e, { padding: t = !0, pad_to_multiple_of: n = 2, do_normalize_per_mel_bins: r = !0, return_attention_mask: i = !0 } = {}) {
		pd(e, "SeamlessM4TFeatureExtractor");
		let a = await this._extract_fbank_features(e, this.config.max_length);
		if (r) {
			let [e, t] = a.dims, n = a.data;
			for (let r = 0; r < t; ++r) {
				let i = 0;
				for (let a = 0; a < e; ++a) i += n[a * t + r];
				let a = i / e, o = 0;
				for (let i = 0; i < e; ++i) o += (n[i * t + r] - a) ** 2;
				o /= e - 1;
				let s = Math.sqrt(o + 1e-7);
				for (let i = 0; i < e; ++i) {
					let e = i * t + r;
					n[e] = (n[e] - a) / s;
				}
			}
		}
		let o;
		if (t) {
			let [e, t] = a.dims, r = a.data, s = e % n;
			if (s > 0) {
				let n = new Float32Array(t * (e + s));
				n.set(r), n.fill(this.config.padding_value, r.length);
				let c = e + s;
				a = new V(a.type, n, [c, t]), i && (o = new V("int64", new BigInt64Array(c), [1, c]), o.data.fill(1n, 0, e));
			}
		}
		let [s, c] = a.dims, l = this.config.stride;
		if (s % l !== 0) throw Error(`The number of frames (${s}) must be a multiple of the stride (${l}).`);
		let u = a.view(1, Math.floor(s / l), c * l), d = { input_features: u };
		if (i) {
			let e = u.dims[1], t = new BigInt64Array(e);
			if (o) {
				let e = o.data;
				for (let n = 1, r = 0; n < s; n += l, ++r) t[r] = e[n];
			} else t.fill(1n);
			d.attention_mask = new V("int64", t, [1, e]);
		}
		return d;
	}
}, Qd = class extends Gd {}, $d = class extends fd {}, ef = class extends fd {
	_zero_mean_unit_var_norm(e) {
		let t = e.reduce((e, t) => e + t, 0) / e.length, n = e.reduce((e, n) => e + (n - t) ** 2, 0) / e.length;
		return e.map((e) => (e - t) / Math.sqrt(n + 1e-7));
	}
	async _call(e) {
		pd(e, "Wav2Vec2FeatureExtractor"), e instanceof Float64Array && (e = new Float32Array(e));
		let t = e;
		this.config.do_normalize && (t = this._zero_mean_unit_var_norm(t));
		let n = [1, t.length];
		return {
			input_values: new V("float32", t, n),
			attention_mask: new V("int64", new BigInt64Array(t.length).fill(1n), n)
		};
	}
}, tf = class extends fd {
	constructor(e) {
		super(e);
		let t = this.config.sampling_rate, n = Od(257, this.config.num_mel_bins, 20, Math.floor(t / 2), t, null, "kaldi", !0);
		this.mel_filters = n, this.window = Pd(400, "hamming", { periodic: !1 }), this.min_num_frames = this.config.min_num_frames;
	}
	async _extract_fbank_features(e) {
		return e = e.map((e) => e * 32768), Nd(e, this.window, 400, 160, {
			fft_length: 512,
			power: 2,
			center: !1,
			preemphasis: .97,
			mel_filters: this.mel_filters,
			log_mel: "log",
			mel_floor: 1.192092955078125e-7,
			remove_dc_offset: !0,
			transpose: !0,
			min_num_frames: this.min_num_frames
		});
	}
	async _call(e) {
		pd(e, "WeSpeakerFeatureExtractor");
		let t = (await this._extract_fbank_features(e)).unsqueeze_(0);
		if (this.config.fbank_centering_span === null) {
			let e = t.mean(1).data, n = t.data, [r, i, a] = t.dims;
			for (let t = 0; t < r; ++t) {
				let r = t * i * a, o = t * a;
				for (let t = 0; t < i; ++t) {
					let i = r + t * a;
					for (let t = 0; t < a; ++t) n[i + t] -= e[o + t];
				}
			}
		}
		return { input_features: t };
	}
}, nf = class extends fd {
	constructor(e) {
		super(e), this.config.mel_filters ??= Od(Math.floor(1 + this.config.n_fft / 2), this.config.feature_size, 0, 8e3, this.config.sampling_rate, "slaney", "slaney"), this.window = Pd(this.config.n_fft, "hann");
	}
	async _extract_fbank_features(e, { center: t = !0 } = {}) {
		let { n_fft: n, hop_length: r, mel_filters: i, global_log_mel_max: a } = this.config, o = Math.floor(t ? e.length / r : (e.length - n) / r);
		return await Nd(e, this.window, n, r, {
			power: 2,
			mel_filters: i,
			log_mel: "log10_max_norm",
			max_log_mel: a,
			center: t,
			max_num_frames: o,
			do_pad: !1
		});
	}
	async _call(e, { center: t = !0 } = {}) {
		return pd(e, "VoxtralRealtimeFeatureExtractor"), { input_features: (await this._extract_fbank_features(e, { center: t })).unsqueeze_(0) };
	}
}, rf = class extends fd {
	constructor(e) {
		super(e), this.config.mel_filters ??= Od(Math.floor(1 + this.config.n_fft / 2), this.config.feature_size, 0, 8e3, this.config.sampling_rate, "slaney", "slaney"), this.window = Pd(this.config.n_fft, "hann");
	}
	async _extract_fbank_features(e) {
		return await Nd(e, this.window, this.config.n_fft, this.config.hop_length, {
			power: 2,
			mel_filters: this.config.mel_filters,
			log_mel: "log10_max_norm",
			max_num_frames: Math.min(Math.floor(e.length / this.config.hop_length), this.config.nb_max_frames)
		});
	}
	async _call(e, { max_length: t = null } = {}) {
		pd(e, "WhisperFeatureExtractor");
		let n, r = t ?? this.config.n_samples;
		return e.length > r ? (e.length > this.config.n_samples && A.warn("Attempting to extract features for audio longer than 30 seconds. If using a pipeline to extract transcript from a long audio clip, remember to specify `chunk_length_s` and/or `stride_length_s`."), n = e.slice(0, r)) : (n = new Float32Array(r), n.set(e)), { input_features: (await this._extract_fbank_features(n)).unsqueeze_(0) };
	}
}, af = class {
	static async from_pretrained(e, t = {}) {
		let n = await Ac(e, sd, !0, t), r = n.feature_extractor_type, i = md[r];
		if (!i) throw Error(`Unknown feature_extractor_type: '${r}'. Please report this at ${od}.`);
		return new i(n);
	}
}, of = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	async _call(e, t = null) {
		let n = this.tokenizer(e), r = t ? await this.feature_extractor(t) : {};
		return {
			...n,
			...r
		};
	}
}, sf = /* @__PURE__ */ new Set(["ja", "zh"]), cf = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	static uses_processor_config = !0;
	get_decoder_prompt_ids(e = "en") {
		let t = [
			"▁",
			"<|startofcontext|>",
			"<|startoftranscript|>",
			"<|emo:undefined|>",
			`<|${e}|>`,
			`<|${e}|>`,
			"<|pnc|>",
			"<|noitn|>",
			"<|notimestamp|>",
			"<|nodiarize|>"
		];
		return this.tokenizer.convert_tokens_to_ids(t);
	}
	static join_chunks(e, t = "en") {
		let n = e.filter((e) => e && e.trim());
		if (n.length === 0) return "";
		let r = sf.has(t) ? "" : " ";
		return [n[0].trimEnd(), ...n.slice(1).map((e) => e.trim())].join(r);
	}
	async _call(e) {
		return await this.feature_extractor(e);
	}
}, lf = {}, uf, df, ff;
if (O.IS_WEB_ENV) uf = (e, t) => {
	if (!self.OffscreenCanvas) throw Error("OffscreenCanvas not supported by this environment.");
	return new self.OffscreenCanvas(e, t);
}, ff = self.createImageBitmap, df = self.ImageData;
else if (lf) ff = async (e) => {
	let t = (await e.metadata()).channels, { data: n, info: r } = await e.rotate().raw().toBuffer({ resolveWithObject: !0 }), i = new hf(new Uint8ClampedArray(n), r.width, r.height, r.channels);
	return t !== void 0 && t !== r.channels && i.convert(t), i;
};
else throw Error("Unable to load image processing library.");
var pf = {
	0: "nearest",
	1: "lanczos",
	2: "bilinear",
	3: "bicubic",
	4: "box",
	5: "hamming"
}, mf = /* @__PURE__ */ new Map([
	["png", "image/png"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["gif", "image/gif"]
]), hf = class e {
	constructor(e, t, n, r) {
		this.data = e, this.width = t, this.height = n, this.channels = r;
	}
	get size() {
		return [this.width, this.height];
	}
	static async read(t) {
		if (t instanceof e) return t;
		if (typeof t == "string" || t instanceof URL) return await this.fromURL(t);
		if (t instanceof Blob) return await this.fromBlob(t);
		if (typeof HTMLCanvasElement < "u" && t instanceof HTMLCanvasElement || typeof OffscreenCanvas < "u" && t instanceof OffscreenCanvas) return this.fromCanvas(t);
		throw Error(`Unsupported input type: ${typeof t}`);
	}
	static fromCanvas(t) {
		if (!O.IS_WEB_ENV) throw Error("fromCanvas() is only supported in browser environments.");
		let n = t.getContext("2d").getImageData(0, 0, t.width, t.height).data;
		return new e(n, t.width, t.height, 4);
	}
	static async fromURL(e) {
		let t = await xc(e);
		if (t.status !== 200) throw Error(`Unable to read image from "${e}" (${t.status} ${t.statusText})`);
		let n = await t.blob();
		return this.fromBlob(n);
	}
	static async fromBlob(e) {
		if (O.IS_WEB_ENV) {
			let t = await ff(e), n = uf(t.width, t.height).getContext("2d");
			return n.drawImage(t, 0, 0), new this(n.getImageData(0, 0, t.width, t.height).data, t.width, t.height, 4);
		}
		{
			let t = lf(await e.arrayBuffer());
			return await ff(t);
		}
	}
	static fromTensor(t, n = "CHW") {
		if (t.dims.length !== 3) throw Error(`Tensor should have 3 dimensions, but has ${t.dims.length} dimensions.`);
		if (n === "CHW") t = t.permute(1, 2, 0);
		else if (n !== "HWC") throw Error(`Unsupported channel format: ${n}`);
		if (!(t.data instanceof Uint8ClampedArray || t.data instanceof Uint8Array)) throw Error(`Unsupported tensor type: ${t.type}`);
		switch (t.dims[2]) {
			case 1:
			case 2:
			case 3:
			case 4: return new e(t.data, t.dims[1], t.dims[0], t.dims[2]);
			default: throw Error(`Unsupported number of channels: ${t.dims[2]}`);
		}
	}
	grayscale() {
		if (this.channels === 1) return this;
		let e = new Uint8ClampedArray(this.width * this.height * 1);
		switch (this.channels) {
			case 3:
			case 4:
				for (let t = 0, n = 0; t < this.data.length; t += this.channels) {
					let r = this.data[t], i = this.data[t + 1], a = this.data[t + 2];
					e[n++] = Math.round(.2989 * r + .587 * i + .114 * a);
				}
				break;
			default: throw Error(`Conversion failed due to unsupported number of channels: ${this.channels}`);
		}
		return this._update(e, this.width, this.height, 1);
	}
	rgb() {
		if (this.channels === 3) return this;
		let e = new Uint8ClampedArray(this.width * this.height * 3);
		switch (this.channels) {
			case 1:
				for (let t = 0, n = 0; t < this.data.length; ++t) e[n++] = this.data[t], e[n++] = this.data[t], e[n++] = this.data[t];
				break;
			case 4:
				for (let t = 0, n = 0; t < this.data.length; t += 4) e[n++] = this.data[t], e[n++] = this.data[t + 1], e[n++] = this.data[t + 2];
				break;
			default: throw Error(`Conversion failed due to unsupported number of channels: ${this.channels}`);
		}
		return this._update(e, this.width, this.height, 3);
	}
	rgba() {
		if (this.channels === 4) return this;
		let e = new Uint8ClampedArray(this.width * this.height * 4);
		switch (this.channels) {
			case 1:
				for (let t = 0, n = 0; t < this.data.length; ++t) e[n++] = this.data[t], e[n++] = this.data[t], e[n++] = this.data[t], e[n++] = 255;
				break;
			case 3:
				for (let t = 0, n = 0; t < this.data.length; t += 3) e[n++] = this.data[t], e[n++] = this.data[t + 1], e[n++] = this.data[t + 2], e[n++] = 255;
				break;
			default: throw Error(`Conversion failed due to unsupported number of channels: ${this.channels}`);
		}
		return this._update(e, this.width, this.height, 4);
	}
	putAlpha(e) {
		if (e.width !== this.width || e.height !== this.height) throw Error(`Expected mask size to be ${this.width}x${this.height}, but got ${e.width}x${e.height}`);
		if (e.channels !== 1) throw Error(`Expected mask to have 1 channel, but got ${e.channels}`);
		let t = this.data, n = e.data, r = this.width * this.height;
		if (this.channels === 3) {
			let e = new Uint8ClampedArray(r * 4);
			for (let i = 0, a = 0, o = 0; i < r; ++i) e[o++] = t[a++], e[o++] = t[a++], e[o++] = t[a++], e[o++] = n[i];
			return this._update(e, this.width, this.height, 4);
		}
		if (this.channels === 4) {
			for (let e = 0; e < r; ++e) t[4 * e + 3] = n[e];
			return this;
		}
		throw Error(`Expected image to have 3 or 4 channels, but got ${this.channels}`);
	}
	async resize(t, n, { resample: r = 2 } = {}) {
		if (this.width === t && this.height === n) return this;
		let i = pf[r] ?? r, a = Ar(t), o = Ar(n);
		if (a && o) return this;
		if (a ? t = n / this.height * this.width : o && (n = t / this.width * this.height), O.IS_WEB_ENV) {
			let r = this.channels, i = this.toCanvas(), a = uf(t, n).getContext("2d");
			return a.drawImage(i, 0, 0, t, n), new e(a.getImageData(0, 0, t, n).data, t, n, 4).convert(r);
		}
		{
			let e = this.toSharp();
			switch (i) {
				case "box":
				case "hamming": (i === "box" || i === "hamming") && (A.warn(`Resampling method ${i} is not yet supported. Using bilinear instead.`), i = "bilinear");
				case "nearest":
				case "bilinear":
				case "bicubic":
					e = e.affine([
						t / this.width,
						0,
						0,
						n / this.height
					], { interpolator: i });
					break;
				case "lanczos":
					e = e.resize({
						width: t,
						height: n,
						fit: "fill",
						kernel: "lanczos3"
					});
					break;
				default: throw Error(`Resampling method ${i} is not supported.`);
			}
			return await ff(e);
		}
	}
	async pad([t, n, r, i]) {
		if (t = Math.max(t, 0), n = Math.max(n, 0), r = Math.max(r, 0), i = Math.max(i, 0), t === 0 && n === 0 && r === 0 && i === 0) return this;
		if (O.IS_WEB_ENV) {
			let a = this.channels, o = this.toCanvas(), s = this.width + t + n, c = this.height + r + i, l = uf(s, c).getContext("2d");
			return l.drawImage(o, 0, 0, this.width, this.height, t, r, this.width, this.height), new e(l.getImageData(0, 0, s, c).data, s, c, 4).convert(a);
		}
		{
			let e = this.toSharp().extend({
				left: t,
				right: n,
				top: r,
				bottom: i
			});
			return await ff(e);
		}
	}
	async crop([t, n, r, i]) {
		if (t = Math.max(t, 0), n = Math.max(n, 0), r = Math.min(r, this.width - 1), i = Math.min(i, this.height - 1), t === 0 && n === 0 && r === this.width - 1 && i === this.height - 1) return this;
		let a = r - t + 1, o = i - n + 1;
		if (O.IS_WEB_ENV) {
			let r = this.channels, i = this.toCanvas(), s = uf(a, o).getContext("2d");
			return s.drawImage(i, t, n, a, o, 0, 0, a, o), new e(s.getImageData(0, 0, a, o).data, a, o, 4).convert(r);
		}
		{
			let e = this.toSharp().extract({
				left: t,
				top: n,
				width: a,
				height: o
			});
			return await ff(e);
		}
	}
	async center_crop(t, n) {
		if (this.width === t && this.height === n) return this;
		let r = (this.width - t) / 2, i = (this.height - n) / 2;
		if (O.IS_WEB_ENV) {
			let a = this.channels, o = this.toCanvas(), s = uf(t, n).getContext("2d"), c = 0, l = 0, u = 0, d = 0;
			return r >= 0 ? c = r : u = -r, i >= 0 ? l = i : d = -i, s.drawImage(o, c, l, t, n, u, d, t, n), new e(s.getImageData(0, 0, t, n).data, t, n, 4).convert(a);
		}
		{
			let e = this.toSharp();
			if (r >= 0 && i >= 0) e = e.extract({
				left: Math.floor(r),
				top: Math.floor(i),
				width: t,
				height: n
			});
			else if (r <= 0 && i <= 0) {
				let a = Math.floor(-i), o = Math.floor(-r);
				e = e.extend({
					top: a,
					left: o,
					right: t - this.width - o,
					bottom: n - this.height - a
				});
			} else {
				let a = [0, 0], o = 0;
				i < 0 ? (a[0] = Math.floor(-i), a[1] = n - this.height - a[0]) : o = Math.floor(i);
				let s = [0, 0], c = 0;
				r < 0 ? (s[0] = Math.floor(-r), s[1] = t - this.width - s[0]) : c = Math.floor(r), e = e.extend({
					top: a[0],
					bottom: a[1],
					left: s[0],
					right: s[1]
				}).extract({
					left: c,
					top: o,
					width: t,
					height: n
				});
			}
			return await ff(e);
		}
	}
	async toBlob(e = "image/png", t = 1) {
		if (!O.IS_WEB_ENV) throw Error("toBlob() is only supported in browser environments.");
		return await this.toCanvas().convertToBlob({
			type: e,
			quality: t
		});
	}
	toTensor(e = "CHW") {
		let t = new V("uint8", new Uint8Array(this.data), [
			this.height,
			this.width,
			this.channels
		]);
		if (e !== "HWC") {
			if (e === "CHW") t = t.permute(2, 0, 1);
			else throw Error(`Unsupported channel format: ${e}`);
		}
		return t;
	}
	toCanvas() {
		if (!O.IS_WEB_ENV) throw Error("toCanvas() is only supported in browser environments.");
		let e = this.clone().rgba(), t = uf(e.width, e.height), n = new df(e.data, e.width, e.height);
		return t.getContext("2d").putImageData(n, 0, 0), t;
	}
	split() {
		let { data: t, width: n, height: r, channels: i } = this, a = t.constructor, o = t.length / i, s = Array.from({ length: i }, () => new a(o));
		for (let e = 0; e < o; ++e) {
			let n = i * e;
			for (let r = 0; r < i; ++r) s[r][e] = t[n + r];
		}
		return s.map((t) => new e(t, n, r, 1));
	}
	_update(e, t, n, r = null) {
		return this.data = e, this.width = t, this.height = n, r !== null && (this.channels = r), this;
	}
	clone() {
		return new e(this.data.slice(), this.width, this.height, this.channels);
	}
	convert(e) {
		if (this.channels === e) return this;
		switch (e) {
			case 1:
				this.grayscale();
				break;
			case 3:
				this.rgb();
				break;
			case 4:
				this.rgba();
				break;
			default: throw Error(`Conversion failed due to unsupported number of channels: ${this.channels}`);
		}
		return this;
	}
	async save(e) {
		if (O.IS_WEB_ENV) {
			if (O.IS_WEBWORKER_ENV) throw Error("Unable to save an image from a Web Worker.");
			let t = e.split(".").pop().toLowerCase(), n = mf.get(t) ?? "image/png";
			return gd(e, await this.toBlob(n));
		}
		if (O.IS_FS_AVAILABLE) await this.toSharp().toFile(e);
		else throw Error("Unable to save the image because filesystem is disabled in this environment.");
	}
	toSharp() {
		if (O.IS_WEB_ENV) throw Error("toSharp() is only supported in server-side environments.");
		return lf(this.data, { raw: {
			width: this.width,
			height: this.height,
			channels: this.channels
		} });
	}
};
hf.read.bind(hf);
function gf(e, t, n = 0, r = null) {
	let i = e / t, a = Uc(i) * t;
	return r !== null && a > r && (a = Math.floor(i) * t), a < n && (a = Math.ceil(i) * t), a;
}
function _f([e, t], n) {
	return [Math.max(Math.floor(e / n), 1) * n, Math.max(Math.floor(t / n), 1) * n];
}
function vf([e, t, n, r]) {
	return [
		e - n / 2,
		t - r / 2,
		e + n / 2,
		t + r / 2
	];
}
function yf(e, t = .5, n = null, r = !1) {
	let i = e.logits, a = e.pred_boxes, [o, s, c] = i.dims;
	if (n !== null && n.length !== o) throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
	let l = [];
	for (let e = 0; e < o; ++e) {
		let o = n === null ? null : n[e], u = {
			boxes: [],
			classes: [],
			scores: []
		}, d = i[e], f = a[e];
		for (let e = 0; e < s; ++e) {
			let n = d[e], i = [], a;
			if (r) {
				a = n.sigmoid().data;
				for (let e = 0; e < a.length; ++e) a[e] > t && i.push(e);
			} else {
				let e = Ic(n.data)[1];
				if (e === c - 1 || (a = Nc(n.data), a[e] < t)) continue;
				i.push(e);
			}
			for (let t of i) {
				let n = f[e].data;
				n = vf(n), o !== null && (n = n.map((e, t) => e * o[(t + 1) % 2])), u.boxes.push(n), u.classes.push(t), u.scores.push(a[t]);
			}
		}
		l.push(u);
	}
	return l;
}
function bf(e, t = null) {
	let n = e.logits, r = n.dims[0];
	if (t !== null && t.length !== r) throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
	let i = [];
	for (let e = 0; e < r; ++e) {
		let r = t === null ? null : t[e], a = n[e];
		r !== null && (a = Ol(a, r, "bilinear", !1));
		let [o, s] = r ?? a.dims.slice(-2), c = new V("int32", new Int32Array(o * s), [o, s]), l = a[0].data, u = c.data;
		for (let e = 1; e < a.dims[0]; ++e) {
			let t = a[e].data;
			for (let n = 0; n < t.length; ++n) t[n] > l[n] && (l[n] = t[n], u[n] = e);
		}
		let d = Array(a.dims[0]);
		for (let e = 0; e < u.length; ++e) {
			let t = u[e];
			d[t] = t;
		}
		let f = d.filter((e) => e !== void 0);
		i.push({
			segmentation: c,
			labels: f
		});
	}
	return i;
}
function xf(e, t, n, r) {
	let i = [], a = [], o = [];
	for (let s = 0; s < e.dims[0]; ++s) {
		let c = e[s], l = t[s], u = Ic(c.data)[1];
		if (u === r) continue;
		let d = Nc(c.data)[u];
		d > n && (i.push(l), a.push(d), o.push(u));
	}
	return [
		i,
		a,
		o
	];
}
function Sf(e, t, n, r = .5, i = .8) {
	let a = [], o = 0, s = 0, c = t[n].data;
	for (let t = 0; t < e.length; ++t) e[t] === n && (a.push(t), ++o), c[t] >= r && ++s;
	let l = o > 0 && s > 0;
	return l &&= o / s > i, [l, a];
}
function Cf(e, t, n, r, i, a = null, o = null) {
	let [s, c] = o ?? e[0].dims, l = new V("int32", new Int32Array(s * c), [s, c]), u = [];
	if (o !== null) for (let t = 0; t < e.length; ++t) e[t] = Ol(e[t], o, "bilinear", !1);
	let d = new Int32Array(e[0].data.length), f = new Float32Array(e[0].data.length);
	for (let n = 0; n < e.length; ++n) {
		let r = t[n], i = e[n].data;
		for (let e = 0; e < i.length; ++e) i[e] *= r, i[e] > f[e] && (d[e] = n, f[e] = i[e]);
	}
	let p = 0, m = l.data;
	for (let a = 0; a < n.length; ++a) {
		let o = n[a], [s, c] = Sf(d, e, a, r, i);
		if (s) {
			++p;
			for (let e of c) m[e] = p;
			u.push({
				id: p,
				label_id: o,
				score: t[a]
			});
		}
	}
	return [l, u];
}
function wf(e, t, n = 28, r = 3136, i = 1003520, a = 1) {
	if (e < n || t < n) {
		let r = Math.max(n / e, n / t);
		e = Math.round(e * r), t = Math.round(t * r);
	}
	if (Math.max(e, t) / Math.min(e, t) > 200) throw Error(`absolute aspect ratio must be smaller than 200, got ${Math.max(e, t) / Math.min(e, t)}`);
	let o = Math.round(e / n) * n, s = Math.round(t / n) * n;
	if (a * o * s > i) {
		let r = Math.sqrt(a * e * t / i);
		o = Math.max(n, Math.floor(e / r / n) * n), s = Math.max(n, Math.floor(t / r / n) * n);
	} else if (a * o * s < r) {
		let i = Math.sqrt(r / (a * e * t));
		o = Math.ceil(e * i / n) * n, s = Math.ceil(t * i / n) * n;
	}
	return [s, o];
}
function Tf(e, t = .5, n = .5, r = .8, i = null, a = null) {
	i === null && (A.warn("`label_ids_to_fuse` unset. No instance will be fused."), i = /* @__PURE__ */ new Set());
	let o = e.class_queries_logits ?? e.logits, s = (e.masks_queries_logits ?? e.pred_masks).sigmoid(), [c, l, u] = o.dims;
	if (--u, a !== null && a.length !== c) throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
	let d = [];
	for (let e = 0; e < c; ++e) {
		let c = a === null ? null : a[e], l = o[e], f = s[e], [p, m, h] = xf(l, f, t, u);
		if (h.length === 0) {
			let [e, t] = c ?? f.dims.slice(-2), n = new V("int32", new Int32Array(e * t).fill(-1), [e, t]);
			d.push({
				segmentation: n,
				segments_info: []
			});
			continue;
		}
		let [g, _] = Cf(p, m, h, n, r, i, c);
		d.push({
			segmentation: g,
			segments_info: _
		});
	}
	return d;
}
function Ef(e, t = .5, n = null) {
	throw Error("`post_process_instance_segmentation` is not yet implemented.");
}
var K = class extends Er {
	constructor(e) {
		super(), this.image_mean = e.image_mean ?? e.mean, this.image_std = e.image_std ?? e.std, this.resample = e.resample ?? 2, this.do_rescale = e.do_rescale ?? !0, this.rescale_factor = e.rescale_factor ?? 1 / 255, this.do_normalize = e.do_normalize, this.do_thumbnail = e.do_thumbnail, this.size = e.size ?? e.image_size, this.do_resize = e.do_resize ?? this.size !== void 0, this.size_divisibility = e.size_divisibility ?? e.size_divisor, this.do_center_crop = e.do_center_crop, this.crop_size = e.crop_size, this.do_convert_rgb = e.do_convert_rgb ?? !0, this.do_crop_margin = e.do_crop_margin, this.pad_size = e.pad_size, this.do_pad = e.do_pad, this.min_pixels = e.min_pixels, this.max_pixels = e.max_pixels, this.do_pad && !this.pad_size && !this.size_divisibility && this.size && this.size.width !== void 0 && this.size.height !== void 0 && (this.pad_size = this.size), this.do_flip_channel_order = e.do_flip_channel_order ?? !1, this.config = e;
	}
	async thumbnail(e, t, n = 2) {
		let r = e.height, i = e.width, a = t.height, o = t.width, s = Math.min(r, a), c = Math.min(i, o);
		return s === r && c === i ? e : (r > i ? c = Math.floor(i * s / r) : i > r && (s = Math.floor(r * c / i)), await e.resize(c, s, { resample: n }));
	}
	async crop_margin(e, t = 200) {
		let n = e.clone().grayscale(), r = Fc(n.data)[0], i = Ic(n.data)[0] - r;
		if (i === 0) return e;
		let a = t / 255, o = n.width, s = n.height, c = 0, l = 0, u = n.data;
		for (let e = 0; e < n.height; ++e) {
			let t = e * n.width;
			for (let d = 0; d < n.width; ++d) (u[t + d] - r) / i < a && (o = Math.min(o, d), s = Math.min(s, e), c = Math.max(c, d), l = Math.max(l, e));
		}
		return e = await e.crop([
			o,
			s,
			c,
			l
		]), e;
	}
	pad_image(e, t, n, { mode: r = "constant", center: i = !1, constant_values: a = 0 } = {}) {
		let [o, s, c] = t, l, u;
		if (typeof n == "number" ? (l = n, u = n) : n === "square" ? l = u = Math.max(o, s) : (l = n.width, u = n.height), l !== s || u !== o) {
			let n = new Float32Array(l * u * c);
			if (Array.isArray(a)) for (let e = 0; e < n.length; ++e) n[e] = a[e % c];
			else a !== 0 && n.fill(a);
			let [d, f] = i ? [Math.floor((l - s) / 2), Math.floor((u - o) / 2)] : [0, 0];
			for (let t = 0; t < o; ++t) {
				let r = (t + f) * l, i = t * s;
				for (let t = 0; t < s; ++t) {
					let a = (r + t + d) * c, o = (i + t) * c;
					for (let t = 0; t < c; ++t) n[a + t] = e[o + t];
				}
			}
			if (r === "symmetric") {
				if (i) throw Error("`center` padding is not supported when `mode` is set to `symmetric`.");
				let t = o - 1, r = s - 1;
				for (let i = 0; i < u; ++i) {
					let a = i * l, u = Pr(i, t) * s;
					for (let t = 0; t < l; ++t) {
						if (i < o && t < s) continue;
						let l = (a + t) * c, d = (u + Pr(t, r)) * c;
						for (let t = 0; t < c; ++t) n[l + t] = e[d + t];
					}
				}
			}
			e = n, t = [
				u,
				l,
				c
			];
		}
		return [e, t];
	}
	rescale(e) {
		for (let t = 0; t < e.length; ++t) e[t] = this.rescale_factor * e[t];
	}
	get_resize_output_image_size(e, t) {
		let [n, r] = e.size, i, a;
		if (this.do_thumbnail) {
			let { height: e, width: n } = t;
			i = Math.min(e, n);
		} else Number.isInteger(t) ? (i = t, a = this.config.max_size ?? i) : t !== void 0 && (i = t.shortest_edge, a = t.longest_edge);
		if (i !== void 0 || a !== void 0) {
			let e = i === void 0 ? 1 : Math.max(i / n, i / r), t = n * e, o = r * e, s = a === void 0 ? 1 : Math.min(a / t, a / o), c = Math.floor(Number((t * s).toFixed(2))), l = Math.floor(Number((o * s).toFixed(2)));
			return this.size_divisibility !== void 0 && ([c, l] = _f([c, l], this.size_divisibility)), [c, l];
		}
		if (t !== void 0 && t.width !== void 0 && t.height !== void 0) {
			let e = t.width, i = t.height;
			if (this.config.keep_aspect_ratio && this.config.ensure_multiple_of) {
				let t = i / r, a = e / n;
				Math.abs(1 - a) < Math.abs(1 - t) ? t = a : a = t, i = gf(t * r, this.config.ensure_multiple_of), e = gf(a * n, this.config.ensure_multiple_of);
			}
			return [e, i];
		}
		if (this.size_divisibility !== void 0) return _f([n, r], this.size_divisibility);
		throw Error(`Could not resize image due to unsupported \`this.size\` option in config: ${JSON.stringify(t)}`);
	}
	async resize(e) {
		let [t, n] = this.get_resize_output_image_size(e, this.size);
		return await e.resize(t, n, { resample: this.resample });
	}
	async preprocess(e, { do_normalize: t = null, do_pad: n = null, do_convert_rgb: r = null, do_convert_grayscale: i = null, do_flip_channel_order: a = null } = {}) {
		this.do_crop_margin && (e = await this.crop_margin(e));
		let [o, s] = e.size;
		if (r ?? this.do_convert_rgb ? e = e.rgb() : i && (e = e.grayscale()), this.do_resize && (e = await this.resize(e)), this.do_thumbnail && (e = await this.thumbnail(e, this.size, this.resample)), this.do_center_crop) {
			let t, n;
			Number.isInteger(this.crop_size) ? (t = this.crop_size, n = this.crop_size) : (t = this.crop_size.width, n = this.crop_size.height), e = await e.center_crop(t, n);
		}
		let c = [e.height, e.width], l = Float32Array.from(e.data), u = [
			e.height,
			e.width,
			e.channels
		];
		if (this.do_rescale && this.rescale(l), t ?? this.do_normalize) {
			let t = this.image_mean;
			Array.isArray(this.image_mean) || (t = Array(e.channels).fill(t));
			let n = this.image_std;
			if (Array.isArray(this.image_std) || (n = Array(e.channels).fill(n)), t.length !== e.channels || n.length !== e.channels) throw Error(`When set to arrays, the length of \`image_mean\` (${t.length}) and \`image_std\` (${n.length}) must match the number of channels in the image (${e.channels}).`);
			for (let r = 0; r < l.length; r += e.channels) for (let i = 0; i < e.channels; ++i) l[r + i] = (l[r + i] - t[i]) / n[i];
		}
		if (n ?? this.do_pad) {
			if (this.pad_size) {
				let t = this.pad_image(l, [
					e.height,
					e.width,
					e.channels
				], this.pad_size);
				[l, u] = t;
			} else if (this.size_divisibility) {
				let e = Math.ceil(u[1] / this.size_divisibility) * this.size_divisibility, t = Math.ceil(u[0] / this.size_divisibility) * this.size_divisibility;
				[l, u] = this.pad_image(l, u, {
					width: e,
					height: t
				});
			}
		}
		if (a ?? this.do_flip_channel_order) {
			if (u[2] !== 3) throw Error("Flipping channel order is only supported for RGB images.");
			for (let e = 0; e < l.length; e += 3) {
				let t = l[e];
				l[e] = l[e + 2], l[e + 2] = t;
			}
		}
		let d = new V("float32", l, u).permute(2, 0, 1);
		return {
			original_size: [s, o],
			reshaped_input_size: c,
			pixel_values: d
		};
	}
	async _call(e, ...t) {
		Array.isArray(e) || (e = [e]);
		let n = await Promise.all(e.map((e) => this.preprocess(e)));
		return {
			pixel_values: Rl(n.map((e) => e.pixel_values), 0),
			original_sizes: n.map((e) => e.original_size),
			reshaped_input_sizes: n.map((e) => e.reshaped_input_size)
		};
	}
	static async from_pretrained(e, t = {}) {
		let n = await Ac(e, cd, !0, t);
		return new this(n);
	}
}, Df = {};
Yn(Df, {
	BeitFeatureExtractor: () => Of,
	BitImageProcessor: () => kf,
	CHMv2ImageProcessor: () => jf,
	CLIPFeatureExtractor: () => Nf,
	CLIPImageProcessor: () => Mf,
	ChineseCLIPFeatureExtractor: () => Af,
	ConvNextFeatureExtractor: () => Ff,
	ConvNextImageProcessor: () => Pf,
	DINOv3ViTImageProcessor: () => Bf,
	DPTFeatureExtractor: () => Wf,
	DPTImageProcessor: () => Uf,
	DeiTFeatureExtractor: () => Lf,
	DeiTImageProcessor: () => If,
	DetrFeatureExtractor: () => zf,
	DetrImageProcessor: () => Rf,
	DonutFeatureExtractor: () => Hf,
	DonutImageProcessor: () => Vf,
	EfficientNetImageProcessor: () => Gf,
	GLPNFeatureExtractor: () => Qf,
	Gemma3ImageProcessor: () => Kf,
	Gemma4ImageProcessor: () => Yf,
	Glm46VImageProcessor: () => Zf,
	GroundingDinoImageProcessor: () => $f,
	Idefics3ImageProcessor: () => ep,
	ImageFeatureExtractor: () => K,
	ImageProcessor: () => K,
	JinaCLIPImageProcessor: () => np,
	Lfm2VlImageProcessor: () => cp,
	LlavaOnevisionImageProcessor: () => lp,
	Mask2FormerImageProcessor: () => fp,
	MaskFormerFeatureExtractor: () => dp,
	MaskFormerImageProcessor: () => up,
	MobileNetV1FeatureExtractor: () => mp,
	MobileNetV1ImageProcessor: () => pp,
	MobileNetV2FeatureExtractor: () => gp,
	MobileNetV2ImageProcessor: () => hp,
	MobileNetV3FeatureExtractor: () => vp,
	MobileNetV3ImageProcessor: () => _p,
	MobileNetV4FeatureExtractor: () => bp,
	MobileNetV4ImageProcessor: () => yp,
	MobileViTFeatureExtractor: () => Sp,
	MobileViTImageProcessor: () => xp,
	NougatImageProcessor: () => Cp,
	OwlViTFeatureExtractor: () => Tp,
	OwlViTImageProcessor: () => wp,
	Owlv2ImageProcessor: () => Ep,
	Phi3VImageProcessor: () => Mp,
	PixtralImageProcessor: () => Np,
	PvtImageProcessor: () => Pp,
	Qwen2VLImageProcessor: () => Xf,
	RTDetrImageProcessor: () => Fp,
	Sam2ImageProcessor: () => Ip,
	Sam3ImageProcessor: () => Ip,
	SamImageProcessor: () => Ip,
	SapiensFeatureExtractor: () => Rp,
	SapiensImageProcessor: () => Lp,
	SegformerFeatureExtractor: () => Bp,
	SegformerImageProcessor: () => zp,
	SiglipImageProcessor: () => Vp,
	SmolVLMImageProcessor: () => ep,
	Swin2SRImageProcessor: () => Hp,
	VLMImageProcessor: () => tp,
	ViTFeatureExtractor: () => Wp,
	ViTImageProcessor: () => Up,
	VitMatteImageProcessor: () => Gp,
	VitPoseImageProcessor: () => Kp,
	YolosFeatureExtractor: () => Jp,
	YolosImageProcessor: () => qp
});
var Of = class extends K {}, kf = class extends K {}, Af = class extends K {}, jf = class extends K {}, Mf = class extends K {}, Nf = class extends Mf {}, Pf = class extends K {
	constructor(e) {
		super(e), this.crop_pct = this.config.crop_pct ?? 224 / 256;
	}
	async resize(e) {
		let t = this.size?.shortest_edge;
		if (t === void 0) throw Error("Size dictionary must contain 'shortest_edge' key.");
		if (t < 384) {
			let n = Math.floor(t / this.crop_pct), [r, i] = this.get_resize_output_image_size(e, { shortest_edge: n });
			e = await e.resize(r, i, { resample: this.resample }), e = await e.center_crop(t, t);
		} else e = await e.resize(t, t, { resample: this.resample });
		return e;
	}
}, Ff = class extends Pf {}, If = class extends K {}, Lf = class extends If {}, Rf = class extends K {
	async _call(e) {
		let t = await super._call(e), n = Wl([
			t.pixel_values.dims[0],
			64,
			64
		], 1n);
		return {
			...t,
			pixel_mask: n
		};
	}
	post_process_object_detection(...e) {
		return yf(...e);
	}
	post_process_panoptic_segmentation(...e) {
		return Tf(...e);
	}
	post_process_instance_segmentation(...e) {
		return Ef(...e);
	}
}, zf = class extends Rf {}, Bf = class extends K {}, Vf = class extends K {
	pad_image(e, t, n, r = {}) {
		let [i, a, o] = t, s = this.image_mean;
		Array.isArray(this.image_mean) || (s = Array(o).fill(s));
		let c = this.image_std;
		Array.isArray(c) || (c = Array(o).fill(s));
		let l = s.map((e, t) => -e / c[t]);
		return super.pad_image(e, t, n, {
			center: !0,
			constant_values: l,
			...r
		});
	}
}, Hf = class extends Vf {}, Uf = class extends K {}, Wf = class extends Uf {}, Gf = class extends K {
	constructor(e) {
		super(e), this.include_top = this.config.include_top ?? !0, this.include_top && (this.image_std = this.image_std.map((e) => e * e));
	}
}, Kf = class extends K {};
function qf(e, t, n, r, i) {
	let a = r * n ** 2, o = Math.sqrt(a / (e * t)), s = i * n, c = Math.floor(o * e / s) * s, l = Math.floor(o * t / s) * s;
	if (c === 0 && l === 0) throw Error(`Attempting to resize to a 0 x 0 image. Resized height should be divisible by \`pooling_kernel_size * patch_size\`=${s}.`);
	let u = Math.floor(r / i ** 2) * s;
	return c === 0 ? (c = s, l = Math.min(Math.floor(t / e) * s, u)) : l === 0 && (l = s, c = Math.min(Math.floor(e / t) * s, u)), [c, l];
}
function Jf(e, t, n, r, i, a, o) {
	let s = Math.floor(t / i), c = Math.floor(n / i), l = s * c, u = i * i * r, d = new Float32Array(a * u), f = 0;
	for (let t = 0; t < s; ++t) for (let a = 0; a < c; ++a) for (let o = 0; o < i; ++o) {
		let s = (t * i + o) * n * r + a * i * r;
		for (let t = 0; t < i; ++t) {
			let n = s + t * r;
			for (let t = 0; t < r; ++t) d[f++] = e[n + t];
		}
	}
	let p = new BigInt64Array(a * 2).fill(-1n), m = 0;
	for (let e = 0; e < s; ++e) for (let t = 0; t < c; ++t) p[m++] = BigInt(t), p[m++] = BigInt(e);
	return {
		patches: new V("float32", d, [a, u]),
		positions: new V("int64", p, [a, 2]),
		num_soft_tokens: Math.floor(l / o ** 2)
	};
}
var Yf = class extends Er {
	constructor(e) {
		super(), this.config = e, this.patch_size = e.patch_size ?? 16, this.max_soft_tokens = e.max_soft_tokens ?? 280, this.pooling_kernel_size = e.pooling_kernel_size ?? 3, this.resample = e.resample ?? 3, this.rescale_factor = e.rescale_factor ?? 1 / 255, this.do_rescale = e.do_rescale ?? !0, this.do_resize = e.do_resize ?? !0, this.do_convert_rgb = e.do_convert_rgb ?? !0;
	}
	async _call(e) {
		Array.isArray(e) || (e = [e]);
		let { patch_size: t, pooling_kernel_size: n } = this, r = this.max_soft_tokens * n ** 2, i = [], a = [], o = [];
		for (let s of e) {
			if (this.do_convert_rgb && (s = s.rgb()), this.do_resize) {
				let [e, i] = qf(s.height, s.width, t, r, n);
				(e !== s.height || i !== s.width) && (s = await s.resize(i, e, { resample: this.resample }));
			}
			let e = Float32Array.from(s.data);
			if (this.do_rescale) for (let t = 0; t < e.length; ++t) e[t] *= this.rescale_factor;
			let { patches: c, positions: l, num_soft_tokens: u } = Jf(e, s.height, s.width, s.channels, t, r, n);
			i.push(c), a.push(l), o.push(u);
		}
		return {
			pixel_values: Rl(i, 0),
			image_position_ids: Rl(a, 0),
			num_soft_tokens_per_image: o
		};
	}
}, Xf = class extends K {
	constructor(e) {
		super(e), this.min_pixels = e.min_pixels ?? e.size?.shortest_edge, this.max_pixels = e.max_pixels ?? e.size?.longest_edge, this.patch_size = e.patch_size, this.merge_size = e.merge_size;
	}
	get_resize_output_image_size(e, t) {
		let n = this.patch_size * this.merge_size;
		return wf(e.height, e.width, n, this.min_pixels, this.max_pixels);
	}
	async _call(e, ...t) {
		let { pixel_values: n, original_sizes: r, reshaped_input_sizes: i } = await super._call(e, ...t), a = n, { temporal_patch_size: o, merge_size: s, patch_size: c } = this.config;
		a.dims[0] === 1 && (a = H(Array.from({ length: o }, () => a), 0));
		let l = a.dims[0] / o, u = a.dims[1], d = Math.floor(a.dims[2] / c), f = Math.floor(a.dims[3] / c);
		return {
			pixel_values: a.view(l, o, u, Math.floor(d / s), s, c, Math.floor(f / s), s, c).permute(0, 3, 6, 4, 7, 2, 1, 5, 8).view(l * d * f, u * o * c * c),
			image_grid_thw: new V("int64", [
				l,
				d,
				f
			], [1, 3]),
			original_sizes: r,
			reshaped_input_sizes: i
		};
	}
}, Zf = class extends Xf {
	get_resize_output_image_size(e, t) {
		let n = this.patch_size * this.merge_size, r = this.config.temporal_patch_size ?? 2;
		return wf(e.height, e.width, n, this.min_pixels, this.max_pixels, r);
	}
}, Qf = class extends K {}, $f = class extends K {
	async _call(e) {
		let t = await super._call(e), n = t.pixel_values.dims, r = Kl([
			n[0],
			n[2],
			n[3]
		]);
		return {
			...t,
			pixel_mask: r
		};
	}
}, ep = class extends K {
	constructor(e) {
		super(e), this.do_image_splitting = e.do_image_splitting ?? !0, this.max_image_size = e.max_image_size;
	}
	get_resize_for_vision_encoder(e, t) {
		let [n, r] = e.dims.slice(-2), i = r / n;
		return r >= n ? (r = Math.ceil(r / t) * t, n = Math.floor(r / i), n = Math.ceil(n / t) * t) : (n = Math.ceil(n / t) * t, r = Math.floor(n * i), r = Math.ceil(r / t) * t), {
			height: n,
			width: r
		};
	}
	async _call(e, { do_image_splitting: t = null, return_row_col_info: n = !1 } = {}) {
		let r;
		if (!Array.isArray(e)) r = [[e]];
		else {
			if (e.length === 0 || !e[0]) throw Error("No images provided.");
			r = Array.isArray(e[0]) ? e : [e];
		}
		let i = [], a = [], o = [], s = [], c = [];
		for (let e of r) {
			let n = await Promise.all(e.map((e) => this.preprocess(e)));
			s.push(...n.map((e) => e.original_size)), c.push(...n.map((e) => e.reshaped_input_size)), n.forEach((e) => e.pixel_values.unsqueeze_(0));
			let { longest_edge: r } = this.max_image_size, l;
			if (t ?? this.do_image_splitting) {
				let e = Array(n.length), t = Array(n.length);
				l = await Promise.all(n.map(async (n, i) => {
					let a = this.get_resize_for_vision_encoder(n.pixel_values, r), o = await kl(n.pixel_values, { size: [a.height, a.width] }), { frames: s, num_splits_h: c, num_splits_w: l } = await this.split_image(o, this.max_image_size);
					return e[i] = c, t[i] = l, H(s, 0);
				})), a.push(e), o.push(t);
			} else {
				let e = [r, r];
				l = await Promise.all(n.map((t) => kl(t.pixel_values, { size: e }))), a.push(Array(n.length).fill(0)), o.push(Array(n.length).fill(0));
			}
			i.push(H(l, 0));
		}
		let l = i.length, [u, d, f, p] = i[0].dims, m, h;
		if (l === 1) m = i[0].unsqueeze_(0), h = Wl([
			l,
			u,
			f,
			p
		], !0);
		else {
			let e = Math.max(...i.map((e) => e.dims.at(0)));
			h = Wl([
				l,
				e,
				f,
				p
			], !0);
			let t = h.data, n = e * f * p;
			for (let r = 0; r < l; ++r) {
				let a = i[r].dims[0];
				if (a < e) {
					i[r] = H([i[r], Wl([
						e - a,
						d,
						f,
						p
					], 0)], 0);
					let o = r * n + a * f * p, s = (r + 1) * n;
					t.fill(!1, o, s);
				}
			}
			m = Rl(i, 0);
		}
		return {
			pixel_values: m,
			pixel_attention_mask: h,
			original_sizes: s,
			reshaped_input_sizes: c,
			...n ? {
				rows: a,
				cols: o
			} : {}
		};
	}
	async split_image(e, { longest_edge: t }) {
		let n = t, r = t, i = [], [a, o] = e.dims.slice(-2), s = 0, c = 0;
		if (a > n || o > r) {
			s = Math.ceil(a / n), c = Math.ceil(o / r);
			let t = Math.ceil(a / s), l = Math.ceil(o / c);
			for (let n = 0; n < s; ++n) for (let r = 0; r < c; ++r) {
				let u, d, f, p;
				n === s - 1 ? (d = a - t, p = a) : (d = n * t, p = (n + 1) * t), r === c - 1 ? (u = o - l, f = o) : (u = r * l, f = (r + 1) * l);
				let m = await Nl(e, [d, u], [p, f], [2, 3]);
				i.push(m);
			}
			let u = n, d = r;
			(a !== u || o !== d) && (e = await kl(e, { size: [u, d] }));
		}
		return i.push(e), {
			frames: i,
			num_splits_h: s,
			num_splits_w: c
		};
	}
}, tp = class extends K {
	constructor(e) {
		super({
			do_pad: !0,
			pad_size: {
				width: e.image_size,
				height: e.image_size
			},
			...e
		}), this.constant_values = this.config.background_color.map((e) => e * this.rescale_factor);
	}
	pad_image(e, t, n, r) {
		return super.pad_image(e, t, n, {
			constant_values: this.constant_values,
			center: !0,
			...r
		});
	}
}, np = class extends K {
	constructor(e) {
		let { resize_mode: t, fill_color: n, interpolation: r, size: i, ...a } = e, o = t === "squash" ? {
			width: i,
			height: i
		} : t === "shortest" ? { shortest_edge: i } : { longest_edge: i }, s = r === "bicubic" ? 3 : 2;
		super({
			...a,
			size: o,
			resample: s,
			do_center_crop: !0,
			crop_size: i,
			do_normalize: !0
		});
	}
};
function rp(e, t) {
	return Math.round(e / t) * t;
}
function ip(e, t, n, r, i) {
	let a = Infinity, o = [1, 1], s = n * r;
	for (let n of t) {
		let t = Math.abs(e - n[0] / n[1]);
		t < a ? (a = t, o = n) : t === a && s > .5 * i * i * n[0] * n[1] && (o = n);
	}
	return o;
}
function ap(e, t) {
	let n = [], r = /* @__PURE__ */ new Set();
	for (let i = e; i <= t; ++i) for (let a = 1; a <= i; ++a) for (let o = 1; o <= i; ++o) {
		let i = a * o;
		if (i >= e && i <= t) {
			let e = a << 16 | o;
			r.has(e) || (r.add(e), n.push([a, o]));
		}
	}
	return n.sort((e, t) => e[0] * e[1] - t[0] * t[1]);
}
function op(e, t) {
	let [n, r, i, a] = e.dims, o = Math.floor(i / t), s = Math.floor(a / t), c = t * t * r, l = e.data, u = new Float32Array(n * o * s * c), d = i * a;
	for (let e = 0; e < n; ++e) {
		let n = e * r * d, i = e * o * s * c;
		for (let e = 0; e < o; ++e) for (let o = 0; o < s; ++o) {
			let f = i + (e * s + o) * c;
			for (let i = 0; i < t; ++i) {
				let s = (e * t + i) * a + o * t;
				for (let e = 0; e < t; ++e) {
					let t = s + e;
					for (let e = 0; e < r; ++e) u[f++] = l[n + e * d + t];
				}
			}
		}
	}
	return new V("float32", u, [
		n,
		o * s,
		c
	]);
}
function sp(e, t) {
	let [, n, r] = e.dims, i = new BigInt64Array(t);
	i.fill(1n, 0, n);
	let a = e;
	if (n < t) {
		let n = new Float32Array(t * r);
		n.set(e.data), a = new V("float32", n, [
			1,
			t,
			r
		]);
	}
	return {
		padded: a,
		mask: new V("int64", i, [t])
	};
}
var cp = class extends K {
	constructor(e) {
		super(e), this.downsample_factor = e.downsample_factor ?? 2, this.do_image_splitting = e.do_image_splitting ?? !0, this.min_tiles = e.min_tiles ?? 2, this.max_tiles = e.max_tiles ?? 10, this.use_thumbnail = e.use_thumbnail ?? !0, this.min_image_tokens = e.min_image_tokens ?? 64, this.max_image_tokens = e.max_image_tokens ?? 256, this.encoder_patch_size = e.encoder_patch_size ?? e.patch_size ?? 16, this.tile_size = e.tile_size ?? 512, this.max_pixels_tolerance = e.max_pixels_tolerance ?? 2, this.return_row_col_info = e.return_row_col_info ?? !1;
		let t = this.max_image_tokens * this.downsample_factor ** 2, n = this.do_image_splitting ? (this.tile_size / this.encoder_patch_size) ** 2 : 0;
		this.max_num_patches = Math.max(t, n);
	}
	_is_image_too_large(e, t) {
		let n = this.encoder_patch_size * this.downsample_factor;
		return Math.max(this.encoder_patch_size, rp(e, n)) * Math.max(this.encoder_patch_size, rp(t, n)) > this.max_image_tokens * (this.encoder_patch_size * this.downsample_factor) ** 2 * this.max_pixels_tolerance;
	}
	_get_grid_layout(e, t) {
		let n = ap(this.min_tiles, this.max_tiles), [r, i] = ip(t / e, n, t, e, this.tile_size);
		return {
			grid_width: r,
			grid_height: i,
			target_width: this.tile_size * r,
			target_height: this.tile_size * i
		};
	}
	async _call(e, { return_row_col_info: t = null } = {}) {
		let n;
		n = Array.isArray(e) ? Array.isArray(e[0]) ? e : [e] : [[e]];
		let r = [], i = [], a = [], o = [], s = [], c = [];
		for (let e of n) {
			let t = await Promise.all(e.map((e) => this.preprocess(e, { do_pad: !1 })));
			for (let { pixel_values: e } of t) {
				let [, t, n] = e.dims, l = e.unsqueeze_(0), u = this.encoder_patch_size * this.downsample_factor, d = u ** 2, [f, p] = wf(Math.max(u, t), Math.max(u, n), u, this.min_image_tokens * d, this.max_image_tokens * d).map((e) => Math.max(u, e)), m, h = 1, g = 1, _ = this._is_image_too_large(t, n), v = this.do_image_splitting && (this.min_tiles !== 1 || this.max_tiles !== 1);
				if (_ && v) {
					let { grid_width: e, grid_height: r, target_width: i, target_height: a } = this._get_grid_layout(t, n);
					h = r, g = e;
					let o = await kl(l, { size: [a, i] });
					m = [];
					for (let t = 0; t < r; ++t) for (let n = 0; n < e; ++n) {
						let e = t * this.tile_size, r = n * this.tile_size;
						m.push(o.slice(null, null, [e, e + this.tile_size], [r, r + this.tile_size]));
					}
					this.use_thumbnail && e * r !== 1 && m.push(await kl(l, { size: [p, f] }));
				} else m = [await kl(l, { size: [p, f] })];
				for (let e of m) {
					let [, , t, n] = e.dims, { padded: o, mask: s } = sp(op(e, this.encoder_patch_size), this.max_num_patches);
					r.push(o), i.push(s), a.push([Math.floor(t / this.encoder_patch_size), Math.floor(n / this.encoder_patch_size)]);
				}
				o.push(h), s.push(g), c.push([p, f]);
			}
		}
		let l = {
			pixel_values: H(r, 0),
			pixel_attention_mask: Rl(i, 0),
			spatial_shapes: new V("int64", BigInt64Array.from(a.flat(), BigInt), [a.length, 2])
		};
		return (t ?? this.return_row_col_info) && (l.image_rows = o, l.image_cols = s, l.image_sizes = c), l;
	}
}, lp = class extends K {}, up = class extends K {
	post_process_panoptic_segmentation(...e) {
		return Tf(...e);
	}
	post_process_instance_segmentation(...e) {
		return Ef(...e);
	}
}, dp = class extends up {}, fp = class extends up {}, pp = class extends K {}, mp = class extends pp {}, hp = class extends K {}, gp = class extends hp {}, _p = class extends K {}, vp = class extends _p {}, yp = class extends K {}, bp = class extends yp {}, xp = class extends K {}, Sp = class extends xp {}, Cp = class extends Vf {}, wp = class extends K {
	post_process_object_detection(...e) {
		return yf(...e);
	}
}, Tp = class extends wp {}, Ep = class extends wp {}, Dp = 336, Op = [2, 3], { ceil: kp, floor: Ap, sqrt: jp } = Math, Mp = class extends K {
	constructor(e) {
		super({
			...e,
			do_normalize: !0,
			do_pad: !0,
			pad_size: "custom",
			do_convert_rgb: !0,
			do_resize: !0
		}), this._num_crops = e.num_crops;
	}
	calc_num_image_tokens_from_image_size(e, t) {
		let { num_img_tokens: n } = this.config;
		return Ap((Ap(t / Dp) * Ap(e / Dp) + 1) * n + 1 + (Ap(t / Dp) + 1) * jp(n));
	}
	get_resize_output_image_size(e, t) {
		let n = this._num_crops, [r, i] = e.size, a = r / i, o = 1;
		for (; o * Math.ceil(o / a) <= n;) o += 1;
		--o;
		let s = Math.floor(o * 336);
		return [s, Math.floor(s / a)];
	}
	pad_image(e, t, n, r = {}) {
		let [i, a] = t, o = Dp * kp(i / Dp), s = Dp * kp(a / Dp), c = [
			1,
			1,
			1
		].map((e, t) => (e - this.image_mean[t]) / this.image_std[t]);
		return super.pad_image(e, t, {
			width: s,
			height: o
		}, {
			center: !0,
			constant_values: c,
			...r
		});
	}
	async _call(e, { num_crops: t = null } = {}) {
		if (this._num_crops = t ??= this.config.num_crops, t < 4 || jp(t) % 1 != 0) throw Error("num_crops must be a square number >= 4");
		Array.isArray(e) || (e = [e]);
		let n = e.length, r = await Promise.all(e.map((e) => this.preprocess(e))), i = r.map((e) => e.original_size), a = r.map((e) => e.reshaped_input_size), o = [];
		for (let { pixel_values: e } of r) {
			e.unsqueeze_(0);
			let [n, r] = e.dims.slice(-2), i = await kl(e, {
				size: [Dp, Dp],
				mode: "bicubic"
			});
			if (t > 0) {
				let a = [], s = jp(t), c = Ap(r / s), l = Ap(n / s);
				for (let t = 0; t < s; ++t) for (let i = 0; i < s; ++i) {
					let o, u, d, f;
					t === s - 1 ? (u = n - l, f = n) : (u = t * l, f = (t + 1) * l), i === s - 1 ? (o = r - c, d = r) : (o = i * c, d = (i + 1) * c);
					let p = await Nl(e, [u, o], [f, d], Op);
					a.push(p);
				}
				let u = await kl(H(a, 0), {
					size: [Dp, Dp],
					mode: "bicubic"
				});
				o.push(H([i, u], 0));
			} else o.push(i);
		}
		let s = Rl(o, 0), c = a.map((e) => e.map((e) => Dp * kp(e / Dp)));
		return {
			pixel_values: s,
			original_sizes: i,
			reshaped_input_sizes: a,
			image_sizes: new V("int64", c.flat(), [n, 2]),
			num_img_tokens: c.map(([e, t]) => this.calc_num_image_tokens_from_image_size(t, e))
		};
	}
}, Np = class extends K {
	get_resize_output_image_size(e, t) {
		let { longest_edge: n } = t;
		if (n === void 0) throw Error("size must contain 'longest_edge'");
		let [r, i] = e.size, a = Math.max(r, i) / n, o = r, s = i;
		a > 1 && (o = Math.floor(r / a), s = Math.floor(i / a));
		let { patch_size: c, spatial_merge_size: l } = this.config;
		if (!l) throw Error("config must contain 'spatial_merge_size'");
		let u = c * l, d = Math.floor((o - 1) / u) + 1, f = Math.floor((s - 1) / u) + 1;
		return [d * u, f * u];
	}
}, Pp = class extends K {}, Fp = class extends K {
	post_process_object_detection(...e) {
		return yf(...e);
	}
}, Ip = class extends K {
	reshape_input_points(e, t, n, r = !1) {
		e = structuredClone(e);
		let i = jr(e);
		if (i.length === 3) r || (i = [1, ...i]), e = [e];
		else if (i.length !== 4) throw Error("The input_points must be a 4D tensor of shape `batch_size`, `point_batch_size`, `nb_points_per_image`, `2`.");
		for (let r = 0; r < e.length; ++r) {
			let [i, a] = t[r], [o, s] = n[r], c = [s / a, o / i];
			for (let t = 0; t < e[r].length; ++t) for (let n = 0; n < e[r][t].length; ++n) for (let i = 0; i < e[r][t][n].length; ++i) e[r][t][n][i] *= c[i % 2];
		}
		return new V("float32", Float32Array.from(e.flat(Infinity)), i);
	}
	add_input_labels(e, t) {
		let n = jr(e);
		if (n.length === 2) n = [1, ...n], e = [e];
		else if (n.length !== 3) throw Error("The input_points must be a 4D tensor of shape `batch_size`, `point_batch_size`, `nb_points_per_image`, `2`.");
		if (n.some((e, n) => e !== t.dims[n])) throw Error(`The first ${n.length} dimensions of 'input_points' and 'input_labels' must be the same.`);
		return new V("int64", e.flat(Infinity).map(BigInt), n);
	}
	async _call(e, { input_points: t = null, input_labels: n = null, input_boxes: r = null } = {}) {
		let i = await super._call(e);
		if (t && (i.input_points = this.reshape_input_points(t, i.original_sizes, i.reshaped_input_sizes)), n) {
			if (!i.input_points) throw Error("`input_points` must be provided if `input_labels` are provided.");
			i.input_labels = this.add_input_labels(n, i.input_points);
		}
		return r && (i.input_boxes = this.reshape_input_points(r, i.original_sizes, i.reshaped_input_sizes, !0)), i;
	}
	async post_process_masks(e, t, n, { mask_threshold: r = 0, binarize: i = !0, pad_size: a = null } = {}) {
		let o = [];
		a = a ?? this.pad_size ?? this.size;
		let s = [a.height, a.width];
		for (let a = 0; a < t.length; ++a) {
			let c = t[a], l = n[a], u = await kl(e[a], {
				mode: "bilinear",
				size: s
			});
			if (u = u.slice(null, null, [0, l[0]], [0, l[1]]), u = await kl(u, {
				mode: "bilinear",
				size: c
			}), i) {
				let e = u.data, t = new Uint8Array(e.length);
				for (let n = 0; n < e.length; ++n) e[n] > r && (t[n] = 1);
				u = new V("bool", t, u.dims);
			}
			o.push(u);
		}
		return o;
	}
	generate_crop_boxes(e, t, { crop_n_layers: n = 0, overlap_ratio: r = 512 / 1500, points_per_crop: i = 32, crop_n_points_downscale_factor: a = 1 } = {}) {}
}, Lp = class extends K {
	post_process_semantic_segmentation(...e) {
		return bf(...e);
	}
}, Rp = class extends Lp {}, zp = class extends K {
	post_process_semantic_segmentation(...e) {
		return bf(...e);
	}
}, Bp = class extends zp {}, Vp = class extends K {}, Hp = class extends K {
	pad_image(e, t, n, r = {}) {
		let [i, a, o] = t;
		return super.pad_image(e, t, {
			width: a + (n - a % n) % n,
			height: i + (n - i % n) % n
		}, {
			mode: "symmetric",
			center: !1,
			constant_values: -1,
			...r
		});
	}
}, Up = class extends K {}, Wp = class extends Up {}, Gp = class extends K {
	async _call(e, t) {
		Array.isArray(e) || (e = [e]), Array.isArray(t) || (t = [t]);
		let n = await Promise.all(e.map((e) => this.preprocess(e))), r = await Promise.all(t.map((e) => this.preprocess(e, {
			do_normalize: !1,
			do_convert_rgb: !1,
			do_convert_grayscale: !0
		})));
		return {
			pixel_values: Rl(n.map((e, t) => H([e.pixel_values, r[t].pixel_values], 0)), 0),
			original_sizes: n.map((e) => e.original_size),
			reshaped_input_sizes: n.map((e) => e.reshaped_input_size)
		};
	}
}, Kp = class extends K {
	post_process_pose_estimation(e, t, { threshold: n = null } = {}) {
		let r = e.tolist(), [i, a, o, s] = e.dims, c = [];
		for (let e = 0; e < i; ++e) {
			let i = r[e], a = t[e], l = [];
			for (let e = 0; e < a.length; ++e) {
				let t = a[e], r = [], c = [], u = [], d = t.at(-2) / s, f = t.at(-1) / o;
				for (let e = 0; e < i.length; ++e) {
					let [t, a] = [0, 0], o = 0, s = -Infinity, l = i[e];
					for (let e = 0; e < l.length; ++e) {
						let n = l[e];
						for (let r = 0; r < n.length; ++r) {
							let i = n[r];
							o += i, s = Math.max(s, i), t += (r + .5) * i, a += e * i;
						}
					}
					if (n != null && s < n) continue;
					let p = [d * t / o, f * a / o];
					r.push(p), u.push(e), c.push(s);
				}
				l.push({
					bbox: t,
					scores: c,
					labels: u,
					keypoints: r
				});
			}
			c.push(l);
		}
		return c;
	}
}, qp = class extends K {
	post_process_object_detection(...e) {
		return yf(...e);
	}
}, Jp = class extends qp {}, Yp = class {
	static async from_pretrained(e, t = {}) {
		let n = await Ac(e, cd, !0, t), r = n.image_processor_type ?? n.feature_extractor_type, i = Df[r?.replace(/Fast$/, "")];
		return i ||= (r !== void 0 && A.warn(`Image processor type '${r}' not found, assuming base ImageProcessor. Please report this at ${od}.`), K), new i(n);
	}
}, Xp = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	constructor(e, t, n) {
		super(e, t, n);
		let { tasks_answer_post_processing_type: r, task_prompts_without_inputs: i, task_prompts_with_input: a } = this.image_processor.config;
		this.tasks_answer_post_processing_type = new Map(Object.entries(r ?? {})), this.task_prompts_without_inputs = new Map(Object.entries(i ?? {})), this.task_prompts_with_input = new Map(Object.entries(a ?? {})), this.regexes = {
			quad_boxes: /(.+?)<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>/gm,
			bboxes: /([^<]+)?<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>/gm
		}, this.size_per_bin = 1e3;
	}
	construct_prompts(e) {
		typeof e == "string" && (e = [e]);
		let t = [];
		for (let n of e) if (this.task_prompts_without_inputs.has(n)) t.push(this.task_prompts_without_inputs.get(n));
		else {
			for (let [e, r] of this.task_prompts_with_input) if (n.includes(e)) {
				t.push(r.replaceAll("{input}", n).replaceAll(e, ""));
				break;
			}
			t.length !== e.length && t.push(n);
		}
		return t;
	}
	post_process_generation(e, t, n) {
		let r = this.tasks_answer_post_processing_type.get(t) ?? "pure_text";
		e = e.replaceAll("<s>", "").replaceAll("</s>", "");
		let i;
		switch (r) {
			case "pure_text":
				i = e;
				break;
			case "description_with_bboxes":
			case "bboxes":
			case "phrase_grounding":
			case "ocr":
				let a = r === "ocr" ? "quad_boxes" : "bboxes", o = e.matchAll(this.regexes[a]), s = [], c = [];
				for (let [e, t, ...r] of o) s.push(t ? t.trim() : s.at(-1) ?? ""), c.push(r.map((e, t) => (Number(e) + .5) / this.size_per_bin * n[t % 2]));
				i = {
					labels: s,
					[a]: c
				};
				break;
			default: throw Error(`Task "${t}" (of type "${r}") not yet implemented.`);
		}
		return { [t]: i };
	}
	async _call(e, t = null, n = {}) {
		if (!e && !t) throw Error("Either text or images must be provided");
		let r = await this.image_processor(e, n), i = t ? this.tokenizer(this.construct_prompts(t), n) : {};
		return {
			...r,
			...i
		};
	}
}, Zp = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	static uses_processor_config = !0;
	static uses_chat_template_file = !0;
	constructor(e, t, n) {
		super(e, t, n), this.image_seq_length = this.config.image_seq_length;
		let { boi_token: r, image_token: i, eoi_token: a } = this.tokenizer.config;
		this.boi_token = r, this.image_token = i, this.eoi_token = a;
		let o = i.repeat(this.image_seq_length);
		this.full_image_sequence = `

${r}${o}${a}

`;
	}
	async _call(e, t = null, n = {}) {
		typeof e == "string" && (e = [e]);
		let r;
		return t && (r = await this.image_processor(t, n), e = e.map((e) => e.replaceAll(this.boi_token, this.full_image_sequence))), {
			...this.tokenizer(e, n),
			...r
		};
	}
}, Qp = class extends G {
	static image_processor_class = Yp;
	static feature_extractor_class = af;
	static tokenizer_class = W;
	static uses_processor_config = !0;
	static uses_chat_template_file = !0;
	constructor(e, t, n) {
		super(e, t, n), this.audio_seq_length = this.config.audio_seq_length, this.image_seq_length = this.config.image_seq_length;
		let { audio_token_id: r, boa_token: i, audio_token: a, eoa_token: o, image_token_id: s, boi_token: c, image_token: l, eoi_token: u } = this.tokenizer.config;
		this.audio_token_id = r, this.boa_token = i, this.audio_token = a;
		let d = a.repeat(this.audio_seq_length);
		this.full_audio_sequence = `

${i}${d}${o}

`, this.image_token_id = s, this.boi_token = c, this.image_token = l;
		let f = l.repeat(this.image_seq_length);
		this.full_image_sequence = `

${c}${f}${u}

`;
	}
	async _call(e, t = null, n = null, r = {}) {
		typeof e == "string" && (e = [e]);
		let i;
		n && (i = await this.feature_extractor(n, r), e = e.map((e) => e.replaceAll(this.audio_token, this.full_audio_sequence)));
		let a;
		return t && (a = await this.image_processor(t, r), e = e.map((e) => e.replaceAll(this.image_token, this.full_image_sequence))), {
			...this.tokenizer(e, r),
			...a,
			...i
		};
	}
}, $p = class extends G {
	static uses_processor_config = !0;
	static uses_chat_template_file = !0;
	constructor(e, t, n) {
		super(e, t, n), this.audio_ms_per_token = this.config.audio_ms_per_token ?? 40, this.audio_seq_length = this.config.audio_seq_length ?? 750, this.image_seq_length = this.config.image_seq_length ?? 280;
		let { audio_token: r, boa_token: i, eoa_token: a, image_token: o, boi_token: s, eoi_token: c } = this.tokenizer.config;
		this.audio_token = r, this.boa_token = i, this.eoa_token = a, this.image_token = o, this.boi_token = s, this.eoi_token = c;
	}
	static async from_pretrained(e, t = {}) {
		let [n, r, i] = await Promise.all([
			Ac(e, ld, !0, t),
			W.from_pretrained(e, t),
			kc(e, ud, !1, t)
		]), a = { tokenizer: r };
		return n.image_processor && (a.image_processor = new Yf(n.image_processor)), n.feature_extractor && (a.feature_extractor = new qd(n.feature_extractor)), new this(n, a, i);
	}
	_compute_audio_num_tokens(e, t) {
		let n = Math.round(t * 20 / 1e3), r = Math.round(t * 10 / 1e3), i = Math.floor(n / 2), a = Math.floor((e + i - n - 1) / r) + 1;
		if (a <= 0) return 0;
		for (let e = 0; e < 2; ++e) a = Math.floor((a - 1) / 2) + 1;
		return Math.min(a, this.audio_seq_length);
	}
	async _call(e, t = null, n = null, r = {}) {
		typeof e == "string" && (e = [e]);
		let i;
		if (t) {
			i = await this.image_processor(t, r);
			let n = i.num_soft_tokens_per_image, a = 0;
			e = e.map((e) => e.replaceAll(this.image_token, () => `

${this.boi_token}${this.image_token.repeat(n[a++])}${this.eoi_token}

`));
		}
		let a;
		if (n) {
			let t = Array.isArray(n) ? n : [n];
			a = await this.feature_extractor(t[0], r);
			let i = this.feature_extractor.config.sampling_rate ?? 16e3, o = 0;
			e = e.map((e) => e.replaceAll(this.audio_token, () => `

${this.boa_token}${this.audio_token.repeat(this._compute_audio_num_tokens(t[o++].length, i))}${this.eoa_token}

`));
		}
		return {
			...this.tokenizer(e, r),
			...i,
			...a
		};
	}
}, em = class extends G {
	static image_processor_class = Yp;
	static tokenizer_class = W;
	static image_token = "<|image_pad|>";
	async _call(e, t = null, ...n) {
		Array.isArray(e) || (e = [e]);
		let r, i;
		if (t && (r = await this.image_processor(t), i = r.image_grid_thw), i) {
			let t = this.image_processor.config.merge_size ** 2, n = 0, r = this.constructor.image_token, a = i.tolist();
			e = e.map((e) => {
				for (; e.includes(r);) {
					let i = Number(a[n++].reduce((e, t) => e * t, 1n));
					e = e.replace(r, "<|placeholder|>".repeat(Math.floor(i / t)));
				}
				return e.replaceAll("<|placeholder|>", r);
			});
		}
		return {
			...this.tokenizer(e),
			...r
		};
	}
}, tm = class extends em {
	static image_token = "<|image|>";
}, nm = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	static uses_processor_config = !0;
	_get_num_audio_features(e) {
		let { hop_length: t } = this.feature_extractor.config.melspec_kwargs, { projector_window_size: n, projector_downsample_rate: r } = this.feature_extractor.config, i = Math.floor(n / r), a = Math.floor(e / t) + 1, o = Math.floor(a / 2);
		return Math.ceil(o / n) * i;
	}
	async _call(e, t = null, n = {}) {
		if (Array.isArray(e)) throw Error("Batched inputs are not supported yet.");
		let r = {};
		if (t) {
			let { input_features: n } = await this.feature_extractor(t);
			r.input_features = n;
			let i = this._get_num_audio_features(t.length);
			r.input_features_mask = new V("bool", new Uint8Array(i).fill(1), [1, i]);
			let a = this.config.audio_token ?? "<|audio|>";
			if (!e.includes(a)) throw Error(`The input text does not contain the audio token ${a}.`);
			e = e.replaceAll(a, a.repeat(i));
		}
		return {
			...this.tokenizer(e, {
				add_special_tokens: !1,
				...n
			}),
			...r
		};
	}
};
function rm(e, t) {
	let n = e.dims.at(-1) - 1, r = e.tolist();
	r.fill(!1, 0, 1), r.fill(!1, n);
	let i = t.tolist();
	return r.map((e, t) => e ? t : null).filter((e) => e !== null).map((e) => i[e]);
}
var im = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	async _call(e, t, n = {}) {
		let r = e ? await this.image_processor(e, n) : {};
		return {
			...t ? this.tokenizer(t, n) : {},
			...r
		};
	}
	post_process_grounded_object_detection(e, t, { box_threshold: n = .25, text_threshold: r = .25, target_sizes: i = null } = {}) {
		let { logits: a, pred_boxes: o } = e, s = a.dims[0];
		if (i !== null && i.length !== s) throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
		let c = a.dims.at(1), l = a.sigmoid(), u = l.max(-1).tolist(), d = o.tolist().map((e) => e.map((e) => vf(e))), f = [];
		for (let e = 0; e < s; ++e) {
			let a = i === null ? null : i[e];
			a !== null && (d[e] = d[e].map((e) => e.map((e, t) => e * a[(t + 1) % 2])));
			let o = u[e], s = [], p = [], m = [];
			for (let i = 0; i < c; ++i) {
				let a = o[i];
				if (a <= n) continue;
				let c = d[e][i], u = l[e][i];
				s.push(a), m.push(c);
				let f = rm(u.gt(r), t[e]);
				p.push(f);
			}
			f.push({
				scores: s,
				boxes: m,
				labels: this.batch_decode(p)
			});
		}
		return f;
	}
};
function am(e, t, n, r, i, a) {
	let o = "";
	for (let a = 0; a < t; ++a) {
		for (let t = 0; t < n; ++t) o += r + `<row_${a + 1}_col_${t + 1}>` + i.repeat(e);
		o += "\n";
	}
	return o += `
${r}${a}` + i.repeat(e) + `${r}`, o;
}
function om(e, t, n, r) {
	return `${t}${r}` + n.repeat(e) + `${t}`;
}
function sm(e, t, n, r, i, a) {
	return e === 0 && t === 0 ? om(n, r, i, a) : am(n, e, t, r, i, a);
}
var cm = class extends G {
	static image_processor_class = Yp;
	static tokenizer_class = W;
	static uses_processor_config = !0;
	fake_image_token = "<fake_token_around_image>";
	image_token = "<image>";
	global_img_token = "<global-img>";
	async _call(e, t = null, n = {}) {
		n.return_row_col_info ??= !0;
		let r;
		t && (r = await this.image_processor(t, n)), Array.isArray(e) || (e = [e]);
		let i = r.rows ?? [Array(e.length).fill(0)], a = r.cols ?? [Array(e.length).fill(0)], o = this.config.image_seq_len, s = [], c = [];
		for (let t = 0; t < e.length; ++t) {
			let n = e[t], r = i[t], l = a[t];
			s.push(Ir(n, this.image_token));
			let u = r.map((e, t) => sm(e, l[t], o, this.fake_image_token, this.image_token, this.global_img_token)), d = n.split(this.image_token);
			if (d.length === 0) throw Error("The image token should be present in the text.");
			let f = d[0];
			for (let e = 0; e < u.length; ++e) f += u[e] + d[e + 1];
			c.push(f);
		}
		return {
			...this.tokenizer(c),
			...r
		};
	}
}, lm = class extends G {
	static image_processor_class = Yp;
	static tokenizer_class = W;
	static uses_processor_config = !0;
	constructor(e, t, n) {
		super(e, t, n), this.image_tag = this.config.image_tag, this.image_start_tag = this.config.image_start_tag, this.image_end_tag = this.config.image_end_tag, this.num_image_tokens = this.config.num_image_tokens;
	}
	async _call(e, { images: t = null, chat_template: n = "default" } = {}) {
		t ? Array.isArray(t) || (t = [t]) : t = await Promise.all(e.filter((e) => e.images).flatMap((e) => e.images).map((e) => hf.read(e)));
		let r = this.tokenizer, i = r.apply_chat_template(e, {
			tokenize: !1,
			add_generation_prompt: !0,
			chat_template: n
		}), a = (e) => r.encode(e, { add_special_tokens: !1 }), o = i.split(this.image_tag), s = o.length - 1;
		if (t.length !== s) throw Error(`Number of images provided (${t.length}) does not match number of "${this.image_tag}" image tags (${s})`);
		let [c, l, u] = r.convert_tokens_to_ids([
			this.image_tag,
			this.image_start_tag,
			this.image_end_tag
		]), d = a(o[0]), f = Array(d.length).fill(!1);
		for (let e = 1; e < o.length; ++e) {
			let t = Array(this.num_image_tokens).fill(c), n = a(o[e]);
			d = Mr(d, [l], t, [u], n);
			let r = Array(this.num_image_tokens).fill(!0);
			f = Mr(f, [!1], r, [!1], Array(n.length).fill(!1));
		}
		let p = [1, d.length], m = {
			input_ids: new V("int64", d, p),
			attention_mask: new V("int64", Array(d.length).fill(1), p),
			images_seq_mask: new V("bool", f, p),
			images_emb_mask: new V("bool", Array(s * this.num_image_tokens).fill(!0), [
				1,
				s,
				this.num_image_tokens
			])
		};
		if (t && t.length > 0) {
			let e = await this.image_processor(t);
			return e.pixel_values.unsqueeze_(0), {
				...m,
				...e
			};
		}
		return m;
	}
}, um = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	async _call(e = null, t = null, n = {}) {
		if (!e && !t) throw Error("Either text or images must be provided");
		let r = e ? this.tokenizer(e, n) : {}, i = t ? await this.image_processor(t, n) : {};
		return {
			...r,
			...i
		};
	}
}, dm = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	async _call(e, t = null, n = {}) {
		let { image_rows: r, image_cols: i, image_sizes: a, ...o } = await this.image_processor(e, {
			...n,
			return_row_col_info: !0
		});
		if (t) {
			let e = this.config.image_token ?? "<image>", { tile_size: n = 512, downsample_factor: o = 2, encoder_patch_size: s = 16, use_thumbnail: c = !0 } = this.image_processor.config, l = (e) => Math.ceil(Math.floor(e / s) / o), u = l(n) ** 2, d = this.config.image_start_token ?? "<|image_start|>", f = this.config.image_end_token ?? "<|image_end|>", p = this.config.image_thumbnail ?? "<|img_thumbnail|>";
			Array.isArray(t) || (t = [t]);
			let m = 0;
			t = t.map((t) => {
				let n = t.split(e);
				return n[0] + n.slice(1).map((t) => {
					let n = m++, [o, s] = a[n], h = r[n], g = i[n], _ = l(o) * l(s), v = d;
					if (h > 1 || g > 1) {
						let t = e.repeat(u);
						for (let e = 0; e < h; ++e) for (let n = 0; n < g; ++n) v += `<|img_row_${e + 1}_col_${n + 1}|>` + t;
						c && (v += p + e.repeat(_));
					} else v += e.repeat(_);
					return v + f + t;
				}).join("");
			});
		}
		return {
			...o,
			...t ? this.tokenizer(t, n) : {}
		};
	}
}, fm = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	static uses_processor_config = !0;
	async _call(e, t = null, n = {}) {
		let r = await this.image_processor(e, n);
		if (t) {
			let [e, n] = r.pixel_values.dims.slice(-2), { image_token: i, patch_size: a, num_additional_image_tokens: o } = this.config, s = Math.floor(e / a) * Math.floor(n / a) + o;
			t = structuredClone(t), Array.isArray(t) || (t = [t]);
			for (let e = 0; e < t.length; ++e) t[e] = t[e].replace(i, i.repeat(s));
		}
		let i = t ? this.tokenizer(t, n) : {};
		return {
			...r,
			...i
		};
	}
}, pm = {
	char: ["char_decode", 1],
	bpe: ["bpe_decode", 2],
	wp: ["wp_decode", 102]
}, mm = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	get char_tokenizer() {
		return this.components.char_tokenizer;
	}
	get bpe_tokenizer() {
		return this.components.bpe_tokenizer;
	}
	get wp_tokenizer() {
		return this.components.wp_tokenizer;
	}
	_decode_helper(e, t) {
		if (!pm.hasOwnProperty(t)) throw Error(`Format ${t} is not supported.`);
		let [n, r] = pm[t], i = this[n].bind(this), [a, o] = e.dims, s = [], c = [], l = e.tolist();
		for (let e = 0; e < a; ++e) {
			let t = l[e], n = [], i = [];
			for (let e = 1; e < o; ++e) {
				let [a, o] = Ic(Nc(t[e]));
				if (i.push(a), o == r) break;
				n.push(o);
			}
			let a = i.length > 0 ? i.reduce((e, t) => e * t, 1) : 0;
			c.push(n), s.push(a);
		}
		return [i(c), s];
	}
	char_decode(e) {
		return this.char_tokenizer.batch_decode(e).map((e) => e.replaceAll(" ", ""));
	}
	bpe_decode(e) {
		return this.bpe_tokenizer.batch_decode(e);
	}
	wp_decode(e) {
		return this.wp_tokenizer.batch_decode(e).map((e) => e.replaceAll(" ", ""));
	}
	batch_decode([e, t, n]) {
		let [r, i] = this._decode_helper(e, "char"), [a, o] = this._decode_helper(t, "bpe"), [s, c] = this._decode_helper(n, "wp"), l = [], u = [];
		for (let e = 0; e < r.length; ++e) {
			let [t, n] = Ic([
				i[e],
				o[e],
				c[e]
			]);
			l.push([
				r[e],
				a[e],
				s[e]
			][n]), u.push(t);
		}
		return {
			generated_text: l,
			scores: u,
			char_preds: r,
			bpe_preds: a,
			wp_preds: s
		};
	}
	static async from_pretrained(...e) {
		let t = await super.from_pretrained(...e), n = await W.from_pretrained("Xenova/gpt2"), r = await W.from_pretrained("Xenova/bert-base-uncased");
		return t.components = {
			image_processor: t.image_processor,
			char_tokenizer: t.tokenizer,
			bpe_tokenizer: n,
			wp_tokenizer: r
		}, t;
	}
	async _call(e, t = null) {
		let n = await this.image_processor(e);
		return t && (n.labels = this.tokenizer(t).input_ids), n;
	}
}, hm = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	async _call(e) {
		return await this.feature_extractor(e);
	}
}, gm = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
}, _m = "<image>";
function vm(e, t, n, r, i) {
	return `${r.repeat(n * i)}${t}${e}
`;
}
var ym = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	static uses_processor_config = !1;
	async _call(e, t = null, n = {}) {
		t ||= (A.warn("You are using PaliGemma without a text prefix. It will perform as a picture-captioning model."), ""), Array.isArray(e) || (e = [e]), Array.isArray(t) || (t = [t]);
		let r = this.tokenizer.bos_token, i = this.image_processor.config.image_seq_length, a;
		t.some((e) => e.includes(_m)) ? a = t.map((e) => {
			let t = e.replaceAll(_m, _m.repeat(i)), n = t.lastIndexOf(_m), a = n === -1 ? 0 : n + _m.length;
			return t.slice(0, a) + r + t.slice(a) + "\n";
		}) : (A.warn("You are passing both `text` and `images` to `PaliGemmaProcessor`. The processor expects special image tokens in the text, as many tokens as there are images per each text. It is recommended to add `<image>` tokens in the very beginning of your text. For this call, we will infer how many images each text has and add special tokens."), a = t.map((t) => vm(t, r, i, _m, e.length)));
		let o = this.tokenizer(a, n);
		return {
			...await this.image_processor(e, n),
			...o
		};
	}
}, bm = "<|image|>", xm = /<\|image_\d+\|>/g, Sm = class extends G {
	static image_processor_class = Yp;
	static tokenizer_class = W;
	async _call(e, t = null, { padding: n = !0, truncation: r = !0, num_crops: i = null } = {}) {
		Array.isArray(e) || (e = [e]);
		let a, o;
		if (t) {
			o = await this.image_processor(t, { num_crops: i });
			let { num_img_tokens: s } = o, c = e.map((e, t) => e.split(xm).join(bm.repeat(s[t])));
			a = this.tokenizer(c, {
				padding: n,
				truncation: r
			});
			let l = this.tokenizer._tokenizer.token_to_id(bm);
			a.input_ids.map_((e) => e == l ? -e : e);
		} else a = this.tokenizer(e);
		return {
			...a,
			...o
		};
	}
}, Cm = class extends G {
	static tokenizer_class = W;
	static image_processor_class = Yp;
	static uses_processor_config = !0;
	async _call(e, t = null, n = {}) {
		let r = await this.image_processor(e, n);
		if (t) {
			let [e, n] = r.pixel_values.dims.slice(-2), { image_token: i, image_break_token: a, image_end_token: o, patch_size: s, spatial_merge_size: c } = this.config, l = s * c, u = Math.floor(e / l), d = Math.floor(n / l);
			t = structuredClone(t), Array.isArray(t) || (t = [t]);
			for (let e = 0; e < t.length; ++e) {
				let n = i.repeat(d), r = n + a, s = n + o, c = r.repeat(u - 1) + s;
				t[e] = t[e].replace(i, c);
			}
		}
		let i = t ? this.tokenizer(t, n) : {};
		return {
			...r,
			...i
		};
	}
}, wm = class extends G {
	static feature_extractor_class = Xd;
	async _call(e) {
		return await this.feature_extractor(e);
	}
	post_process_speaker_diarization(...e) {
		return this.feature_extractor.post_process_speaker_diarization(...e);
	}
	get sampling_rate() {
		return this.feature_extractor.config.sampling_rate;
	}
}, Tm = class extends em {}, Em = class extends Tm {}, Dm = class extends G {
	static image_processor_class = Yp;
	async _call(...e) {
		return await this.image_processor(...e);
	}
	post_process_masks(...e) {
		return this.image_processor.post_process_masks(...e);
	}
	reshape_input_points(...e) {
		return this.image_processor.reshape_input_points(...e);
	}
}, Om = class extends Dm {}, km = class extends Om {}, Am = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	async _call(e) {
		return await this.feature_extractor(e);
	}
}, jm = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	static uses_processor_config = !0;
	async _call(e, t = null, n = {}) {
		if (Array.isArray(e)) throw Error("Batched inputs are not supported yet.");
		let r = {};
		if (t) {
			let i = t.length, { input_features: a } = await this.feature_extractor(t, {
				...n,
				max_length: i
			}), o = Math.round(i / this.config.encoder_ds_factor + 1e-4), s = 1 + Math.ceil(o / this.config.stack_factor);
			r.audio_token_len = [s], r.audio_values = a;
			let c = this.config.audio_placeholder;
			if (!e.includes(c)) throw Error(`The input text does not contain the image token ${c}.`);
			e = e.replaceAll(c, c.repeat(s));
		}
		return {
			...this.tokenizer(e, {
				add_special_tokens: !1,
				...n
			}),
			...r
		};
	}
}, Mm = "[AUDIO]", Nm = "[BEGIN_AUDIO]", Pm = 375;
function Fm(e, t) {
	let n = [];
	for (let r = 0; r < e.length; r += t) n.push(e.subarray(r, Math.min(r + t, e.length)));
	return n;
}
var Im = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	static uses_processor_config = !1;
	async _call(e, t = null, n = {}) {
		if (Array.isArray(e)) throw Error("Batched inputs are not supported yet.");
		let r = {};
		if (t) {
			if (!e.includes(Mm)) throw Error(`The input text does not contain the audio token ${Mm}.`);
			Array.isArray(t) || (t = [t]);
			let i = e.split(Mm), a = i.length - 1;
			if (a !== t.length) throw Error(`The number of audio inputs (${t.length}) does not match the number of audio tokens in the text (${a}).`);
			let o = this.feature_extractor.config.n_samples, s = t.map((e) => Fm(e, o)), c = s.map((e) => e.length), l = s.flat(), u = (await Promise.all(l.map((e) => this.feature_extractor(e, n)))).map((e) => e.input_features);
			r.audio_values = u.length > 1 ? H(u, 0) : u[0];
			let d = i[0];
			for (let e = 0; e < c.length; ++e) {
				d += Nm;
				for (let t = 0; t < c[e]; ++t) d += Mm.repeat(Pm);
				d += i[e + 1];
			}
			e = d;
		}
		return {
			...this.tokenizer(e, {
				add_special_tokens: !1,
				...n
			}),
			...r
		};
	}
}, Lm = 32, Rm = 6, zm = 8, Bm = 10, Vm = 32, Hm = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	static uses_processor_config = !1;
	get num_mel_frames_first_audio_chunk() {
		return (Rm + 1) * zm;
	}
	get num_samples_first_audio_chunk() {
		let { hop_length: e, n_fft: t } = this.feature_extractor.config;
		return (this.num_mel_frames_first_audio_chunk - 1) * e + Math.floor(t / 2);
	}
	get num_samples_per_audio_chunk() {
		let { hop_length: e, n_fft: t } = this.feature_extractor.config;
		return zm * e + t;
	}
	get num_right_pad_tokens() {
		return Rm + 1 + Bm;
	}
	get audio_length_per_tok() {
		return zm;
	}
	get raw_audio_length_per_tok() {
		return zm * this.feature_extractor.config.hop_length;
	}
	async _call(e, { is_streaming: t = !1, is_first_audio_chunk: n = !0 } = {}) {
		if (pd(e, "VoxtralRealtimeProcessor"), !t && !n) throw Error("In non-streaming mode (`is_streaming=false`), `is_first_audio_chunk` must be `true`.");
		if (n) {
			if (t) {
				let t = Lm * this.raw_audio_length_per_tok, n = new Float32Array(t + e.length);
				n.set(e, t);
				let r = await this.feature_extractor(n, { center: !0 }), i = 1 + (Lm + Rm), a = new BigInt64Array(i).fill(BigInt(Vm));
				return a[0] = 1n, {
					input_ids: new V("int64", a, [1, i]),
					...r
				};
			}
			{
				let t = this.num_right_pad_tokens * this.raw_audio_length_per_tok, n = new Float32Array(e.length + t);
				return n.set(e), await this.feature_extractor(n, { center: !0 });
			}
		}
		return await this.feature_extractor(e, { center: !1 });
	}
}, Um = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	async _call(e) {
		return await this.feature_extractor(e);
	}
}, Wm = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	async _call(e) {
		return await this.feature_extractor(e);
	}
}, Gm = class extends G {
	static tokenizer_class = W;
	static feature_extractor_class = af;
	async _call(e) {
		return await this.feature_extractor(e);
	}
}, Km = class {
	static async from_pretrained(e, t = {}) {
		let n = await Ac(e, cd, !0, t), { image_processor_type: r, feature_extractor_type: i, processor_class: a } = n;
		if (a && dd[a]) return dd[a].from_pretrained(e, t);
		if (!r && !i) throw Error("No `image_processor_type` or `feature_extractor_type` found in the config.");
		let o = {};
		if (r) {
			let e = Df[r.replace(/Fast$/, "")];
			if (!e) throw Error(`Unknown image_processor_type: '${r}'.`);
			o.image_processor = new e(n);
		}
		if (i) {
			let e = Df[i];
			if (e) o.image_processor = new e(n);
			else {
				let e = md[i];
				if (!e) throw Error(`Unknown feature_extractor_type: '${i}'.`);
				o.feature_extractor = new e(n);
			}
		}
		return new G({}, o, null);
	}
};
async function qm(e, t) {
	return await Ac(e, "config.json", !0, t);
}
function Jm(e) {
	let t = {}, n = {};
	switch (e.model_type) {
		case "llava":
		case "paligemma":
		case "gemma3":
		case "florence2":
		case "llava_onevision":
		case "idefics3":
		case "granite_speech":
		case "ultravox":
		case "voxtral":
		case "voxtral_realtime":
		case "smolvlm":
		case "gemma3n":
		case "gemma4":
		case "lfm2_vl":
		case "chatterbox":
		case "lighton_ocr":
		case "glm_ocr":
		case "mistral3":
		case "qwen2_5_vl":
		case "qwen3_vl":
		case "qwen3_vl_moe":
			n = Jm(e.text_config);
			break;
		case "moondream1":
			n = Jm(e.phi_config);
			break;
		case "musicgen":
			n = Jm(e.decoder);
			break;
		case "multi_modality":
			n = Jm(e.language_config);
			break;
		case "gpt2":
		case "gptj":
		case "jais":
		case "codegen":
		case "gpt_bigcode":
			t.num_heads = "n_head", t.num_layers = "n_layer", t.hidden_size = "n_embd";
			break;
		case "gpt_neox":
		case "stablelm":
		case "opt":
		case "falcon":
		case "modernbert-decoder":
			t.num_heads = "num_attention_heads", t.num_layers = "num_hidden_layers", t.hidden_size = "hidden_size";
			break;
		case "gpt_oss":
		case "llama":
		case "llama4_text":
		case "nanochat":
		case "apertus":
		case "arcee":
		case "afmoe":
		case "lfm2":
		case "lfm2_moe":
		case "smollm3":
		case "olmo":
		case "olmo2":
		case "olmo3":
		case "mobilellm":
		case "granite":
		case "granitemoehybrid":
		case "cohere":
		case "cohere2":
		case "mistral":
		case "voxtral_realtime_text":
		case "voxtral_realtime_encoder":
		case "starcoder2":
		case "qwen2":
		case "qwen2_moe":
		case "qwen2_vl":
		case "qwen2_vl_text":
		case "qwen2_5_vl_text":
		case "qwen3_moe":
		case "qwen3_vl_text":
		case "qwen3_vl_moe_text":
		case "phi":
		case "phi3":
		case "phi3_v":
		case "llava_qwen2":
			t.num_heads = "num_key_value_heads", t.num_layers = "num_hidden_layers", t.hidden_size = "hidden_size", t.num_attention_heads = "num_attention_heads", t.dim_kv = "head_dim";
			break;
		case "qwen3":
		case "solar_open":
		case "glm_ocr_text":
		case "gemma":
		case "gemma2":
		case "vaultgemma":
		case "gemma3_text":
		case "gemma3n_text":
		case "gemma4_text":
		case "glm":
		case "helium":
		case "ernie4_5":
		case "hunyuan_v1_dense":
		case "falcon_h1":
		case "nemotron_h":
		case "ministral":
		case "ministral3":
			t.num_heads = "num_key_value_heads", t.num_layers = "num_hidden_layers", t.dim_kv = "head_dim";
			break;
		case "openelm":
			t.num_heads = "num_kv_heads", t.num_layers = "num_transformer_layers", t.dim_kv = "head_dim";
			break;
		case "gpt_neo":
		case "donut-swin":
			t.num_heads = "num_heads", t.num_layers = "num_layers", t.hidden_size = "hidden_size";
			break;
		case "bloom":
			t.num_heads = "n_head", t.num_layers = "n_layer", t.hidden_size = "hidden_size";
			break;
		case "mpt":
			t.num_heads = "n_heads", t.num_layers = "n_layers", t.hidden_size = "d_model";
			break;
		case "exaone":
			t.num_heads = "num_key_value_heads", t.num_layers = "num_layers", t.dim_kv = "head_dim", t.num_attention_heads = "num_attention_heads";
			break;
		case "youtu":
		case "deepseek_v3":
		case "deepseek_v4":
		case "glm_moe_dsa":
		case "mistral4":
			t.num_heads = "num_key_value_heads", t.num_layers = "num_hidden_layers", t.dim_kv = e.model_type === "deepseek_v4" ? "head_dim" : "qk_head_dim", t.num_attention_heads = "num_attention_heads";
			break;
		case "zaya":
			t.num_heads = "num_key_value_heads", t.num_layers = "num_hidden_layers", t.hidden_size = "hidden_size", t.dim_kv = "head_dim", t.num_attention_heads = "num_attention_heads";
			break;
		case "hrm_text":
			t.num_heads = "num_key_value_heads", t.num_layers = "num_hidden_layers", t.hidden_size = "hidden_size", t.dim_kv = "head_dim", t.num_attention_heads = "num_attention_heads";
			break;
		case "t5":
		case "mt5":
		case "longt5":
			t.num_decoder_layers = "num_decoder_layers", t.num_decoder_heads = "num_heads", t.decoder_dim_kv = "d_kv", t.num_encoder_layers = "num_layers", t.num_encoder_heads = "num_heads", t.encoder_dim_kv = "d_kv";
			break;
		case "bart":
		case "mbart":
		case "marian":
		case "whisper":
		case "lite-whisper":
		case "m2m_100":
		case "blenderbot":
		case "blenderbot-small":
		case "florence2_language":
			t.num_decoder_layers = "decoder_layers", t.num_decoder_heads = "decoder_attention_heads", t.decoder_hidden_size = "d_model", t.num_encoder_layers = "encoder_layers", t.num_encoder_heads = "encoder_attention_heads", t.encoder_hidden_size = "d_model";
			break;
		case "speecht5":
			t.num_decoder_layers = "decoder_layers", t.num_decoder_heads = "decoder_attention_heads", t.decoder_hidden_size = "hidden_size", t.num_encoder_layers = "encoder_layers", t.num_encoder_heads = "encoder_attention_heads", t.encoder_hidden_size = "hidden_size";
			break;
		case "trocr":
			t.num_encoder_layers = t.num_decoder_layers = "decoder_layers", t.num_encoder_heads = t.num_decoder_heads = "decoder_attention_heads", t.encoder_hidden_size = t.decoder_hidden_size = "d_model";
			break;
		case "musicgen_decoder":
			t.num_encoder_layers = t.num_decoder_layers = "num_hidden_layers", t.num_encoder_heads = t.num_decoder_heads = "num_attention_heads", t.encoder_hidden_size = t.decoder_hidden_size = "hidden_size";
			break;
		case "moonshine":
			t.num_decoder_layers = "decoder_num_hidden_layers", t.num_decoder_heads = "decoder_num_key_value_heads", t.num_encoder_layers = "encoder_num_hidden_layers", t.num_encoder_heads = "encoder_num_key_value_heads", t.encoder_hidden_size = t.decoder_hidden_size = "hidden_size";
			break;
		case "cohere_asr":
			t.num_decoder_layers = "num_hidden_layers", t.num_decoder_heads = "num_key_value_heads", t.decoder_hidden_size = "hidden_size", t.decoder_dim_kv = "head_dim";
			let { num_hidden_layers: r, num_attention_heads: i, hidden_size: a } = e.encoder_config;
			n = {
				num_encoder_layers: r,
				num_encoder_heads: i,
				encoder_hidden_size: a,
				encoder_dim_kv: e.head_dim
			};
			break;
		case "vision-encoder-decoder":
			let o = Jm(e.decoder), s = "num_decoder_layers" in o, c = Fr(e, ["model_type", "is_encoder_decoder"]);
			return s ? (c.num_decoder_layers = o.num_decoder_layers, c.num_decoder_heads = o.num_decoder_heads, c.decoder_hidden_size = o.decoder_hidden_size, c.num_encoder_layers = o.num_encoder_layers, c.num_encoder_heads = o.num_encoder_heads, c.encoder_hidden_size = o.encoder_hidden_size) : (c.num_layers = o.num_layers, c.num_heads = o.num_heads, c.hidden_size = o.hidden_size), c;
	}
	let r = {
		...n,
		...Fr(e, [
			"model_type",
			"multi_query",
			"is_encoder_decoder"
		])
	};
	for (let n in t) r[n] = e[t[n]];
	return r;
}
function Ym(e, t) {
	e instanceof Zm || (e = new Zm(e));
	let n = t?.prefix ?? "past_key_values", r = n === "present" ? "present" : "past", i = /* @__PURE__ */ new Set();
	if (["lfm2", "lfm2_moe"].includes(e.model_type)) {
		let { layer_types: t } = e;
		for (let e = 0; e < t.length; ++e) if (t[e] === "full_attention") i.add(`${n}.${e}.key`), i.add(`${n}.${e}.value`);
		else if (t[e] === "conv") i.add(`${r}_conv.${e}`);
		else throw Error(`Unsupported layer type: ${t[e]}`);
		return i;
	}
	if ([
		"granitemoehybrid",
		"falcon_h1",
		"nemotron_h"
	].includes(e.model_type)) {
		let t = e, a = t.layer_types ?? t.layers_block_type, o = t.num_hidden_layers ?? a?.length;
		for (let e = 0; e < o; ++e) (!a || a[e] === "mamba") && (i.add(`${r}_conv.${e}`), i.add(`${r}_ssm.${e}`)), (!a || a[e] === "attention") && (i.add(`${n}.${e}.key`), i.add(`${n}.${e}.value`));
		return i;
	}
	if ([
		"qwen3_next",
		"qwen3_5_text",
		"qwen3_5_moe_text",
		"olmo_hybrid"
	].includes(e.model_type)) {
		let { layer_types: t } = e;
		for (let a = 0; a < t.length; ++a) if (t[a] === "full_attention") i.add(`${n}.${a}.key`), i.add(`${n}.${a}.value`);
		else if (t[a] === "linear_attention") e.model_type === "olmo_hybrid" ? (i.add(`${r}_conv.${a}.key`), i.add(`${r}_conv.${a}.value`), i.add(`${r}_conv.${a}.query`)) : i.add(`${r}_conv.${a}`), i.add(`${r}_recurrent.${a}`);
		else throw Error(`Unsupported layer type: ${t[a]}`);
		return i;
	}
	if (["gemma4", "gemma4_text"].includes(e.model_type)) {
		let t = e.model_type === "gemma4" ? e.text_config : e, r = t.num_hidden_layers - (t.num_kv_shared_layers ?? 0);
		for (let e = 0; e < r; ++e) i.add(`${n}.${e}.key`), i.add(`${n}.${e}.value`);
		return i;
	}
	if (e.model_type === "deepseek_v4") {
		let { layer_types: t, num_hidden_layers: a } = e;
		for (let e = 0; e < a; ++e) {
			i.add(`${n}.${e}.key`), i.add(`${n}.${e}.value`);
			let a = t[e];
			if (a === "compressed_sparse_attention") i.add(`${r}_compressor.${e}.kv`), i.add(`${r}_compressor.${e}.gate`), i.add(`${r}_indexer.${e}.kv`), i.add(`${r}_indexer.${e}.gate`);
			else if (a === "heavily_compressed_attention") i.add(`${r}_compressor.${e}.kv`), i.add(`${r}_compressor.${e}.gate`);
			else if (a && a !== "sliding_attention") throw Error(`Unsupported layer type: ${a}`);
		}
		return i;
	}
	if (e.model_type === "zaya") {
		let { num_hidden_layers: t, cca_time1: r } = e, a = r ?? 1;
		for (let e = 0; e < t; e += a) i.add(`${n}.${e}.key`), i.add(`${n}.${e}.value`), i.add(`${n}.${e}.conv_state`), i.add(`${n}.${e}.shift_state`);
		return i;
	}
	if ([
		"lfm2_vl",
		"qwen3_5",
		"qwen3_5_moe",
		"voxtral_realtime"
	].includes(e.model_type)) {
		let n;
		return n = e.model_type === "voxtral_realtime" && t?.session_name === "audio_encoder" ? e.audio_config : e.text_config, Ym(n, t);
	}
	return Xm(e, { prefix: n });
}
function Xm(e, { prefix: t = "past_key_values" } = {}) {
	let n = /* @__PURE__ */ new Set(), r = e.normalized_config;
	if (r.is_encoder_decoder && "num_encoder_heads" in r && "num_decoder_heads" in r) for (let e = 0; e < r.num_decoder_layers; ++e) n.add(`${t}.${e}.encoder.key`), n.add(`${t}.${e}.encoder.value`), n.add(`${t}.${e}.decoder.key`), n.add(`${t}.${e}.decoder.value`);
	else if (r.multi_query) for (let e = 0; e < r.num_layers; ++e) n.add(`${t}.${e}.key_value`);
	else for (let e = 0; e < r.num_layers; ++e) n.add(`${t}.${e}.key`), n.add(`${t}.${e}.value`);
	return n;
}
var Zm = class e {
	model_type = null;
	is_encoder_decoder = !1;
	max_position_embeddings;
	"transformers.js_config";
	constructor(e) {
		Object.assign(this, e), this.normalized_config = Jm(this);
	}
	static async from_pretrained(t, { progress_callback: n = null, config: r = null, cache_dir: i = null, local_files_only: a = !1, revision: o = "main" } = {}) {
		r && !(r instanceof e) && (r = new e(r));
		let s = r ?? await qm(t, {
			progress_callback: n,
			config: r,
			cache_dir: i,
			local_files_only: a,
			revision: o
		});
		return new this(s);
	}
}, Qm = class {
	static async from_pretrained(...e) {
		return Zm.from_pretrained(...e);
	}
};
function $m(e, t, n) {
	return e ? typeof e == "object" && e ? e.hasOwnProperty(t) ? +e[t] : e.hasOwnProperty(n) ? +e[n] : 0 : +e : 0;
}
function eh(e, t) {
	let n = [];
	for (let r = 0; r < t; ++r) n.push(`${e}_data${r === 0 ? "" : "_" + r}`);
	return n;
}
async function th(e, t, n, r) {
	let i = `${t}${r}.onnx`;
	return await Oc(e, `${n.subfolder ?? ""}/${i}`, !0, n, O.IS_NODE_ENV);
}
async function nh(e, t, n, r, i, a = {}) {
	let o = `${t}${n}.onnx`, s = O.IS_NODE_ENV, c = [], l = $m(i, o, t);
	if (l > 0) {
		if (l > Qs) throw Error(`The number of external data chunks (${l}) exceeds the maximum allowed value (${Qs}).`);
		let t = eh(o, l);
		for (let n of t) {
			let t = `${r.subfolder ?? ""}/${n}`;
			c.push(new Promise(async (i, a) => {
				let o = await Oc(e, t, !0, r, s);
				i(o instanceof Uint8Array ? {
					path: n,
					data: o
				} : n);
			}));
		}
	} else a.externalData !== void 0 && (c = a.externalData.map(async (t) => {
		if (typeof t.data == "string") {
			let n = await Oc(e, t.data, !0, r);
			return {
				...t,
				data: n
			};
		}
		return t;
	}));
	return Promise.all(c);
}
async function rh(e, t, n, r = !1, i = void 0) {
	let a = n.config?.["transformers.js_config"] ?? {}, o = vl(n.device ?? a.device, t, { warn: (e) => A.info(e) }), s = il(o), c = a.device_config ?? {};
	c.hasOwnProperty(o) && (a = {
		...a,
		...c[o]
	});
	let l = wl(n.dtype ?? a.dtype, t, o, {
		configDtype: a.dtype,
		warn: (e) => A.info(e)
	});
	if (!Cl.hasOwnProperty(l)) throw Error(`Invalid dtype: ${l}. Should be one of: ${Object.keys(bl).join(", ")}`);
	if (o === "webgpu" && !O.IS_NODE_ENV && l === bl.fp16 && !await yl()) throw Error(`The device (${o}) does not support fp16.`);
	let u = Cl[l], d = { ...n.session_options };
	d.executionProviders ??= s;
	let f = a.free_dimension_overrides;
	f ? d.freeDimensionOverrides ??= f : o.startsWith("webnn") && !d.freeDimensionOverrides && A.warn(`WebNN does not currently support dynamic shapes and requires 'free_dimension_overrides' to be set in config.json, preferably as a field within config["transformers.js_config"]["device_config"]["${o}"]. When 'free_dimension_overrides' is not set, you may experience significant performance degradation.`);
	let p = th(e, t, n, u), m = await nh(e, t, u, n, n.use_external_data_format ?? a.use_external_data_format, d);
	if (m.length > 0 && (!O.IS_NODE_ENV || m.some((e) => typeof e != "string")) && (d.externalData = m), r && o === "webgpu") {
		let e = Ym(n.config, {
			prefix: "present",
			session_name: i
		});
		if (e.size > 0 && !pl()) {
			let t = {};
			for (let n of e) t[n] = "gpu-buffer";
			d.preferredOutputLocation = t;
		}
	}
	return {
		buffer_or_path: await p,
		session_options: d,
		session_config: {
			dtype: l,
			device: o
		}
	};
}
async function ih(e, t, n, r = void 0) {
	return Object.fromEntries(await Promise.all(Object.keys(t).map(async (i) => {
		let a = r?.[i] ?? !1, { buffer_or_path: o, session_options: s, session_config: c } = await rh(e, t[i], n, a, i);
		return [i, await cl(o, s, c)];
	})));
}
function ah(e) {
	for (let t in e) dl(e[t]) ? e[t] = new V(e[t]) : typeof e[t] == "object" && ah(e[t]);
	return e;
}
async function q(e, t) {
	let n = oh(e, t);
	try {
		return ah(await ul(e, Object.fromEntries(Object.entries(n).map(([e, t]) => {
			let n = t.ort_tensor;
			return O.IS_NODE_ENV && typeof Float16Array < "u" && n.cpuData instanceof Float16Array && (n.cpuData = new Uint16Array(n.cpuData.buffer)), [e, n];
		}))));
	} catch (e) {
		let t = Object.fromEntries(Object.entries(n).map(([e, t]) => {
			let n = {
				type: t.type,
				dims: t.dims,
				location: t.location
			};
			return n.location !== "gpu-buffer" && (n.data = t.data), [e, n];
		}));
		throw A.error(`An error occurred during model execution: "${e}".`), A.error("Inputs given to model:", t), e;
	}
}
function oh(e, t) {
	let n = /* @__PURE__ */ Object.create(null), r = [];
	for (let i of e.inputNames) {
		let e = t[i];
		if (!(e instanceof V)) {
			r.push(i);
			continue;
		}
		n[i] = pl() ? e.clone() : e;
	}
	if (r.length > 0) throw Error(`An error occurred during model execution: "Missing the following inputs: ${r.join(", ")}.`);
	let i = Object.keys(t).length, a = e.inputNames.length;
	if (i > a) {
		let n = Object.keys(t).filter((t) => !e.inputNames.includes(t));
		A.warn(`WARNING: Too many inputs were provided (${i} > ${a}). The following inputs will be ignored: "${n.join(", ")}".`);
	}
	return n;
}
var J = class {}, sh = class extends J {
	constructor({ last_hidden_state: e, hidden_states: t = null, attentions: n = null }) {
		super(), this.last_hidden_state = e, this.hidden_states = t, this.attentions = n;
	}
}, Y = class extends J {
	constructor({ logits: e, ...t }) {
		super(), this.logits = e;
		let n = Object.values(t);
		n.length > 0 && (this.attentions = n);
	}
}, ch = class extends J {
	constructor({ logits: e }) {
		super(), this.logits = e;
	}
}, lh = class extends J {
	constructor({ logits: e }) {
		super(), this.logits = e;
	}
}, uh = class extends J {
	constructor({ start_logits: e, end_logits: t }) {
		super(), this.start_logits = e, this.end_logits = t;
	}
}, dh = class extends J {
	constructor({ logits: e }) {
		super(), this.logits = e;
	}
}, fh = class extends J {
	constructor({ logits: e, past_key_values: t }) {
		super(), this.logits = e, this.past_key_values = t;
	}
}, ph = class extends J {
	constructor({ logits: e, past_key_values: t, encoder_outputs: n, decoder_attentions: r = null, cross_attentions: i = null }) {
		super(), this.logits = e, this.past_key_values = t, this.encoder_outputs = n, this.decoder_attentions = r, this.cross_attentions = i;
	}
}, mh = class extends J {
	constructor({ alphas: e }) {
		super(), this.alphas = e;
	}
}, hh = class extends Er {
	_call(e, t) {
		throw Error("`_call` should be implemented in a subclass");
	}
}, gh = class extends Er {
	_call(e, t) {
		throw Error("`_call` should be implemented in a subclass");
	}
}, _h = class extends Er {
	constructor() {
		super(), this.processors = [];
	}
	push(e) {
		this.processors.push(e);
	}
	extend(e) {
		this.processors.push(...e);
	}
	_call(e, t) {
		let n = t;
		for (let t of this.processors) n = t(e, n);
		return n;
	}
	[Symbol.iterator]() {
		return this.processors.values();
	}
}, vh = class extends hh {
	constructor(e) {
		super(), this.bos_token_id = e;
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) if (e[n].length === 1) {
			let e = t[n].data;
			e.fill(-Infinity), e[this.bos_token_id] = 0;
		}
		return t;
	}
}, yh = class extends hh {
	constructor(e, t) {
		super(), this.max_length = e, this.eos_token_id = Array.isArray(t) ? t : [t];
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) if (e[n].length === this.max_length - 1) {
			let e = t[n].data;
			e.fill(-Infinity);
			for (let t of this.eos_token_id) e[t] = 0;
		}
		return t;
	}
}, bh = class extends hh {
	constructor(e) {
		super(), this.suppress_tokens = e;
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) {
			let e = t[n].data;
			for (let t of this.suppress_tokens) e[t] = -Infinity;
		}
		return t;
	}
}, xh = class extends hh {
	constructor(e, t) {
		super(), this.begin_suppress_tokens = e, this.begin_index = t;
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) if (e[n].length === this.begin_index) {
			let e = t[n].data;
			for (let t of this.begin_suppress_tokens) e[t] = -Infinity;
		}
		return t;
	}
}, Sh = class extends hh {
	constructor(e, t) {
		super(), this.eos_token_id = Array.isArray(e.eos_token_id) ? e.eos_token_id[0] : e.eos_token_id, this.no_timestamps_token_id = e.no_timestamps_token_id, this.timestamp_begin = this.no_timestamps_token_id + 1, this.begin_index = t.length, t.at(-1) === this.no_timestamps_token_id && --this.begin_index, this.max_initial_timestamp_index = e.max_initial_timestamp_index;
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) {
			let r = t[n].data;
			if (r[this.no_timestamps_token_id] = -Infinity, e[n].length === this.begin_index) {
				r.subarray(0, this.timestamp_begin).fill(-Infinity);
				continue;
			}
			let i = e[n].slice(this.begin_index), a = i.length >= 1 && i[i.length - 1] >= this.timestamp_begin, o = i.length < 2 || i[i.length - 2] >= this.timestamp_begin;
			if (a && (o ? r.subarray(this.timestamp_begin).fill(-Infinity) : r.subarray(0, this.eos_token_id).fill(-Infinity)), e[n].length === this.begin_index && this.max_initial_timestamp_index !== null) {
				let e = this.timestamp_begin + this.max_initial_timestamp_index;
				r.subarray(e + 1).fill(-Infinity);
			}
			let s = Pc(r);
			Math.log(s.subarray(this.timestamp_begin).map(Math.exp).reduce((e, t) => e + t)) > Ic(s.subarray(0, this.timestamp_begin))[0] && r.subarray(0, this.timestamp_begin).fill(-Infinity);
		}
		return t;
	}
}, Ch = class extends hh {
	constructor(e) {
		super(), this.no_repeat_ngram_size = e;
	}
	getNgrams(e) {
		let t = e.length, n = [];
		for (let r = 0; r < t + 1 - this.no_repeat_ngram_size; ++r) {
			let t = [];
			for (let n = 0; n < this.no_repeat_ngram_size; ++n) t.push(e[r + n]);
			n.push(t.map(Number));
		}
		let r = /* @__PURE__ */ new Map();
		for (let e of n) {
			let t = e.slice(0, e.length - 1), n = JSON.stringify(t), i = r.get(n) ?? [];
			i.push(e[e.length - 1]), r.set(n, i);
		}
		return r;
	}
	getGeneratedNgrams(e, t) {
		let n = t.slice(t.length + 1 - this.no_repeat_ngram_size, t.length);
		return e.get(JSON.stringify(n.map(Number))) ?? [];
	}
	calcBannedNgramTokens(e) {
		let t = [];
		if (e.length + 1 < this.no_repeat_ngram_size) return t;
		{
			let t = this.getNgrams(e);
			return this.getGeneratedNgrams(t, e);
		}
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) {
			let r = t[n].data, i = this.calcBannedNgramTokens(e[n]);
			for (let e of i) r[e] = -Infinity;
		}
		return t;
	}
}, wh = class extends hh {
	constructor(e) {
		super(), this.penalty = e;
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) {
			let r = t[n].data;
			for (let t of new Set(e[n])) {
				let e = Number(t);
				r[e] < 0 ? r[e] *= this.penalty : r[e] /= this.penalty;
			}
		}
		return t;
	}
}, Th = class extends hh {
	constructor(e, t) {
		super(), this.min_length = e, this.eos_token_id = Array.isArray(t) ? t : [t];
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) if (e[n].length < this.min_length) {
			let e = t[n].data;
			for (let t of this.eos_token_id) e[t] = -Infinity;
		}
		return t;
	}
}, Eh = class extends hh {
	constructor(e, t, n) {
		super(), this.prompt_length_to_skip = e, this.min_new_tokens = t, this.eos_token_id = Array.isArray(n) ? n : [n];
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) if (e[n].length - this.prompt_length_to_skip < this.min_new_tokens) {
			let e = t[n].data;
			for (let t of this.eos_token_id) e[t] = -Infinity;
		}
		return t;
	}
}, Dh = class extends hh {
	constructor(e, t) {
		super(), this.bad_words_ids = e, this.eos_token_id = Array.isArray(t) ? t : [t];
	}
	_call(e, t) {
		for (let n = 0; n < e.length; ++n) {
			let r = t[n].data, i = e[n];
			for (let e of this.bad_words_ids) {
				if (i.length < e.length - 1) continue;
				let t = !0;
				for (let n = 1; n <= e.length - 1; ++n) if (e.at(-n - 1) != i.at(-n)) {
					t = !1;
					break;
				}
				t && (r[e.at(-1)] = -Infinity);
			}
		}
		return t;
	}
}, Oh = class extends hh {
	constructor(e) {
		if (super(), e <= 1) throw Error(`Require guidance scale >1 to use the classifier-free guidance processor, got guidance scale ${e}.`);
		this.guidance_scale = e;
	}
	_call(e, t) {
		if (t.dims[0] !== 2 * e.length) throw Error(`Logits should have twice the batch size of the input ids, the first half of batches corresponding to the conditional inputs, and the second half of batches corresponding to the unconditional inputs. Got batch size ${t.dims[0]} for the logits and ${e.length} for the input ids.`);
		let n = e.length, r = t.slice([0, n], null), i = t.slice([n, t.dims[0]], null);
		for (let e = 0; e < i.data.length; ++e) i.data[e] += (r.data[e] - i.data[e]) * this.guidance_scale;
		return i;
	}
}, kh = class extends gh {
	constructor(e) {
		if (super(), typeof e != "number" || e <= 0) {
			let t = `\`temperature\` (=${e}) must be a strictly positive float, otherwise your next token scores will be invalid.`;
			e === 0 && (t += " If you're looking for greedy decoding strategies, set `do_sample=false`.");
		}
		this.temperature = e;
	}
	_call(e, t) {
		let n = t.data;
		for (let e = 0; e < n.length; ++e) n[e] /= this.temperature;
		return t;
	}
}, Ah = class {
	max_length = 20;
	max_new_tokens = null;
	min_length = 0;
	min_new_tokens = null;
	early_stopping = !1;
	max_time = null;
	do_sample = !1;
	num_beams = 1;
	num_beam_groups = 1;
	penalty_alpha = null;
	use_cache = !0;
	temperature = 1;
	top_k = 50;
	top_p = 1;
	typical_p = 1;
	epsilon_cutoff = 0;
	eta_cutoff = 0;
	diversity_penalty = 0;
	repetition_penalty = 1;
	encoder_repetition_penalty = 1;
	length_penalty = 1;
	no_repeat_ngram_size = 0;
	bad_words_ids = null;
	force_words_ids = null;
	renormalize_logits = !1;
	constraints = null;
	forced_bos_token_id = null;
	forced_eos_token_id = null;
	remove_invalid_values = !1;
	exponential_decay_length_penalty = null;
	suppress_tokens = null;
	streamer = null;
	begin_suppress_tokens = null;
	forced_decoder_ids = null;
	guidance_scale = null;
	num_return_sequences = 1;
	output_attentions = !1;
	output_hidden_states = !1;
	output_scores = !1;
	return_dict_in_generate = !1;
	pad_token_id = null;
	bos_token_id = null;
	eos_token_id = null;
	encoder_no_repeat_ngram_size = 0;
	decoder_start_token_id = null;
	generation_kwargs = {};
	constructor(e) {
		Object.assign(this, Fr(e, Object.getOwnPropertyNames(this)));
	}
}, jh = class extends Er {
	_call(e, t) {
		throw Error("StoppingCriteria needs to be subclassed");
	}
}, Mh = class e extends Er {
	constructor() {
		super(), this.criteria = [];
	}
	push(e) {
		this.criteria.push(e);
	}
	extend(t) {
		t instanceof e ? t = t.criteria : t instanceof jh && (t = [t]), this.criteria.push(...t);
	}
	_call(e, t) {
		let n = Array(e.length).fill(!1);
		for (let r of this.criteria) {
			let i = r(e, t);
			for (let e = 0; e < n.length; ++e) n[e] ||= i[e];
		}
		return n;
	}
	[Symbol.iterator]() {
		return this.criteria.values();
	}
}, Nh = class extends jh {
	constructor(e, t = null) {
		super(), this.max_length = e, this.max_position_embeddings = t;
	}
	_call(e) {
		return e.map((e) => e.length >= this.max_length);
	}
}, Ph = class extends jh {
	constructor(e) {
		super(), Array.isArray(e) || (e = [e]), this.eos_token_id = e;
	}
	_call(e, t) {
		return e.map((e) => {
			let t = e.at(-1);
			return this.eos_token_id.some((e) => t == e);
		});
	}
}, Fh = class extends Er {
	constructor(e) {
		super(), this.generation_config = e;
	}
	async _call(e) {
		return this.sample(e);
	}
	async sample(e) {
		throw Error("sample should be implemented in subclasses.");
	}
	getLogits(e, t) {
		let n = e.dims.at(-1), r = e.data;
		if (t === -1) r = r.slice(-n);
		else {
			let e = t * n;
			r = r.slice(e, e + n);
		}
		return r;
	}
	randomSelect(e) {
		return Js(e);
	}
	static getSampler(e) {
		if (e.do_sample) return new Lh(e);
		if (e.num_beams > 1) return new Rh(e);
		if (e.num_return_sequences > 1) throw Error(`num_return_sequences has to be 1 when doing greedy search, but is ${e.num_return_sequences}.`);
		return new Ih(e);
	}
}, Ih = class extends Fh {
	async sample(e) {
		let t = Ic(e.data)[1];
		return [[BigInt(t), 0]];
	}
}, Lh = class extends Fh {
	async sample(e) {
		let t = e.dims.at(-1);
		this.generation_config.top_k > 0 && (t = Math.min(this.generation_config.top_k, t));
		let [n, r] = await jl(e, t), i = Nc(n.data);
		return Array.from({ length: this.generation_config.num_beams }, () => {
			let e = this.randomSelect(i);
			return [r.data[e], Math.log(i[e])];
		});
	}
}, Rh = class extends Fh {
	async sample(e) {
		let t = e.dims.at(-1);
		this.generation_config.top_k > 0 && (t = Math.min(this.generation_config.top_k, t));
		let [n, r] = await jl(e, t), i = Nc(n.data);
		return Array.from({ length: this.generation_config.num_beams }, (e, t) => [r.data[t], Math.log(i[t])]);
	}
}, zh = class {
	constructor(e) {
		if (e) for (let t in e) {
			if (t in this) throw TypeError(`Key "${t}" conflicts with an existing property on DynamicCache`);
			let n = e[t];
			if (!(n instanceof V)) throw TypeError(`Expected a Tensor for key "${t}", got ${typeof n}`);
			this[t] = n;
		}
	}
	get_seq_length() {
		let e = this;
		if (Object.keys(e).length === 0) return 0;
		for (let t in e) if (t.startsWith("past_key_values.")) return e[t].dims.at(-2);
		throw Error("Unable to determine sequence length from the cache.");
	}
	update(e) {
		for (let t in e) {
			let n = this[t], r = e[t];
			n && n !== r && n.location === "gpu-buffer" && n.dispose(), this[t] = r;
		}
	}
	async dispose() {
		let e = [];
		for (let t of Object.values(this)) t.location === "gpu-buffer" && e.push(t.dispose());
		await Promise.all(e);
	}
}, X = {
	EncoderOnly: 0,
	EncoderDecoder: 1,
	Seq2Seq: 2,
	Vision2Seq: 3,
	DecoderOnly: 4,
	DecoderOnlyWithoutHead: 5,
	MaskGeneration: 6,
	ImageTextToText: 7,
	Musicgen: 8,
	MultiModality: 9,
	Phi3V: 10,
	AudioTextToText: 11,
	AutoEncoder: 12,
	ImageAudioTextToText: 13,
	Supertonic: 14,
	Chatterbox: 15,
	VoxtralRealtime: 16
}, Bh = {
	[X.DecoderOnly]: {
		sessions: (e, t) => ({ model: t.model_file_name ?? "model" }),
		cache_sessions: { model: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.DecoderOnlyWithoutHead]: { sessions: (e, t) => ({ model: t.model_file_name ?? "model" }) },
	[X.Seq2Seq]: {
		sessions: () => ({
			model: "encoder_model",
			decoder_model_merged: "decoder_model_merged"
		}),
		cache_sessions: { decoder_model_merged: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.Vision2Seq]: {
		sessions: () => ({
			model: "encoder_model",
			decoder_model_merged: "decoder_model_merged"
		}),
		cache_sessions: { decoder_model_merged: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.Musicgen]: {
		sessions: () => ({
			model: "text_encoder",
			decoder_model_merged: "decoder_model_merged",
			encodec_decode: "encodec_decode"
		}),
		cache_sessions: { decoder_model_merged: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.EncoderDecoder]: {
		sessions: () => ({
			model: "encoder_model",
			decoder_model_merged: "decoder_model_merged"
		}),
		cache_sessions: { decoder_model_merged: !0 }
	},
	[X.MaskGeneration]: { sessions: () => ({
		model: "vision_encoder",
		prompt_encoder_mask_decoder: "prompt_encoder_mask_decoder"
	}) },
	[X.ImageTextToText]: {
		text_only_sessions: {
			embed_tokens: "embed_tokens",
			decoder_model_merged: "decoder_model_merged"
		},
		sessions: (e, t, n) => {
			let r = { ...Bh[X.ImageTextToText].text_only_sessions };
			return n || (r.vision_encoder = "vision_encoder"), e.is_encoder_decoder && (r.model = "encoder_model"), r;
		},
		cache_sessions: { decoder_model_merged: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.AudioTextToText]: {
		text_only_sessions: {
			embed_tokens: "embed_tokens",
			decoder_model_merged: "decoder_model_merged"
		},
		sessions: (e, t, n) => {
			let r = { ...Bh[X.AudioTextToText].text_only_sessions };
			return n || (r.audio_encoder = "audio_encoder"), r;
		},
		cache_sessions: { decoder_model_merged: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.ImageAudioTextToText]: {
		text_only_sessions: {
			embed_tokens: "embed_tokens",
			decoder_model_merged: "decoder_model_merged"
		},
		sessions: (e, t, n) => {
			let r = { ...Bh[X.ImageAudioTextToText].text_only_sessions };
			return n || (r.audio_encoder = "audio_encoder", r.vision_encoder = "vision_encoder"), r;
		},
		cache_sessions: { decoder_model_merged: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.Phi3V]: {
		sessions: () => ({
			prepare_inputs_embeds: "prepare_inputs_embeds",
			model: "model",
			vision_encoder: "vision_encoder"
		}),
		cache_sessions: { model: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.MultiModality]: {
		sessions: () => ({
			prepare_inputs_embeds: "prepare_inputs_embeds",
			model: "language_model",
			lm_head: "lm_head",
			gen_head: "gen_head",
			gen_img_embeds: "gen_img_embeds",
			image_decode: "image_decode"
		}),
		cache_sessions: { model: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.AutoEncoder]: { sessions: () => ({
		encoder_model: "encoder_model",
		decoder_model: "decoder_model"
	}) },
	[X.Supertonic]: { sessions: () => ({
		text_encoder: "text_encoder",
		latent_denoiser: "latent_denoiser",
		voice_decoder: "voice_decoder"
	}) },
	[X.Chatterbox]: {
		sessions: () => ({
			embed_tokens: "embed_tokens",
			speech_encoder: "speech_encoder",
			model: "language_model",
			conditional_decoder: "conditional_decoder"
		}),
		cache_sessions: { model: !0 },
		optional_configs: { generation_config: "generation_config.json" }
	},
	[X.VoxtralRealtime]: {
		text_only_sessions: {
			embed_tokens: "embed_tokens",
			decoder_model_merged: "decoder_model_merged"
		},
		sessions: (e, t, n) => {
			let r = { ...Bh[X.VoxtralRealtime].text_only_sessions };
			return n || (r.audio_encoder = "audio_encoder"), r;
		},
		cache_sessions: {
			decoder_model_merged: !0,
			audio_encoder: !0
		},
		optional_configs: { generation_config: "generation_config.json" }
	},
	default: { sessions: (e, t) => ({ model: t.model_file_name ?? "model" }) }
};
function Vh(e) {
	return Bh[e]?.text_only_sessions ?? null;
}
function Hh(e, t, n = {}) {
	let r = Bh[e] ?? Bh.default;
	return {
		sessions: r.sessions(t, n, n.textOnly ?? !1),
		cache_sessions: r.cache_sessions,
		optional_configs: r.optional_configs
	};
}
function Uh(e, { warn: t = !0 } = {}) {
	let n = e.architectures || [];
	for (let e of n) {
		let t = Qh.get(e);
		if (t !== void 0) return t;
	}
	if (e.model_type) {
		let t = Qh.get(e.model_type);
		if (t !== void 0) return t;
		for (let t of Object.values(Kh)) if (t.has(e.model_type)) {
			let n = Qh.get(t.get(e.model_type));
			if (n !== void 0) return n;
		}
	}
	if (t) {
		let t = n.length > 0 ? n.join(", ") : "(none)";
		A.warn(`[resolve_model_type] Architecture(s) not found in MODEL_TYPE_MAPPING: [${t}] for model type '${e.model_type}'. Falling back to EncoderOnly (single model.onnx file). If you encounter issues, please report at: ${od}`);
	}
	return X.EncoderOnly;
}
function Wh(e, { config: t = null, cache_dir: n = null, local_files_only: r = !1, revision: i = "main" } = {}) {
	return t === null ? _c(rc(e, {
		cache_dir: n,
		local_files_only: r,
		revision: i
	}), () => Qm.from_pretrained(e, {
		config: t,
		cache_dir: n,
		local_files_only: r,
		revision: i
	})) : Qm.from_pretrained(e, {
		config: t,
		cache_dir: n,
		local_files_only: r,
		revision: i
	});
}
async function Gh(e, { config: t = null, dtype: n = null, device: r = null, model_file_name: i = null } = {}) {
	t = await Wh(e, { config: t });
	let a = ["config.json"], o = t["transformers.js_config"] ?? {}, s = o.use_external_data_format, c = "onnx", l = r ?? o.device, u = n ?? o.dtype, d = Uh(t), f = (e, t = null) => {
		t ??= e;
		let n = vl(l, e), r = Cl[wl(u, e, n)] ?? "", i = `${t}${r}.onnx`, o = `${c}/${i}`;
		a.push(o);
		let d = $m(s, i, e);
		for (let e of eh(i, d)) {
			let t = `${c}/${e}`;
			a.push(t);
		}
	}, { sessions: p, optional_configs: m } = Hh(d, t, { model_file_name: i });
	for (let [e, t] of Object.entries(p)) f(e, t);
	if (m) for (let e of Object.values(m)) a.push(e);
	return a;
}
var Kh = null;
function qh(e) {
	Kh = e;
}
function Jh(e) {
	if (e instanceof V) return e;
	if (e.length === 0) throw Error("items must be non-empty");
	if (Array.isArray(e[0])) {
		if (e.some((t) => t.length !== e[0].length)) throw Error("Unable to create tensor, you should probably activate truncation and/or padding with 'padding=True' and/or 'truncation=True' to have batched tensors with the same length.");
		return new V("int64", BigInt64Array.from(e.flat().map((e) => BigInt(e))), [e.length, e[0].length]);
	}
	return new V("int64", BigInt64Array.from(e.map((e) => BigInt(e))), [1, e.length]);
}
function Yh(e) {
	return new V("bool", [e], [1]);
}
var Xh = {
	[X.DecoderOnly]: {
		can_generate: !0,
		forward: lg,
		prepare_inputs: hg
	},
	[X.DecoderOnlyWithoutHead]: {
		can_generate: !1,
		forward: lg,
		prepare_inputs: hg
	},
	[X.Seq2Seq]: {
		can_generate: !0,
		forward: tg,
		prepare_inputs: gg
	},
	[X.Vision2Seq]: {
		can_generate: !0,
		forward: tg,
		prepare_inputs: gg
	},
	[X.Musicgen]: {
		can_generate: !0,
		forward: tg
	},
	[X.EncoderDecoder]: {
		can_generate: !1,
		forward: tg
	},
	[X.ImageTextToText]: {
		can_generate: !0,
		forward: fg,
		prepare_inputs: _g
	},
	[X.AudioTextToText]: {
		can_generate: !0,
		forward: dg,
		prepare_inputs: _g
	},
	[X.ImageAudioTextToText]: {
		can_generate: !0,
		prepare_inputs: _g
	},
	[X.Phi3V]: {
		can_generate: !0,
		prepare_inputs: _g
	},
	[X.MultiModality]: { can_generate: !0 },
	[X.AutoEncoder]: {
		can_generate: !1,
		forward: rg
	},
	[X.Chatterbox]: {
		can_generate: !0,
		forward: ng
	},
	[X.VoxtralRealtime]: {
		can_generate: !0,
		prepare_inputs: hg
	},
	default: {
		can_generate: !1,
		forward: ng
	}
};
function Zh(e, t) {
	let n = Qh.get(e), r = !1, i = t?.architectures?.[0];
	if (i && i !== e && e?.endsWith("ForCausalLM") && i.endsWith("ForConditionalGeneration")) {
		let e = Qh.get(i);
		e !== void 0 && (n = e, r = !0);
	}
	let a = Xh[n] ?? Xh.default, o = Bh[n] ?? Bh.default;
	return {
		typeConfig: {
			...a,
			...o
		},
		textOnly: r,
		modelType: n
	};
}
var Qh = /* @__PURE__ */ new Map(), $h = /* @__PURE__ */ new Map(), eg = /* @__PURE__ */ new Map(), Z = class extends Er {
	main_input_name = "input_ids";
	forward_params = ["input_ids", "attention_mask"];
	_return_dict_in_generate_keys = null;
	constructor(e, t, n) {
		super(), this.config = e, this.sessions = t, this.configs = n;
		let { typeConfig: r } = Zh(eg.get(this.constructor), e);
		this.can_generate = r.can_generate, this._forward = r.forward, this._prepare_inputs_for_generation = r.prepare_inputs, this.can_generate && this.forward_params.push("past_key_values"), this.custom_config = this.config["transformers.js_config"] ?? {};
	}
	async dispose() {
		let e = [];
		for (let t of Object.values(this.sessions)) e.push(t.release?.());
		return await Promise.all(e);
	}
	static async from_pretrained(e, { progress_callback: t = null, config: n = null, cache_dir: r = null, local_files_only: i = !1, revision: a = "main", model_file_name: o = null, subfolder: s = "onnx", device: c = null, dtype: l = null, use_external_data_format: u = null, session_options: d = {} } = {}) {
		let f = {
			progress_callback: t,
			config: n,
			cache_dir: r,
			local_files_only: i,
			revision: a,
			model_file_name: o,
			subfolder: s,
			device: c,
			dtype: l,
			use_external_data_format: u,
			session_options: d
		}, p = eg.get(this);
		n = f.config = await Qm.from_pretrained(e, f);
		let { typeConfig: m, textOnly: h, modelType: g } = Zh(p, n);
		if (g === void 0) {
			let e = p ?? n?.model_type;
			e !== "custom" && A.warn(`Model type for '${e}' not found, assuming encoder-only architecture. Please report this at ${od}.`);
		}
		if (t && !(t instanceof Or)) {
			let r = {};
			try {
				let t = await Gh(e, {
					config: n,
					dtype: l,
					device: c,
					model_file_name: o
				});
				(await Promise.all(t.map((t) => yc(e, t, f)))).forEach((e, n) => {
					if (e.exists) {
						let i = t[n] === "config.json";
						r[t[n]] = {
							loaded: i ? e.size ?? 0 : 0,
							total: e.size ?? 0
						};
					}
				});
			} catch (e) {
				A.warn(`Unable to fetch model file metadata for total progress tracking: ${e}`);
			}
			Object.keys(r).length > 0 && (f.progress_callback = new Or(t, r));
		}
		let _ = [ih(e, m.sessions(n, f, h), f, m.cache_sessions)];
		m.optional_configs && _.push(xg(e, m.optional_configs, f));
		let v = await Promise.all(_);
		return new this(n, ...v);
	}
	async _call(e) {
		return await this.forward(e);
	}
	async forward(e) {
		return await this._forward(this, e);
	}
	get generation_config() {
		return this.configs?.generation_config ?? null;
	}
	_get_logits_processor(e, t, n = null) {
		let r = new _h();
		if (e.repetition_penalty !== null && e.repetition_penalty !== 1 && r.push(new wh(e.repetition_penalty)), e.no_repeat_ngram_size !== null && e.no_repeat_ngram_size > 0 && r.push(new Ch(e.no_repeat_ngram_size)), e.bad_words_ids !== null && r.push(new Dh(e.bad_words_ids, e.eos_token_id)), e.min_length !== null && e.eos_token_id !== null && e.min_length > 0 && r.push(new Th(e.min_length, e.eos_token_id)), e.min_new_tokens !== null && e.eos_token_id !== null && e.min_new_tokens > 0 && r.push(new Eh(t, e.min_new_tokens, e.eos_token_id)), e.forced_bos_token_id !== null && r.push(new vh(e.forced_bos_token_id)), e.forced_eos_token_id !== null && r.push(new yh(e.max_length, e.forced_eos_token_id)), e.suppress_tokens !== null && r.push(new bh(e.suppress_tokens)), e.begin_suppress_tokens !== null) {
			let n = t > 1 || e.forced_bos_token_id === null ? t : t + 1;
			r.push(new xh(e.begin_suppress_tokens, n));
		}
		return e.guidance_scale !== null && e.guidance_scale > 1 && r.push(new Oh(e.guidance_scale)), e.temperature === 0 && e.do_sample && (A.warn("`do_sample` changed to false because `temperature: 0` implies greedy sampling (always selecting the most likely token), which is incompatible with `do_sample: true`."), e.do_sample = !1), e.do_sample && e.temperature !== null && e.temperature !== 1 && r.push(new kh(e.temperature)), n !== null && r.extend(n), r;
	}
	_prepare_generation_config(e, t, n = Ah) {
		let r = { ...this.config };
		for (let e of [
			"decoder",
			"generator",
			"text_config"
		]) e in r && Object.assign(r, r[e]);
		let i = new n(r);
		return Object.assign(i, this.generation_config ?? {}), e && Object.assign(i, e), t && Object.assign(i, Fr(t, Object.getOwnPropertyNames(i))), i;
	}
	_get_stopping_criteria(e, t = null) {
		let n = new Mh();
		return e.max_length !== null && n.push(new Nh(e.max_length, this.config.max_position_embeddings ?? null)), e.eos_token_id !== null && n.push(new Ph(e.eos_token_id)), t && n.extend(t), n;
	}
	_validate_model_class() {
		if (!this.can_generate) {
			let e = [
				Kh.MODEL_FOR_CAUSAL_LM_MAPPING_NAMES,
				Kh.MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES,
				Kh.MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES,
				Kh.MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES
			].filter(Boolean), t = eg.get(this.constructor), n = /* @__PURE__ */ new Set(), r = this.config.model_type;
			for (let t of e) {
				let e = t?.get(r);
				e && n.add(e);
			}
			let i = `The current model class (${t}) is not compatible with \`.generate()\`, as it doesn't have a language model head.`;
			throw n.size > 0 && (i += ` Please use the following class instead: ${[...n].join(", ")}`), Error(i);
		}
	}
	prepare_inputs_for_generation(...e) {
		if (!this._prepare_inputs_for_generation) throw Error("prepare_inputs_for_generation is not implemented for this model.");
		return this._prepare_inputs_for_generation(this, ...e);
	}
	_update_model_kwargs_for_generation({ generated_input_ids: e, outputs: t, model_inputs: n, is_encoder_decoder: r }) {
		return n.past_key_values = ig(t, n.past_key_values), n.input_ids = new V("int64", e.flat(), [e.length, 1]), r ? "decoder_attention_mask" in n && (n.decoder_attention_mask = H([n.decoder_attention_mask, Kl([n.decoder_attention_mask.dims[0], 1])], 1)) : n.attention_mask = H([n.attention_mask, Kl([n.attention_mask.dims[0], 1])], 1), n.position_ids = null, n;
	}
	_prepare_model_inputs({ inputs: e, bos_token_id: t, model_kwargs: n }) {
		let r = Fr(n, this.forward_params), i = this.main_input_name;
		if (i in r) {
			if (e) throw Error("`inputs`: {inputs}` were passed alongside {input_name} which is not allowed. Make sure to either pass {inputs} or {input_name}=...");
		} else r[i] = e;
		return {
			inputs_tensor: r[i],
			model_inputs: r,
			model_input_name: i
		};
	}
	async _prepare_encoder_decoder_kwargs_for_generation({ inputs_tensor: e, model_inputs: t, model_input_name: n, generation_config: r }) {
		if (this.sessions.model.inputNames.includes("inputs_embeds") && !t.inputs_embeds && "_prepare_inputs_embeds" in this) {
			let { input_ids: e, pixel_values: n, attention_mask: r, ...i } = t, a = await this._prepare_inputs_embeds(t);
			t = {
				...i,
				...Fr(a, ["inputs_embeds", "attention_mask"])
			};
		}
		let { last_hidden_state: i } = await ng(this, t);
		if (r.guidance_scale !== null && r.guidance_scale > 1) i = H([i, Gl(i, 0)], 0), "attention_mask" in t && (t.attention_mask = H([t.attention_mask, Yl(t.attention_mask)], 0));
		else if (t.decoder_input_ids) {
			let e = Jh(t.decoder_input_ids).dims[0];
			if (e !== i.dims[0]) {
				if (i.dims[0] !== 1) throw Error(`The encoder outputs have a different batch size (${i.dims[0]}) than the decoder inputs (${e}).`);
				i = H(Array.from({ length: e }, () => i), 0);
			}
		}
		return t.encoder_outputs = i, t;
	}
	_prepare_decoder_input_ids_for_generation({ batch_size: e, model_input_name: t, model_kwargs: n, decoder_start_token_id: r, bos_token_id: i, generation_config: a }) {
		let { decoder_input_ids: o, ...s } = n;
		if (!(o instanceof V)) {
			if (o) Array.isArray(o[0]) || (o = Array.from({ length: e }, () => o));
			else if (r ??= i, this.config.model_type === "musicgen") o = Array.from({ length: e * this.config.decoder.num_codebooks }, () => [r]);
			else if (Array.isArray(r)) {
				if (r.length !== e) throw Error(`\`decoder_start_token_id\` expected to have length ${e} but got ${r.length}`);
				o = r;
			} else o = Array.from({ length: e }, () => [r]);
			o = Jh(o);
		}
		return s.decoder_attention_mask = ql(o), {
			input_ids: o,
			model_inputs: s
		};
	}
	async generate({ inputs: e = null, generation_config: t = null, logits_processor: n = null, stopping_criteria: r = null, streamer: i = null, ...a }) {
		this._validate_model_class(), t = this._prepare_generation_config(t, a);
		let { inputs_tensor: o, model_inputs: s, model_input_name: c } = this._prepare_model_inputs({
			inputs: e,
			model_kwargs: a
		}), l = this.config.is_encoder_decoder;
		l && ("encoder_outputs" in s || (s = await this._prepare_encoder_decoder_kwargs_for_generation({
			inputs_tensor: o,
			model_inputs: s,
			model_input_name: c,
			generation_config: t
		})));
		let u;
		l ? {input_ids: u, model_inputs: s} = this._prepare_decoder_input_ids_for_generation({
			batch_size: s[c].dims.at(0),
			model_input_name: c,
			model_kwargs: s,
			decoder_start_token_id: t.decoder_start_token_id,
			bos_token_id: t.bos_token_id,
			generation_config: t
		}) : u = s[c];
		let d = u.dims.at(-1);
		t.max_new_tokens !== null && (t.max_length = d + t.max_new_tokens);
		let f = this._get_logits_processor(t, d, n), p = this._get_stopping_criteria(t, r), m = s[c].dims.at(0), h = Fh.getSampler(t), g = Array(m).fill(0), _ = u.tolist();
		i && i.put(_);
		let v, y = {}, b = {};
		for (;;) {
			if (s = this.prepare_inputs_for_generation(_, s, t), v = await this.forward(s), t.return_dict_in_generate) {
				if (t.output_attentions) {
					let e = ag(v);
					for (let t in e) t in y || (y[t] = []), y[t].push(e[t]);
				} else this._return_dict_in_generate_keys && Object.assign(b, Fr(v, this._return_dict_in_generate_keys));
			}
			let e = f(_, v.logits.slice(null, -1, null).to("float32")), n = [];
			for (let t = 0; t < e.dims.at(0); ++t) {
				let r = e[t], i = await h(r);
				for (let [e, r] of i) {
					let i = BigInt(e);
					g[t] += r, _[t].push(i), n.push([i]);
					break;
				}
			}
			if (i && i.put(n), p(_).every((e) => e)) break;
			s = this._update_model_kwargs_for_generation({
				generated_input_ids: n,
				outputs: v,
				model_inputs: s,
				is_encoder_decoder: l
			});
		}
		i && i.end();
		let x = new V("int64", _.flat(), [_.length, _[0].length]), S = ig(v, s.past_key_values), C = new Set(Object.values(S));
		for (let e of Object.values(v)) e.location === "gpu-buffer" && !C.has(e) && e.dispose();
		return "past_key_values" in a || t.return_dict_in_generate || await S.dispose(), t.return_dict_in_generate ? {
			sequences: x,
			past_key_values: S,
			...y,
			...b
		} : x;
	}
	async _encode_input(e, t, n) {
		if (!Object.hasOwn(this.sessions, e)) throw Error(`Model does not have a ${e} session.`);
		let r = this.sessions[e];
		return (await q(r, Fr(t, r.inputNames)))[n];
	}
	async encode_image(e) {
		return this._encode_input("vision_encoder", e, "image_features");
	}
	async encode_text(e) {
		return this._encode_input("embed_tokens", e, "inputs_embeds");
	}
	async encode_audio(e) {
		return this._encode_input("audio_encoder", e, "audio_features");
	}
};
async function tg(e, t) {
	let { encoder_outputs: n, input_ids: r, decoder_input_ids: i, decoder_attention_mask: a, ...o } = t;
	return n ||= (await ng(e, Fr(t, e.sessions.model.inputNames))).last_hidden_state, o.input_ids = i, o.encoder_hidden_states = n, e.sessions.decoder_model_merged.inputNames.includes("encoder_attention_mask") && (o.encoder_attention_mask = t.attention_mask), a && !o.attention_mask && (o.attention_mask = a), await lg(e, o, !0);
}
async function ng(e, t) {
	let n = e.sessions.model, r = Fr(t, n.inputNames);
	if (n.inputNames.includes("inputs_embeds") && !r.inputs_embeds) {
		if (!t.input_ids) throw Error("Both `input_ids` and `inputs_embeds` are missing in the model inputs.");
		r.inputs_embeds = await e.encode_text({ input_ids: t.input_ids });
	}
	if (n.inputNames.includes("token_type_ids") && !r.token_type_ids) {
		if (!r.input_ids) throw Error("Both `input_ids` and `token_type_ids` are missing in the model inputs.");
		r.token_type_ids = Yl(r.input_ids);
	}
	if (n.inputNames.includes("pixel_mask") && !r.pixel_mask) {
		if (!r.pixel_values) throw Error("Both `pixel_values` and `pixel_mask` are missing in the model inputs.");
		let e = r.pixel_values.dims;
		r.pixel_mask = Kl([
			e[0],
			e[2],
			e[3]
		]);
	}
	return await q(n, r);
}
async function rg(e, t) {
	let n = await e.encode(t);
	return await e.decode(n);
}
function ig(e, t) {
	let n = /* @__PURE__ */ Object.create(null);
	for (let r in e) if (r.startsWith("present")) {
		let i = r.replace("present_ssm", "past_ssm").replace("present_conv", "past_conv").replace("present_recurrent", "past_recurrent").replace("present_compressor", "past_compressor").replace("present_indexer", "past_indexer").replace("present", "past_key_values");
		n[i] = r.includes("encoder") && t ? t[i] : e[r];
	}
	return t ? (t.update(n), t) : new zh(n);
}
function ag(e) {
	let t = {};
	for (let n of [
		"cross_attentions",
		"encoder_attentions",
		"decoder_attentions"
	]) for (let r in e) r.startsWith(n) && (n in t || (t[n] = []), t[n].push(e[r]));
	return t;
}
function og(e, t) {
	return e.map((e) => typeof e == "number" ? e : t[e] ?? 0);
}
function sg(e, t, n) {
	if (n && Object.keys(n).length > 0) return Object.assign(t, n), n;
	let r = e.sessions.decoder_model_merged ?? e.sessions.model, i = (t[e.main_input_name] ?? t.attention_mask)?.dims?.[0] ?? 1, a = Ym(e.config), o = e.config?.normalized_config?.num_heads, s = { batch_size: i };
	typeof o == "number" && (s["batch_size x num_heads"] = i * o);
	let c = /* @__PURE__ */ Object.create(null);
	for (let e of r.inputMetadata) {
		if (!a.has(e.name)) continue;
		let n = og(e.shape, s), r = n.reduce((e, t) => e * t, 1), i = Tl[e.type], o = new V(e.type, new i(r), n);
		t[e.name] = o, c[e.name] = o;
	}
	return n ? (n.update(c), n) : new zh(c);
}
function cg(e, t, n) {
	t.num_logits_to_keep || (e.sessions.decoder_model_merged ?? e.sessions.model)?.inputNames.includes("num_logits_to_keep") && (t.num_logits_to_keep = new V("int64", [n], []));
}
async function lg(e, t, n = !1) {
	let r = e.sessions[n ? "decoder_model_merged" : "model"], { past_key_values: i, ...a } = t;
	return r.inputNames.includes("use_cache_branch") && (a.use_cache_branch = Yh(i != null && Object.keys(i).length > 0)), r.inputNames.includes("position_ids") && a.attention_mask && !a.position_ids && (a.position_ids = mg(a, i, +!![
		"paligemma",
		"gemma3_text",
		"gemma3"
	].includes(e.config.model_type))), cg(e, a, 0n), sg(e, a, i), await q(r, Fr(a, r.inputNames));
}
async function ug(e, { encode_function: t, merge_function: n, modality_input_names: r, modality_output_name: i, input_ids: a = null, attention_mask: o = null, position_ids: s = null, inputs_embeds: c = null, past_key_values: l = null, generation_config: u = null, logits_processor: d = null, num_logits_to_keep: f = null, ...p }) {
	if (!c) {
		c = await e.encode_text({
			input_ids: a,
			...p
		});
		let s = Fr(p, r);
		if (Object.keys(s).length > 0) {
			if (a.dims[1] !== 1) {
				let e = await t({
					...s,
					...p
				});
				({inputs_embeds: c, attention_mask: o} = n({
					[i]: e,
					inputs_embeds: c,
					input_ids: a,
					attention_mask: o
				}));
			} else if (l && a.dims[1] === 1) {
				let e = a.dims[1], t = l.get_seq_length();
				o = H([Kl([a.dims[0], t]), o.slice(null, [o.dims[1] - e, o.dims[1]])], 1);
			}
		}
	}
	if (!s && [
		"qwen2_vl",
		"qwen2_vl_text",
		"qwen2_5_vl",
		"qwen2_5_vl_text",
		"qwen3_vl",
		"qwen3_vl_text",
		"qwen3_vl_moe",
		"qwen3_vl_moe_text",
		"qwen3_5",
		"qwen3_5_text",
		"qwen3_5_moe",
		"qwen3_5_moe_text",
		"glm_ocr",
		"glm_ocr_text"
	].includes(e.config.model_type)) {
		let { image_grid_thw: t, video_grid_thw: n } = p;
		[s] = e.get_rope_index(a, t, n, o);
	}
	return await lg(e, {
		inputs_embeds: c,
		past_key_values: l,
		attention_mask: o,
		position_ids: s,
		generation_config: u,
		logits_processor: d,
		num_logits_to_keep: f
	}, !0);
}
async function dg(e, t) {
	return await ug(e, {
		...t,
		modality_input_names: ["audio_values", "input_features"],
		modality_output_name: "audio_features",
		encode_function: e.encode_audio.bind(e),
		merge_function: e._merge_input_ids_with_audio_features.bind(e)
	});
}
async function fg(e, t) {
	return await ug(e, {
		...t,
		modality_input_names: ["pixel_values"],
		modality_output_name: "image_features",
		encode_function: e.encode_image.bind(e),
		merge_function: e._merge_input_ids_with_image_features.bind(e)
	});
}
function pg(e, t = 0) {
	let [n, r] = e.dims, i = e.data, a = new BigInt64Array(i.length);
	for (let e = 0; e < n; ++e) {
		let n = e * r, o = BigInt(t);
		for (let e = 0; e < r; ++e) {
			let t = n + e;
			i[t] === 0n ? a[t] = BigInt(1) : (a[t] = o, o += i[t]);
		}
	}
	return {
		data: a,
		dims: e.dims
	};
}
function mg(e, t = null, n = 0) {
	let { input_ids: r, inputs_embeds: i, attention_mask: a } = e, { data: o, dims: s } = pg(a, n), c = new V("int64", o, s);
	if (t) {
		let e = -(r ?? i).dims.at(1);
		c = c.slice(null, [e, null]);
	}
	return c;
}
function hg(e, t, n, r) {
	let i = n.past_key_values ? n.past_key_values.get_seq_length() : 0;
	if (cg(e, n, 1n), !n.attention_mask) {
		let e;
		for (let t of [
			"input_ids",
			"inputs_embeds",
			"position_ids"
		]) if (n[t]) {
			e = n[t].dims;
			break;
		}
		if (!e) throw Error("attention_mask is not provided, and unable to infer its shape from model inputs.");
		n.attention_mask = Kl([e[0], i + e[1]]);
	}
	if (n.past_key_values) {
		let { input_ids: e, attention_mask: t } = n;
		t && t.dims[1] > e.dims[1] || i < e.dims[1] && (n.input_ids = e.slice(null, [i, null]));
	}
	return n;
}
function gg(e, t, n, r) {
	return n.past_key_values && (t = t.map((e) => [e.at(-1)])), cg(e, n, 1n), {
		...n,
		decoder_input_ids: Jh(t)
	};
}
function _g(e, ...t) {
	return e.config.is_encoder_decoder ? gg(e, ...t) : hg(e, ...t);
}
function vg({ modality_token_id: e, inputs_embeds: t, modality_features: n, input_ids: r, attention_mask: i }) {
	let a = r.tolist().map((t) => t.reduce((t, n, r) => (n == e && t.push(r), t), [])), o = a.reduce((e, t) => e + t.length, 0), s = n.dims[0];
	if (o !== s) throw Error(`Number of tokens and features do not match: tokens: ${o}, features ${s}`);
	let c = 0;
	for (let e = 0; e < a.length; ++e) {
		let r = a[e], i = t[e];
		for (let e = 0; e < r.length; ++e) i[r[e]].data.set(n[c++].data);
	}
	return {
		inputs_embeds: t,
		attention_mask: i
	};
}
function yg({ image_token_id: e, inputs_embeds: t, image_features: n, input_ids: r, attention_mask: i }) {
	return vg({
		modality_token_id: e,
		inputs_embeds: t,
		modality_features: n,
		input_ids: r,
		attention_mask: i
	});
}
function bg({ audio_token_id: e, inputs_embeds: t, audio_features: n, input_ids: r, attention_mask: i }) {
	return vg({
		modality_token_id: e,
		inputs_embeds: t,
		modality_features: n,
		input_ids: r,
		attention_mask: i
	});
}
async function xg(e, t, n) {
	return Object.fromEntries(await Promise.all(Object.keys(t).map(async (r) => [r, await Ac(e, t[r], !1, n)])));
}
var Sg = {};
Yn(Sg, {
	ASTForAudioClassification: () => zg,
	ASTModel: () => Rg,
	ASTPreTrainedModel: () => Lg,
	AfmoeForCausalLM: () => Ng,
	AfmoeModel: () => Mg,
	AfmoePreTrainedModel: () => jg,
	AlbertForMaskedLM: () => Dg,
	AlbertForQuestionAnswering: () => Eg,
	AlbertForSequenceClassification: () => Tg,
	AlbertModel: () => wg,
	AlbertPreTrainedModel: () => Cg,
	ApertusForCausalLM: () => Ag,
	ApertusModel: () => kg,
	ApertusPreTrainedModel: () => Og,
	ArceeForCausalLM: () => Ig,
	ArceeModel: () => Fg,
	ArceePreTrainedModel: () => Pg,
	BartForConditionalGeneration: () => Hg,
	BartForSequenceClassification: () => Ug,
	BartModel: () => Vg,
	BartPretrainedModel: () => Bg,
	BaseModelOutput: () => sh,
	BeitForImageClassification: () => Kg,
	BeitModel: () => Gg,
	BeitPreTrainedModel: () => Wg,
	BertForMaskedLM: () => Yg,
	BertForQuestionAnswering: () => Qg,
	BertForSequenceClassification: () => Xg,
	BertForTokenClassification: () => Zg,
	BertModel: () => Jg,
	BertPreTrainedModel: () => qg,
	BlenderbotForConditionalGeneration: () => t_,
	BlenderbotModel: () => e_,
	BlenderbotPreTrainedModel: () => $g,
	BlenderbotSmallForConditionalGeneration: () => i_,
	BlenderbotSmallModel: () => r_,
	BlenderbotSmallPreTrainedModel: () => n_,
	BloomForCausalLM: () => s_,
	BloomModel: () => o_,
	BloomPreTrainedModel: () => a_,
	CHMv2ForDepthEstimation: () => x_,
	CHMv2PreTrainedModel: () => b_,
	CLIPModel: () => D_,
	CLIPPreTrainedModel: () => E_,
	CLIPSegForImageSegmentation: () => P_,
	CLIPSegModel: () => N_,
	CLIPSegPreTrainedModel: () => M_,
	CLIPTextModel: () => O_,
	CLIPTextModelWithProjection: () => k_,
	CLIPVisionModel: () => A_,
	CLIPVisionModelWithProjection: () => j_,
	CamembertForMaskedLM: () => u_,
	CamembertForQuestionAnswering: () => p_,
	CamembertForSequenceClassification: () => d_,
	CamembertForTokenClassification: () => f_,
	CamembertModel: () => l_,
	CamembertPreTrainedModel: () => c_,
	CausalLMOutput: () => dh,
	CausalLMOutputWithPast: () => fh,
	ChatterboxModel: () => __,
	ChatterboxPreTrainedModel: () => g_,
	ChineseCLIPModel: () => y_,
	ChineseCLIPPreTrainedModel: () => v_,
	ClapAudioModelWithProjection: () => T_,
	ClapModel: () => C_,
	ClapPreTrainedModel: () => S_,
	ClapTextModelWithProjection: () => w_,
	CodeGenForCausalLM: () => L_,
	CodeGenModel: () => I_,
	CodeGenPreTrainedModel: () => F_,
	Cohere2ForCausalLM: () => U_,
	Cohere2Model: () => H_,
	Cohere2PreTrainedModel: () => V_,
	CohereAsrForConditionalGeneration: () => K_,
	CohereAsrModel: () => G_,
	CohereAsrPreTrainedModel: () => W_,
	CohereForCausalLM: () => B_,
	CohereModel: () => z_,
	CoherePreTrainedModel: () => R_,
	ConvBertForMaskedLM: () => Y_,
	ConvBertForQuestionAnswering: () => Q_,
	ConvBertForSequenceClassification: () => X_,
	ConvBertForTokenClassification: () => Z_,
	ConvBertModel: () => J_,
	ConvBertPreTrainedModel: () => q_,
	ConvNextForImageClassification: () => tv,
	ConvNextModel: () => ev,
	ConvNextPreTrainedModel: () => $_,
	ConvNextV2ForImageClassification: () => iv,
	ConvNextV2Model: () => rv,
	ConvNextV2PreTrainedModel: () => nv,
	DFineForObjectDetection: () => dv,
	DFineModel: () => uv,
	DFinePreTrainedModel: () => lv,
	DINOv3ConvNextModel: () => iy,
	DINOv3ConvNextPreTrainedModel: () => ry,
	DINOv3ViTModel: () => oy,
	DINOv3ViTPreTrainedModel: () => ay,
	DPTForDepthEstimation: () => _y,
	DPTModel: () => gy,
	DPTPreTrainedModel: () => hy,
	DacDecoderModel: () => _v,
	DacDecoderOutput: () => pv,
	DacEncoderModel: () => gv,
	DacEncoderOutput: () => fv,
	DacModel: () => hv,
	DacPreTrainedModel: () => mv,
	DebertaForMaskedLM: () => bv,
	DebertaForQuestionAnswering: () => Cv,
	DebertaForSequenceClassification: () => xv,
	DebertaForTokenClassification: () => Sv,
	DebertaModel: () => yv,
	DebertaPreTrainedModel: () => vv,
	DebertaV2ForMaskedLM: () => Mv,
	DebertaV2ForQuestionAnswering: () => Fv,
	DebertaV2ForSequenceClassification: () => Nv,
	DebertaV2ForTokenClassification: () => Pv,
	DebertaV2Model: () => jv,
	DebertaV2PreTrainedModel: () => Av,
	DecisionTransformerModel: () => Lv,
	DecisionTransformerPreTrainedModel: () => Iv,
	DeepseekV3ForCausalLM: () => Ev,
	DeepseekV3Model: () => Tv,
	DeepseekV3PreTrainedModel: () => wv,
	DeepseekV4ForCausalLM: () => kv,
	DeepseekV4Model: () => Ov,
	DeepseekV4PreTrainedModel: () => Dv,
	DeiTForImageClassification: () => Bv,
	DeiTModel: () => zv,
	DeiTPreTrainedModel: () => Rv,
	DepthAnythingForDepthEstimation: () => Hv,
	DepthAnythingPreTrainedModel: () => Vv,
	DepthProForDepthEstimation: () => Wv,
	DepthProPreTrainedModel: () => Uv,
	DetrForObjectDetection: () => qv,
	DetrForSegmentation: () => Jv,
	DetrModel: () => Kv,
	DetrObjectDetectionOutput: () => Yv,
	DetrPreTrainedModel: () => Gv,
	DetrSegmentationOutput: () => Xv,
	Dinov2ForImageClassification: () => $v,
	Dinov2Model: () => Qv,
	Dinov2PreTrainedModel: () => Zv,
	Dinov2WithRegistersForImageClassification: () => ny,
	Dinov2WithRegistersModel: () => ty,
	Dinov2WithRegistersPreTrainedModel: () => ey,
	DistilBertForMaskedLM: () => fy,
	DistilBertForQuestionAnswering: () => dy,
	DistilBertForSequenceClassification: () => ly,
	DistilBertForTokenClassification: () => uy,
	DistilBertModel: () => cy,
	DistilBertPreTrainedModel: () => sy,
	DonutSwinModel: () => my,
	DonutSwinPreTrainedModel: () => py,
	EdgeTamModel: () => iE,
	EfficientNetForImageClassification: () => by,
	EfficientNetModel: () => yy,
	EfficientNetPreTrainedModel: () => vy,
	ElectraForMaskedLM: () => Cy,
	ElectraForQuestionAnswering: () => Ey,
	ElectraForSequenceClassification: () => wy,
	ElectraForTokenClassification: () => Ty,
	ElectraModel: () => Sy,
	ElectraPreTrainedModel: () => xy,
	Ernie4_5ForCausalLM: () => ky,
	Ernie4_5Model: () => Oy,
	Ernie4_5PretrainedModel: () => Dy,
	EsmForMaskedLM: () => My,
	EsmForSequenceClassification: () => Ny,
	EsmForTokenClassification: () => Py,
	EsmModel: () => jy,
	EsmPreTrainedModel: () => Ay,
	EuroBertForMaskedLM: () => Ly,
	EuroBertForSequenceClassification: () => Ry,
	EuroBertForTokenClassification: () => zy,
	EuroBertModel: () => Iy,
	EuroBertPreTrainedModel: () => Fy,
	ExaoneForCausalLM: () => Hy,
	ExaoneModel: () => Vy,
	ExaonePreTrainedModel: () => By,
	FalconForCausalLM: () => Gy,
	FalconH1ForCausalLM: () => Jy,
	FalconH1Model: () => qy,
	FalconH1PreTrainedModel: () => Ky,
	FalconModel: () => Wy,
	FalconPreTrainedModel: () => Uy,
	FastViTForImageClassification: () => Zy,
	FastViTModel: () => Xy,
	FastViTPreTrainedModel: () => Yy,
	Florence2ForConditionalGeneration: () => $y,
	Florence2PreTrainedModel: () => Qy,
	GLPNForDepthEstimation: () => Nb,
	GLPNModel: () => Mb,
	GLPNPreTrainedModel: () => jb,
	GPT2LMHeadModel: () => Jb,
	GPT2Model: () => qb,
	GPT2PreTrainedModel: () => Kb,
	GPTBigCodeForCausalLM: () => Ib,
	GPTBigCodeModel: () => Fb,
	GPTBigCodePreTrainedModel: () => Pb,
	GPTJForCausalLM: () => Zb,
	GPTJModel: () => Xb,
	GPTJPreTrainedModel: () => Yb,
	GPTNeoForCausalLM: () => zb,
	GPTNeoModel: () => Rb,
	GPTNeoPreTrainedModel: () => Lb,
	GPTNeoXForCausalLM: () => Hb,
	GPTNeoXModel: () => Vb,
	GPTNeoXPreTrainedModel: () => Bb,
	Gemma2ForCausalLM: () => ab,
	Gemma2Model: () => ib,
	Gemma2PreTrainedModel: () => rb,
	Gemma3ForCausalLM: () => pb,
	Gemma3ForConditionalGeneration: () => fb,
	Gemma3Model: () => db,
	Gemma3PreTrainedModel: () => ub,
	Gemma3nForCausalLM: () => gb,
	Gemma3nForConditionalGeneration: () => hb,
	Gemma3nPreTrainedModel: () => mb,
	Gemma4ForCausalLM: () => vb,
	Gemma4ForConditionalGeneration: () => _b,
	GemmaForCausalLM: () => nb,
	GemmaModel: () => tb,
	GemmaPreTrainedModel: () => eb,
	GlmForCausalLM: () => xb,
	GlmModel: () => bb,
	GlmMoeDsaForCausalLM: () => wb,
	GlmMoeDsaModel: () => Cb,
	GlmMoeDsaPreTrainedModel: () => Sb,
	GlmOcrForConditionalGeneration: () => Ab,
	GlmPreTrainedModel: () => yb,
	GptOssForCausalLM: () => Gb,
	GptOssModel: () => Wb,
	GptOssPreTrainedModel: () => Ub,
	GraniteForCausalLM: () => ex,
	GraniteModel: () => $b,
	GraniteMoeHybridForCausalLM: () => rx,
	GraniteMoeHybridModel: () => nx,
	GraniteMoeHybridPreTrainedModel: () => tx,
	GranitePreTrainedModel: () => Qb,
	GraniteSpeechForConditionalGeneration: () => ox,
	GroundingDinoForObjectDetection: () => cx,
	GroundingDinoPreTrainedModel: () => sx,
	GroupViTModel: () => ux,
	GroupViTPreTrainedModel: () => lx,
	HeliumForCausalLM: () => px,
	HeliumModel: () => fx,
	HeliumPreTrainedModel: () => dx,
	HieraForImageClassification: () => gx,
	HieraModel: () => hx,
	HieraPreTrainedModel: () => mx,
	HrmTextForCausalLM: () => yx,
	HrmTextModel: () => vx,
	HrmTextPreTrainedModel: () => _x,
	HubertForCTC: () => Dx,
	HubertForSequenceClassification: () => Ox,
	HubertModel: () => Ex,
	HubertPreTrainedModel: () => Tx,
	HunYuanDenseV1ForCausalLM: () => jx,
	HunYuanDenseV1Model: () => Ax,
	HunYuanDenseV1PreTrainedModel: () => kx,
	IJepaForImageClassification: () => Fx,
	IJepaModel: () => Px,
	IJepaPreTrainedModel: () => Nx,
	Idefics3ForConditionalGeneration: () => Mx,
	ImageMattingOutput: () => mh,
	JAISLMHeadModel: () => Rx,
	JAISModel: () => Lx,
	JAISPreTrainedModel: () => Ix,
	JinaCLIPModel: () => Bx,
	JinaCLIPPreTrainedModel: () => zx,
	JinaCLIPTextModel: () => Vx,
	JinaCLIPVisionModel: () => Hx,
	Lfm2ForCausalLM: () => Gx,
	Lfm2Model: () => Wx,
	Lfm2MoeForCausalLM: () => Yx,
	Lfm2MoeModel: () => Jx,
	Lfm2MoePreTrainedModel: () => qx,
	Lfm2PreTrainedModel: () => Ux,
	Lfm2VlForConditionalGeneration: () => Xx,
	LightOnOcrForConditionalGeneration: () => Kx,
	LiteWhisperForConditionalGeneration: () => pO,
	Llama4ForCausalLM: () => tS,
	Llama4PreTrainedModel: () => eS,
	LlamaForCausalLM: () => $x,
	LlamaModel: () => Qx,
	LlamaPreTrainedModel: () => Zx,
	LlavaForConditionalGeneration: () => sb,
	LlavaOnevisionForConditionalGeneration: () => sb,
	LlavaPreTrainedModel: () => ob,
	LlavaQwen2ForCausalLM: () => lb,
	LongT5ForConditionalGeneration: () => iS,
	LongT5Model: () => rS,
	LongT5PreTrainedModel: () => nS,
	M2M100ForConditionalGeneration: () => sS,
	M2M100Model: () => oS,
	M2M100PreTrainedModel: () => aS,
	MBartForCausalLM: () => vS,
	MBartForConditionalGeneration: () => gS,
	MBartForSequenceClassification: () => _S,
	MBartModel: () => hS,
	MBartPreTrainedModel: () => mS,
	MPNetForMaskedLM: () => PC,
	MPNetForQuestionAnswering: () => LC,
	MPNetForSequenceClassification: () => FC,
	MPNetForTokenClassification: () => IC,
	MPNetModel: () => NC,
	MPNetPreTrainedModel: () => MC,
	MT5ForConditionalGeneration: () => UC,
	MT5Model: () => HC,
	MT5PreTrainedModel: () => VC,
	MarianMTModel: () => uS,
	MarianModel: () => lS,
	MarianPreTrainedModel: () => cS,
	MaskFormerForInstanceSegmentation: () => pS,
	MaskFormerModel: () => fS,
	MaskFormerPreTrainedModel: () => dS,
	MaskedLMOutput: () => lh,
	Metric3DForDepthEstimation: () => bS,
	Metric3DPreTrainedModel: () => yS,
	Metric3Dv2ForDepthEstimation: () => SS,
	Metric3Dv2PreTrainedModel: () => xS,
	MgpstrForSceneTextRecognition: () => TS,
	MgpstrModelOutput: () => CS,
	MgpstrPreTrainedModel: () => wS,
	MimiDecoderModel: () => jS,
	MimiDecoderOutput: () => DS,
	MimiEncoderModel: () => AS,
	MimiEncoderOutput: () => ES,
	MimiModel: () => kS,
	MimiPreTrainedModel: () => OS,
	Ministral3ForCausalLM: () => LS,
	Ministral3Model: () => IS,
	Ministral3PreTrainedModel: () => FS,
	MinistralForCausalLM: () => PS,
	MinistralModel: () => NS,
	MinistralPreTrainedModel: () => MS,
	Mistral3ForConditionalGeneration: () => VS,
	Mistral4ForCausalLM: () => WS,
	Mistral4Model: () => US,
	Mistral4PreTrainedModel: () => HS,
	MistralForCausalLM: () => BS,
	MistralModel: () => zS,
	MistralPreTrainedModel: () => RS,
	MobileBertForMaskedLM: () => qS,
	MobileBertForQuestionAnswering: () => YS,
	MobileBertForSequenceClassification: () => JS,
	MobileBertModel: () => KS,
	MobileBertPreTrainedModel: () => GS,
	MobileLLMForCausalLM: () => QS,
	MobileLLMModel: () => ZS,
	MobileLLMPreTrainedModel: () => XS,
	MobileNetV1ForImageClassification: () => tC,
	MobileNetV1ForSemanticSegmentation: () => nC,
	MobileNetV1Model: () => eC,
	MobileNetV1PreTrainedModel: () => $S,
	MobileNetV2ForImageClassification: () => aC,
	MobileNetV2ForSemanticSegmentation: () => oC,
	MobileNetV2Model: () => iC,
	MobileNetV2PreTrainedModel: () => rC,
	MobileNetV3ForImageClassification: () => lC,
	MobileNetV3ForSemanticSegmentation: () => uC,
	MobileNetV3Model: () => cC,
	MobileNetV3PreTrainedModel: () => sC,
	MobileNetV4ForImageClassification: () => pC,
	MobileNetV4ForSemanticSegmentation: () => mC,
	MobileNetV4Model: () => fC,
	MobileNetV4PreTrainedModel: () => dC,
	MobileViTForImageClassification: () => _C,
	MobileViTModel: () => gC,
	MobileViTPreTrainedModel: () => hC,
	MobileViTV2ForImageClassification: () => bC,
	MobileViTV2Model: () => yC,
	MobileViTV2PreTrainedModel: () => vC,
	ModelOutput: () => J,
	ModernBertDecoderForCausalLM: () => OC,
	ModernBertDecoderModel: () => DC,
	ModernBertDecoderPreTrainedModel: () => EC,
	ModernBertForMaskedLM: () => CC,
	ModernBertForSequenceClassification: () => wC,
	ModernBertForTokenClassification: () => TC,
	ModernBertModel: () => SC,
	ModernBertPreTrainedModel: () => xC,
	Moondream1ForConditionalGeneration: () => cb,
	MoonshineForConditionalGeneration: () => jC,
	MoonshineModel: () => AC,
	MoonshinePreTrainedModel: () => kC,
	MptForCausalLM: () => BC,
	MptModel: () => zC,
	MptPreTrainedModel: () => RC,
	MultiModalityCausalLM: () => GC,
	MultiModalityPreTrainedModel: () => WC,
	MusicgenForCausalLM: () => JC,
	MusicgenForConditionalGeneration: () => YC,
	MusicgenModel: () => qC,
	MusicgenPreTrainedModel: () => KC,
	NanoChatForCausalLM: () => QC,
	NanoChatModel: () => ZC,
	NanoChatPreTrainedModel: () => XC,
	NemotronHForCausalLM: () => tw,
	NemotronHModel: () => ew,
	NemotronHPreTrainedModel: () => $C,
	NeoBertForMaskedLM: () => iw,
	NeoBertForQuestionAnswering: () => sw,
	NeoBertForSequenceClassification: () => aw,
	NeoBertForTokenClassification: () => ow,
	NeoBertModel: () => rw,
	NeoBertPreTrainedModel: () => nw,
	NomicBertModel: () => lw,
	NomicBertPreTrainedModel: () => cw,
	OPTForCausalLM: () => Aw,
	OPTModel: () => kw,
	OPTPreTrainedModel: () => Ow,
	Olmo2ForCausalLM: () => hw,
	Olmo2Model: () => mw,
	Olmo2PreTrainedModel: () => pw,
	Olmo3ForCausalLM: () => vw,
	Olmo3Model: () => _w,
	Olmo3PreTrainedModel: () => gw,
	OlmoForCausalLM: () => fw,
	OlmoHybridForCausalLM: () => xw,
	OlmoHybridModel: () => bw,
	OlmoHybridPreTrainedModel: () => yw,
	OlmoModel: () => dw,
	OlmoPreTrainedModel: () => uw,
	OpenAIPrivacyFilterForTokenClassification: () => ww,
	OpenAIPrivacyFilterModel: () => Cw,
	OpenAIPrivacyFilterPreTrainedModel: () => Sw,
	OpenELMForCausalLM: () => Dw,
	OpenELMModel: () => Ew,
	OpenELMPreTrainedModel: () => Tw,
	OwlViTForObjectDetection: () => Iw,
	OwlViTModel: () => Fw,
	OwlViTPreTrainedModel: () => Pw,
	Owlv2ForObjectDetection: () => Nw,
	Owlv2Model: () => Mw,
	Owlv2PreTrainedModel: () => jw,
	PaliGemmaForConditionalGeneration: () => Lw,
	ParakeetForCTC: () => zw,
	ParakeetPreTrainedModel: () => Rw,
	PatchTSMixerForPrediction: () => Hw,
	PatchTSMixerModel: () => Vw,
	PatchTSMixerPreTrainedModel: () => Bw,
	PatchTSTForPrediction: () => Gw,
	PatchTSTModel: () => Ww,
	PatchTSTPreTrainedModel: () => Uw,
	Phi3ForCausalLM: () => Zw,
	Phi3Model: () => Xw,
	Phi3PreTrainedModel: () => Yw,
	Phi3VForCausalLM: () => $w,
	Phi3VPreTrainedModel: () => Qw,
	PhiForCausalLM: () => Jw,
	PhiModel: () => qw,
	PhiPreTrainedModel: () => Kw,
	PreTrainedModel: () => Z,
	PvtForImageClassification: () => nT,
	PvtModel: () => tT,
	PvtPreTrainedModel: () => eT,
	PyAnnoteForAudioFrameClassification: () => aT,
	PyAnnoteModel: () => iT,
	PyAnnotePreTrainedModel: () => rT,
	QuestionAnsweringModelOutput: () => uh,
	Qwen2ForCausalLM: () => cT,
	Qwen2Model: () => sT,
	Qwen2MoeForCausalLM: () => dT,
	Qwen2MoeModel: () => uT,
	Qwen2MoePreTrainedModel: () => lT,
	Qwen2PreTrainedModel: () => oT,
	Qwen2VLForCausalLM: () => Db,
	Qwen2VLForConditionalGeneration: () => Eb,
	Qwen2VLPreTrainedModel: () => Tb,
	Qwen2_5_VLForCausalLM: () => kb,
	Qwen2_5_VLForConditionalGeneration: () => Ob,
	Qwen3ForCausalLM: () => mT,
	Qwen3Model: () => pT,
	Qwen3MoeForCausalLM: () => _T,
	Qwen3MoeModel: () => gT,
	Qwen3MoePreTrainedModel: () => hT,
	Qwen3NextForCausalLM: () => bT,
	Qwen3NextModel: () => yT,
	Qwen3NextPreTrainedModel: () => vT,
	Qwen3PreTrainedModel: () => fT,
	Qwen3VLForCausalLM: () => ST,
	Qwen3VLForConditionalGeneration: () => xT,
	Qwen3VLMoeForCausalLM: () => wT,
	Qwen3VLMoeForConditionalGeneration: () => CT,
	Qwen3_5ForCausalLM: () => ET,
	Qwen3_5ForConditionalGeneration: () => TT,
	Qwen3_5MoeForCausalLM: () => OT,
	Qwen3_5MoeForConditionalGeneration: () => DT,
	RFDetrForObjectDetection: () => PT,
	RFDetrModel: () => NT,
	RFDetrObjectDetectionOutput: () => FT,
	RFDetrPreTrainedModel: () => MT,
	RTDetrForObjectDetection: () => sv,
	RTDetrModel: () => ov,
	RTDetrObjectDetectionOutput: () => cv,
	RTDetrPreTrainedModel: () => av,
	RTDetrV2ForObjectDetection: () => XT,
	RTDetrV2Model: () => YT,
	RTDetrV2ObjectDetectionOutput: () => ZT,
	RTDetrV2PreTrainedModel: () => JT,
	ResNetForImageClassification: () => jT,
	ResNetModel: () => AT,
	ResNetPreTrainedModel: () => kT,
	RoFormerForMaskedLM: () => WT,
	RoFormerForQuestionAnswering: () => qT,
	RoFormerForSequenceClassification: () => GT,
	RoFormerForTokenClassification: () => KT,
	RoFormerModel: () => UT,
	RoFormerPreTrainedModel: () => HT,
	RobertaForMaskedLM: () => RT,
	RobertaForQuestionAnswering: () => VT,
	RobertaForSequenceClassification: () => zT,
	RobertaForTokenClassification: () => BT,
	RobertaModel: () => LT,
	RobertaPreTrainedModel: () => IT,
	Sam2ImageSegmentationOutput: () => tE,
	Sam2Model: () => rE,
	Sam2PreTrainedModel: () => nE,
	Sam3TrackerModel: () => aE,
	SamImageSegmentationOutput: () => QT,
	SamModel: () => eE,
	SamPreTrainedModel: () => $T,
	SapiensForDepthEstimation: () => cE,
	SapiensForNormalEstimation: () => lE,
	SapiensForSemanticSegmentation: () => sE,
	SapiensPreTrainedModel: () => oE,
	SegformerForImageClassification: () => fE,
	SegformerForSemanticSegmentation: () => pE,
	SegformerModel: () => dE,
	SegformerPreTrainedModel: () => uE,
	Seq2SeqLMOutput: () => ph,
	SequenceClassifierOutput: () => Y,
	SiglipModel: () => hE,
	SiglipPreTrainedModel: () => mE,
	SiglipTextModel: () => gE,
	SiglipVisionModel: () => _E,
	SmolLM3ForCausalLM: () => bE,
	SmolLM3Model: () => yE,
	SmolLM3PreTrainedModel: () => vE,
	SmolVLMForConditionalGeneration: () => xE,
	SnacDecoderModel: () => TE,
	SnacEncoderModel: () => wE,
	SnacModel: () => CE,
	SnacPreTrainedModel: () => SE,
	SolarOpenForCausalLM: () => OE,
	SolarOpenModel: () => DE,
	SolarOpenPreTrainedModel: () => EE,
	SpeechT5ForSpeechToText: () => jE,
	SpeechT5ForTextToSpeech: () => ME,
	SpeechT5HifiGan: () => NE,
	SpeechT5Model: () => AE,
	SpeechT5PreTrainedModel: () => kE,
	SqueezeBertForMaskedLM: () => IE,
	SqueezeBertForQuestionAnswering: () => RE,
	SqueezeBertForSequenceClassification: () => LE,
	SqueezeBertModel: () => FE,
	SqueezeBertPreTrainedModel: () => PE,
	StableLmForCausalLM: () => VE,
	StableLmModel: () => BE,
	StableLmPreTrainedModel: () => zE,
	Starcoder2ForCausalLM: () => WE,
	Starcoder2Model: () => UE,
	Starcoder2PreTrainedModel: () => HE,
	StyleTextToSpeech2Model: () => KE,
	StyleTextToSpeech2PreTrainedModel: () => GE,
	SupertonicForConditionalGeneration: () => JE,
	SupertonicPreTrainedModel: () => qE,
	Swin2SRForImageSuperResolution: () => tD,
	Swin2SRModel: () => eD,
	Swin2SRPreTrainedModel: () => $E,
	SwinForImageClassification: () => ZE,
	SwinForSemanticSegmentation: () => QE,
	SwinModel: () => XE,
	SwinPreTrainedModel: () => YE,
	T5ForConditionalGeneration: () => iD,
	T5Model: () => rD,
	T5PreTrainedModel: () => nD,
	TableTransformerForObjectDetection: () => sD,
	TableTransformerModel: () => oD,
	TableTransformerObjectDetectionOutput: () => cD,
	TableTransformerPreTrainedModel: () => aD,
	TokenClassifierOutput: () => ch,
	TrOCRForCausalLM: () => uD,
	TrOCRPreTrainedModel: () => lD,
	UltravoxModel: () => ax,
	UltravoxPreTrainedModel: () => ix,
	UniSpeechForCTC: () => pD,
	UniSpeechForSequenceClassification: () => mD,
	UniSpeechModel: () => fD,
	UniSpeechPreTrainedModel: () => dD,
	UniSpeechSatForAudioFrameClassification: () => yD,
	UniSpeechSatForCTC: () => _D,
	UniSpeechSatForSequenceClassification: () => vD,
	UniSpeechSatModel: () => gD,
	UniSpeechSatPreTrainedModel: () => hD,
	VaultGemmaForCausalLM: () => SD,
	VaultGemmaModel: () => xD,
	VaultGemmaPreTrainedModel: () => bD,
	ViTForImageClassification: () => ED,
	ViTMAEModel: () => OD,
	ViTMAEPreTrainedModel: () => DD,
	ViTMSNForImageClassification: () => jD,
	ViTMSNModel: () => AD,
	ViTMSNPreTrainedModel: () => kD,
	ViTModel: () => TD,
	ViTPreTrainedModel: () => wD,
	VisionEncoderDecoderModel: () => CD,
	VitMatteForImageMatting: () => ND,
	VitMattePreTrainedModel: () => MD,
	VitPoseForPoseEstimation: () => FD,
	VitPosePreTrainedModel: () => PD,
	VitsModel: () => RD,
	VitsModelOutput: () => ID,
	VitsPreTrainedModel: () => LD,
	VoxtralForConditionalGeneration: () => zD,
	VoxtralRealtimeForConditionalGeneration: () => YD,
	VoxtralRealtimePreTrainedModel: () => JD,
	Wav2Vec2BertForCTC: () => QD,
	Wav2Vec2BertForSequenceClassification: () => $D,
	Wav2Vec2BertModel: () => ZD,
	Wav2Vec2BertPreTrainedModel: () => XD,
	Wav2Vec2ForAudioFrameClassification: () => wx,
	Wav2Vec2ForCTC: () => Sx,
	Wav2Vec2ForSequenceClassification: () => Cx,
	Wav2Vec2Model: () => xx,
	Wav2Vec2PreTrainedModel: () => bx,
	WavLMForAudioFrameClassification: () => oO,
	WavLMForCTC: () => rO,
	WavLMForSequenceClassification: () => iO,
	WavLMForXVector: () => aO,
	WavLMModel: () => nO,
	WavLMPreTrainedModel: () => tO,
	WeSpeakerResNetModel: () => cO,
	WeSpeakerResNetPreTrainedModel: () => sO,
	WhisperForConditionalGeneration: () => fO,
	WhisperModel: () => dO,
	WhisperPreTrainedModel: () => uO,
	XLMForQuestionAnswering: () => yO,
	XLMForSequenceClassification: () => _O,
	XLMForTokenClassification: () => vO,
	XLMModel: () => hO,
	XLMPreTrainedModel: () => mO,
	XLMRobertaForMaskedLM: () => SO,
	XLMRobertaForQuestionAnswering: () => TO,
	XLMRobertaForSequenceClassification: () => CO,
	XLMRobertaForTokenClassification: () => wO,
	XLMRobertaModel: () => xO,
	XLMRobertaPreTrainedModel: () => bO,
	XLMWithLMHeadModel: () => gO,
	XVectorOutput: () => eO,
	YolosForObjectDetection: () => OO,
	YolosModel: () => DO,
	YolosObjectDetectionOutput: () => kO,
	YolosPreTrainedModel: () => EO,
	YoutuForCausalLM: () => MO,
	YoutuModel: () => jO,
	YoutuPreTrainedModel: () => AO,
	ZayaForCausalLM: () => FO,
	ZayaModel: () => PO,
	ZayaPreTrainedModel: () => NO
});
var Cg = class extends Z {}, wg = class extends Cg {}, Tg = class extends Cg {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Eg = class extends Cg {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, Dg = class extends Cg {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, Og = class extends Z {}, kg = class extends Og {}, Ag = class extends Og {}, jg = class extends Z {}, Mg = class extends jg {}, Ng = class extends jg {}, Pg = class extends Z {}, Fg = class extends Pg {}, Ig = class extends Pg {}, Lg = class extends Z {}, Rg = class extends Lg {}, zg = class extends Lg {}, Bg = class extends Z {}, Vg = class extends Bg {}, Hg = class extends Bg {}, Ug = class extends Bg {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Wg = class extends Z {}, Gg = class extends Wg {}, Kg = class extends Wg {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, qg = class extends Z {}, Jg = class extends qg {}, Yg = class extends qg {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, Xg = class extends qg {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Zg = class extends qg {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Qg = class extends qg {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, $g = class extends Z {}, e_ = class extends $g {}, t_ = class extends $g {}, n_ = class extends Z {}, r_ = class extends n_ {}, i_ = class extends n_ {}, a_ = class extends Z {}, o_ = class extends a_ {}, s_ = class extends a_ {}, c_ = class extends Z {}, l_ = class extends c_ {}, u_ = class extends c_ {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, d_ = class extends c_ {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, f_ = class extends c_ {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, p_ = class extends c_ {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, m_ = 4299n, h_ = 6561n, g_ = class extends Z {
	forward_params = [
		"input_ids",
		"inputs_embeds",
		"attention_mask",
		"position_ids",
		"audio_values",
		"exaggeration",
		"audio_features",
		"audio_tokens",
		"speaker_embeddings",
		"speaker_features",
		"past_key_values"
	];
	main_input_name = "input_ids";
	_return_dict_in_generate_keys = [
		"audio_tokens",
		"speaker_embeddings",
		"speaker_features"
	];
}, __ = class extends g_ {
	async encode_speech(e) {
		return q(this.sessions.speech_encoder, { audio_values: e });
	}
	async forward({ input_ids: e = null, attention_mask: t = null, audio_values: n = null, exaggeration: r = null, position_ids: i = null, inputs_embeds: a = null, past_key_values: o = null, generation_config: s = null, logits_processor: c = null, num_logits_to_keep: l = null, audio_features: u = null, audio_tokens: d = null, speaker_embeddings: f = null, speaker_features: p = null, ...m }) {
		let h;
		if (!a) {
			let s = this.sessions.embed_tokens.inputNames, c = { input_ids: e };
			if (s.includes("exaggeration")) {
				if (!(r instanceof V)) {
					let t = e.dims[0];
					if (r == null) r = Wl([t], .5);
					else if (typeof r == "number") r = Wl([t], r);
					else if (Array.isArray(r)) r = new V("float32", r, [t]);
					else throw Error("Unsupported type for `exaggeration` input");
				}
				c.exaggeration = r;
			}
			if (s.includes("position_ids") && (c.position_ids = i), {inputs_embeds: a} = await q(this.sessions.embed_tokens, c), u && d && f && p && (h = {
				audio_features: u,
				audio_tokens: d,
				speaker_embeddings: f,
				speaker_features: p
			}), h || n) h ??= await this.encode_speech(n), a = H([h.audio_features, a], 1), t = Kl([a.dims[0], a.dims[1]]);
			else {
				let e = a.dims[1];
				if (!o || e !== 1) throw Error("Incorrect state encountered during generation.");
				let n = o.get_seq_length();
				t = Kl([a.dims[0], n + e]);
			}
		}
		return {
			...await lg(this, {
				inputs_embeds: a,
				past_key_values: o,
				attention_mask: t,
				generation_config: s,
				logits_processor: c,
				num_logits_to_keep: l
			}, !1),
			...h
		};
	}
	prepare_inputs_for_generation(e, t, n) {
		return !t.position_ids && this.sessions.embed_tokens.inputNames.includes("position_ids") && (t.position_ids = t.input_ids.dims[1] === 1 ? new V("int64", Array.from({ length: e.length }, (t, n) => e[n].length - e[n].findLastIndex((e) => e == h_) - 1), [e.length, 1]) : new V("int64", t.input_ids.tolist().map((e) => {
			let t = 0;
			return e.map((e) => e >= h_ ? 0 : t++);
		}).flat(), t.input_ids.dims)), t.input_ids.dims[1] === 1 && (delete t.audio_values, delete t.audio_features, delete t.audio_tokens, delete t.speaker_embeddings, delete t.speaker_features), hg(this, e, t, n);
	}
	async generate(e) {
		let t = e.past_key_values, { sequences: n, audio_tokens: r, speaker_embeddings: i, speaker_features: a, past_key_values: o } = await super.generate({
			...e,
			return_dict_in_generate: !0
		});
		try {
			let t = n.slice(null, [e.input_ids.dims[1], -1]), o = H([
				r,
				t,
				Wl([t.dims[0], 3], m_)
			], 1), { waveform: s } = await q(this.sessions.conditional_decoder, {
				speech_tokens: o,
				speaker_features: a,
				speaker_embeddings: i
			});
			return s;
		} finally {
			o !== t && await o?.dispose();
		}
	}
}, v_ = class extends Z {}, y_ = class extends v_ {}, b_ = class extends Z {}, x_ = class extends b_ {}, S_ = class extends Z {}, C_ = class extends S_ {}, w_ = class extends S_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "text_model"
		});
	}
}, T_ = class extends S_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "audio_model"
		});
	}
}, E_ = class extends Z {}, D_ = class extends E_ {}, O_ = class extends E_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "text_model"
		});
	}
}, k_ = class extends E_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "text_model"
		});
	}
}, A_ = class extends E_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "vision_model"
		});
	}
}, j_ = class extends E_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "vision_model"
		});
	}
}, M_ = class extends Z {}, N_ = class extends M_ {}, P_ = class extends M_ {}, F_ = class extends Z {}, I_ = class extends F_ {}, L_ = class extends F_ {}, R_ = class extends Z {}, z_ = class extends R_ {}, B_ = class extends R_ {}, V_ = class extends Z {}, H_ = class extends V_ {}, U_ = class extends V_ {}, W_ = class extends Z {
	requires_attention_mask = !1;
	main_input_name = "input_features";
	forward_params = [
		"input_features",
		"decoder_input_ids",
		"decoder_attention_mask",
		"past_key_values"
	];
}, G_ = class extends W_ {}, K_ = class extends W_ {}, q_ = class extends Z {}, J_ = class extends q_ {}, Y_ = class extends q_ {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, X_ = class extends q_ {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Z_ = class extends q_ {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Q_ = class extends q_ {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, $_ = class extends Z {}, ev = class extends $_ {}, tv = class extends $_ {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, nv = class extends Z {}, rv = class extends nv {}, iv = class extends nv {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, av = class extends Z {}, ov = class extends av {}, sv = class extends av {
	async _call(e) {
		return new cv(await super._call(e));
	}
}, cv = class extends J {
	constructor({ logits: e, pred_boxes: t }) {
		super(), this.logits = e, this.pred_boxes = t;
	}
}, lv = class extends Z {}, uv = class extends lv {}, dv = class extends lv {
	async _call(e) {
		return new cv(await super._call(e));
	}
}, fv = class extends J {
	constructor({ audio_codes: e }) {
		super(), this.audio_codes = e;
	}
}, pv = class extends J {
	constructor({ audio_values: e }) {
		super(), this.audio_values = e;
	}
}, mv = class extends Z {
	main_input_name = "input_values";
	forward_params = ["input_values"];
}, hv = class extends mv {
	async encode(e) {
		return new fv(await q(this.sessions.encoder_model, e));
	}
	async decode(e) {
		return new pv(await q(this.sessions.decoder_model, e));
	}
}, gv = class extends mv {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "encoder_model"
		});
	}
}, _v = class extends mv {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "decoder_model"
		});
	}
}, vv = class extends Z {}, yv = class extends vv {}, bv = class extends vv {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, xv = class extends vv {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Sv = class extends vv {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Cv = class extends vv {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, wv = class extends Z {}, Tv = class extends wv {}, Ev = class extends wv {}, Dv = class extends Z {}, Ov = class extends Dv {}, kv = class extends Dv {}, Av = class extends Z {}, jv = class extends Av {}, Mv = class extends Av {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, Nv = class extends Av {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Pv = class extends Av {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Fv = class extends Av {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, Iv = class extends Z {}, Lv = class extends Iv {}, Rv = class extends Z {}, zv = class extends Rv {}, Bv = class extends Rv {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Vv = class extends Z {}, Hv = class extends Vv {}, Uv = class extends Z {}, Wv = class extends Uv {}, Gv = class extends Z {}, Kv = class extends Gv {}, qv = class extends Gv {
	async _call(e) {
		return new Yv(await super._call(e));
	}
}, Jv = class extends Gv {
	async _call(e) {
		return new Xv(await super._call(e));
	}
}, Yv = class extends J {
	constructor({ logits: e, pred_boxes: t }) {
		super(), this.logits = e, this.pred_boxes = t;
	}
}, Xv = class extends J {
	constructor({ logits: e, pred_boxes: t, pred_masks: n }) {
		super(), this.logits = e, this.pred_boxes = t, this.pred_masks = n;
	}
}, Zv = class extends Z {}, Qv = class extends Zv {}, $v = class extends Zv {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, ey = class extends Z {}, ty = class extends ey {}, ny = class extends ey {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, ry = class extends Z {}, iy = class extends ry {}, ay = class extends Z {}, oy = class extends ay {}, sy = class extends Z {}, cy = class extends sy {}, ly = class extends sy {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, uy = class extends sy {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, dy = class extends sy {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, fy = class extends sy {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, py = class extends Z {}, my = class extends py {}, hy = class extends Z {}, gy = class extends hy {}, _y = class extends hy {}, vy = class extends Z {}, yy = class extends vy {}, by = class extends vy {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, xy = class extends Z {}, Sy = class extends xy {}, Cy = class extends xy {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, wy = class extends xy {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Ty = class extends xy {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Ey = class extends xy {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, Dy = class extends Z {}, Oy = class extends Dy {}, ky = class extends Dy {}, Ay = class extends Z {}, jy = class extends Ay {}, My = class extends Ay {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, Ny = class extends Ay {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Py = class extends Ay {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Fy = class extends Z {}, Iy = class extends Fy {}, Ly = class extends Fy {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, Ry = class extends Fy {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, zy = class extends Fy {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, By = class extends Z {}, Vy = class extends By {}, Hy = class extends By {}, Uy = class extends Z {}, Wy = class extends Uy {}, Gy = class extends Uy {}, Ky = class extends Z {}, qy = class extends Ky {}, Jy = class extends Ky {}, Yy = class extends Z {}, Xy = class extends Yy {}, Zy = class extends Yy {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Qy = class extends Z {
	forward_params = [
		"input_ids",
		"inputs_embeds",
		"attention_mask",
		"pixel_values",
		"encoder_outputs",
		"decoder_input_ids",
		"decoder_inputs_embeds",
		"decoder_attention_mask",
		"past_key_values"
	];
	main_input_name = "inputs_embeds";
}, $y = class extends Qy {
	_merge_input_ids_with_image_features({ inputs_embeds: e, image_features: t, input_ids: n, attention_mask: r }) {
		return {
			inputs_embeds: H([t, e], 1),
			attention_mask: H([Kl(t.dims.slice(0, 2)), r], 1)
		};
	}
	async _prepare_inputs_embeds({ input_ids: e, pixel_values: t, inputs_embeds: n, attention_mask: r }) {
		if (!e && !t) throw Error("Either `input_ids` or `pixel_values` should be provided.");
		let i, a;
		return e && (i = await this.encode_text({ input_ids: e })), t && (a = await this.encode_image({ pixel_values: t })), i && a ? {inputs_embeds: n, attention_mask: r} = this._merge_input_ids_with_image_features({
			inputs_embeds: i,
			image_features: a,
			input_ids: e,
			attention_mask: r
		}) : n = i || a, {
			inputs_embeds: n,
			attention_mask: r
		};
	}
	async forward({ input_ids: e, pixel_values: t, attention_mask: n, decoder_input_ids: r, decoder_attention_mask: i, encoder_outputs: a, past_key_values: o, inputs_embeds: s, decoder_inputs_embeds: c, num_logits_to_keep: l = null }) {
		if (s || ({inputs_embeds: s, attention_mask: n} = await this._prepare_inputs_embeds({
			input_ids: e,
			pixel_values: t,
			inputs_embeds: s,
			attention_mask: n
		})), !a) {
			let { last_hidden_state: e } = await ng(this, {
				inputs_embeds: s,
				attention_mask: n
			});
			a = e;
		}
		if (!c) {
			if (!r) throw Error("Either `decoder_input_ids` or `decoder_inputs_embeds` should be provided.");
			c = await this.encode_text({ input_ids: r });
		}
		let u = {
			inputs_embeds: c,
			attention_mask: i,
			encoder_attention_mask: n,
			encoder_hidden_states: a,
			past_key_values: o,
			num_logits_to_keep: l
		};
		return await lg(this, u, !0);
	}
}, eb = class extends Z {}, tb = class extends eb {}, nb = class extends eb {}, rb = class extends Z {}, ib = class extends rb {}, ab = class extends rb {}, ob = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"pixel_values",
		"position_ids",
		"past_key_values"
	];
}, sb = class extends ob {
	_merge_input_ids_with_image_features(e) {
		let t = e.image_features.dims.at(-1), n = e.image_features.view(-1, t);
		return yg({
			image_token_id: this.config.image_token_index ?? this.config.image_token_id,
			...e,
			image_features: n
		});
	}
}, cb = class extends sb {}, lb = class extends sb {}, ub = class extends Z {}, db = class extends ub {}, fb = class extends sb {}, pb = class extends fb {}, mb = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"inputs_embeds",
		"per_layer_inputs",
		"position_ids",
		"pixel_values",
		"input_features",
		"input_features_mask",
		"past_key_values"
	];
}, hb = class extends mb {
	async forward({ input_ids: e = null, attention_mask: t = null, pixel_values: n = null, input_features: r = null, input_features_mask: i = null, position_ids: a = null, inputs_embeds: o = null, per_layer_inputs: s = null, past_key_values: c = null, generation_config: l = null, logits_processor: u = null, num_logits_to_keep: d = null, ...f }) {
		if ((!o || !s) && ({inputs_embeds: o, per_layer_inputs: s} = await q(this.sessions.embed_tokens, { input_ids: e }), e.dims[1] !== 1)) {
			if (n) {
				let { image_features: r } = await this._encode_vision({
					pixel_values: n,
					...f
				});
				({inputs_embeds: o, attention_mask: t} = this._merge_input_ids_with_image_features({
					image_features: r,
					inputs_embeds: o,
					input_ids: e,
					attention_mask: t
				}));
			}
			if (r) {
				let { audio_features: n } = await q(this.sessions.audio_encoder, {
					input_features: r,
					input_features_mask: i
				});
				({inputs_embeds: o, attention_mask: t} = this._merge_input_ids_with_audio_features({
					audio_features: n,
					inputs_embeds: o,
					input_ids: e,
					attention_mask: t
				}));
			}
		}
		return await lg(this, {
			inputs_embeds: o,
			per_layer_inputs: s,
			past_key_values: c,
			attention_mask: t,
			position_ids: a,
			generation_config: l,
			logits_processor: u,
			num_logits_to_keep: d
		}, !0);
	}
	_encode_vision(e) {
		return q(this.sessions.vision_encoder, { pixel_values: e.pixel_values });
	}
	_merge_input_ids_with_image_features(e) {
		let t = e.image_features.dims.at(-1), n = e.image_features.view(-1, t);
		return yg({
			image_token_id: this.config.image_token_id,
			...e,
			image_features: n
		});
	}
	_merge_input_ids_with_audio_features(e) {
		let t = e.audio_features.dims.at(-1), n = e.audio_features.view(-1, t);
		return bg({
			audio_token_id: this.config.audio_token_id,
			...e,
			audio_features: n
		});
	}
}, gb = class extends hb {}, _b = class extends hb {
	forward_params = [
		"input_ids",
		"attention_mask",
		"inputs_embeds",
		"per_layer_inputs",
		"position_ids",
		"pixel_values",
		"image_position_ids",
		"input_features",
		"input_features_mask",
		"past_key_values"
	];
	_encode_vision(e) {
		return q(this.sessions.vision_encoder, {
			pixel_values: e.pixel_values,
			pixel_position_ids: e.image_position_ids
		});
	}
}, vb = class extends _b {}, yb = class extends Z {}, bb = class extends yb {}, xb = class extends yb {}, Sb = class extends Z {}, Cb = class extends Sb {}, wb = class extends Sb {}, Tb = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"position_ids",
		"past_key_values",
		"pixel_values",
		"image_grid_thw"
	];
}, Eb = class extends Tb {
	image_grid_thw_name = "grid_thw";
	_get_text_only_rope_index(e, t) {
		if (t) {
			let { data: e, dims: n } = pg(t), r = BigInt64Array.from({ length: 3 * e.length }, (t, n) => e[n % e.length]), i = Array.from({ length: n[0] }, (t, r) => Ic(e.subarray(n[1] * r, n[1] * (r + 1)))[0] + 1n + BigInt(n[1]));
			return [new V("int64", r, [3, ...n]), new V("int64", i, [i.length, 1])];
		}
		{
			let [t, n] = e.dims;
			return [new V("int64", BigInt64Array.from({ length: 3 * t * n }, (e, r) => BigInt(Math.floor(r % n / t))), [3, ...e.dims]), Jl([t, 1])];
		}
	}
	_reorder_and_write_positions(e, t, n, r) {
		let i = e.reduce((e, t) => e + t.length, 0), a = Array(i), o = 0;
		for (let t = 0; t < 3; ++t) for (let n of e) {
			let e = n.length / 3;
			for (let r = t * e; r < (t + 1) * e; ++r) a[o++] = n[r];
		}
		let s = 0;
		for (let e = 0; e < t.length; ++e) if (t[e] == 1) {
			for (let t = 0; t < 3; ++t) n[t][r][e] = a[t * i / 3 + s];
			++s;
		}
		return a;
	}
	_get_multimodal_rope_positions({ filtered_ids: e, image_grid_thw_list: t, video_grid_thw_list: n, spatial_merge_size: r, state: i }) {
		let { image_token_id: a, video_token_id: o, vision_start_token_id: s } = this.config, c = e, l = c.reduce((e, t, n) => (t == s && e.push(n), e), []).map((e) => c[e + 1]), u = l.filter((e) => e == a).length, d = l.filter((e) => e == o).length, f = [], p = 0, m = u, h = d;
		for (let e = 0; e < l.length; ++e) {
			let e = c.findIndex((e, t) => t > p && e == a), s = c.findIndex((e, t) => t > p && e == o), l = m > 0 && e !== -1 ? e : c.length + 1, u = h > 0 && s !== -1 ? s : c.length + 1, d, g, _, v;
			l < u ? ([g, _, v] = t[i.image_index], ++i.image_index, --m, d = l) : ([g, _, v] = n[i.video_index], ++i.video_index, --h, d = u);
			let [y, b, x] = [
				Number(g),
				Math.floor(Number(_) / r),
				Math.floor(Number(v) / r)
			], S = d - p, C = f.length > 0 ? Ic(f.at(-1))[0] + 1 : 0;
			f.push(Array.from({ length: 3 * S }, (e, t) => C + t % S));
			let ee = S + C, w = y * b * x, te = Array.from({ length: w }, (e, t) => ee + Math.floor(t / (b * x))), ne = Array.from({ length: w }, (e, t) => ee + Math.floor(t / x) % b), re = Array.from({ length: w }, (e, t) => ee + t % x);
			f.push([
				te,
				ne,
				re
			].flat()), p = d + w;
		}
		if (p < c.length) {
			let e = f.length > 0 ? Ic(f.at(-1))[0] + 1 : 0, t = c.length - p;
			f.push(Array.from({ length: 3 * t }, (n, r) => e + r % t));
		}
		return f;
	}
	get_rope_index(e, t, n, r) {
		let { vision_config: i } = this.config, a = i.spatial_merge_size ?? 2;
		if (t || n) {
			let i = e.tolist();
			r ||= ql(e);
			let o = r.tolist(), s = Array.from({ length: 3 }, () => Array.from({ length: e.dims[0] }, () => Array.from({ length: e.dims[1] }, () => 0))), c = t ? t.tolist() : [], l = n ? n.tolist() : [], u = {
				image_index: 0,
				video_index: 0
			}, d = [];
			for (let e = 0; e < i.length; ++e) {
				let t = i[e].filter((t, n) => o[e][n] == 1), n = this._get_multimodal_rope_positions({
					filtered_ids: t,
					image_grid_thw_list: c,
					video_grid_thw_list: l,
					spatial_merge_size: a,
					state: u
				}), r = this._reorder_and_write_positions(n, o[e], s, e);
				d.push(Ic(r)[0] + 1 - i[e].length);
			}
			return [new V("int64", s.flat(Infinity), [
				3,
				e.dims[0],
				e.dims[1]
			]), new V("int64", d, [d.length, 1])];
		}
		return this._get_text_only_rope_index(e, r);
	}
	async encode_image({ pixel_values: e, image_grid_thw: t }) {
		return (await q(this.sessions.vision_encoder, {
			pixel_values: e,
			[this.image_grid_thw_name]: t
		})).image_features;
	}
	_merge_input_ids_with_image_features(e) {
		return yg({
			image_token_id: this.config.image_token_id,
			...e
		});
	}
	prepare_inputs_for_generation(e, t, n) {
		if (cg(this, t, 1n), !t.attention_mask || t.position_ids || !(this.sessions.decoder_model_merged ?? this.sessions.model).inputNames.includes("position_ids")) return t;
		if (!t.past_key_values) [t.position_ids, t.rope_deltas] = this.get_rope_index(t.input_ids, t.image_grid_thw, t.video_grid_thw, t.attention_mask);
		else {
			t.pixel_values = null;
			let e = t.past_key_values.get_seq_length();
			if (e < t.input_ids.dims[1]) {
				let [n, r] = this.get_rope_index(t.input_ids, t.image_grid_thw, t.video_grid_thw, t.attention_mask);
				t.rope_deltas = r, t.position_ids = n.slice(null, null, [e, null]), t.input_ids = t.input_ids.slice(null, [e, null]);
			} else {
				t.rope_deltas || ([, t.rope_deltas] = this.get_rope_index(t.input_ids, t.image_grid_thw, t.video_grid_thw, t.attention_mask));
				let n = BigInt(e), r = t.rope_deltas.map((e) => n + e);
				t.position_ids = Rl([
					r,
					r,
					r
				], 0);
			}
		}
		return t;
	}
}, Db = class extends Eb {}, Ob = class extends Eb {
	image_grid_thw_name = "image_grid_thw";
}, kb = class extends Db {
	image_grid_thw_name = "image_grid_thw";
}, Ab = class extends Ob {
	get_vision_position_ids(e, t, n, r) {
		let i = Math.floor(t[0] / n), a = Math.floor(t[1] / r), o = Math.floor(t[2] / r), s = a * o * i, c = Array.from({ length: s }, () => e), l = Array.from({ length: s }, (t, n) => e + Math.floor(n / (o * i))), u = Array.from({ length: s }, (t, n) => e + n % o);
		return [
			...c,
			...l,
			...u
		];
	}
	_get_multimodal_rope_positions({ filtered_ids: e, image_grid_thw_list: t, video_grid_thw_list: n, spatial_merge_size: r, state: i }) {
		let { image_token_id: a } = this.config, o = [], s = 0, c = +(e[0] == a);
		for (let t = 1; t <= e.length; ++t) {
			let n = t < e.length ? +(e[t] == a) : -1;
			n !== c && (o.push([
				c,
				s,
				t
			]), s = t, c = n);
		}
		let l = 0, u = [];
		for (let [e, n, a] of o) if (e === 0) {
			let e = a - n;
			u.push(Array.from({ length: 3 * e }, (t, n) => l + n % e)), l += e;
		} else {
			let e = t[i.image_index++].map(Number), n = e[0];
			u.push(this.get_vision_position_ids(l, e, n, r)), l += Math.max(e[1], e[2]) / r;
		}
		return u;
	}
}, jb = class extends Z {}, Mb = class extends jb {}, Nb = class extends jb {}, Pb = class extends Z {}, Fb = class extends Pb {}, Ib = class extends Pb {}, Lb = class extends Z {}, Rb = class extends Lb {}, zb = class extends Lb {}, Bb = class extends Z {}, Vb = class extends Bb {}, Hb = class extends Bb {}, Ub = class extends Z {}, Wb = class extends Ub {}, Gb = class extends Ub {}, Kb = class extends Z {}, qb = class extends Kb {}, Jb = class extends Kb {}, Yb = class extends Z {}, Xb = class extends Yb {}, Zb = class extends Yb {}, Qb = class extends Z {}, $b = class extends Qb {}, ex = class extends Qb {}, tx = class extends Z {}, nx = class extends tx {}, rx = class extends tx {}, ix = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"position_ids",
		"audio_values",
		"past_key_values"
	];
}, ax = class extends ix {
	_merge_input_ids_with_audio_features(e) {
		let t = e.audio_features.dims.at(-1), n = e.audio_features.view(-1, t);
		return bg({
			audio_token_id: this.config.ignore_index ?? this.config.audio_token_id ?? this.config.audio_token_index,
			...e,
			audio_features: n
		});
	}
}, ox = class extends ax {
	forward_params = [
		"input_ids",
		"attention_mask",
		"input_features",
		"past_key_values"
	];
}, sx = class extends Z {}, cx = class extends sx {}, lx = class extends Z {}, ux = class extends lx {}, dx = class extends Z {}, fx = class extends dx {}, px = class extends dx {}, mx = class extends Z {}, hx = class extends mx {}, gx = class extends mx {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, _x = class extends Z {}, vx = class extends _x {}, yx = class extends _x {
	forward_params = [
		"input_ids",
		"attention_mask",
		"token_type_ids",
		"past_key_values"
	];
	prepare_inputs_for_generation(e, t, n) {
		let r = hg(this, e, t, n);
		return r.token_type_ids = (r.past_key_values ? Yl : ql)(r.input_ids), r;
	}
}, bx = class extends Z {}, xx = class extends bx {}, Sx = class extends bx {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, Cx = class extends bx {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, wx = class extends bx {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, Tx = class extends Z {}, Ex = class extends bx {}, Dx = class extends bx {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, Ox = class extends bx {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, kx = class extends Z {}, Ax = class extends kx {}, jx = class extends kx {}, Mx = class extends sb {
	forward_params = [
		"input_ids",
		"attention_mask",
		"pixel_values",
		"pixel_attention_mask",
		"position_ids",
		"past_key_values"
	];
}, Nx = class extends Z {}, Px = class extends Nx {}, Fx = class extends Nx {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Ix = class extends Z {}, Lx = class extends Ix {}, Rx = class extends Ix {}, zx = class extends Z {}, Bx = class extends zx {
	async forward(e) {
		let t = !e.input_ids, n = !e.pixel_values;
		if (t && n) throw Error("Either `input_ids` or `pixel_values` should be provided.");
		if (t && (e.input_ids = Kl([e.pixel_values.dims[0], 1])), n) {
			let { image_size: t } = this.config.vision_config;
			e.pixel_values = Wl([
				0,
				3,
				t,
				t
			], 0);
		}
		let { text_embeddings: r, image_embeddings: i, l2norm_text_embeddings: a, l2norm_image_embeddings: o } = await super.forward(e), s = {};
		return t || (s.text_embeddings = r, s.l2norm_text_embeddings = a), n || (s.image_embeddings = i, s.l2norm_image_embeddings = o), s;
	}
}, Vx = class extends zx {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "text_model"
		});
	}
}, Hx = class extends zx {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "vision_model"
		});
	}
}, Ux = class extends Z {}, Wx = class extends Ux {}, Gx = class extends Ux {}, Kx = class extends sb {}, qx = class extends Z {}, Jx = class extends qx {}, Yx = class extends qx {}, Xx = class extends sb {
	forward_params = [
		"input_ids",
		"attention_mask",
		"pixel_values",
		"pixel_attention_mask",
		"spatial_shapes",
		"position_ids",
		"past_key_values"
	];
}, Zx = class extends Z {}, Qx = class extends Zx {}, $x = class extends Zx {}, eS = class extends Z {}, tS = class extends eS {}, nS = class extends Z {}, rS = class extends nS {}, iS = class extends nS {}, aS = class extends Z {}, oS = class extends aS {}, sS = class extends aS {}, cS = class extends Z {}, lS = class extends cS {}, uS = class extends cS {}, dS = class extends Z {}, fS = class extends dS {}, pS = class extends dS {}, mS = class extends Z {}, hS = class extends mS {}, gS = class extends mS {}, _S = class extends mS {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, vS = class extends mS {}, yS = class extends Z {}, bS = class extends yS {}, xS = class extends Z {}, SS = class extends xS {}, CS = class extends J {
	constructor({ char_logits: e, bpe_logits: t, wp_logits: n }) {
		super(), this.char_logits = e, this.bpe_logits = t, this.wp_logits = n;
	}
	get logits() {
		return [
			this.char_logits,
			this.bpe_logits,
			this.wp_logits
		];
	}
}, wS = class extends Z {}, TS = class extends wS {
	async _call(e) {
		return new CS(await super._call(e));
	}
}, ES = class extends J {
	constructor({ audio_codes: e }) {
		super(), this.audio_codes = e;
	}
}, DS = class extends J {
	constructor({ audio_values: e }) {
		super(), this.audio_values = e;
	}
}, OS = class extends Z {
	main_input_name = "input_values";
	forward_params = ["input_values"];
}, kS = class extends OS {
	async encode(e) {
		return new ES(await q(this.sessions.encoder_model, e));
	}
	async decode(e) {
		return new DS(await q(this.sessions.decoder_model, e));
	}
}, AS = class extends OS {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "encoder_model"
		});
	}
}, jS = class extends OS {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "decoder_model"
		});
	}
}, MS = class extends Z {}, NS = class extends MS {}, PS = class extends MS {}, FS = class extends Z {}, IS = class extends FS {}, LS = class extends FS {}, RS = class extends Z {}, zS = class extends RS {}, BS = class extends RS {}, VS = class extends sb {}, HS = class extends Z {}, US = class extends HS {}, WS = class extends HS {}, GS = class extends Z {}, KS = class extends GS {}, qS = class extends GS {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, JS = class extends GS {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, YS = class extends GS {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, XS = class extends Z {}, ZS = class extends XS {}, QS = class extends XS {}, $S = class extends Z {}, eC = class extends $S {}, tC = class extends $S {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, nC = class extends $S {}, rC = class extends Z {}, iC = class extends rC {}, aC = class extends rC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, oC = class extends rC {}, sC = class extends Z {}, cC = class extends sC {}, lC = class extends sC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, uC = class extends sC {}, dC = class extends Z {}, fC = class extends dC {}, pC = class extends dC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, mC = class extends dC {}, hC = class extends Z {}, gC = class extends hC {}, _C = class extends hC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, vC = class extends Z {}, yC = class extends vC {}, bC = class extends vC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, xC = class extends Z {}, SC = class extends xC {}, CC = class extends xC {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, wC = class extends xC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, TC = class extends xC {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, EC = class extends Z {}, DC = class extends EC {}, OC = class extends EC {}, kC = class extends Z {
	requires_attention_mask = !1;
	main_input_name = "input_values";
	forward_params = [
		"input_values",
		"decoder_input_ids",
		"past_key_values"
	];
}, AC = class extends kC {}, jC = class extends kC {}, MC = class extends Z {}, NC = class extends MC {}, PC = class extends MC {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, FC = class extends MC {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, IC = class extends MC {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, LC = class extends MC {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, RC = class extends Z {}, zC = class extends RC {}, BC = class extends RC {}, VC = class extends Z {}, HC = class extends VC {}, UC = class extends VC {}, WC = class extends Z {}, GC = class extends WC {
	forward_params = [
		"input_ids",
		"pixel_values",
		"images_seq_mask",
		"images_emb_mask",
		"attention_mask",
		"position_ids",
		"past_key_values"
	];
	constructor(...e) {
		super(...e), this._generation_mode = "text";
	}
	async forward(e) {
		let t = this._generation_mode ?? "text", n;
		if (t === "text" || !e.past_key_values) {
			let t = this.sessions.prepare_inputs_embeds;
			n = await q(t, Fr(e, t.inputNames));
		} else {
			let t = this.sessions.gen_img_embeds;
			n = await q(t, Fr({ image_ids: e.input_ids }, t.inputNames));
		}
		let r = {
			...e,
			...n
		}, i = await lg(this, r), a = this.sessions[t === "text" ? "lm_head" : "gen_head"];
		if (!a) throw Error(`Unable to find "${a}" generation head`);
		let o = await q(a, Fr(i, a.inputNames));
		return {
			...n,
			...i,
			...o
		};
	}
	prepare_inputs_for_generation(e, t, n) {
		let r = !!t.past_key_values;
		return cg(this, t, 1n), n.guidance_scale !== null && n.guidance_scale > 1 && (r ? t.input_ids = H([t.input_ids, t.input_ids], 0) : (t.input_ids = H([t.input_ids, Gl(t.input_ids, BigInt(n.pad_token_id))], 0), t.attention_mask = H([t.attention_mask, Gl(t.attention_mask, 0n)], 0))), (r || !t.pixel_values) && (t.pixel_values = Wl([
			0,
			0,
			3,
			384,
			384
		], 1)), r && (t.images_seq_mask = new V("bool", [,].fill(!0).fill(!1, 0, 1), [1, 1]), t.images_emb_mask = new V("bool", [].fill(!1), [
			1,
			1,
			0
		])), t;
	}
	async generate(e) {
		return this._generation_mode = "text", super.generate(e);
	}
	async generate_images(e) {
		this._generation_mode = "image";
		let t = (e.inputs ?? e[this.main_input_name]).dims[1], n = (await super.generate(e)).slice(null, [t, null]), r = this.sessions.image_decode, { decoded_image: i } = await q(r, { generated_tokens: n }), a = i.add_(1).mul_(255 / 2).clamp_(0, 255).to("uint8"), o = [];
		for (let e of a) {
			let t = hf.fromTensor(e);
			o.push(t);
		}
		return o;
	}
}, KC = class extends Z {}, qC = class extends KC {}, JC = class extends KC {}, YC = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"encoder_outputs",
		"decoder_input_ids",
		"decoder_attention_mask",
		"past_key_values"
	];
	_apply_and_filter_by_delay_pattern_mask(e) {
		let [t, n] = e.dims, r = this.config.decoder.num_codebooks, i = n - r, a = 0;
		for (let t = 0; t < e.size; ++t) {
			if (e.data[t] == this.config.decoder.pad_token_id) continue;
			let o = t % n - Math.floor(t / n) % r;
			o > 0 && o <= i && (e.data[a++] = e.data[t]);
		}
		let o = Math.floor(t / r), s = a / (o * r);
		return new V(e.type, e.data.slice(0, a), [
			o,
			r,
			s
		]);
	}
	prepare_inputs_for_generation(e, t, n) {
		let r = BigInt(this.config.decoder.pad_token_id), i = structuredClone(e);
		for (let e = 0; e < i.length; ++e) for (let t = 0; t < i[e].length; ++t) e % this.config.decoder.num_codebooks >= t && (i[e][t] = r);
		return n.guidance_scale !== null && n.guidance_scale > 1 && (i = i.concat(i)), gg(this, i, t, n);
	}
	async generate(e) {
		let t = await super.generate(e), n = this._apply_and_filter_by_delay_pattern_mask(t).unsqueeze_(0), { audio_values: r } = await q(this.sessions.encodec_decode, { audio_codes: n });
		return r;
	}
}, XC = class extends Z {}, ZC = class extends XC {}, QC = class extends XC {}, $C = class extends Z {}, ew = class extends $C {}, tw = class extends $C {}, nw = class extends Z {}, rw = class extends nw {}, iw = class extends nw {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, aw = class extends nw {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, ow = class extends nw {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, sw = class extends nw {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, cw = class extends Z {}, lw = class extends cw {}, uw = class extends Z {}, dw = class extends uw {}, fw = class extends uw {}, pw = class extends Z {}, mw = class extends pw {}, hw = class extends pw {}, gw = class extends Z {}, _w = class extends gw {}, vw = class extends gw {}, yw = class extends Z {}, bw = class extends yw {}, xw = class extends yw {}, Sw = class extends Z {}, Cw = class extends Sw {}, ww = class extends Sw {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, Tw = class extends Z {}, Ew = class extends Tw {}, Dw = class extends Tw {}, Ow = class extends Z {}, kw = class extends Ow {}, Aw = class extends Ow {}, jw = class extends Z {}, Mw = class extends jw {}, Nw = class extends jw {}, Pw = class extends Z {}, Fw = class extends Pw {}, Iw = class extends Pw {}, Lw = class extends sb {}, Rw = class extends Z {}, zw = class extends Rw {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, Bw = class extends Z {}, Vw = class extends Bw {}, Hw = class extends Bw {}, Uw = class extends Z {}, Ww = class extends Uw {}, Gw = class extends Uw {}, Kw = class extends Z {}, qw = class extends Kw {}, Jw = class extends Kw {}, Yw = class extends Z {}, Xw = class extends Yw {}, Zw = class extends Yw {}, Qw = class extends Z {
	forward_params = [
		"input_ids",
		"inputs_embeds",
		"attention_mask",
		"position_ids",
		"pixel_values",
		"image_sizes",
		"past_key_values"
	];
}, $w = class extends Qw {
	async forward({ input_ids: e = null, attention_mask: t = null, pixel_values: n = null, image_sizes: r = null, position_ids: i = null, inputs_embeds: a = null, past_key_values: o = null, generation_config: s = null, logits_processor: c = null, num_logits_to_keep: l = null, ...u }) {
		if (!a) {
			let t;
			if (n && e.dims[1] !== 1) {
				if (!r) throw Error("`image_sizes` must be provided when `pixel_values` is provided.");
				({image_features: t} = await q(this.sessions.vision_encoder, {
					pixel_values: n,
					image_sizes: r
				}));
			} else {
				let e = this.config.normalized_config.hidden_size;
				t = new V("float32", [], [0, e]);
			}
			({inputs_embeds: a} = await q(this.sessions.prepare_inputs_embeds, {
				input_ids: e,
				image_features: t
			}));
		}
		return await lg(this, {
			inputs_embeds: a,
			past_key_values: o,
			attention_mask: t,
			position_ids: i,
			generation_config: s,
			logits_processor: c,
			num_logits_to_keep: l
		}, !1);
	}
}, eT = class extends Z {}, tT = class extends eT {}, nT = class extends eT {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, rT = class extends Z {}, iT = class extends rT {}, aT = class extends rT {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, oT = class extends Z {}, sT = class extends oT {}, cT = class extends oT {}, lT = class extends Z {}, uT = class extends lT {}, dT = class extends lT {}, fT = class extends Z {}, pT = class extends fT {}, mT = class extends fT {}, hT = class extends Z {}, gT = class extends hT {}, _T = class extends hT {}, vT = class extends Z {}, yT = class extends vT {}, bT = class extends vT {}, xT = class extends Ob {}, ST = class extends kb {}, CT = class extends xT {}, wT = class extends ST {}, TT = class extends xT {}, ET = class extends TT {}, DT = class extends TT {}, OT = class extends ET {}, kT = class extends Z {}, AT = class extends kT {}, jT = class extends kT {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, MT = class extends Z {}, NT = class extends MT {}, PT = class extends MT {
	async _call(e) {
		return new FT(await super._call(e));
	}
}, FT = class extends cv {}, IT = class extends Z {}, LT = class extends IT {}, RT = class extends IT {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, zT = class extends IT {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, BT = class extends IT {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, VT = class extends IT {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, HT = class extends Z {}, UT = class extends HT {}, WT = class extends HT {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, GT = class extends HT {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, KT = class extends HT {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, qT = class extends HT {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, JT = class extends Z {}, YT = class extends JT {}, XT = class extends JT {
	async _call(e) {
		return new ZT(await super._call(e));
	}
}, ZT = class extends cv {}, QT = class extends J {
	constructor({ iou_scores: e, pred_masks: t }) {
		super(), this.iou_scores = e, this.pred_masks = t;
	}
}, $T = class extends Z {}, eE = class extends $T {
	async get_image_embeddings({ pixel_values: e }) {
		return await ng(this, { pixel_values: e });
	}
	async forward(e) {
		e = !e.image_embeddings || !e.image_positional_embeddings ? {
			...e,
			...await this.get_image_embeddings(e)
		} : { ...e }, e.input_labels ??= Kl(e.input_points.dims.slice(0, -1));
		let t = {
			image_embeddings: e.image_embeddings,
			image_positional_embeddings: e.image_positional_embeddings
		};
		return e.input_points && (t.input_points = e.input_points), e.input_labels && (t.input_labels = e.input_labels), e.input_boxes && (t.input_boxes = e.input_boxes), await q(this.sessions.prompt_encoder_mask_decoder, t);
	}
	async _call(e) {
		return new QT(await super._call(e));
	}
}, tE = class extends J {
	constructor({ iou_scores: e, pred_masks: t, object_score_logits: n }) {
		super(), this.iou_scores = e, this.pred_masks = t, this.object_score_logits = n;
	}
}, nE = class extends Z {}, rE = class extends nE {
	async get_image_embeddings({ pixel_values: e }) {
		return await ng(this, { pixel_values: e });
	}
	async forward(e) {
		let { num_feature_levels: t } = this.config.vision_config;
		if (e = Array.from({ length: t }, (e, t) => `image_embeddings.${t}`).some((t) => !e[t]) ? {
			...e,
			...await this.get_image_embeddings(e)
		} : { ...e }, e.input_points) {
			if (e.input_boxes && e.input_boxes.dims[1] !== 1) throw Error("When both `input_points` and `input_boxes` are provided, the number of boxes per image must be 1.");
			let t = e.input_points.dims;
			e.input_labels ??= Kl(t.slice(0, -1)), e.input_boxes ??= Wl([
				t[0],
				0,
				4
			], 0);
		} else if (e.input_boxes) {
			let t = e.input_boxes.dims;
			e.input_labels = Wl([
				t[0],
				t[1],
				0
			], -1n), e.input_points = Wl([
				t[0],
				1,
				0,
				2
			], 0);
		} else throw Error("At least one of `input_points` or `input_boxes` must be provided.");
		let n = this.sessions.prompt_encoder_mask_decoder;
		return await q(n, Fr(e, n.inputNames));
	}
	async _call(e) {
		return new tE(await super._call(e));
	}
}, iE = class extends rE {}, aE = class extends rE {}, oE = class extends Z {}, sE = class extends oE {}, cE = class extends oE {}, lE = class extends oE {}, uE = class extends Z {}, dE = class extends uE {}, fE = class extends uE {}, pE = class extends uE {}, mE = class extends Z {}, hE = class extends mE {}, gE = class extends mE {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "text_model"
		});
	}
}, _E = class extends E_ {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "vision_model"
		});
	}
}, vE = class extends Z {}, yE = class extends vE {}, bE = class extends vE {}, xE = class extends Mx {}, SE = class extends Z {
	main_input_name = "input_values";
	forward_params = ["input_values"];
}, CE = class extends SE {
	async encode(e) {
		return await q(this.sessions.encoder_model, e);
	}
	async decode(e) {
		return await q(this.sessions.decoder_model, e);
	}
}, wE = class extends SE {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "encoder_model"
		});
	}
}, TE = class extends SE {
	static async from_pretrained(e, t = {}) {
		return super.from_pretrained(e, {
			...t,
			model_file_name: t.model_file_name ?? "decoder_model"
		});
	}
}, EE = class extends Z {}, DE = class extends EE {}, OE = class extends EE {}, kE = class extends Z {}, AE = class extends kE {}, jE = class extends kE {}, ME = class extends kE {
	async generate_speech(e, t, { threshold: n = .5, minlenratio: r = 0, maxlenratio: i = 20, vocoder: a = null } = {}) {
		let o = { input_ids: e }, { encoder_outputs: s, encoder_attention_mask: c } = await ng(this, o), l = s.dims[1] / this.config.reduction_factor, u = Math.floor(l * i), d = Math.floor(l * r), f = this.config.num_mel_bins, p = [], m = null, h = null, g = 0;
		for (;;) {
			++g;
			let e = Yh(!!h), r;
			r = h ? h.output_sequence_out : new V("float32", new Float32Array(f), [
				1,
				1,
				f
			]);
			let i = {
				use_cache_branch: e,
				output_sequence: r,
				encoder_attention_mask: c,
				speaker_embeddings: t,
				encoder_hidden_states: s
			};
			sg(this, i, m), h = await q(this.sessions.decoder_model_merged, i), m = ig(h, m);
			let { prob: a, spectrum: o } = h;
			if (p.push(o), g >= d && (Array.from(a.data).filter((e) => e >= n).length > 0 || g >= u)) break;
		}
		let _ = H(p), { waveform: v } = await q(a.sessions.model, { spectrogram: _ });
		return {
			spectrogram: _,
			waveform: v
		};
	}
}, NE = class extends Z {
	main_input_name = "spectrogram";
}, PE = class extends Z {}, FE = class extends PE {}, IE = class extends PE {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, LE = class extends PE {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, RE = class extends PE {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, zE = class extends Z {}, BE = class extends zE {}, VE = class extends zE {}, HE = class extends Z {}, UE = class extends HE {}, WE = class extends HE {}, GE = class extends Z {}, KE = class extends GE {}, qE = class extends Z {}, JE = class extends qE {
	async generate_speech({ input_ids: e, attention_mask: t, style: n, num_inference_steps: r = 5, speed: i = 1.05 }) {
		let { sampling_rate: a, chunk_compress_factor: o, base_chunk_size: s, latent_dim: c } = this.config, { last_hidden_state: l, durations: u } = await q(this.sessions.text_encoder, {
			input_ids: e,
			attention_mask: t,
			style: n
		}), d = u.div(i).mul_(a), f = s * o, p = d.data, m = Int32Array.from(p, (e) => Math.ceil(e / f)), h = Math.max(...m), g = e.dims[0], _ = new BigInt64Array(g * h);
		for (let e = 0; e < g; ++e) _.fill(1n, e * h, e * h + m[e]);
		let v = new V("int64", _, [g, h]), y = c * o, b = y * h, x = Xl([
			g,
			y,
			h
		]), S = x.data;
		for (let e = 0; e < g; ++e) if (m[e] !== h) for (let t = 0; t < y; ++t) S.fill(0, e * b + t * h + m[e], e * b + (t + 1) * h);
		let C = Wl([g], r);
		for (let e = 0; e < r; ++e) {
			let r = Wl([g], e);
			({denoised_latents: x} = await q(this.sessions.latent_denoiser, {
				style: n,
				noisy_latents: x,
				latent_mask: v,
				encoder_outputs: l,
				attention_mask: t,
				timestep: r,
				num_inference_steps: C
			}));
		}
		let { waveform: ee } = await q(this.sessions.voice_decoder, { latents: x });
		return {
			waveform: ee,
			durations: d
		};
	}
}, YE = class extends Z {}, XE = class extends YE {}, ZE = class extends YE {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, QE = class extends YE {}, $E = class extends Z {}, eD = class extends $E {}, tD = class extends $E {}, nD = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"encoder_outputs",
		"decoder_input_ids",
		"decoder_attention_mask",
		"past_key_values"
	];
}, rD = class extends nD {}, iD = class extends nD {}, aD = class extends Z {}, oD = class extends aD {}, sD = class extends aD {
	async _call(e) {
		return new cD(await super._call(e));
	}
}, cD = class extends Yv {}, lD = class extends Z {}, uD = class extends lD {}, dD = class extends Z {}, fD = class extends dD {}, pD = class extends dD {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, mD = class extends dD {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, hD = class extends Z {}, gD = class extends hD {}, _D = class extends hD {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, vD = class extends hD {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, yD = class extends hD {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, bD = class extends Z {}, xD = class extends bD {}, SD = class extends bD {}, CD = class extends Z {
	main_input_name = "pixel_values";
	forward_params = [
		"pixel_values",
		"decoder_input_ids",
		"encoder_hidden_states",
		"past_key_values"
	];
}, wD = class extends Z {}, TD = class extends wD {}, ED = class extends wD {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, DD = class extends Z {}, OD = class extends DD {}, kD = class extends Z {}, AD = class extends kD {}, jD = class extends kD {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, MD = class extends Z {}, ND = class extends MD {
	async _call(e) {
		return new mh(await super._call(e));
	}
}, PD = class extends Z {}, FD = class extends PD {}, ID = class extends J {
	constructor({ waveform: e, spectrogram: t }) {
		super(), this.waveform = e, this.spectrogram = t;
	}
}, LD = class extends Z {}, RD = class extends LD {
	async _call(e) {
		return new ID(await super._call(e));
	}
}, zD = class extends ax {}, BD = 2, VD = 1, HD = /* @__PURE__ */ new WeakMap();
function UD(e, t) {
	let { text_config: n, audio_config: r } = e.config, i = e.sessions.audio_encoder, { num_mel_bins: a, hidden_size: o } = r, s = a + o, c = new zh(), l = Ym(r), u = { batch_size: 1 }, d = "float32";
	for (let e of i.inputMetadata) {
		if (e.name === "past_padding_cache") {
			d = e.type;
			continue;
		}
		if (!l.has(e.name)) continue;
		let t = og(e.shape, u), n = t.reduce((e, t) => e * t, 1), r = Tl[e.type];
		c[e.name] = new V(e.type, new r(n), t);
	}
	let f = Tl[d], p = new V(d, new f(s * BD), [
		1,
		s,
		BD
	]), m = t[Symbol.asyncIterator]?.() ?? t[Symbol.iterator]?.();
	if (!m) throw Error("input_features must be iterable or async iterable");
	return {
		encoder_session: i,
		enc_kv_cache: c,
		enc_padding_cache: p,
		enc_past_seq_len: 0,
		audio_embed_queue: [],
		audio_embed_total_tokens: 0,
		audio_queue_offset: 0,
		audio_consumed: 0,
		stream_exhausted: !1,
		chunks_iter: m,
		text_hidden_size: n.hidden_size
	};
}
async function WD(e, t) {
	let n = t.dims[2], r = Math.floor((VD + n - 3) / 2) + 1, i = new V("int64", BigInt64Array.from({ length: r }, (t, n) => BigInt(e.enc_past_seq_len + n)), [1, r]), a = e.enc_past_seq_len + r, o = Kl([1, a]), { audio_embeds: s, present_padding_cache: c, ...l } = await q(e.encoder_session, {
		input_features: t,
		attention_mask: o,
		position_ids: i,
		past_padding_cache: e.enc_padding_cache,
		...e.enc_kv_cache
	});
	e.enc_padding_cache.location === "gpu-buffer" && e.enc_padding_cache.dispose(), e.enc_padding_cache = c;
	for (let t in l) if (t.startsWith("present.")) {
		let n = t.replace("present", "past_key_values"), r = e.enc_kv_cache[n];
		r?.location === "gpu-buffer" && r.dispose(), e.enc_kv_cache[n] = l[t];
	}
	return e.enc_past_seq_len = a, s;
}
async function GD(e, t) {
	for (; e.audio_embed_total_tokens < t && !e.stream_exhausted;) {
		let t = await e.chunks_iter.next();
		if (t.done) {
			e.stream_exhausted = !0;
			break;
		}
		let n = await WD(e, t.value);
		e.audio_embed_queue.push({
			data: n.data,
			tokens: n.dims[1]
		}), e.audio_embed_total_tokens += n.dims[1];
	}
}
function KD(e, t, n) {
	if (e.audio_embed_queue.length === 0) return;
	let r = t.data, i = 0, a = n;
	for (; a > 0 && e.audio_embed_queue.length > 0;) {
		let t = e.audio_embed_queue[0], n = t.tokens - e.audio_queue_offset, o = Math.min(a, n), s = e.audio_queue_offset * e.text_hidden_size;
		for (let n = 0; n < o * e.text_hidden_size; ++n) r[i * e.text_hidden_size + n] += t.data[s + n];
		i += o, a -= o, e.audio_queue_offset += o, e.audio_queue_offset >= t.tokens && (e.audio_embed_queue.shift(), e.audio_queue_offset = 0);
	}
	e.audio_consumed += n - a;
}
var qD = class extends jh {
	constructor(e) {
		super(), this._s = e;
	}
	_call(e) {
		let t = this._s.stream_exhausted && this._s.audio_embed_queue.length === 0;
		return e.map(() => t);
	}
}, JD = class extends Z {
	forward_params = [
		"input_ids",
		"attention_mask",
		"position_ids",
		"past_key_values"
	];
}, YD = class extends JD {
	async forward({ input_ids: e, past_key_values: t, ...n }) {
		let r = e.dims[1], i = HD.get(this);
		i && await GD(i, i.audio_consumed + r);
		let { inputs_embeds: a } = await q(this.sessions.embed_tokens, { input_ids: e });
		i && KD(i, a, r);
		let o = {
			inputs_embeds: a,
			...n
		};
		sg(this, o, t);
		let s = this.sessions.decoder_model_merged;
		return await q(s, Fr(o, s.inputNames));
	}
	async generate({ input_features: e, stopping_criteria: t, ...n }) {
		if (!e) throw Error("input_features (generator/iterable) must be provided");
		let r = UD(this, e);
		HD.set(this, r);
		let i = new Mh();
		i.push(new qD(r)), t && i.extend(t);
		try {
			return await super.generate({
				...n,
				stopping_criteria: i
			});
		} finally {
			r.enc_kv_cache.dispose(), HD.delete(this);
		}
	}
}, XD = class extends Z {}, ZD = class extends XD {}, QD = class extends XD {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, $D = class extends XD {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, eO = class extends J {
	constructor({ logits: e, embeddings: t }) {
		super(), this.logits = e, this.embeddings = t;
	}
}, tO = class extends Z {}, nO = class extends tO {}, rO = class extends tO {
	async _call(e) {
		return new dh(await super._call(e));
	}
}, iO = class extends tO {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, aO = class extends tO {
	async _call(e) {
		return new eO(await super._call(e));
	}
}, oO = class extends tO {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, sO = class extends Z {}, cO = class extends sO {}, lO = class extends Ah {
	return_timestamps = null;
	return_token_timestamps = null;
	num_frames = null;
	alignment_heads = null;
	task = null;
	language = null;
	no_timestamps_token_id = null;
	prompt_ids = null;
	is_multilingual = null;
	lang_to_id = null;
	task_to_id = null;
	max_initial_timestamp_index = 1;
}, uO = class extends Z {
	requires_attention_mask = !1;
	main_input_name = "input_features";
	forward_params = [
		"input_features",
		"attention_mask",
		"decoder_input_ids",
		"decoder_attention_mask",
		"past_key_values"
	];
}, dO = class extends uO {}, fO = class extends uO {
	_prepare_generation_config(e, t) {
		return super._prepare_generation_config(e, t, lO);
	}
	_retrieve_init_tokens(e) {
		let t = [e.decoder_start_token_id], n = e.language, r = e.task;
		if (e.is_multilingual) {
			n ||= (A.warn("No language specified - defaulting to English (en)."), "en");
			let i = `<|${ed(n)}|>`;
			t.push(e.lang_to_id[i]), t.push(e.task_to_id[r ?? "transcribe"]);
		} else if (n || r) throw Error("Cannot specify `task` or `language` for an English-only model. If the model is intended to be multilingual, pass `is_multilingual=true` to generate, or update the generation config.");
		return !e.return_timestamps && e.no_timestamps_token_id && t.at(-1) !== e.no_timestamps_token_id ? t.push(e.no_timestamps_token_id) : e.return_timestamps && t.at(-1) === e.no_timestamps_token_id && (A.warn("<|notimestamps|> prompt token is removed from generation_config since `return_timestamps` is set to `true`."), t.pop()), t.filter((e) => e != null);
	}
	async generate({ inputs: e = null, generation_config: t = null, logits_processor: n = null, stopping_criteria: r = null, ...i }) {
		t = this._prepare_generation_config(t, i);
		let a = i.decoder_input_ids instanceof V ? eu(i.decoder_input_ids) : i.decoder_input_ids ?? this._retrieve_init_tokens(t);
		if (t.return_timestamps && (n ??= new _h(), n.push(new Sh(t, a))), t.begin_suppress_tokens && (n ??= new _h(), n.push(new xh(t.begin_suppress_tokens, a.length))), t.return_token_timestamps) {
			if (!t.alignment_heads) throw Error("Model generation config has no `alignment_heads`, token-level timestamps not available. See https://gist.github.com/hollance/42e32852f24243b748ae6bc1f985b13a on how to add this property to the generation config.");
			t.task === "translate" && A.warn("Token-level timestamps may not be reliable for task 'translate'."), t.output_attentions = !0, t.return_dict_in_generate = !0;
		}
		if (t.return_timestamps && !i.max_new_tokens) return this._generate_with_seek({
			inputs: e,
			generation_config: t,
			logits_processor: n,
			init_tokens: a,
			kwargs: i
		});
		let o = await super.generate({
			inputs: e,
			generation_config: t,
			logits_processor: n,
			decoder_input_ids: a,
			...i
		});
		return t.return_token_timestamps && (o.token_timestamps = this._extract_token_timestamps(o, t.alignment_heads, t.num_frames, .02, a.length)), o;
	}
	async _generate_with_seek({ inputs: e, generation_config: t, logits_processor: n, init_tokens: r, kwargs: i }) {
		let a = t.no_timestamps_token_id + 1, o = Array.isArray(t.eos_token_id) ? t.eos_token_id[0] : t.eos_token_id, s = t.return_token_timestamps, c = e, l = c.dims[2], u = 2 * this.config.max_source_positions, d = 0, f = [], p = [];
		for (; d < l;) {
			let e = Math.min(d + u, l), m = c.slice(null, null, [d, e]), h, g = m.dims[2];
			if (g < u) {
				let e = c.dims[1], t = new Float32Array(e * u), n = m.data;
				for (let r = 0; r < e; ++r) t.set(n.subarray(r * g, (r + 1) * g), r * u);
				h = new V("float32", t, [
					1,
					e,
					u
				]);
			} else h = m;
			if (n) for (let e of n) "begin_index" in e && (e.begin_index = r.length);
			let _ = await super.generate({
				inputs: h,
				generation_config: t,
				logits_processor: n,
				decoder_input_ids: r,
				...i
			}), v = (s ? _.sequences : _)[0].tolist().map(Number).slice(r.length), y;
			if (s) {
				_.token_timestamps = this._extract_token_timestamps(_, t.alignment_heads, Math.floor((e - d) / 2), .02, r.length);
				let n = d / 2 * .02;
				y = _.token_timestamps[0].tolist().slice(r.length).map((e) => e + n);
			}
			if (v.length > 0 && v.at(-1) === o && v.pop(), v.length === 0) break;
			let b = v.map((e) => e >= a), x = v.length >= 2 && b[v.length - 1] && !b[v.length - 2], S = [];
			for (let e = 0; e < v.length - 1; ++e) b[e] && b[e + 1] && S.push(e + 1);
			let C, ee = v.length;
			if (S.length > 0) {
				if (x) C = e - d;
				else {
					let e = S.at(-1);
					C = (v[e - 1] - a) * 2, ee = e;
				}
			} else C = e - d;
			let w = Math.floor(d / 2), te = a + 1500;
			for (let e = 0; e < ee; ++e) v[e] >= a && (v[e] = Math.min(v[e] + w, te));
			f.push(...v.slice(0, ee)), y && p.push(...y.slice(0, ee)), d += C;
		}
		f.push(o);
		let m = [...r, ...f];
		if (s) {
			let e = new V("int64", m.map(BigInt), [1, m.length]), t = [
				...Array(r.length).fill(0),
				...p,
				0
			];
			return {
				sequences: e,
				token_timestamps: new V("float32", new Float32Array(t), [1, t.length])
			};
		}
		return new V("int64", m.map(BigInt), [1, m.length]);
	}
	_extract_token_timestamps(e, t, n = null, r = .02, i = 0) {
		if (!e.cross_attentions) throw Error("Model outputs must contain cross attentions to extract timestamps. This is most likely because the model was not exported with `output_attentions=True`.");
		n ?? A.warn("`num_frames` has not been set, meaning the entire audio will be analyzed. This may lead to inaccurate token-level timestamps for short audios (< 30 seconds).");
		let a = this.config.median_filter_width;
		a === void 0 && (A.warn("Model config has no `median_filter_width`, using default value of 7."), a = 7);
		let o = e.cross_attentions, s = Array.from({ length: this.config.decoder_layers }, (e, t) => H(o.map((e) => e[t]), 2)), c = Rl(t.map(([e, t]) => {
			if (e >= s.length) throw Error(`Layer index ${e} is out of bounds for cross attentions (length ${s.length}).`);
			return n ? s[e].slice(null, t, null, [0, n]) : s[e].slice(null, t);
		})).permute(1, 0, 2, 3), [l, u] = Bl(c, -2, 0, !0), d = c.clone();
		for (let e = 0; e < d.dims[0]; ++e) {
			let t = d[e];
			for (let n = 0; n < t.dims[0]; ++n) {
				let r = t[n], i = l[e][n][0].data, o = u[e][n][0].data;
				for (let e = 0; e < r.dims[0]; ++e) {
					let t = r[e].data;
					for (let e = 0; e < t.length; ++e) t[e] = (t[e] - o[e]) / i[e];
					t.set(Vc(t, a));
				}
			}
		}
		let f = [Vl(i > 0 ? d.slice(null, null, [i, d.dims[2]], null) : d, 1)], p = e.sequences.dims, m = new V("float32", new Float32Array(p[0] * p[1]), p);
		for (let e = 0; e < p[0]; ++e) {
			let [t, n] = Wc(f[e].neg().squeeze_(0).tolist()), a = Mr([1], Array.from({ length: t.length - 1 }, (e, n) => t[n + 1] - t[n])).map((e) => !!e), o = [];
			for (let e = 0; e < a.length; ++e) a[e] && o.push(n[e] * r);
			let s = Array(i).fill(0);
			s.push(...o), o.length > 0 && s.push(o.at(-1)), m[e].data.set(s);
		}
		return m;
	}
}, pO = class extends fO {}, mO = class extends Z {}, hO = class extends mO {}, gO = class extends mO {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, _O = class extends mO {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, vO = class extends mO {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, yO = class extends mO {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, bO = class extends Z {}, xO = class extends bO {}, SO = class extends bO {
	async _call(e) {
		return new lh(await super._call(e));
	}
}, CO = class extends bO {
	async _call(e) {
		return new Y(await super._call(e));
	}
}, wO = class extends bO {
	async _call(e) {
		return new ch(await super._call(e));
	}
}, TO = class extends bO {
	async _call(e) {
		return new uh(await super._call(e));
	}
}, EO = class extends Z {}, DO = class extends EO {}, OO = class extends EO {
	async _call(e) {
		return new kO(await super._call(e));
	}
}, kO = class extends J {
	constructor({ logits: e, pred_boxes: t }) {
		super(), this.logits = e, this.pred_boxes = t;
	}
}, AO = class extends Z {}, jO = class extends AO {}, MO = class extends AO {}, NO = class extends Z {}, PO = class extends NO {}, FO = class extends NO {}, IO = /* @__PURE__ */ new Map([
	["bert", "BertModel"],
	["eurobert", "EuroBertModel"],
	["neobert", "NeoBertModel"],
	["modernbert", "ModernBertModel"],
	["nomic_bert", "NomicBertModel"],
	["roformer", "RoFormerModel"],
	["electra", "ElectraModel"],
	["esm", "EsmModel"],
	["convbert", "ConvBertModel"],
	["camembert", "CamembertModel"],
	["deberta", "DebertaModel"],
	["deberta-v2", "DebertaV2Model"],
	["mpnet", "MPNetModel"],
	["albert", "AlbertModel"],
	["distilbert", "DistilBertModel"],
	["roberta", "RobertaModel"],
	["xlm", "XLMModel"],
	["xlm-roberta", "XLMRobertaModel"],
	["clap", "ClapModel"],
	["clip", "CLIPModel"],
	["clipseg", "CLIPSegModel"],
	["chinese_clip", "ChineseCLIPModel"],
	["siglip", "SiglipModel"],
	["jina_clip", "JinaCLIPModel"],
	["mobilebert", "MobileBertModel"],
	["squeezebert", "SqueezeBertModel"],
	["wav2vec2", "Wav2Vec2Model"],
	["wav2vec2-bert", "Wav2Vec2BertModel"],
	["unispeech", "UniSpeechModel"],
	["unispeech-sat", "UniSpeechSatModel"],
	["hubert", "HubertModel"],
	["wavlm", "WavLMModel"],
	["audio-spectrogram-transformer", "ASTModel"],
	["vits", "VitsModel"],
	["pyannote", "PyAnnoteModel"],
	["wespeaker-resnet", "WeSpeakerResNetModel"],
	["detr", "DetrModel"],
	["rt_detr", "RTDetrModel"],
	["rt_detr_v2", "RTDetrV2Model"],
	["rf_detr", "RFDetrModel"],
	["d_fine", "DFineModel"],
	["table-transformer", "TableTransformerModel"],
	["vit", "ViTModel"],
	["ijepa", "IJepaModel"],
	["pvt", "PvtModel"],
	["vit_msn", "ViTMSNModel"],
	["vit_mae", "ViTMAEModel"],
	["groupvit", "GroupViTModel"],
	["fastvit", "FastViTModel"],
	["mobilevit", "MobileViTModel"],
	["mobilevitv2", "MobileViTV2Model"],
	["owlvit", "OwlViTModel"],
	["owlv2", "Owlv2Model"],
	["beit", "BeitModel"],
	["deit", "DeiTModel"],
	["hiera", "HieraModel"],
	["convnext", "ConvNextModel"],
	["convnextv2", "ConvNextV2Model"],
	["dinov2", "Dinov2Model"],
	["dinov2_with_registers", "Dinov2WithRegistersModel"],
	["dinov3_vit", "DINOv3ViTModel"],
	["dinov3_convnext", "DINOv3ConvNextModel"],
	["resnet", "ResNetModel"],
	["swin", "SwinModel"],
	["swin2sr", "Swin2SRModel"],
	["donut-swin", "DonutSwinModel"],
	["yolos", "YolosModel"],
	["dpt", "DPTModel"],
	["glpn", "GLPNModel"],
	["hifigan", "SpeechT5HifiGan"],
	["efficientnet", "EfficientNetModel"],
	["decision_transformer", "DecisionTransformerModel"],
	["patchtst", "PatchTSTModel"],
	["patchtsmixer", "PatchTSMixerModel"],
	["mobilenet_v1", "MobileNetV1Model"],
	["mobilenet_v2", "MobileNetV2Model"],
	["mobilenet_v3", "MobileNetV3Model"],
	["mobilenet_v4", "MobileNetV4Model"],
	["maskformer", "MaskFormerModel"],
	["mgp-str", "MgpstrForSceneTextRecognition"],
	["style_text_to_speech_2", "StyleTextToSpeech2Model"],
	["openai_privacy_filter", "OpenAIPrivacyFilterModel"]
]), LO = /* @__PURE__ */ new Map([
	["t5", "T5Model"],
	["longt5", "LongT5Model"],
	["mt5", "MT5Model"],
	["bart", "BartModel"],
	["mbart", "MBartModel"],
	["marian", "MarianModel"],
	["whisper", "WhisperModel"],
	["cohere_asr", "CohereAsrModel"],
	["m2m_100", "M2M100Model"],
	["blenderbot", "BlenderbotModel"],
	["blenderbot-small", "BlenderbotSmallModel"]
]), RO = /* @__PURE__ */ new Map([
	["mimi", "MimiModel"],
	["dac", "DacModel"],
	["snac", "SnacModel"]
]), zO = /* @__PURE__ */ new Map([
	["bloom", "BloomModel"],
	["jais", "JAISModel"],
	["gpt2", "GPT2Model"],
	["gpt_oss", "GptOssModel"],
	["gptj", "GPTJModel"],
	["gpt_bigcode", "GPTBigCodeModel"],
	["gpt_neo", "GPTNeoModel"],
	["gpt_neox", "GPTNeoXModel"],
	["codegen", "CodeGenModel"],
	["llama", "LlamaModel"],
	["apertus", "ApertusModel"],
	["nanochat", "NanoChatModel"],
	["arcee", "ArceeModel"],
	["afmoe", "AfmoeModel"],
	["lfm2", "Lfm2Model"],
	["lfm2_moe", "Lfm2MoeModel"],
	["smollm3", "SmolLM3Model"],
	["exaone", "ExaoneModel"],
	["olmo", "OlmoModel"],
	["olmo2", "Olmo2Model"],
	["olmo3", "Olmo3Model"],
	["olmo_hybrid", "OlmoHybridModel"],
	["mobilellm", "MobileLLMModel"],
	["granite", "GraniteModel"],
	["granitemoehybrid", "GraniteMoeHybridModel"],
	["cohere", "CohereModel"],
	["cohere2", "Cohere2Model"],
	["gemma", "GemmaModel"],
	["gemma2", "Gemma2Model"],
	["vaultgemma", "VaultGemmaModel"],
	["gemma3_text", "Gemma3Model"],
	["helium", "HeliumModel"],
	["glm", "GlmModel"],
	["glm_moe_dsa", "GlmMoeDsaModel"],
	["openelm", "OpenELMModel"],
	["qwen2", "Qwen2Model"],
	["qwen2_moe", "Qwen2MoeModel"],
	["qwen3", "Qwen3Model"],
	["qwen3_moe", "Qwen3MoeModel"],
	["qwen3_next", "Qwen3NextModel"],
	["phi", "PhiModel"],
	["phi3", "Phi3Model"],
	["mpt", "MptModel"],
	["opt", "OPTModel"],
	["mistral", "MistralModel"],
	["mistral4", "Mistral4Model"],
	["ministral", "MinistralModel"],
	["ministral3", "Ministral3Model"],
	["ernie4_5", "Ernie4_5ForCausalLM"],
	["starcoder2", "Starcoder2Model"],
	["deepseek_v3", "DeepseekV3Model"],
	["deepseek_v4", "DeepseekV4Model"],
	["falcon", "FalconModel"],
	["falcon_h1", "FalconH1Model"],
	["nemotron_h", "NemotronHModel"],
	["solar_open", "SolarOpenModel"],
	["stablelm", "StableLmModel"],
	["modernbert-decoder", "ModernBertDecoderModel"],
	["hunyuan_v1_dense", "HunYuanDenseV1Model"],
	["youtu", "YoutuModel"],
	["zaya", "ZayaModel"],
	["hrm_text", "HrmTextModel"]
]), BO = /* @__PURE__ */ new Map([
	["speecht5", "SpeechT5ForSpeechToText"],
	["whisper", "WhisperForConditionalGeneration"],
	["lite-whisper", "LiteWhisperForConditionalGeneration"],
	["moonshine", "MoonshineForConditionalGeneration"],
	["cohere_asr", "CohereAsrForConditionalGeneration"]
]), VO = /* @__PURE__ */ new Map([["speecht5", "SpeechT5ForTextToSpeech"]]), HO = /* @__PURE__ */ new Map([
	["vits", "VitsModel"],
	["musicgen", "MusicgenForConditionalGeneration"],
	["supertonic", "SupertonicForConditionalGeneration"]
]), UO = /* @__PURE__ */ new Map([
	["bert", "BertForSequenceClassification"],
	["eurobert", "EuroBertForSequenceClassification"],
	["neobert", "NeoBertForSequenceClassification"],
	["modernbert", "ModernBertForSequenceClassification"],
	["roformer", "RoFormerForSequenceClassification"],
	["electra", "ElectraForSequenceClassification"],
	["esm", "EsmForSequenceClassification"],
	["convbert", "ConvBertForSequenceClassification"],
	["camembert", "CamembertForSequenceClassification"],
	["deberta", "DebertaForSequenceClassification"],
	["deberta-v2", "DebertaV2ForSequenceClassification"],
	["mpnet", "MPNetForSequenceClassification"],
	["albert", "AlbertForSequenceClassification"],
	["distilbert", "DistilBertForSequenceClassification"],
	["roberta", "RobertaForSequenceClassification"],
	["xlm", "XLMForSequenceClassification"],
	["xlm-roberta", "XLMRobertaForSequenceClassification"],
	["bart", "BartForSequenceClassification"],
	["mbart", "MBartForSequenceClassification"],
	["mobilebert", "MobileBertForSequenceClassification"],
	["squeezebert", "SqueezeBertForSequenceClassification"]
]), WO = /* @__PURE__ */ new Map([
	["bert", "BertForTokenClassification"],
	["eurobert", "EuroBertForTokenClassification"],
	["neobert", "NeoBertForTokenClassification"],
	["modernbert", "ModernBertForTokenClassification"],
	["roformer", "RoFormerForTokenClassification"],
	["electra", "ElectraForTokenClassification"],
	["esm", "EsmForTokenClassification"],
	["convbert", "ConvBertForTokenClassification"],
	["camembert", "CamembertForTokenClassification"],
	["deberta", "DebertaForTokenClassification"],
	["deberta-v2", "DebertaV2ForTokenClassification"],
	["mpnet", "MPNetForTokenClassification"],
	["distilbert", "DistilBertForTokenClassification"],
	["roberta", "RobertaForTokenClassification"],
	["xlm", "XLMForTokenClassification"],
	["xlm-roberta", "XLMRobertaForTokenClassification"],
	["openai_privacy_filter", "OpenAIPrivacyFilterForTokenClassification"]
]), GO = /* @__PURE__ */ new Map([
	["t5", "T5ForConditionalGeneration"],
	["longt5", "LongT5ForConditionalGeneration"],
	["mt5", "MT5ForConditionalGeneration"],
	["bart", "BartForConditionalGeneration"],
	["mbart", "MBartForConditionalGeneration"],
	["marian", "MarianMTModel"],
	["m2m_100", "M2M100ForConditionalGeneration"],
	["blenderbot", "BlenderbotForConditionalGeneration"],
	["blenderbot-small", "BlenderbotSmallForConditionalGeneration"]
]), KO = /* @__PURE__ */ new Map([
	["bloom", "BloomForCausalLM"],
	["gpt2", "GPT2LMHeadModel"],
	["gpt_oss", "GptOssForCausalLM"],
	["jais", "JAISLMHeadModel"],
	["gptj", "GPTJForCausalLM"],
	["gpt_bigcode", "GPTBigCodeForCausalLM"],
	["gpt_neo", "GPTNeoForCausalLM"],
	["gpt_neox", "GPTNeoXForCausalLM"],
	["codegen", "CodeGenForCausalLM"],
	["llama", "LlamaForCausalLM"],
	["nanochat", "NanoChatForCausalLM"],
	["apertus", "ApertusForCausalLM"],
	["llama4_text", "Llama4ForCausalLM"],
	["arcee", "ArceeForCausalLM"],
	["afmoe", "AfmoeForCausalLM"],
	["lfm2", "Lfm2ForCausalLM"],
	["lfm2_moe", "Lfm2MoeForCausalLM"],
	["smollm3", "SmolLM3ForCausalLM"],
	["exaone", "ExaoneForCausalLM"],
	["olmo", "OlmoForCausalLM"],
	["olmo2", "Olmo2ForCausalLM"],
	["olmo3", "Olmo3ForCausalLM"],
	["olmo_hybrid", "OlmoHybridForCausalLM"],
	["mobilellm", "MobileLLMForCausalLM"],
	["granite", "GraniteForCausalLM"],
	["granitemoehybrid", "GraniteMoeHybridForCausalLM"],
	["cohere", "CohereForCausalLM"],
	["cohere2", "Cohere2ForCausalLM"],
	["gemma", "GemmaForCausalLM"],
	["gemma2", "Gemma2ForCausalLM"],
	["vaultgemma", "VaultGemmaForCausalLM"],
	["gemma3_text", "Gemma3ForCausalLM"],
	["gemma3", "Gemma3ForCausalLM"],
	["helium", "HeliumForCausalLM"],
	["glm", "GlmForCausalLM"],
	["glm_moe_dsa", "GlmMoeDsaForCausalLM"],
	["openelm", "OpenELMForCausalLM"],
	["qwen2", "Qwen2ForCausalLM"],
	["qwen2_moe", "Qwen2MoeForCausalLM"],
	["qwen3", "Qwen3ForCausalLM"],
	["qwen3_moe", "Qwen3MoeForCausalLM"],
	["qwen3_next", "Qwen3NextForCausalLM"],
	["qwen2_vl", "Qwen2VLForCausalLM"],
	["qwen2_5_vl", "Qwen2_5_VLForCausalLM"],
	["qwen3_vl", "Qwen3VLForCausalLM"],
	["qwen3_vl_moe", "Qwen3VLMoeForCausalLM"],
	["qwen3_5", "Qwen3_5ForCausalLM"],
	["qwen3_5_text", "Qwen3_5ForCausalLM"],
	["qwen3_5_moe", "Qwen3_5MoeForCausalLM"],
	["gemma3n", "Gemma3nForCausalLM"],
	["gemma4", "Gemma4ForCausalLM"],
	["phi", "PhiForCausalLM"],
	["phi3", "Phi3ForCausalLM"],
	["mpt", "MptForCausalLM"],
	["opt", "OPTForCausalLM"],
	["mbart", "MBartForCausalLM"],
	["mistral", "MistralForCausalLM"],
	["mistral4", "Mistral4ForCausalLM"],
	["ministral", "MinistralForCausalLM"],
	["ministral3", "Ministral3ForCausalLM"],
	["ernie4_5", "Ernie4_5ForCausalLM"],
	["starcoder2", "Starcoder2ForCausalLM"],
	["deepseek_v3", "DeepseekV3ForCausalLM"],
	["deepseek_v4", "DeepseekV4ForCausalLM"],
	["falcon", "FalconForCausalLM"],
	["falcon_h1", "FalconH1ForCausalLM"],
	["nemotron_h", "NemotronHForCausalLM"],
	["trocr", "TrOCRForCausalLM"],
	["solar_open", "SolarOpenForCausalLM"],
	["stablelm", "StableLmForCausalLM"],
	["modernbert-decoder", "ModernBertDecoderForCausalLM"],
	["hunyuan_v1_dense", "HunYuanDenseV1ForCausalLM"],
	["youtu", "YoutuForCausalLM"],
	["zaya", "ZayaForCausalLM"],
	["hrm_text", "HrmTextForCausalLM"],
	["phi3_v", "Phi3VForCausalLM"]
]), qO = /* @__PURE__ */ new Map([["multi_modality", "MultiModalityCausalLM"]]), JO = /* @__PURE__ */ new Map([
	["bert", "BertForMaskedLM"],
	["eurobert", "EuroBertForMaskedLM"],
	["neobert", "NeoBertForMaskedLM"],
	["modernbert", "ModernBertForMaskedLM"],
	["roformer", "RoFormerForMaskedLM"],
	["electra", "ElectraForMaskedLM"],
	["esm", "EsmForMaskedLM"],
	["convbert", "ConvBertForMaskedLM"],
	["camembert", "CamembertForMaskedLM"],
	["deberta", "DebertaForMaskedLM"],
	["deberta-v2", "DebertaV2ForMaskedLM"],
	["mpnet", "MPNetForMaskedLM"],
	["albert", "AlbertForMaskedLM"],
	["distilbert", "DistilBertForMaskedLM"],
	["roberta", "RobertaForMaskedLM"],
	["xlm", "XLMWithLMHeadModel"],
	["xlm-roberta", "XLMRobertaForMaskedLM"],
	["mobilebert", "MobileBertForMaskedLM"],
	["squeezebert", "SqueezeBertForMaskedLM"]
]), YO = /* @__PURE__ */ new Map([
	["bert", "BertForQuestionAnswering"],
	["neobert", "NeoBertForQuestionAnswering"],
	["roformer", "RoFormerForQuestionAnswering"],
	["electra", "ElectraForQuestionAnswering"],
	["convbert", "ConvBertForQuestionAnswering"],
	["camembert", "CamembertForQuestionAnswering"],
	["deberta", "DebertaForQuestionAnswering"],
	["deberta-v2", "DebertaV2ForQuestionAnswering"],
	["mpnet", "MPNetForQuestionAnswering"],
	["albert", "AlbertForQuestionAnswering"],
	["distilbert", "DistilBertForQuestionAnswering"],
	["roberta", "RobertaForQuestionAnswering"],
	["xlm", "XLMForQuestionAnswering"],
	["xlm-roberta", "XLMRobertaForQuestionAnswering"],
	["mobilebert", "MobileBertForQuestionAnswering"],
	["squeezebert", "SqueezeBertForQuestionAnswering"]
]), XO = /* @__PURE__ */ new Map([
	["vision-encoder-decoder", "VisionEncoderDecoderModel"],
	["idefics3", "Idefics3ForConditionalGeneration"],
	["smolvlm", "SmolVLMForConditionalGeneration"]
]), ZO = /* @__PURE__ */ new Map([
	["llava", "LlavaForConditionalGeneration"],
	["llava_onevision", "LlavaOnevisionForConditionalGeneration"],
	["moondream1", "Moondream1ForConditionalGeneration"],
	["florence2", "Florence2ForConditionalGeneration"],
	["qwen2_vl", "Qwen2VLForConditionalGeneration"],
	["qwen2_5_vl", "Qwen2_5_VLForConditionalGeneration"],
	["qwen3_vl", "Qwen3VLForConditionalGeneration"],
	["qwen3_vl_moe", "Qwen3VLMoeForConditionalGeneration"],
	["qwen3_5", "Qwen3_5ForConditionalGeneration"],
	["qwen3_5_moe", "Qwen3_5MoeForConditionalGeneration"],
	["lfm2_vl", "Lfm2VlForConditionalGeneration"],
	["idefics3", "Idefics3ForConditionalGeneration"],
	["smolvlm", "SmolVLMForConditionalGeneration"],
	["paligemma", "PaliGemmaForConditionalGeneration"],
	["llava_qwen2", "LlavaQwen2ForCausalLM"],
	["gemma3", "Gemma3ForConditionalGeneration"],
	["gemma3n", "Gemma3nForConditionalGeneration"],
	["gemma4", "Gemma4ForConditionalGeneration"],
	["mistral3", "Mistral3For" + "ConditionalGeneration"],
	["lighton_ocr", "LightOnOcrForConditionalGeneration"],
	["glm_ocr", "GlmOcrForConditionalGeneration"]
]), QO = /* @__PURE__ */ new Map([
	["granite_speech", "GraniteSpeechForConditionalGeneration"],
	["ultravox", "UltravoxModel"],
	["voxtral", "VoxtralForConditionalGeneration"],
	["voxtral_realtime", "VoxtralRealtimeForConditionalGeneration"]
]), $O = /* @__PURE__ */ new Map([["vision-encoder-decoder", "VisionEncoderDecoderModel"]]), ek = /* @__PURE__ */ new Map([
	["vit", "ViTForImageClassification"],
	["ijepa", "IJepaForImageClassification"],
	["pvt", "PvtForImageClassification"],
	["vit_msn", "ViTMSNForImageClassification"],
	["fastvit", "FastViTForImageClassification"],
	["mobilevit", "MobileViTForImageClassification"],
	["mobilevitv2", "MobileViTV2ForImageClassification"],
	["beit", "BeitForImageClassification"],
	["deit", "DeiTForImageClassification"],
	["hiera", "HieraForImageClassification"],
	["convnext", "ConvNextForImageClassification"],
	["convnextv2", "ConvNextV2ForImageClassification"],
	["dinov2", "Dinov2ForImageClassification"],
	["dinov2_with_registers", "Dinov2WithRegistersForImageClassification"],
	["resnet", "ResNetForImageClassification"],
	["swin", "SwinForImageClassification"],
	["segformer", "SegformerForImageClassification"],
	["efficientnet", "EfficientNetForImageClassification"],
	["mobilenet_v1", "MobileNetV1ForImageClassification"],
	["mobilenet_v2", "MobileNetV2ForImageClassification"],
	["mobilenet_v3", "MobileNetV3ForImageClassification"],
	["mobilenet_v4", "MobileNetV4ForImageClassification"]
]), tk = /* @__PURE__ */ new Map([
	["detr", "DetrForObjectDetection"],
	["rt_detr", "RTDetrForObjectDetection"],
	["rt_detr_v2", "RTDetrV2ForObjectDetection"],
	["rf_detr", "RFDetrForObjectDetection"],
	["d_fine", "DFineForObjectDetection"],
	["table-transformer", "TableTransformerForObjectDetection"],
	["yolos", "YolosForObjectDetection"]
]), nk = /* @__PURE__ */ new Map([
	["owlvit", "OwlViTForObjectDetection"],
	["owlv2", "Owlv2ForObjectDetection"],
	["grounding-dino", "GroundingDinoForObjectDetection"]
]), rk = /* @__PURE__ */ new Map([["detr", "DetrForSegmentation"], ["clipseg", "CLIPSegForImageSegmentation"]]), ik = /* @__PURE__ */ new Map([
	["segformer", "SegformerForSemanticSegmentation"],
	["sapiens", "SapiensForSemanticSegmentation"],
	["swin", "SwinForSemanticSegmentation"],
	["mobilenet_v1", "MobileNetV1ForSemanticSegmentation"],
	["mobilenet_v2", "MobileNetV2ForSemanticSegmentation"],
	["mobilenet_v3", "MobileNetV3ForSemanticSegmentation"],
	["mobilenet_v4", "MobileNetV4ForSemanticSegmentation"]
]), ak = /* @__PURE__ */ new Map([["detr", "DetrForSegmentation"], ["maskformer", "MaskFormerForInstanceSegmentation"]]), ok = /* @__PURE__ */ new Map([
	["sam", "SamModel"],
	["sam2", "Sam2Model"],
	["edgetam", "EdgeTamModel"],
	["sam3_tracker", "Sam3TrackerModel"]
]), sk = /* @__PURE__ */ new Map([
	["wav2vec2", "Wav2Vec2ForCTC"],
	["wav2vec2-bert", "Wav2Vec2BertForCTC"],
	["unispeech", "UniSpeechForCTC"],
	["unispeech-sat", "UniSpeechSatForCTC"],
	["wavlm", "WavLMForCTC"],
	["hubert", "HubertForCTC"],
	["parakeet_ctc", "ParakeetForCTC"]
]), ck = /* @__PURE__ */ new Map([
	["wav2vec2", "Wav2Vec2ForSequenceClassification"],
	["wav2vec2-bert", "Wav2Vec2BertForSequenceClassification"],
	["unispeech", "UniSpeechForSequenceClassification"],
	["unispeech-sat", "UniSpeechSatForSequenceClassification"],
	["wavlm", "WavLMForSequenceClassification"],
	["hubert", "HubertForSequenceClassification"],
	["audio-spectrogram-transformer", "ASTForAudioClassification"]
]), lk = /* @__PURE__ */ new Map([["wavlm", "WavLMForXVector"]]), uk = /* @__PURE__ */ new Map([
	["unispeech-sat", "UniSpeechSatForAudioFrameClassification"],
	["wavlm", "WavLMForAudioFrameClassification"],
	["wav2vec2", "Wav2Vec2ForAudioFrameClassification"],
	["pyannote", "PyAnnoteForAudioFrameClassification"]
]), dk = /* @__PURE__ */ new Map([["vitmatte", "VitMatteForImageMatting"]]), fk = /* @__PURE__ */ new Map([["patchtst", "PatchTSTForPrediction"], ["patchtsmixer", "PatchTSMixerForPrediction"]]), pk = /* @__PURE__ */ new Map([["swin2sr", "Swin2SRForImageSuperResolution"]]), mk = /* @__PURE__ */ new Map([
	["chmv2", "CHMv2ForDepthEstimation"],
	["dpt", "DPTForDepthEstimation"],
	["depth_anything", "DepthAnythingForDepthEstimation"],
	["glpn", "GLPNForDepthEstimation"],
	["sapiens", "SapiensForDepthEstimation"],
	["depth_pro", "DepthProForDepthEstimation"],
	["metric3d", "Metric3DForDepthEstimation"],
	["metric3dv2", "Metric3Dv2ForDepthEstimation"]
]), hk = /* @__PURE__ */ new Map([["sapiens", "SapiensForNormalEstimation"]]), gk = /* @__PURE__ */ new Map([["vitpose", "VitPoseForPoseEstimation"]]), _k = /* @__PURE__ */ new Map([
	["clip", "CLIPVisionModelWithProjection"],
	["siglip", "SiglipVisionModel"],
	["jina_clip", "JinaCLIPVisionModel"]
]), vk = [
	[IO, X.EncoderOnly],
	[LO, X.EncoderDecoder],
	[zO, X.DecoderOnlyWithoutHead],
	[RO, X.AutoEncoder],
	[UO, X.EncoderOnly],
	[WO, X.EncoderOnly],
	[GO, X.Seq2Seq],
	[BO, X.Seq2Seq],
	[KO, X.DecoderOnly],
	[qO, X.MultiModality],
	[JO, X.EncoderOnly],
	[YO, X.EncoderOnly],
	[XO, X.Vision2Seq],
	[ZO, X.ImageTextToText],
	[QO, X.AudioTextToText],
	[ek, X.EncoderOnly],
	[rk, X.EncoderOnly],
	[ak, X.EncoderOnly],
	[ik, X.EncoderOnly],
	[dk, X.EncoderOnly],
	[fk, X.EncoderOnly],
	[pk, X.EncoderOnly],
	[mk, X.EncoderOnly],
	[hk, X.EncoderOnly],
	[gk, X.EncoderOnly],
	[tk, X.EncoderOnly],
	[nk, X.EncoderOnly],
	[ok, X.MaskGeneration],
	[sk, X.EncoderOnly],
	[ck, X.EncoderOnly],
	[VO, X.Seq2Seq],
	[HO, X.EncoderOnly],
	[lk, X.EncoderOnly],
	[uk, X.EncoderOnly],
	[_k, X.EncoderOnly]
];
for (let [e, t] of vk) for (let n of e.values()) {
	Qh.set(n, t);
	let e = Sg[n];
	eg.set(e, n), $h.set(n, e);
}
var yk = [
	[
		"MusicgenForConditionalGeneration",
		YC,
		X.Musicgen
	],
	[
		"Phi3VForCausalLM",
		$w,
		X.Phi3V
	],
	[
		"CLIPTextModelWithProjection",
		k_,
		X.EncoderOnly
	],
	[
		"SiglipTextModel",
		gE,
		X.EncoderOnly
	],
	[
		"JinaCLIPTextModel",
		Vx,
		X.EncoderOnly
	],
	[
		"ClapTextModelWithProjection",
		w_,
		X.EncoderOnly
	],
	[
		"ClapAudioModelWithProjection",
		T_,
		X.EncoderOnly
	],
	[
		"DacEncoderModel",
		gv,
		X.EncoderOnly
	],
	[
		"DacDecoderModel",
		_v,
		X.EncoderOnly
	],
	[
		"MimiEncoderModel",
		AS,
		X.EncoderOnly
	],
	[
		"MimiDecoderModel",
		jS,
		X.EncoderOnly
	],
	[
		"SnacEncoderModel",
		wE,
		X.EncoderOnly
	],
	[
		"SnacDecoderModel",
		TE,
		X.EncoderOnly
	],
	[
		"Gemma3nForConditionalGeneration",
		hb,
		X.ImageAudioTextToText
	],
	[
		"Gemma4ForConditionalGeneration",
		_b,
		X.ImageAudioTextToText
	],
	[
		"SupertonicForConditionalGeneration",
		JE,
		X.Supertonic
	],
	[
		"ChatterboxModel",
		__,
		X.Chatterbox
	],
	[
		"VoxtralRealtimeForConditionalGeneration",
		YD,
		X.VoxtralRealtime
	]
];
for (let [e, t, n] of yk) Qh.set(e, n), eg.set(t, e), $h.set(e, t);
var bk = /* @__PURE__ */ new Map([
	["modnet", rk],
	["birefnet", rk],
	["isnet", rk],
	["ben", rk]
]);
for (let [e, t] of bk.entries()) t.set(e, "PreTrainedModel"), Qh.set(e, X.EncoderOnly), $h.set(e, Z);
var xk = new Set(bk.keys());
Qh.set("PreTrainedModel", X.EncoderOnly), eg.set(Z, "PreTrainedModel");
var Q = {
	MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING_NAMES: UO,
	MODEL_FOR_TOKEN_CLASSIFICATION_MAPPING_NAMES: WO,
	MODEL_FOR_TEXT_TO_SPECTROGRAM_MAPPING_NAMES: VO,
	MODEL_FOR_TEXT_TO_WAVEFORM_MAPPING_NAMES: HO,
	MODEL_FOR_MASKED_LM_MAPPING_NAMES: JO,
	MODEL_FOR_QUESTION_ANSWERING_MAPPING_NAMES: YO,
	MODEL_FOR_IMAGE_CLASSIFICATION_MAPPING_NAMES: ek,
	MODEL_FOR_IMAGE_SEGMENTATION_MAPPING_NAMES: rk,
	MODEL_FOR_SEMANTIC_SEGMENTATION_MAPPING_NAMES: ik,
	MODEL_FOR_UNIVERSAL_SEGMENTATION_MAPPING_NAMES: ak,
	MODEL_FOR_OBJECT_DETECTION_MAPPING_NAMES: tk,
	MODEL_FOR_ZERO_SHOT_OBJECT_DETECTION_MAPPING_NAMES: nk,
	MODEL_FOR_MASK_GENERATION_MAPPING_NAMES: ok,
	MODEL_FOR_CTC_MAPPING_NAMES: sk,
	MODEL_FOR_AUDIO_CLASSIFICATION_MAPPING_NAMES: ck,
	MODEL_FOR_AUDIO_XVECTOR_MAPPING_NAMES: lk,
	MODEL_FOR_AUDIO_FRAME_CLASSIFICATION_MAPPING_NAMES: uk,
	MODEL_FOR_DOCUMENT_QUESTION_ANSWERING_MAPPING_NAMES: $O,
	MODEL_FOR_IMAGE_MATTING_MAPPING_NAMES: dk,
	MODEL_FOR_IMAGE_TO_IMAGE_MAPPING_NAMES: pk,
	MODEL_FOR_DEPTH_ESTIMATION_MAPPING_NAMES: mk,
	MODEL_FOR_NORMAL_ESTIMATION_MAPPING_NAMES: hk,
	MODEL_FOR_POSE_ESTIMATION_MAPPING_NAMES: gk,
	MODEL_FOR_IMAGE_FEATURE_EXTRACTION_MAPPING_NAMES: _k,
	MODEL_FOR_IMAGE_TEXT_TO_TEXT_MAPPING_NAMES: ZO,
	MODEL_FOR_AUDIO_TEXT_TO_TEXT_MAPPING_NAMES: QO,
	MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES: GO,
	MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES: BO,
	MODEL_FOR_CAUSAL_LM_MAPPING_NAMES: KO,
	MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES: XO
};
qh(Q);
var $ = class {
	static MODEL_CLASS_MAPPINGS = null;
	static BASE_IF_FAIL = !1;
	static supports(e) {
		if (!this.MODEL_CLASS_MAPPINGS) return !1;
		for (let t of this.MODEL_CLASS_MAPPINGS) if (t.has(e)) return !0;
		return this.BASE_IF_FAIL;
	}
	static async from_pretrained(e, { progress_callback: t = null, config: n = null, cache_dir: r = null, local_files_only: i = !1, revision: a = "main", model_file_name: o = null, subfolder: s = "onnx", device: c = null, dtype: l = null, use_external_data_format: u = null, session_options: d = {} } = {}) {
		let f = {
			progress_callback: t,
			config: n,
			cache_dir: r,
			local_files_only: i,
			revision: a,
			model_file_name: o,
			subfolder: s,
			device: c,
			dtype: l,
			use_external_data_format: u,
			session_options: d
		};
		if (f.config = await Qm.from_pretrained(e, f), !this.MODEL_CLASS_MAPPINGS) throw Error("`MODEL_CLASS_MAPPINGS` not implemented for this type of `AutoClass`: " + this.name);
		let { model_type: p } = f.config;
		for (let t of this.MODEL_CLASS_MAPPINGS) {
			let n = t.get(p);
			if (!n) {
				for (let e of t.values()) if (e[0] === p) {
					n = e;
					break;
				}
				if (!n) continue;
			}
			return await Sg[n].from_pretrained(e, f);
		}
		if (this.BASE_IF_FAIL) return xk.has(p) || A.warn(`Unknown model class "${p}", attempting to construct from base class.`), await Z.from_pretrained(e, f);
		throw Error(`Unsupported model type: ${p}`);
	}
}, Sk = class extends $ {
	static MODEL_CLASS_MAPPINGS = vk.map((e) => e[0]);
	static BASE_IF_FAIL = !0;
}, Ck = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING_NAMES];
}, wk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_TOKEN_CLASSIFICATION_MAPPING_NAMES];
}, Tk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES];
}, Ek = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES];
}, Dk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_TEXT_TO_SPECTROGRAM_MAPPING_NAMES];
}, Ok = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_TEXT_TO_WAVEFORM_MAPPING_NAMES];
}, kk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_CAUSAL_LM_MAPPING_NAMES];
}, Ak = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_MASKED_LM_MAPPING_NAMES];
}, jk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_QUESTION_ANSWERING_MAPPING_NAMES];
}, Mk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES];
}, Nk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_IMAGE_CLASSIFICATION_MAPPING_NAMES];
}, Pk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_IMAGE_SEGMENTATION_MAPPING_NAMES];
}, Fk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_SEMANTIC_SEGMENTATION_MAPPING_NAMES];
}, Ik = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_UNIVERSAL_SEGMENTATION_MAPPING_NAMES];
}, Lk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_OBJECT_DETECTION_MAPPING_NAMES];
}, Rk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_ZERO_SHOT_OBJECT_DETECTION_MAPPING_NAMES];
};
(class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_MASK_GENERATION_MAPPING_NAMES];
});
var zk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_CTC_MAPPING_NAMES];
}, Bk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_AUDIO_CLASSIFICATION_MAPPING_NAMES];
};
(class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_AUDIO_XVECTOR_MAPPING_NAMES];
}), class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_AUDIO_FRAME_CLASSIFICATION_MAPPING_NAMES];
};
var Vk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_DOCUMENT_QUESTION_ANSWERING_MAPPING_NAMES];
};
(class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_IMAGE_MATTING_MAPPING_NAMES];
});
var Hk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_IMAGE_TO_IMAGE_MAPPING_NAMES];
}, Uk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_DEPTH_ESTIMATION_MAPPING_NAMES];
};
(class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_NORMAL_ESTIMATION_MAPPING_NAMES];
}), class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_POSE_ESTIMATION_MAPPING_NAMES];
};
var Wk = class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_IMAGE_FEATURE_EXTRACTION_MAPPING_NAMES];
};
(class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_IMAGE_TEXT_TO_TEXT_MAPPING_NAMES];
}), class extends $ {
	static MODEL_CLASS_MAPPINGS = [Q.MODEL_FOR_AUDIO_TEXT_TO_TEXT_MAPPING_NAMES];
};
async function Gk(e) {
	return Array.isArray(e) || (e = [e]), await Promise.all(e.map((e) => hf.read(e)));
}
async function Kk(e, t) {
	return Array.isArray(e) || (e = [e]), await Promise.all(e.map((e) => typeof e == "string" || e instanceof URL ? vd(e, t) : e instanceof Float64Array ? new Float32Array(e) : e));
}
function qk(e, t) {
	t && (e = e.map((e) => e | 0));
	let [n, r, i, a] = e;
	return {
		xmin: n,
		ymin: r,
		xmax: i,
		ymax: a
	};
}
var Jk = class extends Er {
	constructor({ task: e, model: t, tokenizer: n = null, processor: r = null }) {
		super(), this.task = e, this.model = t, this.tokenizer = n, this.processor = r;
	}
	async dispose() {
		await this.model.dispose();
	}
}, Yk = class extends Jk {
	async _call(e, { top_k: t = 1 } = {}) {
		let n = this.tokenizer(e, {
			padding: !0,
			truncation: !0
		}), r = await this.model(n), { problem_type: i, id2label: a } = this.model.config, o = i === "multi_label_classification" ? (e) => e.sigmoid() : (e) => new V("float32", Nc(e.data), e.dims), s = [];
		for (let e of r.logits) {
			let n = await jl(o(e), t), r = n[0].tolist(), i = n[1].tolist().map((e, t) => ({
				label: a ? a[e] : `LABEL_${e}`,
				score: r[t]
			}));
			t === 1 ? s.push(...i) : s.push(i);
		}
		return Array.isArray(e) || t === 1 ? s : s[0];
	}
}, Xk = class extends Jk {
	async _call(e, { ignore_labels: t = ["O"], aggregation_strategy: n = "none" } = {}) {
		if (n !== "none" && n !== "simple") throw Error(`Invalid aggregation_strategy: "${n}". Must be one of "none" or "simple".`);
		let r = Array.isArray(e), i = this.tokenizer(r ? e : [e], {
			padding: !0,
			truncation: !0
		}), a = (await this.model(i)).logits, o = this.model.config.id2label, s = [];
		for (let e = 0; e < a.dims[0]; ++e) {
			let r = i.input_ids[e].tolist(), c = a[e], l = [];
			for (let e = 0; e < c.dims[0]; ++e) {
				let n = c[e], i = Ic(n.data)[1], a = o ? o[i] : `LABEL_${i}`;
				if (t.includes(a)) continue;
				let s = this.tokenizer.decode([r[e]], { skip_special_tokens: !0 });
				if (s === "") continue;
				let u = Nc(n.data);
				l.push({
					entity: a,
					score: u[i],
					index: e,
					word: s
				});
			}
			s.push(n === "simple" ? Qk(l, r, this.tokenizer) : l);
		}
		return r ? s : s[0];
	}
};
function Zk(e) {
	let t = e[0];
	return e[1] === "-" && (t === "B" || t === "I" || t === "E" || t === "S") ? [t, e.slice(2)] : ["I", e];
}
function Qk(e, t, n) {
	let r = [], i = null;
	for (let t = 0; t < e.length; ++t) {
		let [n, a] = Zk(e[t].entity);
		i === a && n !== "B" && n !== "S" ? (r[r.length - 1].end = t + 1, n === "E" && (i = null)) : (r.push({
			tag: a,
			start: t,
			end: t + 1
		}), i = n === "S" ? null : a);
	}
	return r.map(({ tag: r, start: i, end: a }) => {
		let o = 0, s = [];
		for (let n = i; n < a; ++n) o += e[n].score, s.push(t[e[n].index]);
		return {
			entity_group: r,
			score: o / (a - i),
			word: n.decode(s, { skip_special_tokens: !0 })
		};
	});
}
var $k = class extends Jk {
	async _call(e, t, { top_k: n = 1 } = {}) {
		let r = this.tokenizer(e, {
			text_pair: t,
			padding: !0,
			truncation: !0
		}), i = Array.isArray(e), { start_logits: a, end_logits: o } = await this.model(r), s = r.input_ids.tolist(), c = r.attention_mask.tolist(), { all_special_ids: l, sep_token_id: u } = this.tokenizer, d = [];
		for (let e = 0; e < a.dims[0]; ++e) {
			let t = s[e], r = t.findIndex((e) => e == u), i = a[e].tolist(), f = o[e].tolist();
			for (let n = 1; n < i.length; ++n) (c[e] == 0 || n <= r || l.findIndex((e) => e == t[n]) !== -1) && (i[n] = -Infinity, f[n] = -Infinity);
			let p = Nc(i).map((e, t) => [e, t]), m = Nc(f).map((e, t) => [e, t]);
			p[0][0] = 0, m[0][0] = 0;
			let h = Nr(p, m).filter((e) => e[0][1] <= e[1][1]).map((e) => [
				e[0][1],
				e[1][1],
				e[0][0] * e[1][0]
			]).sort((e, t) => t[2] - e[2]), g = [];
			for (let e = 0; e < Math.min(h.length, n); ++e) {
				let [n, r, i] = h[e], a = t.slice(n, r + 1), o = this.tokenizer.decode(a, { skip_special_tokens: !0 });
				g.push({
					answer: o,
					score: i
				});
			}
			n === 1 ? d.push(...g) : d.push(g);
		}
		return i ? d : d[0];
	}
}, eA = class extends Jk {
	async _call(e, { top_k: t = 5 } = {}) {
		let { mask_token_id: n, mask_token: r } = this.tokenizer, i = this.tokenizer(e, {
			padding: !0,
			truncation: !0
		}), { logits: a } = await this.model(i), o = [], s = i.input_ids.tolist();
		for (let e = 0; e < s.length; ++e) {
			let i = s[e], c = i.findIndex((e) => e == n);
			if (c === -1) throw Error(`Mask token (${r}) not found in text.`);
			let l = a[e][c], u = await jl(new V("float32", Nc(l.data), l.dims), t), d = u[0].tolist(), f = u[1].tolist();
			o.push(f.map((e, t) => {
				let n = i.slice();
				return n[c] = e, {
					score: d[t],
					token: Number(e),
					token_str: this.tokenizer.decode([e]),
					sequence: this.tokenizer.decode(n, { skip_special_tokens: !0 })
				};
			}));
		}
		return Array.isArray(e) ? o : o[0];
	}
}, tA = class extends Jk {
	_default_generation_config = { max_new_tokens: 256 };
	_key = "generated_text";
	async _call(e, t = {}) {
		Array.isArray(e) || (e = [e]), this.model.config.prefix && (e = e.map((e) => this.model.config.prefix + e));
		let n = this.model.config.task_specific_params;
		n && n[this.task] && n[this.task].prefix && (e = e.map((e) => n[this.task].prefix + e));
		let r = this.tokenizer, i = {
			padding: !0,
			truncation: !0
		}, a;
		a = this.task === "translation" && "_build_translation_inputs" in r ? r._build_translation_inputs(e, i, t) : r(e, i);
		let o = await this.model.generate({
			...a,
			...this._default_generation_config,
			...t
		});
		return r.batch_decode(o, { skip_special_tokens: !0 }).map((e) => ({ [this._key]: e }));
	}
}, nA = class extends tA {
	_key = "summary_text";
}, rA = class extends tA {
	_key = "translation_text";
};
function iA(e) {
	return Array.isArray(e) && e.every((e) => "role" in e && "content" in e);
}
var aA = class extends Jk {
	_default_generation_config = { max_new_tokens: 256 };
	async _call(e, t = {}) {
		let { add_special_tokens: n, return_full_text: r, tools: i, documents: a, chat_template: o, tokenizer_encode_kwargs: s, ...c } = t, l = !1, u = !1, d = n ?? (this.tokenizer.add_bos_token || this.tokenizer.add_eos_token) ?? !1, f = s, p;
		if (typeof e == "string") p = e = [e];
		else if (Array.isArray(e) && e.every((e) => typeof e == "string")) l = !0, p = e;
		else {
			if (iA(e)) e = [e];
			else if (Array.isArray(e) && e.every(iA)) l = !0;
			else throw Error("Input must be a string, an array of strings, a Chat, or an array of Chats");
			u = !0;
			let t = {
				tokenize: !1,
				add_generation_prompt: !0,
				...Fr({
					tools: i,
					documents: a,
					chat_template: o
				}, [
					"tools",
					"documents",
					"chat_template"
				]),
				...f
			};
			p = e.map((e) => this.tokenizer.apply_chat_template(e, t)), d = !1, f = void 0;
		}
		let m = u ? !1 : r ?? !0;
		this.tokenizer.padding_side = "left";
		let h = this.tokenizer(p, {
			add_special_tokens: d,
			padding: !0,
			truncation: !0,
			...f
		}), g = await this.model.generate({
			...h,
			...this._default_generation_config,
			...c
		}), _ = this.tokenizer.batch_decode(g, { skip_special_tokens: !0 }), v;
		!m && h.input_ids.dims.at(-1) > 0 && (v = this.tokenizer.batch_decode(h.input_ids, { skip_special_tokens: !0 }).map((e) => e.length));
		let y = Array.from({ length: e.length }, (e) => []);
		for (let t = 0; t < _.length; ++t) {
			let n = Math.floor(t / g.dims[0] * e.length);
			v && (_[t] = _[t].slice(v[n])), y[n].push({ generated_text: u ? [...e[n], {
				role: "assistant",
				content: _[t]
			}] : _[t] });
		}
		return !l && y.length === 1 ? y[0] : y;
	}
}, oA = class extends Jk {
	constructor(e) {
		super(e), this.label2id = Object.fromEntries(Object.entries(this.model.config.label2id).map(([e, t]) => [e.toLowerCase(), t])), this.entailment_id = this.label2id.entailment, this.entailment_id === void 0 && (A.warn("Could not find 'entailment' in label2id mapping. Using 2 as entailment_id."), this.entailment_id = 2), this.contradiction_id = this.label2id.contradiction ?? this.label2id.not_entailment, this.contradiction_id === void 0 && (A.warn("Could not find 'contradiction' in label2id mapping. Using 0 as contradiction_id."), this.contradiction_id = 0);
	}
	async _call(e, t, { hypothesis_template: n = "This example is {}.", multi_label: r = !1 } = {}) {
		let i = Array.isArray(e);
		i || (e = [e]), Array.isArray(t) || (t = [t]);
		let a = t.map((e) => n.replace("{}", e)), o = r || t.length === 1, s = [];
		for (let n of e) {
			let e = [];
			for (let t of a) {
				let r = this.tokenizer(n, {
					text_pair: t,
					padding: !0,
					truncation: !0
				}), i = await this.model(r);
				o ? e.push([i.logits.data[this.contradiction_id], i.logits.data[this.entailment_id]]) : e.push(i.logits.data[this.entailment_id]);
			}
			let r = (o ? e.map((e) => Nc(e)[1]) : Nc(e)).map((e, t) => [e, t]).sort((e, t) => t[0] - e[0]);
			s.push({
				sequence: n,
				labels: r.map((e) => t[e[1]]),
				scores: r.map((e) => e[0])
			});
		}
		return i ? s : s[0];
	}
}, sA = class extends Jk {
	async _call(e, { top_k: t = 5 } = {}) {
		let n = this.processor.feature_extractor.config.sampling_rate, r = await Kk(e, n), i = this.model.config.id2label, a = [];
		for (let e of r) {
			let n = await this.processor(e), r = (await this.model(n)).logits[0], o = await jl(new V("float32", Nc(r.data), r.dims), t), s = o[0].tolist(), c = o[1].tolist().map((e, t) => ({
				label: i ? i[e] : `LABEL_${e}`,
				score: s[t]
			}));
			a.push(c);
		}
		return Array.isArray(e) ? a : a[0];
	}
}, cA = class extends Jk {
	async _call(e, t, { hypothesis_template: n = "This is a sound of {}." } = {}) {
		let r = !Array.isArray(e);
		r && (e = [e]);
		let i = t.map((e) => n.replace("{}", e)), a = this.tokenizer(i, {
			padding: !0,
			truncation: !0
		}), o = this.processor.feature_extractor.config.sampling_rate, s = await Kk(e, o), c = [];
		for (let e of s) {
			let n = await this.processor(e), r = Nc((await this.model({
				...a,
				...n
			})).logits_per_audio.data);
			c.push([...r].map((e, n) => ({
				score: e,
				label: t[n]
			})));
		}
		return r ? c[0] : c;
	}
}, lA = class extends Jk {
	_default_generation_config = {};
	async _call(e, t = {}) {
		switch (t = {
			...this._default_generation_config,
			...t
		}, this.model.config.model_type) {
			case "whisper":
			case "lite-whisper": return this._call_whisper(e, t);
			case "wav2vec2":
			case "wav2vec2-bert":
			case "unispeech":
			case "unispeech-sat":
			case "hubert":
			case "parakeet_ctc": return this._call_wav2vec2(e, t);
			case "moonshine": return this._call_moonshine(e, t);
			case "cohere_asr": return this._call_cohere_asr(e, t);
			default: throw Error(`AutomaticSpeechRecognitionPipeline does not support model type '${this.model.config.model_type}'.`);
		}
	}
	async _call_wav2vec2(e, t) {
		t.language && A.warn("`language` parameter is not yet supported for `wav2vec2` models, defaulting to \"English\"."), t.task && A.warn("`task` parameter is not yet supported for `wav2vec2` models, defaulting to \"transcribe\".");
		let n = !Array.isArray(e), r = n ? [e] : e, i = this.processor.feature_extractor.config.sampling_rate, a = await Kk(r, i), o = [];
		for (let e of a) {
			let t = await this.processor(e), n = (await this.model(t)).logits[0], r = [];
			for (let e of n) r.push(Ic(e.data)[1]);
			let i = this.tokenizer.decode(r, { skip_special_tokens: !0 }).trim();
			o.push({ text: i });
		}
		return n ? o[0] : o;
	}
	async _call_whisper(e, t) {
		let n = t.return_timestamps ?? !1, r = t.chunk_length_s ?? 0, i = t.force_full_sequences ?? !1, a = t.stride_length_s ?? null, o = { ...t };
		n === "word" && (o.return_token_timestamps = !0, o.return_timestamps = !0);
		let s = !Array.isArray(e), c = s ? [e] : e, l = this.processor.feature_extractor.config, u = l.chunk_length / this.model.config.max_source_positions, d = l.hop_length, f = l.sampling_rate, p = await Kk(c, f), m = [];
		for (let e of p) {
			let t = [];
			if (r > 0) {
				if (a === null) a = r / 6;
				else if (r <= a) throw Error("`chunk_length_s` must be larger than `stride_length_s`.");
				let n = f * r, i = f * a, o = n - 2 * i, s = 0;
				for (;;) {
					let r = s + n, a = e.subarray(s, r), c = await this.processor(a), l = s === 0, u = r >= e.length;
					if (t.push({
						stride: [
							a.length,
							l ? 0 : i,
							u ? 0 : i
						],
						input_features: c.input_features,
						is_last: u
					}), u) break;
					s += o;
				}
			} else t = [{
				stride: [
					e.length,
					0,
					0
				],
				input_features: (await this.processor(e)).input_features,
				is_last: !0
			}];
			for (let e of t) {
				o.num_frames = Math.floor(e.stride[0] / d);
				let t = await this.model.generate({
					inputs: e.input_features,
					...o
				});
				if (n === "word") {
					let n = t.sequences.tolist()[0], r = t.token_timestamps.tolist()[0], i = this.tokenizer.timestamp_begin, a = Math.max(n.findIndex((e) => Number(e) >= i), 0);
					e.tokens = n.slice(a), e.token_timestamps = r.slice(a).map((e) => Hc(e, 2));
				} else e.tokens = t[0].tolist();
				e.stride = e.stride.map((e) => e / f);
			}
			let [s, c] = this.tokenizer._decode_asr(t, {
				time_precision: u,
				return_timestamps: n,
				force_full_sequences: i
			});
			m.push({
				text: s,
				...c
			});
		}
		return s ? m[0] : m;
	}
	async _call_moonshine(e, t) {
		let n = !Array.isArray(e), r = n ? [e] : e, i = this.processor.feature_extractor.config.sampling_rate, a = await Kk(r, i), o = [];
		for (let e of a) {
			let n = await this.processor(e), r = Math.floor(e.length / i) * 6, a = await this.model.generate({
				max_new_tokens: r,
				...t,
				...n
			}), s = this.tokenizer.batch_decode(a, { skip_special_tokens: !0 })[0];
			o.push({ text: s });
		}
		return n ? o[0] : o;
	}
	async _call_cohere_asr(e, t) {
		let n = !Array.isArray(e), r = n ? [e] : e, i = this.processor.feature_extractor, a = i.config.sampling_rate, o = await Kk(r, a), s = t.language ?? "en", c = this.processor.get_decoder_prompt_ids(s), l = [];
		for (let e of o) {
			let n = i.split_audio(e), r = [];
			for (let e of n) {
				let n = await this.processor(e), i = await this.model.generate({
					...n,
					decoder_input_ids: c,
					...t
				}), a = this.tokenizer.decode(i[0].tolist(), { skip_special_tokens: !0 }).trim();
				r.push(a);
			}
			let a = this.processor.constructor.join_chunks(r, s);
			l.push({ text: a });
		}
		return n ? l[0] : l;
	}
}, uA = class extends Jk {
	DEFAULT_VOCODER_ID = "Xenova/speecht5_hifigan";
	constructor(e) {
		super(e), this.vocoder = e.vocoder ?? null;
	}
	async _prepare_speaker_embeddings(e, t) {
		if ((typeof e == "string" || e instanceof URL) && (e = new Float32Array(await (await k.fetch(e)).arrayBuffer())), e instanceof Float32Array) e = new V("float32", e, [e.length]);
		else if (!(e instanceof V)) throw Error("Speaker embeddings must be a `Tensor`, `Float32Array`, `string`, or `URL`.");
		if (t > 1) {
			if (e.dims[0] === 1) e = e.repeat(t, 1);
			else if (e.dims[0] !== t) throw Error(`Expected speaker embeddings batch size to be 1 or ${t}, but got ${e.dims[0]}.`);
		}
		return e;
	}
	_postprocess_waveform(e, t, n, r = null) {
		let i = t.data, [a, o] = t.dims, s = r ? r.data : null, c = [];
		for (let e = 0; e < a; ++e) {
			let t = s ? Math.min(Math.ceil(s[e]), o) : o, r = e * o;
			c.push(new Ld(i.slice(r, r + t), n));
		}
		return Array.isArray(e) ? c : c[0];
	}
	async _call(e, t) {
		return this.processor ? this._call_text_to_spectrogram(e, t) : this.model.config.model_type === "supertonic" ? this._call_supertonic(e, t) : this._call_text_to_waveform(e);
	}
	async _call_supertonic(e, { speaker_embeddings: t, num_inference_steps: n, speed: r }) {
		if (!t) throw Error("Speaker embeddings must be provided for Supertonic models.");
		let { sampling_rate: i, style_dim: a } = this.model.config, o = this.tokenizer(e, {
			padding: !0,
			truncation: !0
		}), s = o.input_ids.dims[0];
		t = await this._prepare_speaker_embeddings(t, s), t = t.view(s, -1, a);
		let { waveform: c, durations: l } = await this.model.generate_speech({
			...o,
			style: t,
			num_inference_steps: n,
			speed: r
		});
		return this._postprocess_waveform(e, c, i, l);
	}
	async _call_text_to_waveform(e) {
		let t = this.tokenizer(e, {
			padding: !0,
			truncation: !0
		}), { waveform: n } = await this.model(t), r = this.model.config.sampling_rate;
		return this._postprocess_waveform(e, n, r);
	}
	async _call_text_to_spectrogram(e, { speaker_embeddings: t }) {
		this.vocoder ||= (A.info("No vocoder specified, using default HifiGan vocoder."), await Sk.from_pretrained(this.DEFAULT_VOCODER_ID, { dtype: "fp32" }));
		let { input_ids: n } = this.tokenizer(e, {
			padding: !0,
			truncation: !0
		}), r = n.dims[0];
		t = await this._prepare_speaker_embeddings(t, r), t = t.view(r, -1);
		let { waveform: i } = await this.model.generate_speech(n, t, { vocoder: this.vocoder }), a = this.processor.feature_extractor.config.sampling_rate;
		return this._postprocess_waveform(e, i, a);
	}
}, dA = class extends Jk {
	async _call(e, t = {}) {
		let n = Array.isArray(e), r = await Gk(e), { pixel_values: i } = await this.processor(r), a = [];
		for (let e of i) {
			e.dims = [1, ...e.dims];
			let n = await this.model.generate({
				inputs: e,
				...t
			}), r = this.tokenizer.batch_decode(n, { skip_special_tokens: !0 }).map((e) => ({ generated_text: e.trim() }));
			a.push(r);
		}
		return n ? a : a[0];
	}
}, fA = class extends Jk {
	async _call(e, { top_k: t = 5 } = {}) {
		let n = await Gk(e), { pixel_values: r } = await this.processor(n), i = await this.model({ pixel_values: r }), { id2label: a } = this.model.config, o = [];
		for (let e of i.logits) {
			let n = await jl(new V("float32", Nc(e.data), e.dims), t), r = n[0].tolist(), i = n[1].tolist().map((e, t) => ({
				label: a ? a[e] : `LABEL_${e}`,
				score: r[t]
			}));
			o.push(i);
		}
		return Array.isArray(e) ? o : o[0];
	}
}, pA = {
	panoptic: "post_process_panoptic_segmentation",
	instance: "post_process_instance_segmentation",
	semantic: "post_process_semantic_segmentation"
}, mA = class extends Jk {
	async _call(e, { threshold: t = .5, mask_threshold: n = .5, overlap_mask_area_threshold: r = .8, label_ids_to_fuse: i = null, target_sizes: a = null, subtask: o = null } = {}) {
		if (Array.isArray(e) && e.length !== 1) throw Error("Image segmentation pipeline currently only supports a batch size of 1.");
		let s = await Gk(e), c = s.map((e) => [e.height, e.width]), l = await this.processor(s), { inputNames: u, outputNames: d } = this.model.sessions.model;
		if (!u.includes("pixel_values")) {
			if (u.length !== 1) throw Error(`Expected a single input name, but got ${u.length} inputs: ${u}.`);
			let e = u[0];
			if (e in l) throw Error(`Input name ${e} already exists in the inputs.`);
			l[e] = l.pixel_values;
		}
		let f = await this.model(l), p = null;
		if (o !== null) p = pA[o];
		else if (this.processor.image_processor) {
			for (let [e, t] of Object.entries(pA)) if (t in this.processor.image_processor) {
				p = this.processor.image_processor[t].bind(this.processor.image_processor), o = e;
				break;
			}
		}
		let m = this.model.config.id2label, h = [];
		if (!o) {
			let e = f[d[0]];
			for (let t = 0; t < c.length; ++t) {
				let n = c[t], r = e[t];
				r.data.some((e) => e < -1e-5 || e > 1.00001) && r.sigmoid_();
				let i = await hf.fromTensor(r.mul_(255).to("uint8")).resize(n[1], n[0]);
				h.push({
					label: null,
					score: null,
					mask: i
				});
			}
		} else if (o === "panoptic" || o === "instance") {
			let e = p(f, t, n, r, i, a ?? c)[0], o = e.segmentation;
			for (let t of e.segments_info) {
				let e = new Uint8ClampedArray(o.data.length);
				for (let n = 0; n < o.data.length; ++n) o.data[n] === t.id && (e[n] = 255);
				let n = new hf(e, o.dims[1], o.dims[0], 1);
				h.push({
					score: t.score,
					label: m[t.label_id],
					mask: n
				});
			}
		} else if (o === "semantic") {
			let { segmentation: e, labels: t } = p(f, a ?? c)[0];
			for (let n of t) {
				let t = new Uint8ClampedArray(e.data.length);
				for (let r = 0; r < e.data.length; ++r) e.data[r] === n && (t[r] = 255);
				let r = new hf(t, e.dims[1], e.dims[0], 1);
				h.push({
					score: null,
					label: m[n],
					mask: r
				});
			}
		} else throw Error(`Subtask ${o} not supported.`);
		return h;
	}
}, hA = Object.freeze({
	"text-classification": {
		pipeline: Yk,
		model: Ck,
		default: { model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english" },
		type: "text"
	},
	"token-classification": {
		pipeline: Xk,
		model: wk,
		default: { model: "Xenova/bert-base-multilingual-cased-ner-hrl" },
		type: "text"
	},
	"question-answering": {
		pipeline: $k,
		model: jk,
		default: { model: "Xenova/distilbert-base-cased-distilled-squad" },
		type: "text"
	},
	"fill-mask": {
		pipeline: eA,
		model: Ak,
		default: {
			model: "onnx-community/ettin-encoder-32m-ONNX",
			dtype: "fp32"
		},
		type: "text"
	},
	summarization: {
		pipeline: nA,
		model: Tk,
		default: { model: "Xenova/distilbart-cnn-6-6" },
		type: "text"
	},
	translation: {
		pipeline: rA,
		model: Tk,
		default: { model: "Xenova/t5-small" },
		type: "text"
	},
	"text2text-generation": {
		pipeline: tA,
		model: Tk,
		default: { model: "Xenova/flan-t5-small" },
		type: "text"
	},
	"text-generation": {
		pipeline: aA,
		model: kk,
		default: {
			model: "onnx-community/Qwen3-0.6B-ONNX",
			dtype: "q4"
		},
		type: "text"
	},
	"zero-shot-classification": {
		pipeline: oA,
		model: Ck,
		default: { model: "Xenova/distilbert-base-uncased-mnli" },
		type: "text"
	},
	"audio-classification": {
		pipeline: sA,
		model: Bk,
		default: { model: "Xenova/wav2vec2-base-superb-ks" },
		type: "audio"
	},
	"zero-shot-audio-classification": {
		pipeline: cA,
		model: Sk,
		default: { model: "Xenova/clap-htsat-unfused" },
		type: "multimodal"
	},
	"automatic-speech-recognition": {
		pipeline: lA,
		model: [Ek, zk],
		default: { model: "Xenova/whisper-tiny.en" },
		type: "multimodal"
	},
	"text-to-audio": {
		pipeline: uA,
		model: [Ok, Dk],
		default: {
			model: "onnx-community/Supertonic-TTS-ONNX",
			dtype: "fp32"
		},
		type: "text"
	},
	"image-to-text": {
		pipeline: dA,
		model: Mk,
		default: { model: "Xenova/vit-gpt2-image-captioning" },
		type: "multimodal"
	},
	"image-classification": {
		pipeline: fA,
		model: Nk,
		default: { model: "Xenova/vit-base-patch16-224" },
		type: "multimodal"
	},
	"image-segmentation": {
		pipeline: mA,
		model: [
			Pk,
			Fk,
			Ik
		],
		default: { model: "Xenova/detr-resnet-50-panoptic" },
		type: "multimodal"
	},
	"background-removal": {
		pipeline: class extends mA {
			async _call(e, t = {}) {
				let n = await Gk(e), r = await super._call(e, t), i = n.map((e, t) => {
					let n = e.clone();
					return n.putAlpha(r[t].mask), n;
				});
				return Array.isArray(e) ? i : i[0];
			}
		},
		model: [
			Pk,
			Fk,
			Ik
		],
		default: { model: "Xenova/modnet" },
		type: "image"
	},
	"zero-shot-image-classification": {
		pipeline: class extends Jk {
			async _call(e, t, { hypothesis_template: n = "This is a photo of {}" } = {}) {
				let r = Array.isArray(e), i = await Gk(e), a = t.map((e) => n.replace("{}", e)), o = this.tokenizer(a, {
					padding: this.model.config.model_type !== "siglip" || "max_length",
					truncation: !0
				}), { pixel_values: s } = await this.processor(i), c = await this.model({
					...o,
					pixel_values: s
				}), l = this.model.config.model_type === "siglip" ? (e) => e.sigmoid().data : (e) => Nc(e.data), u = [];
				for (let e of c.logits_per_image) {
					let n = [...l(e)].map((e, n) => ({
						score: e,
						label: t[n]
					}));
					n.sort((e, t) => t.score - e.score), u.push(n);
				}
				return r ? u : u[0];
			}
		},
		model: Sk,
		default: { model: "Xenova/clip-vit-base-patch32" },
		type: "multimodal"
	},
	"object-detection": {
		pipeline: class extends Jk {
			async _call(e, { threshold: t = .9, percentage: n = !1 } = {}) {
				let r = Array.isArray(e);
				if (r && e.length !== 1) throw Error("Object detection pipeline currently only supports a batch size of 1.");
				let i = await Gk(e), a = n ? null : i.map((e) => [e.height, e.width]), { pixel_values: o, pixel_mask: s } = await this.processor(i), c = await this.model({
					pixel_values: o,
					pixel_mask: s
				}), l = this.processor.image_processor.post_process_object_detection(c, t, a), { id2label: u } = this.model.config, d = l.map((e) => e.boxes.map((t, r) => ({
					score: e.scores[r],
					label: u[e.classes[r]],
					box: qk(t, !n)
				})));
				return r ? d : d[0];
			}
		},
		model: Lk,
		default: { model: "Xenova/detr-resnet-50" },
		type: "multimodal"
	},
	"zero-shot-object-detection": {
		pipeline: class extends Jk {
			async _call(e, t, { threshold: n = .1, top_k: r = null, percentage: i = !1 } = {}) {
				let a = Array.isArray(e), o = await Gk(e), s = this.tokenizer(t, {
					padding: !0,
					truncation: !0
				}), c = await this.processor(o), l = [];
				for (let e = 0; e < o.length; ++e) {
					let a = o[e], u = i ? null : [[a.height, a.width]], d = c.pixel_values[e].unsqueeze_(0), f = await this.model({
						...s,
						pixel_values: d
					}), p;
					if ("post_process_grounded_object_detection" in this.processor) {
						let e = this.processor.post_process_grounded_object_detection(f, s.input_ids, {
							box_threshold: n,
							text_threshold: n,
							target_sizes: u
						})[0];
						p = e.boxes.map((t, n) => ({
							score: e.scores[n],
							label: e.labels[n],
							box: qk(t, !i)
						}));
					} else {
						let e = this.processor.image_processor.post_process_object_detection(f, n, u, !0)[0];
						p = e.boxes.map((n, r) => ({
							score: e.scores[r],
							label: t[e.classes[r]],
							box: qk(n, !i)
						}));
					}
					p.sort((e, t) => t.score - e.score), r !== null && (p = p.slice(0, r)), l.push(p);
				}
				return a ? l : l[0];
			}
		},
		model: Rk,
		default: { model: "Xenova/owlvit-base-patch32" },
		type: "multimodal"
	},
	"document-question-answering": {
		pipeline: class extends Jk {
			_default_generation_config = { max_new_tokens: 256 };
			async _call(e, t, n = {}) {
				if (Array.isArray(e)) {
					if (e.length !== 1) throw Error("Document Question Answering pipeline currently only supports a batch size of 1.");
					e = e[0];
				}
				let r = (await Gk(e))[0], { pixel_values: i } = await this.processor(r), a = `<s_docvqa><s_question>${t}</s_question><s_answer>`, o = this.tokenizer(a, {
					add_special_tokens: !1,
					padding: !0,
					truncation: !0
				}).input_ids, s = await this.model.generate({
					inputs: i,
					max_length: this.model.config.decoder.max_position_embeddings,
					decoder_input_ids: o,
					...this._default_generation_config,
					...n
				}), c = this.tokenizer.batch_decode(s)[0].match(/<s_answer>(.*?)<\/s_answer>/), l = null;
				return c && c.length >= 2 && (l = c[1].trim()), [{ answer: l }];
			}
		},
		model: Vk,
		default: { model: "Xenova/donut-base-finetuned-docvqa" },
		type: "multimodal"
	},
	"image-to-image": {
		pipeline: class extends Jk {
			async _call(e) {
				let t = await Gk(e), n = await this.processor(t), r = await this.model(n), i = [];
				for (let e of r.reconstruction) {
					let t = e.squeeze().clamp_(0, 1).mul_(255).round_().to("uint8");
					i.push(hf.fromTensor(t));
				}
				return Array.isArray(e) ? i : i[0];
			}
		},
		model: Hk,
		default: { model: "Xenova/swin2SR-classical-sr-x2-64" },
		type: "image"
	},
	"depth-estimation": {
		pipeline: class extends Jk {
			async _call(e) {
				let t = await Gk(e), n = await this.processor(t), { predicted_depth: r } = await this.model(n), i = [];
				for (let e = 0; e < t.length; ++e) {
					let n = r[e], [a, o] = n.dims.slice(-2), [s, c] = t[e].size, l = (await kl(n.view(1, 1, a, o), {
						size: [c, s],
						mode: "bilinear"
					})).view(c, s), u = l.min().item(), d = l.max().item(), f = l.sub(u).div_(d - u).mul_(255).to("uint8").unsqueeze(0), p = hf.fromTensor(f);
					i.push({
						predicted_depth: l,
						depth: p
					});
				}
				return Array.isArray(e) ? i : i[0];
			}
		},
		model: Uk,
		default: { model: "onnx-community/depth-anything-v2-small" },
		type: "image"
	},
	"feature-extraction": {
		pipeline: class extends Jk {
			async _call(e, { pooling: t = "none", normalize: n = !1, quantize: r = !1, precision: i = "binary" } = {}) {
				let a = this.tokenizer(e, {
					padding: !0,
					truncation: !0
				}), o = await this.model(a), s = o.last_hidden_state ?? o.logits ?? o.token_embeddings;
				switch (t) {
					case "none": break;
					case "mean":
						s = Pl(s, a.attention_mask);
						break;
					case "first_token":
					case "cls":
						s = s.slice(null, 0);
						break;
					case "last_token":
					case "eos":
						s = s.slice(null, -1);
						break;
					default: throw Error(`Pooling method '${t}' not supported.`);
				}
				return n && (s = s.normalize(2, -1)), r && (s = Zl(s, i)), s;
			}
		},
		model: Sk,
		default: {
			model: "onnx-community/all-MiniLM-L6-v2-ONNX",
			dtype: "fp32"
		},
		type: "text"
	},
	"image-feature-extraction": {
		pipeline: class extends Jk {
			async _call(e, { pool: t = null } = {}) {
				let n = await Gk(e), { pixel_values: r } = await this.processor(n), i = await this.model({ pixel_values: r }), a;
				if (t) {
					if (!("pooler_output" in i)) throw Error("No pooled output was returned. Make sure the model has a 'pooler' layer when using the 'pool' option.");
					a = i.pooler_output;
				} else a = i.last_hidden_state ?? i.logits ?? i.image_embeds;
				return a;
			}
		},
		model: [Wk, Sk],
		default: {
			model: "onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX",
			dtype: "fp32"
		},
		type: "image"
	}
}), gA = Object.freeze({
	"sentiment-analysis": "text-classification",
	ner: "token-classification",
	asr: "automatic-speech-recognition",
	"text-to-speech": "text-to-audio",
	embeddings: "feature-extraction"
});
async function _A(e) {
	if (!e) throw Error("modelId is required");
	return (await yc(e, cd, {})).exists ? [cd] : [];
}
async function vA(e, { config: t = null, dtype: n = null, device: r = null, model_file_name: i = null, include_tokenizer: a = !0, include_processor: o = !0 } = {}) {
	let s = await Gh(e, {
		config: t,
		dtype: n,
		device: r,
		model_file_name: i
	});
	if (a) {
		let t = await Ql(e);
		s.push(...t);
	}
	if (o) {
		let t = await _A(e);
		s.push(...t);
	}
	return s;
}
async function yA(e, t, n = {}) {
	e = gA[e] ?? e;
	let r = hA[e];
	if (!r) throw Error(`Unsupported pipeline task: ${e}. Must be one of [${Object.keys(hA).join(", ")}]`);
	let { type: i } = r, a = i !== "audio" && i !== "image", o = i !== "text", s = await vA(t, {
		...n,
		include_tokenizer: a,
		include_processor: o
	});
	if (e === "text-generation") {
		let e = Vh(Uh(await Wh(t, n)));
		if (e) {
			let t = Object.values(e).map((e) => `onnx/${e}`);
			return s.filter((e) => !e.startsWith("onnx/") || t.some((t) => e.startsWith(t)));
		}
	}
	return s;
}
async function bA(e, t = null, { progress_callback: n = null, config: r = null, cache_dir: i = null, local_files_only: a = !1, revision: o = "main", device: s = null, dtype: c = null, subfolder: l = "onnx", use_external_data_format: u = null, model_file_name: d = null, session_options: f = {} } = {}) {
	e = gA[e] ?? e;
	let p = hA[e.split("_", 1)[0]];
	if (!p) throw Error(`Unsupported pipeline: ${e}. Must be one of [${Object.keys(hA)}]`);
	t || (t = p.default.model, A.info(`No model specified. Using default model: "${t}".`), !c && p.default.dtype && (c = p.default.dtype));
	let m = await yA(e, t, {
		device: s,
		dtype: c
	}), h = {};
	if (n) try {
		(await Promise.all(m.map(async (e) => yc(t, e)))).forEach((e, t) => {
			e.exists && (h[m[t]] = {
				loaded: 0,
				total: e.size ?? 0
			});
		});
	} catch (e) {
		A.warn(`Unable to fetch model file metadata for total progress tracking: ${e}`);
	}
	let g = {
		progress_callback: n ? new Or(n, h) : void 0,
		config: r,
		cache_dir: i,
		local_files_only: a,
		revision: o,
		device: s,
		dtype: c,
		subfolder: l,
		use_external_data_format: u,
		model_file_name: d,
		session_options: f
	}, _ = m.includes("tokenizer.json"), v = m.includes("preprocessor_config.json"), y = p.model, b;
	if (Array.isArray(y)) {
		let n = r ?? await Qm.from_pretrained(t, g), { model_type: i } = n, a = y.find((e) => e.supports(i));
		if (!a) throw Error(`Unsupported model type "${i}" for task "${e}". None of the candidate model classes support this type.`);
		b = a.from_pretrained(t, {
			...g,
			config: n
		});
	} else b = y.from_pretrained(t, g);
	let [x, S, C] = await Promise.all([
		_ ? W.from_pretrained(t, g) : null,
		v ? Km.from_pretrained(t, g) : null,
		b
	]), ee = {
		task: e,
		model: C
	};
	x && (ee.tokenizer = x), S && (ee.processor = S), Dr(n, {
		status: "ready",
		task: e,
		model: t
	});
	let w = p.pipeline;
	return new w(ee);
}
O.IS_PROCESS_AVAILABLE, Object.keys(Cl);
//#endregion
export { k as env, bA as pipeline };
