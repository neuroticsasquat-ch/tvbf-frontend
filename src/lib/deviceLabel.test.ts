import { describe, expect, it } from "vitest";
import { deviceLabel } from "./deviceLabel";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:130.0) Gecko/20100101 Firefox/130.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  linuxOpera:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
};

describe("deviceLabel", () => {
  it.each([
    [UA.iphoneSafari, "iPhone · Safari"],
    [UA.iphoneChrome, "iPhone · Chrome"],
    [UA.windowsChrome, "Windows · Chrome"],
    [UA.windowsEdge, "Windows · Edge"],
    [UA.macSafari, "Mac · Safari"],
    [UA.macFirefox, "Mac · Firefox"],
    [UA.androidChrome, "Android · Chrome"],
    [UA.androidSamsung, "Android · Samsung Internet"],
    [UA.linuxFirefox, "Linux · Firefox"],
    [UA.linuxOpera, "Linux · Opera"],
  ])("labels %s as %s", (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });

  it("keeps whichever half it recognises", () => {
    expect(deviceLabel("SomeBot/1.0 (Windows NT 10.0)")).toBe("Windows");
    expect(deviceLabel("Firefox/130.0")).toBe("Firefox");
  });

  it.each([null, undefined, "", "curl/8.4.0"])("falls back to Unknown device for %s", (ua) => {
    expect(deviceLabel(ua)).toBe("Unknown device");
  });
});
