import { probe } from "./probe";

self.onmessage = async (event: MessageEvent<Parameters<typeof probe>[0]>) => {
  try {
    self.postMessage({ result: await probe(event.data) });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) });
  }
};
