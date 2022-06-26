import { Bid, Hand, HandJson } from "@chrisbook/bridge-core";
import * as admin from "firebase-admin";
import { firestore, logger } from "firebase-functions";
import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from "firebase/firestore";

const app = admin.initializeApp();
const db = app.firestore();

export interface Table {
  id: string;
  players?: string[];
  hand: Hand;
}

const tableConverter: FirestoreDataConverter<Table> = {
  toFirestore(table: Table): DocumentData {
    return {
      players: table.players,
      hand: table.hand.toJson(),
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): Table {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      players: data.players || [],
      hand: Hand.fromJson(data.hand),
    };
  },
};

export const robot = firestore
  .document("tables/{tableId}")
  .onWrite(async (change, context) => {
    const tableId = context.params.tableId;
    logger.info("onWrite for table " + tableId);

    const ref = db.collection("tables").doc(tableId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new Error("Table not found at " + tableId);
    }

    const data = snapshot.data() as { players?: []; hand?: HandJson };
    const hand = Hand.fromJson(data.hand || {});

    const turn = hand.turn;
    let newHand: Hand | undefined;
    if (turn && data?.players?.at(turn.index()) === "Robot") {
      logger.info("Robot's turn!");
      if (hand.isBidding) {
        newHand = hand.doBid(Bid.Pass, turn);
      } else if (hand.isPlaying) {
        const holding = hand.getHolding(turn);
        for (const card of holding) {
          newHand = hand.doPlay(card, turn);
          if (newHand) break;
        }
        // TODO;
      }
    } else {
      logger.info("Not Robot's turn");
    }
    if (newHand) {
      ref.update({ hand: newHand.toJson() });
    }
  });
