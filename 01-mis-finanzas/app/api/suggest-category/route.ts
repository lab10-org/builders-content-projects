import { suggestCategory } from "../../../src/ai/suggestCategory";

/**
 * Server-side endpoint holding the API key: the browser reaches the AI only
 * through this route, never with the key in its bundle (3.7).
 *
 * Replies are built with the Web-standard `Response.json` rather than
 * `NextResponse`, so the handler stays directly invocable from a
 * node-environment test without pulling in `next/server`.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const description =
    typeof body === "object" && body !== null
      ? (body as { description?: unknown }).description
      : undefined;

  if (typeof description !== "string" || description.trim() === "") {
    return Response.json(
      { error: "La descripción es obligatoria." },
      { status: 400 },
    );
  }

  try {
    const category = await suggestCategory(description);
    return Response.json({ category }, { status: 200 });
  } catch {
    // The upstream message is deliberately not forwarded: it can carry provider
    // detail the browser has no business seeing. The client degrades gracefully
    // on any non-ok response anyway (3.6).
    return Response.json(
      { error: "No se pudo obtener una sugerencia." },
      { status: 502 },
    );
  }
}
