# 1. Use Postgres for the session store

Date: 2026-11-24

Owner: Ada Lovelace

Review date: 2027-06-01

## Status

Accepted

## Context

Sessions are stored in memory today. Restarts drop every session, and the
evidence is dated 2026-11-20 in the incident review:

- Incident review, 2026-11-20: https://example.com/incidents/session-loss-2026-11-20

## Decision

We will store sessions in Postgres, with a 24-hour TTL and a cleanup job.

## Considered Options

- Option A: Store sessions in Postgres with a 24-hour TTL.
- Option B: Store sessions in Redis. Rejected: a second store adds an
  operational dependency the team cannot staff on call.
- Option C: Keep sessions in memory. Rejected: restarts drop every session,
  which caused the 2026-11-20 incident.

## Reversal

We reverse this decision if Postgres session latency exceeds 50 ms at p95
for 7 consecutive days, or if session-store cost exceeds the Redis quote
for two consecutive months.

## Consequences

Sessions survive restarts. The cleanup job must be monitored; if it stops,
the table grows without bound.
