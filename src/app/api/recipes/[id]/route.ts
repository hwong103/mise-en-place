import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { id: resolved.id },
  });

  if (!recipe) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: recipe.id,
    title: recipe.title,
    sourceUrl: recipe.sourceUrl,
    householdId: recipe.householdId,
    createdAt: recipe.createdAt,
  });
}
