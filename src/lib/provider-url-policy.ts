import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.azure.internal",
  "instance-data.ec2.internal",
]);

function parseIpv4(address: string) {
  const octets = address.split(".").map(Number);

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }

  return octets;
}

export function isDisallowedNetworkAddress(address: string) {
  const normalized = address
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split("%")[0];
  const ipv4 = parseIpv4(normalized.replace(/^::ffff:/, ""));

  if (ipv4) {
    const [a, b, c] = ipv4;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (isIP(normalized) !== 6) {
    return false;
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");

  return (
    blockedHostnames.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

export function validateProviderBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Base URL must use http or https.");
  }

  if (url.username || url.password) {
    throw new Error("Credentials are not allowed in the Base URL.");
  }

  if (isBlockedHostname(hostname) || isDisallowedNetworkAddress(hostname)) {
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname);

    if (!localDevelopment && process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS !== "true") {
      throw new Error("Private or local network model endpoints are not allowed by this server.");
    }
  }

  if (
    url.protocol === "http:" &&
    process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS !== "true" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname)
    )
  ) {
    throw new Error("Custom provider Base URLs must use HTTPS.");
  }

  return url;
}

export async function assertSafeProviderBaseUrl(baseUrl: string) {
  const url = validateProviderBaseUrl(baseUrl);
  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();

  if (process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS === "true") {
    return;
  }

  const localDevelopment =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(hostname);

  if (localDevelopment) {
    return;
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some((entry) => isDisallowedNetworkAddress(entry.address))) {
    throw new Error("The model endpoint resolves to a private or reserved network address.");
  }
}
