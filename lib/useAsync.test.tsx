import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsync } from "./useAsync";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useAsync", () => {
  it("a slow earlier response never overwrites a newer one", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fn = vi.fn((q: string) => (q === "a" ? first.promise : second.promise));
    const { result, rerender } = renderHook(({ q }) => useAsync(() => fn(q), [q]), { initialProps: { q: "a" } });
    rerender({ q: "b" });
    second.resolve("B");
    await waitFor(() => expect(result.current.data).toBe("B"));
    first.resolve("A");
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.data).toBe("B");
    expect(result.current.loading).toBe(false);
  });

  it("does not fetch while disabled, and surfaces errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const { result, rerender } = renderHook(({ enabled }) => useAsync(fn, [], { enabled }), { initialProps: { enabled: false } });
    expect(fn).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    rerender({ enabled: true });
    await waitFor(() => expect((result.current.error as Error).message).toBe("boom"));
    expect(result.current.data).toBeNull();
  });
});
