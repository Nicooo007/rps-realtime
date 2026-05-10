import { Choice } from "../types/gameTypes";

export function getWinner(p1: Choice, p2: Choice): "p1" | "p2" | "draw" {
  if (p1 === p2) return "draw";
  if (
    (p1 === "rock"     && p2 === "scissors") ||
    (p1 === "paper"    && p2 === "rock")     ||
    (p1 === "scissors" && p2 === "paper")
  ) return "p1";
  return "p2";
}