export type GuidedStoryStatus = "idle" | "advancing" | "complete" | "error";

export interface GuidedStoryState {
  /** Next step to run when the user clicks “Next step” (0–7). When 8, the story is finished. */
  nextStepIndex: number;
  status: GuidedStoryStatus;
  errorMessage?: string;
}

export interface GuidedStoryStepDef {
  id: string;
  title: string;
  description: string;
}

export function getInitialGuidedStory(): GuidedStoryState {
  return {
    nextStepIndex: 0,
    status: "idle",
  };
}
