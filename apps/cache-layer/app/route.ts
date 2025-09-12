import { NextRequest } from "next/server";
import { GET as getPage } from "./[...slug]/route.ts";

export const GET = async (request: NextRequest) => {
  return getPage(request, { params: Promise.resolve({ slug: [] }) });
};
