const SHADES = '.,-~:;=!*#$@'
const WIDTH = 44
const HEIGHT = 22
const K2 = 4.5
const K1Y = 24
const K1X = 40
const TILT = -0.35
const LIGHT = [0, 0.71, -0.71]

// each point: [x, y, z, nx, ny, nz, albedo?]
const project = (points, angle) => {
  const chars = new Array(WIDTH * HEIGHT).fill(' ')
  const zbuf = new Float32Array(WIDTH * HEIGHT)
  const cA = Math.cos(angle)
  const sA = Math.sin(angle)
  const cT = Math.cos(TILT)
  const sT = Math.sin(TILT)

  for (const point of points) {
    const [x, y, z, nx, ny, nz] = point
    const x1 = x * cA + z * sA
    const z1 = z * cA - x * sA
    const y2 = y * cT - z1 * sT
    const z2 = y * sT + z1 * cT + K2
    const ooz = 1 / z2
    const px = Math.round(WIDTH / 2 + K1X * ooz * x1)
    const py = Math.round(HEIGHT / 2 + 2 - K1Y * ooz * y2)
    if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) continue
    const idx = py * WIDTH + px
    if (ooz <= zbuf[idx]) continue
    zbuf[idx] = ooz

    const nx1 = nx * cA + nz * sA
    const nz1 = nz * cA - nx * sA
    const ny2 = ny * cT - nz1 * sT
    const nz2 = ny * sT + nz1 * cT
    const lum =
      (nx1 * LIGHT[0] + ny2 * LIGHT[1] + nz2 * LIGHT[2]) * (point[6] ?? 1)
    const shade = Math.max(0, Math.min(SHADES.length - 1, Math.floor((lum * 0.5 + 0.5) * SHADES.length)))
    chars[idx] = SHADES[shade]
  }

  return chars
}

const stringify = (chars) => {
  const rows = []
  for (let row = 0; row < HEIGHT; row += 1) {
    rows.push(chars.slice(row * WIDTH, (row + 1) * WIDTH).join(''))
  }
  return rows.join('\n')
}

const buildMug = () => {
  const points = []

  // outer wall
  for (let i = 0; i < 70; i += 1) {
    const theta = (i / 70) * Math.PI * 2
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    for (let j = 0; j <= 16; j += 1) {
      const y = -0.8 + (j / 16) * 1.5
      points.push([c, y, s, c, 0, s])
    }
  }

  // bottom
  for (let i = 0; i < 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2
    for (let j = 1; j <= 7; j += 1) {
      const r = j / 7
      points.push([r * Math.cos(theta), -0.8, r * Math.sin(theta), 0, -1, 0])
    }
  }

  // coffee surface just below the rim
  for (let i = 0; i < 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2
    for (let j = 0; j <= 6; j += 1) {
      const r = (j / 6) * 0.92
      points.push([r * Math.cos(theta), 0.55, r * Math.sin(theta), 0, 1, 0])
    }
  }

  // handle: partial torus in the x/y plane, attached to the wall
  const ringR = 0.55
  const tubeR = 0.14
  for (let i = 0; i <= 40; i += 1) {
    const alpha = -Math.PI / 2 + (i / 40) * Math.PI
    const dx = Math.cos(alpha)
    const dy = Math.sin(alpha)
    for (let j = 0; j < 14; j += 1) {
      const beta = (j / 14) * Math.PI * 2
      const cb = Math.cos(beta)
      const sb = Math.sin(beta)
      points.push([
        1.08 + (ringR + tubeR * cb) * dx,
        -0.05 + (ringR + tubeR * cb) * dy,
        tubeR * sb,
        cb * dx,
        cb * dy,
        sb,
      ])
    }
  }

  return points
}

const buildLaptop = () => {
  const points = []

  // base slab
  for (let i = 0; i <= 42; i += 1) {
    const x = -1.1 + (i / 42) * 2.2
    for (let j = 0; j <= 26; j += 1) {
      const z = -0.75 + (j / 26) * 1.5
      points.push([x, -0.41, z, 0, 1, 0])
      points.push([x, -0.55, z, 0, -1, 0])
    }
  }
  for (let i = 0; i <= 42; i += 1) {
    const x = -1.1 + (i / 42) * 2.2
    for (let j = 0; j < 3; j += 1) {
      const y = -0.55 + (j / 2) * 0.14
      points.push([x, y, 0.75, 0, 0, 1])
      points.push([x, y, -0.75, 0, 0, -1])
    }
  }
  for (let i = 0; i <= 26; i += 1) {
    const z = -0.75 + (i / 26) * 1.5
    for (let j = 0; j < 3; j += 1) {
      const y = -0.55 + (j / 2) * 0.14
      points.push([1.1, y, z, 1, 0, 0])
      points.push([-1.1, y, z, -1, 0, 0])
    }
  }

  // screen leaning back ~20 degrees, hinged at the back edge of the base
  const dv = [0, 0.94, -0.34]
  const nf = [0, 0.34, 0.94]
  for (let i = 0; i <= 42; i += 1) {
    const x = -1.1 + (i / 42) * 2.2
    for (let j = 0; j <= 26; j += 1) {
      const v = (j / 26) * 1.3
      const py = -0.41 + v * dv[1]
      const pz = -0.75 + v * dv[2]
      // glowing front panel, slightly inset bezel via higher albedo in the middle
      const inner = Math.abs(x) < 0.95 && v > 0.12 && v < 1.18 ? 1.25 : 0.9
      points.push([x + 0.03 * nf[0], py + 0.03 * nf[1], pz + 0.03 * nf[2], nf[0], nf[1], nf[2], inner])
      points.push([x - 0.03 * nf[0], py - 0.03 * nf[1], pz - 0.03 * nf[2], -nf[0], -nf[1], -nf[2]])
    }
  }

  return points.map(([x, y, z, ...rest]) => [x * 0.95, (y - 0.18) * 0.95, z * 0.95, ...rest])
}

