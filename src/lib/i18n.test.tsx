// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDomTranslation,
  detectPreferredLocale,
  I18nProvider,
  LanguageSwitcher,
  LOCALE_STORAGE_KEY,
  translateTextToEn,
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

describe("rank names in both languages", () => {
  it("translates Chinese rank names for the English UI", () => {
    expect(translateTextToEn("机长教员")).toBe("Captain Instructor");
    expect(translateTextToEn("Next: 资深机长教员")).toBe(
      "Next: SR Captain Instructor",
    );
    expect(
      translateTextToEn(
        "China Southern 001VG · 机长教员 · 580:47 remaining to 资深机长教员",
      ),
    ).toBe(
      "China Southern 001VG · Captain Instructor · 580:47 remaining to SR Captain Instructor",
    );
  });

  // The agreed name of each rank in both languages, lowest first.
  const RANK_NAMES: Array<[string, string]> = [
    ["飞行学员", "Trainee"],
    ["见习第二副驾驶", "Trainee Second Officer"],
    ["第二副驾驶", "Second Officer"],
    ["副机长", "First Officer"],
    ["资深副机长", "Senior First Officer"],
    ["机长", "Captain"],
    ["资深机长", "SR Captain"],
    ["机队机长", "Fleet Captain"],
    ["机长教员", "Captain Instructor"],
    ["资深机长教员", "SR Captain Instructor"],
  ];

  it.each(RANK_NAMES)("shows %s as %s in the English UI", (chinese, english) => {
    expect(translateTextToEn(chinese)).toBe(english);
    expect(translateTextToEn(`Next: ${chinese}`)).toBe(`Next: ${english}`);
  });

  it.each(RANK_NAMES)("shows %s for %s in the Chinese UI", (chinese, english) => {
    expect(translateTextToZh(english)).toBe(chinese);
    expect(translateTextToZh(`001VG ${english}`)).toBe(`001VG ${chinese}`);
  });

  it.each([
    ["见习二副", "Trainee Second Officer"],
    ["二副驾驶", "Second Officer"],
    ["第一副驾驶", "First Officer"],
    ["资深副驾驶", "Senior First Officer"],
    ["高级副驾驶", "Senior First Officer"],
    ["责任机长", "Captain"],
    ["机队总机长", "Fleet Captain"],
  ])("still shows the older name %s as %s", (chinese, english) => {
    expect(translateTextToEn(chinese)).toBe(english);
  });

  it("gives the other English spellings the same Chinese name", () => {
    expect(translateTextToZh("SR First Officer")).toBe("资深副机长");
    expect(translateTextToZh("Senior Captain")).toBe("资深机长");
  });

  it("only translates whole rank titles", () => {
    expect(translateTextToEn("见习第一副驾驶")).toBe("见习第一副驾驶");
    expect(translateTextToEn("机长室")).toBe("机长室");
    expect(translateTextToEn("机长教员、资深机长教员")).toBe(
      "Captain Instructor、SR Captain Instructor",
    );
  });

  it("leaves English text and other Chinese text alone", () => {
    expect(translateTextToEn("Total flight time")).toBe("Total flight time");
    expect(translateTextToEn("飞行数据与分析")).toBe("飞行数据与分析");
  });

  it("translates the instructor ranks to Chinese as whole titles", () => {
    expect(translateTextToZh("Captain Instructor")).toBe("机长教员");
    expect(translateTextToZh("SR Captain Instructor")).toBe("资深机长教员");
    expect(translateTextToZh("Senior Captain Instructor")).toBe("资深机长教员");
  });

  it("switches rank names on the page in both directions", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>机长教员</p><p>Captain</p>";
    const [chineseRank, englishRank] = Array.from(root.children);

    applyDomTranslation(root, "en");
    expect(chineseRank.textContent).toBe("Captain Instructor");
    expect(englishRank.textContent).toBe("Captain");

    applyDomTranslation(root, "zh");
    expect(chineseRank.textContent).toBe("机长教员");
    expect(englishRank.textContent).toBe("机长");

    applyDomTranslation(root, "en");
    expect(chineseRank.textContent).toBe("Captain Instructor");
    expect(englishRank.textContent).toBe("Captain");
  });
});
