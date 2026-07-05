import { registerPlugin } from "@capacitor/core";

/**
 * Native barcode scan (v3 Phase 4) — Capacitor build only, loaded via
 * dynamic import so the web bundle never fetches it. Bridge-typed like the
 * HealthKit provider: the concrete plugin is pinned when the iOS project is
 * generated (candidate: @capacitor-mlkit/barcode-scanning — verify
 * maintenance then; the bridge below matches its surface). Web callers never
 * reach this module — search is the fallback.
 */

interface BarcodeScannerBridge {
  scan(): Promise<{ barcodes: Array<{ rawValue?: string }> }>;
}

const BarcodeScanner = registerPlugin<BarcodeScannerBridge>("BarcodeScanning");

export async function scanBarcodeNative(): Promise<string | null> {
  try {
    const { barcodes } = await BarcodeScanner.scan();
    return barcodes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}
