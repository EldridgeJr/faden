// Reads and joins MP3 files without ffmpeg.
//
// An MP3 file is a row of independent frames. Each frame starts with a
// 4-byte header that says how long the frame is and how many audio samples
// it holds. So two MP3s with the same format can be joined by putting their
// frames one after the other, and the exact duration is the sum of all
// samples divided by the sample rate.
//
// The code reads MPEG-1, 2 and 2.5 Layer III. Checked against real files:
// - OpenAI (step 6a): MPEG-2, 24 kHz, 128 kbit/s, no tags at all.
// - ElevenLabs: MPEG-1, 44.1 kHz, 128 kbit/s, with an ID3v2 tag and an
//   Info frame at the start. Both are skipped (see below).

// Bit rates in kbit/s by index (header bits 12–15). 0 = "free", 15 = bad.
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

// Sample rates in Hz by MPEG version and index (header bits 10–11).
const SAMPLE_RATES = {
  "1": [44100, 48000, 32000],
  "2": [22050, 24000, 16000],
  "2.5": [11025, 12000, 8000],
} as const;

type FrameHeader = { length: number; samples: number; sampleRate: number };

// Reads the frame header at offset. null: no valid Layer III header there.
export function readFrameHeader(bytes: Uint8Array, offset: number): FrameHeader | null {
  if (offset + 4 > bytes.length) return null;
  const [b0, b1, b2] = [bytes[offset], bytes[offset + 1], bytes[offset + 2]];

  // 11 sync bits, all 1.
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const versionBits = (b1 >> 3) & 0b11; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  const layerBits = (b1 >> 1) & 0b11; // 1 = Layer III
  if (versionBits === 1 || layerBits !== 1) return null;
  const version = versionBits === 3 ? "1" : versionBits === 2 ? "2" : "2.5";

  const bitrateIndex = b2 >> 4;
  const sampleRateIndex = (b2 >> 2) & 0b11;
  const padding = (b2 >> 1) & 1;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;

  const bitrate = (version === "1" ? BITRATES_V1 : BITRATES_V2)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][sampleRateIndex];
  // Layer III: 1152 samples per frame in MPEG-1, 576 in MPEG-2 and 2.5.
  const samples = version === "1" ? 1152 : 576;
  // Bytes per frame = (samples / 8) × bit rate / sample rate, plus padding.
  const length = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;

  return { length, samples, sampleRate };
}

// Length of an ID3v2 tag at the start (metadata like title), or 0.
// Header: "ID3", 2 bytes version, 1 byte flags, 4 bytes size with 7 bits each.
function id3v2Length(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  const hasFooter = (bytes[5] & 0x10) !== 0;
  return 10 + size + (hasFooter ? 10 : 0);
}

// Does the frame at offset carry "Xing" or "Info"? Encoders put this
// metadata frame first: it looks like a frame of audio, but holds the frame
// count of its own file. In the middle of a joined MP3 it would make some
// players show a wrong length or stop early, so we drop it.
// The word sits right after the "side info", whose size depends on the
// MPEG version and on mono or stereo.
function isInfoFrame(bytes: Uint8Array, offset: number): boolean {
  const mpeg1 = ((bytes[offset + 1] >> 3) & 0b11) === 3;
  const mono = bytes[offset + 3] >> 6 === 3;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  const at = offset + 4 + sideInfo;
  const word = String.fromCharCode(...bytes.subarray(at, at + 4));
  return word === "Xing" || word === "Info";
}

// The audio frames of one MP3 (without tags) and their exact duration.
// Throws if the data is not a clean row of frames: better an error than a
// podcast with a silent or broken part.
export function readMp3(bytes: Uint8Array): { frames: Uint8Array; seconds: number } {
  let start = id3v2Length(bytes);
  const first = readFrameHeader(bytes, start);
  if (first && start + first.length <= bytes.length && isInfoFrame(bytes, start)) start += first.length;
  let offset = start;
  let seconds = 0;

  while (offset < bytes.length) {
    // An ID3v1 tag ("TAG", 128 bytes) may close the file.
    const rest = bytes.length - offset;
    if (rest === 128 && bytes[offset] === 0x54 && bytes[offset + 1] === 0x41 && bytes[offset + 2] === 0x47) {
      break;
    }
    const header = readFrameHeader(bytes, offset);
    if (!header || offset + header.length > bytes.length) {
      throw new Error(`Invalid MP3 data at byte ${offset} of ${bytes.length}`);
    }
    seconds += header.samples / header.sampleRate;
    offset += header.length;
  }

  if (offset === start) throw new Error("MP3 without audio frames");
  return { frames: bytes.subarray(start, offset), seconds };
}

// Joins MP3s into one file. Returns the bytes and the duration of each part,
// so the transcript knows when each turn starts.
export function joinMp3(parts: Uint8Array[]): { bytes: Uint8Array; durations: number[] } {
  const read = parts.map(readMp3);
  const bytes = new Uint8Array(read.reduce((sum, part) => sum + part.frames.length, 0));
  let offset = 0;
  for (const part of read) {
    bytes.set(part.frames, offset);
    offset += part.frames.length;
  }
  return { bytes, durations: read.map((part) => part.seconds) };
}

// Start time of each part in seconds: 0, d1, d1 + d2, …
export function startTimes(durations: number[]): number[] {
  let time = 0;
  return durations.map((duration) => {
    const start = time;
    time += duration;
    return start;
  });
}
