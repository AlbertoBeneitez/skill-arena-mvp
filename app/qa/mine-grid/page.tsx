import { connection } from "next/server";
import { notFound } from "next/navigation";
import MineLocalQA from "@/components/MineLocalQA";
/** Opt-in local QA only. Not a catalogue route or a Vercel memory deployment. */
export default async function MineQA() {
  await connection();
  if (
    process.env.ALLOW_LOCAL_HIDDEN_GAMES !== "1" ||
    process.env.VERCEL === "1"
  )
    notFound();
  return <MineLocalQA />;
}
