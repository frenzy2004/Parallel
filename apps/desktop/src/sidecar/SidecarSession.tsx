import { useEffect, useRef, useState } from "react";
import { PrecedentSchema } from "@parallel/contracts";
import { TwinEventSchema, type TwinEvent } from "@parallel/contracts/events";
import { Sidecar, type PrecedentMatchView } from "./Sidecar.js";

export interface SidecarSessionBridge {
  dismiss(): Promise<void>;
  setMappingHighlights(anchorIds: string[]): Promise<void>;
  recordOutcome(
    outcome: "unlocked" | "wrong_twin" | "not_same",
  ): Promise<void>;
  regenerateTwin(): Promise<void>;
  matchPrecedent(): Promise<unknown>;
  onTwinEvent(listener: (event: unknown) => void): () => void;
  onTwinReset(listener: () => void): () => void;
}

const parsePrecedentMatch = (value: unknown): PrecedentMatchView | null => {
  if (typeof value !== "object" || value === null) return null;
  const { precedent, score } = value as Record<string, unknown>;
  const parsed = PrecedentSchema.safeParse(precedent);
  if (
    !parsed.success ||
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 1
  ) {
    return null;
  }
  return { precedent: parsed.data, score };
};

const ignoreHandledFailure = (work: Promise<unknown>): void => {
  void work.catch(() => undefined);
};

export function SidecarSession({
  bridge,
}: {
  bridge: SidecarSessionBridge;
}): JSX.Element {
  const [events, setEvents] = useState<TwinEvent[]>([]);
  const [precedentMatch, setPrecedentMatch] =
    useState<PrecedentMatchView | null>(null);
  const precedentLookupEpoch = useRef(0);

  useEffect(() => {
    const stopEvents = bridge.onTwinEvent((event) => {
      const parsed = TwinEventSchema.safeParse(event);
      if (!parsed.success) return;
      setEvents((current) => [...current, parsed.data]);
      if (parsed.data.state === "recognized") {
        const lookupEpoch = ++precedentLookupEpoch.current;
        setPrecedentMatch(null);
        ignoreHandledFailure(
          bridge
            .matchPrecedent()
            .then((match) => {
              if (precedentLookupEpoch.current === lookupEpoch) {
                setPrecedentMatch(parsePrecedentMatch(match));
              }
            }),
        );
      }
    });
    const stopResets = bridge.onTwinReset(() => {
      precedentLookupEpoch.current += 1;
      setEvents([]);
      setPrecedentMatch(null);
    });
    return () => {
      precedentLookupEpoch.current += 1;
      stopEvents();
      stopResets();
    };
  }, [bridge]);

  return (
    <Sidecar
      events={events}
      precedentMatch={precedentMatch}
      onDismiss={() => ignoreHandledFailure(bridge.dismiss())}
      onMap={(anchorIds) =>
        ignoreHandledFailure(bridge.setMappingHighlights(anchorIds))
      }
      onOutcome={(outcome) =>
        ignoreHandledFailure(bridge.recordOutcome(outcome))
      }
      onAnother={() => ignoreHandledFailure(bridge.regenerateTwin())}
      onPrecedentFeedback={() => {
        setPrecedentMatch(null);
        ignoreHandledFailure(bridge.recordOutcome("not_same"));
      }}
    />
  );
}

export { parsePrecedentMatch };
