const CREDENTIAL_PATTERNS = [
	/\b(sk|key|ak|api[_-]?key)[_-][\w-]{20,}\b/gi,
	/Bearer\s+[\w\-.~+/]+=*/gi,
	/\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
	/\bAKIA[A-Z0-9]{16}\b/g,
	/password\s*[:=]\s*\S+/gi,
	/[\w.+-]+@[\w-]+\.[\w.]+:[\S]+/g,
	/\bgh[ps]_[A-Za-z0-9_]{36,}\b/g,
	/\bnpm_[A-Za-z0-9]{36,}\b/g,
	/\bxox[bpas]-[\w-]{10,}\b/g,
	/\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/g,
	/\bsk-ant-[\w-]{20,}\b/g,
	/-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
	/\b(postgres|mysql|mongodb(\+srv)?|redis):\/\/[^\s]+/gi,
	/\btoken\s*[:=]\s*[\w\-.~+/]{20,}/gi,
];

export function scrubCredentials(text: string): string {
	let result = text;
	for (const pattern of CREDENTIAL_PATTERNS) {
		result = result.replace(pattern, "[REDACTED]");
	}
	return result;
}
