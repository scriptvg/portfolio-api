import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("vitest can run a test", () => {
    expect(1 + 1).toBe(2);
  });

  it("typescript types are available", () => {
    const value: string = "ok";
    expect(value).toBe("ok");
  });
});
