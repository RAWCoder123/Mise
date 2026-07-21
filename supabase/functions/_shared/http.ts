export const MAX_JSON_BODY_BYTES = 64 * 1024;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*"
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

export async function readJsonObject(req: Request, maximumBytes = MAX_JSON_BODY_BYTES) {
  const contentLengthHeader = req.headers.get("content-length");
  if (!contentLengthHeader) {
    throw new HttpError(411, "Content-Length is required.");
  }

  const contentLength = Number(contentLengthHeader);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1) {
    throw new HttpError(400, "Content-Length must describe a non-empty request body.");
  }
  if (contentLength > maximumBytes) {
    throw new HttpError(413, `Request body must not exceed ${maximumBytes} bytes.`);
  }
  if (!req.body) {
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  const reader = req.body.getReader();
  const bytes = new Uint8Array(contentLength);
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const nextReceivedBytes = receivedBytes + value.byteLength;
      if (nextReceivedBytes > maximumBytes) {
        await reader.cancel("request body too large");
        throw new HttpError(413, `Request body must not exceed ${maximumBytes} bytes.`);
      }
      if (nextReceivedBytes > contentLength) {
        await reader.cancel("request body length mismatch");
        throw new HttpError(400, "Request body length does not match Content-Length.");
      }
      bytes.set(value, receivedBytes);
      receivedBytes = nextReceivedBytes;
    }
  } finally {
    reader.releaseLock();
  }

  if (receivedBytes !== contentLength) {
    throw new HttpError(400, "Request body length does not match Content-Length.");
  }

  let body: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}
