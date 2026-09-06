import { NextResponse } from "next/server";

import { adminDb } from "../../../lib/firebaseAdmin";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("brokerAssets")
      .where("active", "==", true)
      .get();

    const assets = snapshot.docs.map((item) => {
      const data = item.data();

      return {
        id: item.id,
        symbol: data.symbol,
        name: data.name,
        category: data.category,
        price: Number(data.price ?? 0),
        previousPrice: Number(
          data.previousPrice ?? data.price ?? 0
        ),
        direction: data.direction ?? "NEUTRAL",
        active: data.active ?? true,
      };
    });

    return NextResponse.json({
      success: true,
      assets,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar mercado:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível carregar o mercado.",
      },
      { status: 500 }
    );
  }
}