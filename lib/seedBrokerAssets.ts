import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_BROKER_ASSETS } from "./brokerAssets";

export async function seedBrokerAssets() {
  for (const asset of DEFAULT_BROKER_ASSETS) {
    const assetRef = doc(collection(db, "brokerAssets"));

    await setDoc(assetRef, {
      ...asset,
      previousPrice: asset.price,
      direction: "NEUTRAL",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  console.log("Ativos do broker criados com sucesso.");
}