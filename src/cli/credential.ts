/**
 * Credential Manager — AES-256-GCM encrypted credential storage.
 *
 * File format is identical to the Python CLI for cross-SDK interoperability:
 * [4B magic "HZ2C"][16B salt][12B nonce][ciphertext + 16B auth tag]
 *
 * Key derivation: PBKDF2-SHA256, 100000 iterations, from machine fingerprint.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// File format constants
const MAGIC = Buffer.from('HZ2C', 'ascii')
const SALT_SIZE = 16
const NONCE_SIZE = 12
const PBKDF2_ITERATIONS = 100_000
const KEY_SIZE = 32 // AES-256
const AUTH_TAG_SIZE = 16

const DEFAULT_DIR = path.join(os.homedir(), '.hezor2')
const DEFAULT_FILE = path.join(DEFAULT_DIR, 'credentials')

export interface ProfileData {
  host: string
  base_url: string
  api_key: string
  session_id: string
  user_id: string
  user_name: string
  display_name: string
  app_name: string | null
  logged_in_at: string | null
  expires_at: string | null
}

interface CredentialStore {
  version: number
  profiles: Record<string, ProfileData>
  active_profile: string
}

export class CredentialManager {
  private readonly filePath: string

  constructor(credentialsPath?: string) {
    this.filePath = credentialsPath ?? DEFAULT_FILE
  }

  private deriveKey(salt: Buffer): Buffer {
    // Machine fingerprint: hostname + OS username + "hezor2-cli"
    const fingerprint = `${os.hostname()}:${os.userInfo().username}:hezor2-cli`
    return crypto.pbkdf2Sync(fingerprint, salt, PBKDF2_ITERATIONS, KEY_SIZE, 'sha256')
  }

  private encrypt(plaintext: Buffer): Buffer {
    const salt = crypto.randomBytes(SALT_SIZE)
    const nonce = crypto.randomBytes(NONCE_SIZE)
    const key = this.deriveKey(salt)

    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([MAGIC, salt, nonce, encrypted, authTag])
  }

  private decrypt(data: Buffer): Buffer {
    const minLen = MAGIC.length + SALT_SIZE + NONCE_SIZE + AUTH_TAG_SIZE
    if (data.length < minLen) {
      throw new Error('Invalid credentials file: too short')
    }

    if (!data.subarray(0, 4).equals(MAGIC)) {
      throw new Error('Invalid credentials file: bad magic bytes')
    }

    let offset = MAGIC.length
    const salt = data.subarray(offset, offset + SALT_SIZE)
    offset += SALT_SIZE
    const nonce = data.subarray(offset, offset + NONCE_SIZE)
    offset += NONCE_SIZE
    const ciphertextWithTag = data.subarray(offset)

    // Auth tag is last 16 bytes
    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - AUTH_TAG_SIZE)
    const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - AUTH_TAG_SIZE)

    const key = this.deriveKey(salt)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  private readStore(): CredentialStore {
    if (!fs.existsSync(this.filePath)) {
      return { version: 1, profiles: {}, active_profile: 'default' }
    }

    const encrypted = fs.readFileSync(this.filePath)
    const plaintext = this.decrypt(encrypted)
    return JSON.parse(plaintext.toString('utf-8')) as CredentialStore
  }

  private writeStore(store: CredentialStore): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const plaintext = Buffer.from(JSON.stringify(store, null, 2), 'utf-8')
    const encrypted = this.encrypt(plaintext)
    fs.writeFileSync(this.filePath, encrypted, { mode: 0o600 })
  }

  saveProfile(profileName: string, data: ProfileData): void {
    const store = this.readStore()
    store.profiles[profileName] = data
    store.active_profile = profileName
    this.writeStore(store)
  }

  loadProfile(profileName?: string): ProfileData | null {
    const store = this.readStore()
    const name = profileName ?? store.active_profile ?? 'default'
    return store.profiles[name] ?? null
  }

  deleteProfile(profileName: string): boolean {
    const store = this.readStore()
    if (!(profileName in store.profiles)) return false

    delete store.profiles[profileName]
    if (store.active_profile === profileName) {
      const remaining = Object.keys(store.profiles)
      store.active_profile = remaining[0] ?? 'default'
    }
    this.writeStore(store)
    return true
  }

  listProfiles(): string[] {
    const store = this.readStore()
    return Object.keys(store.profiles)
  }

  getActiveProfileName(): string {
    const store = this.readStore()
    return store.active_profile ?? 'default'
  }

  hasCredentials(): boolean {
    return fs.existsSync(this.filePath)
  }
}
