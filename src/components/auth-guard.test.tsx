// @vitest-environment jsdom

import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  token: "token-a" as string | null,
  pathname: "/crew/pireps/new",
  router: { push: vi.fn() },
  mounted: vi.fn(),
  unmounted: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => session.router,
  usePathname: () => session.pathname,
}));
vi.mock("@/lib/utils/auth", () => ({ getToken: () => session.token }));

import { AuthGuard } from "./auth-guard";

type PendingVerification = {
  token: string;
  signal: AbortSignal | null | undefined;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

let container: HTMLDivElement;
let root: Root | null;
let pending: PendingVerification[];

function DraftForm() {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    session.mounted();
    return () => { session.unmounted(); };
  }, []);
  return (
    <form>
      <input aria-label="Flight notes" value={draft}
        onInput={(event) => setDraft(event.currentTarget.value)} />
      <output>{draft}</output>
    </form>
  );
}

function input() { return container.querySelector("input"); }

async function renderGuard() {
  await act(async () => { root!.render(<AuthGuard><DraftForm /></AuthGuard>); });
}

async function respond(index: number, status = 200, userStatus = 1, permissions: string[] = []) {
  await act(async () => {
    pending[index].resolve(Response.json(
      status === 200
        ? { status: userStatus, Permissions: permissions.map((name) => ({ name })) }
        : { error: "Verification failed" },
      { status },
    ));
  });
}

async function focus() {
  await act(async () => { window.dispatchEvent(new Event("focus")); });
}

