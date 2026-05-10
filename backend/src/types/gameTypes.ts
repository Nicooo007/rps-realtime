export type Choice = "rock" | "paper" | "scissors";

export interface Player {
  id: string;
  choice: Choice | null;
}

export interface GameResult {
  p1: Choice;
  p2: Choice;
  result: "p1" | "p2" | "draw";
}