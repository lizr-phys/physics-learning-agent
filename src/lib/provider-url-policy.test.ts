import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isDisallowedNetworkAddress,
  validateProviderBaseUrl,
} from "@/lib/provider-url-policy";

const originalPrivateEndpointSetting = process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS;

afterEach(() => {
  vi.unstubAllEnvs();
  process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS = originalPrivateEndpointSetting;
});

describe("provider URL policy", () => {
  it("recognizes private, loopback, link-local, and metadata addresses", () => {
    expect(isDisallowedNetworkAddress("127.0.0.1")).toBe(true);
    expect(isDisallowedNetworkAddress("10.0.0.8")).toBe(true);
    expect(isDisallowedNetworkAddress("172.20.1.1")).toBe(true);
    expect(isDisallowedNetworkAddress("192.168.1.5")).toBe(true);
    expect(isDisallowedNetworkAddress("169.254.169.254")).toBe(true);
    expect(isDisallowedNetworkAddress("::1")).toBe(true);
    expect(isDisallowedNetworkAddress("[::1]")).toBe(true);
    expect(isDisallowedNetworkAddress("fd00::12")).toBe(true);
    expect(isDisallowedNetworkAddress("8.8.8.8")).toBe(false);
    expect(isDisallowedNetworkAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("requires a public HTTPS endpoint in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS;

    expect(() => validateProviderBaseUrl("https://api.openai.com/v1")).not.toThrow();
    expect(() => validateProviderBaseUrl("http://api.example.com/v1")).toThrow(/HTTPS/);
    expect(() => validateProviderBaseUrl("https://127.0.0.1/v1")).toThrow(/Private or local/);
    expect(() => validateProviderBaseUrl("https://[::1]/v1")).toThrow(/Private or local/);
    expect(() => validateProviderBaseUrl("https://metadata.google.internal/v1")).toThrow(
      /Private or local/,
    );
  });

  it("allows explicitly configured private endpoints", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS = "true";

    expect(() => validateProviderBaseUrl("http://192.168.1.20:11434/v1")).not.toThrow();
  });
});
