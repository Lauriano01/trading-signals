import {
  Timestamp,
} from "firebase/firestore";

export type BrokerAsset = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price: number;
  previousPrice: number;
  direction: "UP" | "DOWN" | "NEUTRAL";
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};