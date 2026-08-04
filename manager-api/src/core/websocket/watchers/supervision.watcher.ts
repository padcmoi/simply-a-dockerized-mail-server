import { SupervisionRecorderService } from "../../supervision/supervision-recorder.service";
import { Watcher } from "../watcher.type";

// One second rather than two: the CPU and the network are read as deltas over
// the interval, so a shorter one is a finer curve, and what it costs is three
// small /proc reads and one frame of about 200 bytes per watching tab. The load
// average gains nothing (the kernel only recomputes it every five seconds) and
// nothing is written to the database any faster: samples are still averaged into
// one row every ten seconds.
export const SUPERVISION_INTERVAL_MS = 1_000;

// This poller is the machine's only sampling loop: it runs from boot, with or
// without a subscriber, because the recorded history is built from it and
// because two loops reading /proc would each reset the other's baseline.
export function supervisionWatcher(recorder: SupervisionRecorderService): Watcher {
  return {
    topic: "supervision-machine",
    permissions: [{ resource: "supervision", actions: ["access", "view-machine-metrics"] }],
    intervalMs: SUPERVISION_INTERVAL_MS,
    fn: () => recorder.tick(),
  };
}
