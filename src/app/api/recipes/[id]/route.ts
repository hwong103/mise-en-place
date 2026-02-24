import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let householdId: string;

  try {
    householdId = await getCurrentHouseholdId("throw");
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resolved = await params;
  const recipe = await prisma.recipe.findFirst({
    where: { id: resolved.id, householdId },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      createdAt: true,
    },
  });

  if (!recipe) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: recipe.id,
    title: recipe.title,
    sourceUrl: recipe.sourceUrl,
    createdAt: recipe.createdAt,
  });
}
