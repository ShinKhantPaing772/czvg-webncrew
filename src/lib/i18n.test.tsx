// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectPreferredLocale,
  I18nProvider,
  LanguageSwitcher,
  LOCALE_STORAGE_KEY,
  translateTextToZh,
  useI18n,
} from "./i18n";

function SampleConsumer() {
  const { locale, t } = useI18n();
  return (
    <div>
      <span id="current-locale">{locale}</span>
      <span id="translated-title">
        {t("Live aircraft scheduling", "实时机队排班")}
      </span>
      <LanguageSwitcher />
    </div>
  );
}

describe("i18n multi-language support & auto-detection", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("auto-detects Chinese and English from browser language preferences", () => {
    expect(detectPreferredLocale(["zh-CN", "en-US"], null)).toBe("zh");
    expect(detectPreferredLocale("zh-TW", null)).toBe("zh");
    expect(detectPreferredLocale(["en-GB", "zh-CN"], null)).toBe("en");
    expect(detectPreferredLocale(["fr-FR"], null)).toBe("en");
  });

  it("prioritizes user-saved locale over browser language", () => {
    expect(detectPreferredLocale(["zh-CN"], "en")).toBe("en");
    expect(detectPreferredLocale(["en-US"], "zh")).toBe("zh");
  });

  it("translates static phrases and dynamic aviation patterns to Chinese", () => {
    expect(translateTextToZh("Live aircraft scheduling")).toBe("实时机队排班中心");
    expect(translateTextToZh("IFVARB Approved Virtual Airline")).toBe(
      "IFVARB 官方认证虚拟航空公司",
    );
    expect(translateTextToZh("About CZVG")).toBe("关于虚拟南航");
    expect(translateTextToZh("Main hubs")).toBe("核心主枢纽");
    expect(translateTextToZh("Fleet overview")).toBe("机队总览");
    expect(translateTextToZh("Applicant Portal")).toBe("招飞中心");
    expect(translateTextToZh("PIREP Management")).toBe("飞行报告签派审核");
    expect(translateTextToZh("Find routes")).toBe("查找航线");
    expect(translateTextToZh("Dep ICAO")).toBe("起飞 ICAO");
    expect(translateTextToZh("DEP ICAO")).toBe("起飞 ICAO");
    expect(translateTextToZh("Arr ICAO")).toBe("到达 ICAO");
    expect(translateTextToZh("ARR ICAO")).toBe("到达 ICAO");
    expect(
      translateTextToZh(
        "Search active commercial and partner routes, filter by aircraft or duration, and dispatch a PIREP.",
      ),
    ).toBe("检索活跃的商业与伙伴航线，按机型或航程筛选并签派申报。");
    expect(translateTextToZh("Submit PIREP")).toBe("提交飞行报告");
    expect(translateTextToZh("Latest 8 sectors")).toBe("最近 8 个航段");
    expect(translateTextToZh("3/5 aircraft unlocked for your rank")).toBe(
      "当前职级已解锁 3/5 架机型",
    );
  });

  it("toggles between English and Chinese and persists choice in localStorage", async () => {
    await act(async () => {
      root.render(
        <I18nProvider>
          <SampleConsumer />
        </I18nProvider>,
      );
    });

    expect(container.querySelector("#current-locale")?.textContent).toBe("en");
    expect(container.querySelector("#translated-title")?.textContent).toBe(
      "Live aircraft scheduling",
    );

    const switcher = container.querySelector("button")!;
    await act(async () => {
      switcher.click();
    });

    expect(container.querySelector("#current-locale")?.textContent).toBe("zh");
    expect(container.querySelector("#translated-title")?.textContent).toBe(
      "实时机队排班",
    );
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh");

    await act(async () => {
      switcher.click();
    });

    expect(container.querySelector("#current-locale")?.textContent).toBe("en");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
  });
});