const buildBrain = () => {
  const points = []

  // cerebrum: ellipsoid with winding gyri ridges and a longitudinal fissure
  const rx = 1.0
  const ry = 0.85
  const rz = 1.2
  for (let i = 0; i <= 52; i += 1) {
    const theta = (i / 52) * 2.3 // polar angle from the top; open underneath
    const st = Math.sin(theta)
    const ct = Math.cos(theta)
    for (let j = 0; j < 76; j += 1) {
      const phi = (j / 76) * Math.PI * 2
      const x0 = rx * st * Math.cos(phi)
      const y0 = ry * ct
      const z0 = rz * st * Math.sin(phi)

      // longitudinal fissure between the hemispheres
      if (Math.abs(x0) < 0.09 && y0 > -0.2) continue

      // gyri: wavy bands that wind around the surface instead of a checker pattern
      const fold = Math.sin(8 * phi + 2.2 * Math.sin(3 * theta) + 2 * theta)
      const bump = 1 + 0.07 * fold
      const albedo = 0.78 + 0.5 * fold

      let nx = x0 / (rx * rx)
      let ny = y0 / (ry * ry)
      let nz = z0 / (rz * rz)
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len

      points.push([x0 * bump, y0 * bump, z0 * bump, nx, ny, nz, albedo])
    }
  }

  // cerebellum: smaller lobe tucked under the back, with fine horizontal folia
  const cx = 0
  const cy = -0.52
  const cz = -0.72
  const ax = 0.6
  const ay = 0.36
  const az = 0.48
  for (let i = 0; i <= 22; i += 1) {
    const theta = (i / 22) * Math.PI
    const st = Math.sin(theta)
    const ct = Math.cos(theta)
    for (let j = 0; j < 44; j += 1) {
      const phi = (j / 44) * Math.PI * 2
      const x0 = ax * st * Math.cos(phi)
      const y0 = ay * ct
      const z0 = az * st * Math.sin(phi)
      const albedo = 0.7 + 0.45 * Math.sin(15 * theta)

      let nx = x0 / (ax * ax)
      let ny = y0 / (ay * ay)
      let nz = z0 / (az * az)
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len

      points.push([cx + x0, cy + y0, cz + z0, nx, ny, nz, albedo])
    }
  }

  // brainstem: short cylinder angling down from beneath the middle
  for (let i = 0; i < 28; i += 1) {
    const phi = (i / 28) * Math.PI * 2
    const c = Math.cos(phi)
    const s = Math.sin(phi)
    for (let j = 0; j <= 8; j += 1) {
      const t = j / 8
      points.push([0.17 * c, -0.5 - t * 0.42, -0.25 - t * 0.18, c, 0, s, 0.85])
    }
  }

  return points
}

const buildGlobe = () => {
  const points = []

  for (let i = 0; i <= 38; i += 1) {
    const theta = (i / 38) * Math.PI
    const st = Math.sin(theta)
    const ct = Math.cos(theta)

    for (let j = 0; j < 72; j += 1) {
      const phi = (j / 72) * Math.PI * 2
      const x = st * Math.cos(phi)
      const y = ct
      const z = st * Math.sin(phi)
      const terrain =
        Math.sin(phi * 3 + theta * 2.4) +
        0.55 * Math.sin(phi * 7 - theta * 4.2) +
        0.35 * Math.cos(phi * 11 + theta)
      const albedo = terrain > 0.45 ? 1.3 : 0.68

      points.push([x, y, z, x, y, z, albedo])
    }
  }

  return points
}

const MUG = buildMug()
const LAPTOP = buildLaptop()
const BRAIN = buildBrain()
const GLOBE = buildGlobe()

export function renderMug(angle, time) {
  const chars = project(MUG, angle)

  // steam rising above the rim
  for (let s = 0; s < 3; s += 1) {
    const sway = Math.sin(time * 0.0016 + s * 1.9)
    const px = Math.round(WIDTH / 2 + sway * (1.5 + s))
    const py = 2 - s + Math.round(Math.sin(time * 0.001 + s) * 0.5) + 1
    if (py >= 0 && py < HEIGHT && chars[py * WIDTH + px] === ' ') {
      chars[py * WIDTH + px] = sway > 0 ? ')' : '('
    }
  }

  return stringify(chars)
}

export function renderLaptop(angle) {
  return stringify(project(LAPTOP, angle))
}

export function renderBrain(angle) {
  return stringify(project(BRAIN, angle))
}

export function renderGlobe(angle) {
  return stringify(project(GLOBE, angle))
}
