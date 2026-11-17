// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  setToken: vi.fn(),
  router: { push: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/utils/auth", () => ({ setToken: mocks.setToken }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (en: string) => en }) }));

import { SignupForm } from "./signup-form";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/auth/ifc/")) {
      return Response.json({ result: [{ userId: "if-pilot-id" }] });
    }
    if (url === "/api/auth") {
      return Response.json({ token: "new-token", redirectTo: "/crew/application" });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function checkbox() {
  return container.querySelector<HTMLButtonElement>('[role="checkbox"]')!;
}

function applyButton() {
  return container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
}

async function fillForm() {
  await act(async () => {
    const values = {
      name: "Test Pilot",
      email: "pilot@example.com",
      ifc: "TestPilot",
      password: "test-password-123",
      passwordConfirm: "test-password-123",
    };
    for (const [id, value] of Object.entries(values)) {
      const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

async function toggleEligibility() {
  await act(async () => checkbox().click());
}

async function waitForLookup() {
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
}

async function submitForm() {
  // Exercise the form handler as well as the disabled submit button, so the
  // eligibility rule also covers submissions that bypass native validation.
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("SignupForm age eligibility", () => {
  it("requires the 13/14 confirmation before checking IFC without collecting birth date or nationality", async () => {
    await act(async () => root.render(<SignupForm />));

    expect(container.querySelector('label[for="age-eligible"]')?.textContent).toBe(
      "I am at least 13 years old, or at least 14 if I am located in mainland China.",
    );
    expect(checkbox().getAttribute("aria-checked")).toBe("false");
    expect(checkbox().getAttribute("aria-required")).toBe("true");
    expect(applyButton().disabled).toBe(true);
    const fieldLabels = Array.from(container.querySelectorAll("label"), label => label.textContent).join(" ");
    expect(fieldLabels).not.toMatch(/date of birth|birthdate|nationality|citizenship/i);
    expect(container.querySelector('input[type="date"], input[autocomplete^="bday"]')).toBeNull();

    await fillForm();
    await waitForLookup();
    await submitForm();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Confirm that you are at least 13 years old, or at least 14 if you are located in mainland China.",
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("checks IFC after confirmation and submits only the required signup details with ageEligible true", async () => {
    await act(async () => root.render(<SignupForm />));
    await fillForm();
    await toggleEligibility();
    expect(checkbox().getAttribute("aria-checked")).toBe("true");
    expect(mocks.fetch).not.toHaveBeenCalled();

    await waitForLookup();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/auth/ifc/TestPilot", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(applyButton().disabled).toBe(false);
    await act(async () => applyButton().click());

    const signupRequest = mocks.fetch.mock.calls.find(([url]) => url === "/api/auth");
    expect(signupRequest?.[1]?.method).toBe("POST");
    expect(JSON.parse(signupRequest![1].body)).toEqual({
      action: "signup",
      email: "pilot@example.com",
      password: "test-password-123",
      name: "Test Pilot",
      ifc: "TestPilot",
      ageEligible: true,
    });
    expect(mocks.setToken).toHaveBeenCalledWith("new-token");
    expect(mocks.router.push).toHaveBeenCalledWith("/crew/application");
  });

  it("blocks again after unchecking and requires a fresh IFC check when reconfirmed", async () => {
    await act(async () => root.render(<SignupForm />));
    await fillForm();
    await toggleEligibility();
    await waitForLookup();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    await toggleEligibility();
    expect(applyButton().disabled).toBe(true);
    await waitForLookup();
    await submitForm();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    await toggleEligibility();
    await submitForm();
    expect(container.textContent).toContain("IFC username entered is not valid");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await waitForLookup();
    await submitForm();
    expect(mocks.fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/ifc/TestPilot", "/api/auth/ifc/TestPilot", "/api/auth",
    ]);
  });

  it("aborts an in-flight check when unchecked and ignores a late successful response", async () => {
    let resolveLookup!: (response: Response) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveLookup = resolve; }));
    await act(async () => root.render(<SignupForm />));
    await fillForm();
    await toggleEligibility();
    await waitForLookup();
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    await toggleEligibility();
    expect(signal.aborted).toBe(true);
    expect(applyButton().disabled).toBe(true);
    await act(async () => resolveLookup(Response.json({ result: [{ userId: "if-pilot-id" }] })));

    await toggleEligibility();
    await submitForm();
    expect(container.textContent).toContain("IFC username entered is not valid");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.setToken).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});
