
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";

export type TradeSide = "LONG" | "SHORT";

export type BrokerPosition = {
  userId: string;
  assetId: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  amountUsd: number;
  status: "OPEN" | "CLOSED";
  createdAt: unknown;
  closedAt?: unknown;
  closePrice?: number;
  pnl?: number;
  pnlPercent?: number;
};

export async function openBrokerPosition(
  userId: string,
  assetId: string,
  symbol: string,
  side: TradeSide,
  entryPrice: number,
  amountUsd: number
) {
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  if (!assetId || !symbol) {
    throw new Error("Ativo inválido.");
  }

  if (side !== "LONG" && side !== "SHORT") {
    throw new Error("Direção da operação inválida.");
  }

  if (entryPrice <= 0) {
    throw new Error("Preço de entrada inválido.");
  }

  if (amountUsd <= 0) {
    throw new Error("Valor da operação inválido.");
  }

  const quantity = amountUsd / entryPrice;

  if (quantity <= 0) {
    throw new Error("Quantidade inválida.");
  }

  const position: BrokerPosition = {
    userId,
    assetId,
    symbol,
    side,
    entryPrice,
    quantity,
    amountUsd,
    status: "OPEN",
    createdAt: serverTimestamp(),
  };

  const positionRef = await addDoc(
    collection(db, "brokerPositions"),
    position
  );

  return positionRef.id;
}

export async function closeBrokerPosition(
  positionId: string,
  side: TradeSide,
  entryPrice: number,
  quantity: number,
  closePrice: number,
  amountUsd: number
) {
  if (!positionId) {
    throw new Error("Posição inválida.");
  }

  if (entryPrice <= 0 || closePrice <= 0) {
    throw new Error("Preço inválido.");
  }

  if (quantity <= 0) {
    throw new Error("Quantidade inválida.");
  }

  let pnl = 0;

  if (side === "LONG") {
    pnl = (closePrice - entryPrice) * quantity;
  } else {
    pnl = (entryPrice - closePrice) * quantity;
  }

  const pnlPercent =
    amountUsd > 0 ? (pnl / amountUsd) * 100 : 0;

  const positionRef = doc(db, "brokerPositions", positionId);

  await updateDoc(positionRef, {
    status: "CLOSED",
    closePrice,
    pnl,
    pnlPercent,
    closedAt: serverTimestamp(),
  });

  return {
    pnl,
    pnlPercent,
    closePrice,
  };
}
