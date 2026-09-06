import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "CRON_SECRET não configurado." },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;

    const response = await fetch(
      `${baseUrl}/api/market/engine`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Erro no cron do mercado:", error);

    return NextResponse.json(
      {
        error: "Erro ao executar o motor do mercado.",
      },
      { status: 500 }
    );
  }
}