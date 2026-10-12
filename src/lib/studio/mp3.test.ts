import { describe, expect, it } from "vitest";
import { joinMp3, readFrameHeader, readMp3, startTimes } from "./mp3";

// One frame: 4 header bytes, the rest zeros (silence is not needed here,
// only the structure matters).
function frame(b1: number, b2: number, length: number): number[] {
  return [0xff, b1, b2, 0xc4, ...new Array(length - 4).fill(0)];
}

// The format of OpenAI's speech API (seen in the step 6a listening test):
// FF F3 C4 = MPEG-2 Layer III, 128 kbit/s, 24 kHz → 384 bytes, 24 ms.
const openAiFrame = () => frame(0xf3, 0xc4, 384);

function mp3(frameCount: number): Uint8Array {
  return new Uint8Array(Array.from({ length: frameCount }, openAiFrame).flat());
}

describe("readFrameHeader", () => {
  it("reads the OpenAI format: MPEG-2, 128 kbit/s, 24 kHz", () => {
    expect(readFrameHeader(mp3(1), 0)).toEqual({ length: 384, samples: 576, sampleRate: 24000 });
  });

  it("reads MPEG-1: 128 kbit/s, 44.1 kHz, with and without padding", () => {
    // FB = MPEG-1 Layer III. 90 = index 9 (128 kbit/s), 44.1 kHz. 92 = with padding.
    const bytes = new Uint8Array([...frame(0xfb, 0x90, 417), ...frame(0xfb, 0x92, 418)]);
    expect(readFrameHeader(bytes, 0)).toEqual({ length: 417, samples: 1152, sampleRate: 44100 });
    expect(readFrameHeader(bytes, 417)?.length).toBe(418);
  });

  it("rejects bytes without sync and other layers", () => {
    expect(readFrameHeader(new Uint8Array([0x49, 0x44, 0x33, 0x04]), 0)).toBeNull();
    // F5 = MPEG-2 Layer II
    expect(readFrameHeader(new Uint8Array([0xff, 0xf5, 0xc4, 0xc4]), 0)).toBeNull();
  });
});

describe("readMp3", () => {
  it("adds up the duration of all frames: 10 × 24 ms", () => {
    const { seconds, frames } = readMp3(mp3(10));
    expect(seconds).toBeCloseTo(0.24, 10);
    expect(frames.length).toBe(3840);
  });

  it("matches the listening test: 367 frames are 8.808 s (afinfo said the same)", () => {
    expect(readMp3(mp3(367)).seconds).toBeCloseTo(8.808, 10);
  });

  it("skips an ID3v2 tag at the start", () => {
    // "ID3", version 4.0, no flags, size 20 → 30 bytes tag.
    const tag = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0x41)];
    const { frames, seconds } = readMp3(new Uint8Array([...tag, ...mp3(2)]));
    expect(frames.length).toBe(768);
    expect(seconds).toBeCloseTo(0.048, 10);
  });

  it("ignores an ID3v1 tag at the end", () => {
    const tag = [0x54, 0x41, 0x47, ...new Array(125).fill(0)];
    expect(readMp3(new Uint8Array([...mp3(2), ...tag])).frames.length).toBe(768);
  });

  it("skips an Info frame at the start (ElevenLabs), but keeps normal frames", () => {
    // MPEG-1, 128 kbit/s, 44.1 kHz, mono (C4): side info is 17 bytes, so
    // "Info" sits at byte 4 + 17 = 21 of the first frame.
    const info = frame(0xfb, 0x90, 417);
    info.splice(21, 4, 0x49, 0x6e, 0x66, 0x6f);
    const audio = [...frame(0xfb, 0x90, 417), ...frame(0xfb, 0x90, 417)];
    const { frames, seconds } = readMp3(new Uint8Array([...info, ...audio]));
    expect(frames.length).toBe(834);
    expect(seconds).toBeCloseTo((2 * 1152) / 44100, 10);
  });

  it("does not drop a frame that has the word somewhere else", () => {
    const audio = frame(0xfb, 0x90, 417);
    audio.splice(100, 4, 0x49, 0x6e, 0x66, 0x6f);
    expect(readMp3(new Uint8Array(audio)).frames.length).toBe(417);
  });

  it("throws on broken data and on a cut-off last frame", () => {
    expect(() => readMp3(new Uint8Array([...mp3(2), 1, 2, 3, 4, 5]))).toThrow(/byte 768/);
    expect(() => readMp3(mp3(2).subarray(0, 700))).toThrow();
    expect(() => readMp3(new Uint8Array())).toThrow(/without audio/);
  });
});

describe("joinMp3", () => {
  it("puts the frames one after the other and returns each duration", () => {
    const { bytes, durations } = joinMp3([mp3(3), mp3(5)]);
    expect(durations.map((d) => Math.round(d * 1000))).toEqual([72, 120]);
    // The result is one valid MP3 again.
    expect(readMp3(bytes).seconds).toBeCloseTo(0.192, 10);
  });
});

describe("startTimes", () => {
  it("starts each part where the parts before it end", () => {
    expect(startTimes([2, 3.5, 1])).toEqual([0, 2, 5.5]);
  });
});
