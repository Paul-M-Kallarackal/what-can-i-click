import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAtlasStore } from "../../store/useAtlasStore";
import { AboutPanel } from "./AboutPanel";
import { AccessibleWorld } from "./AccessibleWorld";
import { Inspector } from "./Inspector";

const interactiveSelector = "button, a[href], input, select, textarea, summary, [tabindex]";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("closed overlay panels", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useAtlasStore.getState().reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderPanel(Component: ComponentType) {
    act(() => root.render(createElement(Component)));
  }

  function panel(label: string) {
    const element = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    expect(element).not.toBeNull();
    return element!;
  }

  function expectClosed(element: HTMLElement, interactiveCount: number) {
    const controls = [...element.querySelectorAll<HTMLElement>(interactiveSelector)];
    expect(element.getAttribute("aria-hidden")).toBe("true");
    expect(element.hasAttribute("inert")).toBe(true);
    expect(controls).toHaveLength(interactiveCount);
    expect(controls.every((control) => control.closest("[inert]") === element)).toBe(true);
  }

  function expectOpen(element: HTMLElement) {
    const controls = [...element.querySelectorAll<HTMLElement>(interactiveSelector)];
    expect(element.getAttribute("aria-hidden")).toBe("false");
    expect(element.hasAttribute("inert")).toBe(false);
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((control) => control.closest("[inert]") === null)).toBe(true);
  }

  it("keeps the inspector controls inert until content opens it", () => {
    renderPanel(Inspector);
    const element = panel("ClickHouse mechanism inspector");

    expectClosed(element, 2);

    act(() => useAtlasStore.getState().selectMechanism("mergetree.part-anatomy"));
    expectOpen(element);

    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Close inspector"]')!.click());
    expectClosed(element, 2);
  });

  it("keeps all 70 world choices and its close button inert while closed", () => {
    renderPanel(AccessibleWorld);
    const element = panel("World in words");

    expectClosed(element, 71);

    act(() => useAtlasStore.getState().setWorldInWordsOpen(true));
    expectOpen(element);

    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Close world in words"]')!.click());
    expectClosed(element, 71);
  });

  it("keeps the about links and close button inert while closed", () => {
    renderPanel(AboutPanel);
    const element = panel("About What can I Click");

    expectClosed(element, 3);

    act(() => useAtlasStore.getState().setAboutOpen(true));
    expectOpen(element);

    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Close about panel"]')!.click());
    expectClosed(element, 3);
  });
});
