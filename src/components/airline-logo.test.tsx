// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AirlineLogo, type AirlineLogoProps } from "./airline-logo";

let container: HTMLDivElement;
let root: Root;

async function renderLogo(props: AirlineLogoProps) {
  await act(async () => { root.render(<AirlineLogo {...props} />); });
}

async function fail(image: HTMLImageElement) {
  await act(async () => { image.dispatchEvent(new Event("error")); });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.unstubAllGlobals();
});

describe("AirlineLogo image failures", () => {
  it("hides a broken partner asset but recovers when the same component changes airline", async () => {
    await renderLogo({ flightnum: "5X104" });
    expect(container.querySelectorAll("img")).toHaveLength(1);
    const partner = container.querySelector("img")!;
    expect(partner.getAttribute("src")).toBe("https://www.gstatic.com/flights/airline_logos/70px/5X.png");
    await fail(partner);
    expect(container.querySelector("img")).toBeNull();

    // Editing just the flight digits keeps the same failed logo source hidden.
    await renderLogo({ flightnum: "5X999" });
    expect(container.querySelector("img")).toBeNull();

    await renderLogo({ flightnum: "CZ3101", alt: "Current airline" });
    const logos = [...container.querySelectorAll("img")];
    expect(logos.map(image => image.getAttribute("src"))).toEqual([
      "/airlines/china-southern.svg", "/airlines/china-southern-white.svg",
    ]);
    expect(logos.every(image => image.alt === "Current airline")).toBe(true);
  });

  it("recovers when a livery change replaces a failed local light/dark source pair", async () => {
    await renderLogo({ liveryname: "China Southern" });
    const dark = container.querySelector<HTMLImageElement>(".brand-logo-dark")!;
    await fail(dark);
    expect(container.querySelector("img")).toBeNull();

    await renderLogo({ liveryname: "Xiamen Airlines" });
    expect(container.querySelector(".brand-logo-light")?.getAttribute("src")).toBe("/airlines/xiamenair.svg");
    expect(container.querySelector(".brand-logo-dark")?.getAttribute("src")).toBe("/airlines/xiamenair-white.svg");
  });

  it("does not let a late error from a replaced image hide the current source", async () => {
    await renderLogo({ flightnum: "5X104" });
    const previous = container.querySelector("img")!;
    await renderLogo({ flightnum: "MF801" });
    await fail(previous);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/airlines/xiamenair.svg");
  });
});
