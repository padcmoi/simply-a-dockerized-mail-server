import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const SupervisionApi = () => applyDecorators(ApiTags("supervision"), ApiSecurity("apiToken"));

const snapshot = {
  at: 1770000000000,
  cores: 8,
  cpu: 3.5,
  load: { one: 0.23, five: 0.3, fifteen: 0.27 },
  memory: { total: 24616660992, used: 4939212800 },
  network: { interface: "eth0", in: 9875, out: 7500 },
  rspamd: { scanned: 12034, noAction: 9870, greylist: 163, addHeader: 1500, reject: 501, learned: 240 },
  postfix: { active: 1, deferred: 3, hold: 0, incoming: 0 },
};

export const GetLiveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The live minute of the machine: the last snapshot and the points behind it",
      description:
        "The sampling loop runs from boot, so this window already exists when a page opens and there is nothing " +
        "to wait for. The websocket topic `supervision-machine` carries the same snapshots from there on, one " +
        "every two seconds. `cpu` is null until two readings of /proc/stat have been taken, and `network` is null " +
        "on a host whose own interfaces are out of reach from this container. The same loop reads the two mail " +
        "services: `rspamd` is rspamd's own counters at that moment, the figures its page tiles, counted since it " +
        "started, null while rspamd is out of reach; `postfix` is the number of messages in each queue directory, " +
        "null while the spool is out of reach.",
    }),
    ApiResponse({
      status: 200,
      description: "The latest snapshot and the live window, oldest point first (up to 31 points, one every two seconds).",
      schema: { example: { snapshot, points: [snapshot], thresholds: { busy: 0.7, saturated: 0.9 } } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `supervision:access` and/or `supervision:view-machine-metrics` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission supervision:access", error: "Forbidden" } },
    })
  );

export const GetHistoryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The recorded machine history over one window, aggregated to what a chart can draw",
      description:
        "One recorded row stands for ten seconds and a month is kept. The window is grouped in SQL: an hour into " +
        "minutes, a day into quarter hours, a week into two-hour steps. Every bucket of the window is returned, " +
        "including the ones nothing was recorded in (all figures null), so a point always sits where its moment is. " +
        "`memory` is a percentage of what is installed, like the live frames; `network` is bytes per second, in then out. " +
        "`rspamd` is rspamd's counters at the end of the bucket: scanned, no action, greylist, add header, reject, " +
        "learned. `postfix` is the mean depth of each queue over the bucket: active, deferred, hold, incoming. " +
        "Either is null for a bucket during which the service was out of reach.",
    }),
    ApiParam({ name: "range", enum: ["hour", "day", "week"], description: "How far back the window reaches" }),
    ApiResponse({
      status: 200,
      description: "The window, its step in milliseconds, and one point per bucket.",
      schema: {
        example: {
          range: "hour",
          step: 60000,
          points: [
            {
              at: 1770000000000,
              cpu: 3.4,
              memory: 20.1,
              load: [0.23, 0.3, 0.27],
              network: [9875, 7500],
              rspamd: [12034, 9870, 163, 1500, 501, 240],
              postfix: [0.5, 3, 0, 0],
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: "Unknown range",
      schema: { example: { statusCode: 400, message: "Unknown range", error: "Bad Request" } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `supervision:access` and/or `supervision:view-metrics-history` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission supervision:access", error: "Forbidden" } },
    })
  );
