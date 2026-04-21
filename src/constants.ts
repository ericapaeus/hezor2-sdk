/** Request header keys and anonymous keys for JWT signing. */

export const REQ_HEADER_META_INFO_KEY = 'X-META-INFO'
export const REQ_HEADER_APP_NAME_KEY = 'X-APP-NAME'

/** MetaInfo extras key for authorized toolkit IDs */
export const META_EXTRAS_KEY_AUTHORIZED_TOOLKITS = 'authorized_toolkits'

/**
 * MetaInfo extras key for authorized knowledge base IDs in the current session.
 *
 * DANGER: When this field is empty or absent, downstream workflows treat it as
 * "full KB access" (compat shim during the multi-KB migration). This will be
 * tightened to "empty = no access" in the future; callers should not rely on
 * the "unset = all" behavior.
 */
export const META_EXTRAS_KEY_AUTHORIZED_KB_IDS = 'authorized_kb_ids'

export const ANONYMOUS_HEADER_PRIVATE_KEY = `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIGjMF8GCSqGSIb3DQEFDTBSMDEGCSqGSIb3DQEFDDAkBBApd1A1zS2kYA2PacTL
ga12AgIIADAMBggqhkiG9w0CCQUAMB0GCWCGSAFlAwQBKgQQLqgqVXR/1YxTjbJ6
wleoyARAf2ENSGpjGhuZ1b1j4Y7YvRyzDNC5Nw5FQfVSll9BkyBP5fYv0+zRuUqu
XE1mIsWI/vEuRcDP/U/EG46uOfaDKg==
-----END ENCRYPTED PRIVATE KEY-----`

export const ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD = 'file_password'

export const ANONYMOUS_HEADER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEArzeACVckM68Jf83BVPzX4ZNWFkyAvbsOwadn/lg7l0c=
-----END PUBLIC KEY-----`
