import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: params.id },
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
