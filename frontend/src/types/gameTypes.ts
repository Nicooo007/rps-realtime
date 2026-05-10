export type Choice = "rock" | "paper" | "scissors";

export interface ResultPayload {
  p1: Choice;
  p2: Choice;
  result: string;
}

