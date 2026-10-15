/**
 * Node-only tools: rendering a shader to a GIF or MP4 file through headless
 * Chrome and ffmpeg. Kept out of the main entry so it stays browser-safe.
 *
 * @packageDocumentation
 */

export { exportMotionGraphic, findChrome, type ExportOptions } from "./export/recorder.js";
