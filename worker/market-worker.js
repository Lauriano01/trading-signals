const ENGINE_URL = process.env.ENGINE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!ENGINE_URL) {
  throw new Error("ENGINE_URL não configurado.");
}

if (!CRON_SECRET) {
  throw new Error("CRON_SECRET não configurado.");
}

async function runEngine() {
  try {
    const response = await fetch(ENGINE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();

    console.log(
      `[MARKET WORKER] ${new Date().toISOString()}`,
      response.status,
      data
    );
  } catch (error) {
    console.error("[MARKET WORKER] Erro:", error);
  }
}

runEngine();

setInterval(runEngine, 5000);