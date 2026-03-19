import { describe, expect, it } from "vitest";

import {
  buildObservabilityPayload,
  normalizeKeyRequests,
  normalizePageState
} from "../observability.js";

describe("observability", () => {
  it("normalizes page state and strips query/fragment from page url", () => {
    const pageState = normalizePageState({
      page_kind: "feed",
      url: "https://example.com/feed?token=secret#section-1",
      title: "Example Feed",
      ready_state: "complete"
    });

    expect(pageState).toMatchObject({
      page_kind: "feed",
      url: "https://example.com/feed",
      title: "Example Feed",
      ready_state: "complete"
    });
  });

  it("normalizes key requests and keeps only bounded records", () => {
    const keyRequests = normalizeKeyRequests(
      [
        {
          request_id: "req-1",
          stage: "request",
          method: "GET",
          url: "/api/feed?token=abc",
          outcome: "completed",
          status_code: 200
        },
        {
          request_id: "req-2",
          stage: "request",
          method: "POST",
          url: "https://example.com/api/action?signature=secret",
          outcome: "failed",
          failure_reason: "timeout"
        }
      ],
      { maxRequests: 1 }
    );

    expect(keyRequests).toHaveLength(1);
    expect(keyRequests[0]).toMatchObject({
      request_id: "req-1",
      url: "/api/feed",
      method: "GET",
      outcome: "completed",
      status_code: 200
    });
  });

  it("builds bounded observability payload", () => {
    const payload = buildObservabilityPayload(
      {
        page_state: {
          page_kind: "detail",
          url: "https://example.com/post/1?code=secret#hash",
          title: "A".repeat(120),
          ready_state: "interactive"
        },
        key_requests: [
          {
            request_id: "req-1",
            stage: "request",
            method: "GET",
            url: "https://example.com/api/feed?token=abc",
            outcome: "completed"
          }
        ],
        failure_site: {
          stage: "request",
          component: "network",
          target: "/api/feed",
          summary: "x".repeat(200)
        }
      },
      {
        maxTitleLength: 32,
        maxFailureSummaryLength: 64
      }
    );

    expect(payload.page_state.title).toHaveLength(32);
    expect(payload.page_state.url).toBe("https://example.com/post/1");
    expect(payload.key_requests[0].url).toBe("https://example.com/api/feed");
    expect(payload.failure_site?.summary).toHaveLength(64);
  });
});
