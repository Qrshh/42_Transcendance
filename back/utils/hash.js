const { randomBytes, pbkdf2Sync } = require('crypto')

const ITERATIONS = 100_000
const KEY_LENGTH = 64
const DIGEST = 'sha512'

function hashPassword(password) {
	const salt = randomBytes(16).toString('hex')
	const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
	return { salt, hash }
}

function verifyPassword(password, salt, expectedHash) {
	const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
	return hash === expectedHash
}

module.exports = {
	hashPassword,
	verifyPassword
}
