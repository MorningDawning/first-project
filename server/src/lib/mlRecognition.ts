const ML_SERVICE_URL = process.env.ML_SERVICE_URL;

type MlCandidate = { beerName: string; confidence: number };
type MlResponse = { recognized: boolean; candidates: MlCandidate[] };

/**
 * Calls the CLIP label-recognition service (see /ml). Returns null whenever
 * recognition isn't available — no ML_SERVICE_URL configured, the service is
 * down, or it hasn't loaded a trained checkpoint yet — so callers can fall
 * back to another scan strategy instead of failing the request.
 */
export async function recognizeLabel(photo: Buffer): Promise<MlCandidate | null> {
  if (!ML_SERVICE_URL) return null;

  try {
    const form = new FormData();
    form.append("photo", new Blob([photo]), "scan.jpg");

    const response = await fetch(`${ML_SERVICE_URL}/recognize`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const result = (await response.json()) as MlResponse;
    if (!result.recognized || result.candidates.length === 0) return null;
    return result.candidates[0];
  } catch {
    return null;
  }
}
