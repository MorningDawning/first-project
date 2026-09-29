const ML_SERVICE_URL = process.env.ML_SERVICE_URL;

export type MlCandidate = { beerName: string; breweryName?: string; confidence: number };
export type MlResult = { recognized: boolean; candidates: MlCandidate[] };

/**
 * Обращается к сервису распознавания этикеток (см. /ml). Возвращает null, если распознавание
 * недоступно: ML_SERVICE_URL не задан, сервис не отвечает или в нём ещё нет галереи фото.
 * Тогда вызывающий код просто продолжает без него (штрихкод, ручной поиск).
 */
export async function recognizeLabel(photo: Buffer): Promise<MlResult | null> {
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

    const result = (await response.json()) as MlResult;
    return Array.isArray(result.candidates) ? result : null;
  } catch {
    return null;
  }
}
