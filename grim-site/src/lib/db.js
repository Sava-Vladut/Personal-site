import initSqlJs from 'sql.js'
// Vite resolves this to a served URL for the WASM binary that backs sql.js.
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

// The whole SQLite database lives in the browser. We export its bytes after any
// write and stash them (base64) in localStorage so accounts survive reloads —
// no server required. This is a lightweight, self-contained auth store, not a
// hardened backend: passwords are salted + SHA-256 hashed, but anyone with the
// device can read the encoded DB.
const DB_KEY = 'grim.auth.sqlite'

let dbPromise = null

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const makeSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

function loadBytes() {
  const stored = localStorage.getItem(DB_KEY)
  if (!stored) return null
  try {
    const binary = atob(stored)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function persist(db) {
  const bytes = db.export()
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  localStorage.setItem(DB_KEY, btoa(binary))
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      const bytes = loadBytes()
      const db = bytes ? new SQL.Database(bytes) : new SQL.Database()
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          salt          TEXT NOT NULL,
          is_admin      INTEGER NOT NULL DEFAULT 0,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      persist(db)
      return db
    })()
  }
  return dbPromise
}

function readOne(db, sql, params) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    return stmt.step() ? stmt.getAsObject() : null
  } finally {
    stmt.free()
  }
}

const toAccount = (row) => ({
  username: row.username,
  isAdmin: Boolean(row.is_admin),
})

export async function createUser({ username, password, isAdmin = false }) {
  const db = await getDb()
  if (readOne(db, 'SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', [username])) {
    throw new Error('That username is already taken.')
  }
  const salt = makeSalt()
  const passwordHash = await hashPassword(password, salt)
  db.run('INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)', [
    username,
    passwordHash,
    salt,
    isAdmin ? 1 : 0,
  ])
  persist(db)
  return { username, isAdmin: Boolean(isAdmin) }
}

export async function verifyUser({ username, password }) {
  const db = await getDb()
  const row = readOne(
    db,
    'SELECT username, password_hash, salt, is_admin FROM users WHERE username = ? COLLATE NOCASE',
    [username],
  )
  if (!row) throw new Error('No account matches that username.')
  const passwordHash = await hashPassword(password, row.salt)
  if (passwordHash !== row.password_hash) throw new Error('Incorrect password.')
  return toAccount(row)
}

export async function countUsers() {
  const db = await getDb()
  const row = readOne(db, 'SELECT COUNT(*) AS total FROM users', [])
  return row?.total ?? 0
}
