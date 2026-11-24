# 2. Cache rendered pages at the edge

Date: 2026-11-24

Owner: Grace Hopper

## Status

Accepted

## Context

Origin latency is high at peak, measured on 2026-11-18:

- Load test report, 2026-11-18: https://example.com/reports/load-test-2026-11-18

## Decision

We will cache rendered pages at the edge with a 5-minute TTL.

## Considered Options

- Option A: Cache rendered pages at the edge with a 5-minute TTL.
- Option B: Cache full pages in the application. Rejected: cache
  invalidation is unreliable and stale pages have shipped before.

## Consequences

Peak origin load drops. Stale pages may be served for up to 5 minutes.
