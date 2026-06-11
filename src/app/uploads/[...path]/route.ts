import { jsonError } from "@/lib/api";
import { getUploadFileResponse } from "@/lib/upload-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, context: UploadRouteContext) {
  try {
    const { path } = await context.params;

    return await getUploadFileResponse(path);
  } catch (error) {
    return jsonError(error);
  }
}

export async function HEAD(_request: Request, context: UploadRouteContext) {
  try {
    const { path } = await context.params;
    const response = await getUploadFileResponse(path);

    return new Response(null, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    return jsonError(error);
  }
}
