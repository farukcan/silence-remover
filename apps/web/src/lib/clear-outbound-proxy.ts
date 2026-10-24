// Bun's fetch follows HTTP_PROXY / HTTPS_PROXY / ALL_PROXY. Node's fetch does not.
// A closed proxy port refuses every URL, including http://api.:8080, with
// ECONNREFUSED. The Go API is on the Docker network and must be reached directly.
// Dynamic process.env access stays runtime; Next inlines literal process.env.KEY.
const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
] as const;

export function clearOutboundProxyEnv(): void {
  for (const key of PROXY_ENV_KEYS) {
    delete process.env[key];
  }
}

clearOutboundProxyEnv();