async function enterDraft() {
  const field = input()!;
  expect(field).not.toBeNull();
  await act(async () => {
    field.value = "Unsubmitted flight notes";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelector("output")?.textContent).toBe("Unsubmitted flight notes");
  return field;
}

async function verifiedDraft() {
  await renderGuard();
  await respond(0);
  return enterDraft();
}

function expectDraftPreserved(field: HTMLInputElement) {
  expect(input()).toBe(field);
  expect(field.value).toBe("Unsubmitted flight notes");
  expect(container.querySelector("output")?.textContent).toBe("Unsubmitted flight notes");
  expect(session.mounted).toHaveBeenCalledTimes(1);
  expect(session.unmounted).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain("Loading...");
}

beforeEach(() => {
  session.token = "token-a";
  session.pathname = "/crew/pireps/new";
  session.router.push.mockClear();
  session.mounted.mockClear();
  session.unmounted.mockClear();
  pending = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Deliberately allow resolution after abort to exercise the stale-response
  // guard as well as cancellation; a response can already be queued at abort.
  vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
    pending.push({ token: JSON.parse(String(options.body)).token,
      signal: options.signal, resolve, reject });
  })));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    root = null;
    for (const request of pending) request.reject(new DOMException("Aborted", "AbortError"));
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("AuthGuard session revalidation", () => {
  it("shows initial loading until the session has been verified", async () => {
    await renderGuard();
    expect(container.textContent).toContain("Loading...");
    expect(input()).toBeNull();
    expect(session.mounted).not.toHaveBeenCalled();
    expect(pending).toHaveLength(1);
    expect(pending[0].token).toBe("token-a");
    await respond(0);
    expect(input()).not.toBeNull();
    expect(session.mounted).toHaveBeenCalledTimes(1);
    expect(session.router.push).not.toHaveBeenCalled();
  });

  it("preserves the same draft and DOM node during focus verification and deduplicates repeated focus", async () => {
    const field = await verifiedDraft();
    await focus();
    expectDraftPreserved(field);
    await focus();
    await focus();
    expect(pending).toHaveLength(2);
    expectDraftPreserved(field);
    await respond(1);
    expectDraftPreserved(field);
    expect(session.router.push).not.toHaveBeenCalled();
  });

  it.each([401, 404])("redirects a previously verified session when verification returns %s", async (status) => {
    await verifiedDraft();
    await focus();
    await respond(1, status);
    expect(session.router.push).toHaveBeenCalledWith("/crew");
  });

  it("applies an applicant status returned by a successful background check", async () => {
    await verifiedDraft();
    await focus();
    await respond(1, 200, 0);
    expect(session.router.push).toHaveBeenCalledWith("/crew/application");
    expect(input()).toBeNull();
  });

  it("applies revoked admin permissions returned by a successful background check", async () => {
    session.pathname = "/crew/admin/users";
    await renderGuard();
    await respond(0, 200, 1, ["admin"]);
    expect(session.router.push).not.toHaveBeenCalled();
    await focus();
    await respond(1, 200, 1, []);
    expect(session.router.push).toHaveBeenCalledWith("/crew/home");
  });

  it("preserves the login form through focus events when there is no token", async () => {
    session.token = null;
    session.pathname = "/crew";
    await renderGuard();
    const field = await enterDraft();
    await focus();
    await focus();
    expect(pending).toHaveLength(0);
    expectDraftPreserved(field);
    expect(session.router.push).not.toHaveBeenCalled();
  });

  it.each(["network", "server"] as const)("keeps the verified draft when background verification has a %s failure", async (failure) => {
    const field = await verifiedDraft();
    await focus();
    if (failure === "network") {
      await act(async () => { pending[1].reject(new Error("Temporarily offline")); });
    } else {
      await respond(1, 503);
    }
    expectDraftPreserved(field);
    expect(session.router.push).not.toHaveBeenCalled();
    await focus();
    expect(pending).toHaveLength(3);
    await respond(2);
    expectDraftPreserved(field);
  });

  it("does not trust an unverified session when the initial check has a server failure", async () => {
    await renderGuard();
    await respond(0, 503);
    expect(session.router.push).toHaveBeenCalledWith("/crew");
  });

  it("detects a changed token on focus and ignores success from the superseded check", async () => {
    await verifiedDraft();
    await focus();
    session.token = "token-b";
    await focus();
    expect(pending).toHaveLength(3);
    expect(pending[1].signal?.aborted).toBe(true);
    expect(pending[2].token).toBe("token-b");
    expect(input()).toBeNull();
    await respond(1);
    expect(input()).toBeNull();
    expect(container.textContent).toContain("Loading...");
    await respond(2);
    expect(input()?.value).toBe("");
    expect(session.mounted).toHaveBeenCalledTimes(2);
    expect(session.router.push).not.toHaveBeenCalled();
  });

  it("rechecks a token replaced during initial verification even without another focus event", async () => {
    await renderGuard();
    session.token = "token-b";
    await respond(0, 200, 0);
    expect(pending).toHaveLength(2);
    expect(pending[1].token).toBe("token-b");
    expect(input()).toBeNull();
    expect(container.textContent).toContain("Loading...");
    expect(session.router.push).not.toHaveBeenCalled();
    await respond(1);
    expect(input()).not.toBeNull();
    expect(session.mounted).toHaveBeenCalledTimes(1);
    expect(session.router.push).not.toHaveBeenCalled();
  });

  it("detects token removal on focus and ignores a late response from the signed-out account", async () => {
    await verifiedDraft();
    await focus();
    session.token = null;
    await focus();
    expect(pending).toHaveLength(2);
    expect(pending[1].signal?.aborted).toBe(true);
    expect(session.router.push).toHaveBeenCalledWith("/crew");
    // A late applicant response would redirect to /crew/application if accepted.
    await respond(1, 200, 0);
    expect(session.router.push.mock.calls.every(([path]) => path === "/crew")).toBe(true);
  });

  it("aborts pending verification on unmount and ignores its eventual response", async () => {
    await renderGuard();
    await act(async () => { root!.unmount(); root = null; });
    expect(pending[0].signal?.aborted).toBe(true);
    await respond(0, 200, 0);
    expect(session.router.push).not.toHaveBeenCalled();
    expect(session.mounted).not.toHaveBeenCalled();
  });
});
