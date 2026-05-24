import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getUserAddresses, saveAddressForUser } from "@/lib/addresses";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireApiUser();
    const addresses = await getUserAddresses(user.id);
    return NextResponse.json(addresses);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const address = await saveAddressForUser(user.id, await request.json());
    return NextResponse.json(address);
  } catch (error) {
    return jsonError(error);
  }
}
