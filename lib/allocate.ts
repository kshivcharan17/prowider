// lib/allocate.ts
/**
 * Lead allocation engine.
 *
 * Rules:
 *  Service 1 → mandatory: Provider 1       | pool: Providers 2,3,4
 *  Service 2 → mandatory: Provider 5       | pool: Providers 6,7,8
 *  Service 3 → mandatory: Provider 1,4     | pool: Providers 2,3,5,6,7,8
 *
 * Each lead gets exactly 3 providers.
 * After mandatory slots, remaining slots are filled from the pool
 * using a persistent round-robin pointer (stored in AllocationState).
 * Providers over monthly quota (10) are skipped.
 *
 * The entire operation runs inside a serializable transaction to
 * prevent duplicate assignments under concurrent requests.
 */

import prisma from "./prisma";
import { Prisma } from "@prisma/client";
import { emitLeadUpdate } from "./sse";

const TOTAL_ASSIGNMENTS = 3;

// Config keyed by service name
const SERVICE_CONFIG: Record<
  string,
  { mandatory: number[]; pool: number[]; poolKey: string }
> = {
  "Service 1": {
    mandatory: [1],
    pool: [2, 3, 4],
    poolKey: "service1_pool",
  },
  "Service 2": {
    mandatory: [5],
    pool: [6, 7, 8],
    poolKey: "service2_pool",
  },
  "Service 3": {
    mandatory: [1, 4],
    pool: [2, 3, 5, 6, 7, 8],
    poolKey: "service3_pool",
  },
};

export async function allocateLead(leadId: number, serviceName: string) {
  const config = SERVICE_CONFIG[serviceName];
  if (!config) throw new Error(`Unknown service: ${serviceName}`);

  // Use SERIALIZABLE isolation to prevent race conditions
  await prisma.$transaction(
    async (tx) => {
      // Lock the allocation state row to serialize concurrent allocations
      // Raw query to acquire advisory lock per poolKey to prevent concurrent allocation
      const poolKeyHash = config.poolKey
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${poolKeyHash})`
      );

      // Fetch providers with current quota info (lock rows)
      const providerIds = [
        ...new Set([...config.mandatory, ...config.pool]),
      ];
      const providers = await tx.provider.findMany({
        where: { id: { in: providerIds } },
        select: { id: true, monthlyQuota: true, leadsReceived: true },
      });
      const providerMap = new Map(providers.map((p) => [p.id, p]));

      const hasCapacity = (id: number) => {
        const p = providerMap.get(id);
        return p ? p.leadsReceived < p.monthlyQuota : false;
      };

      // 1. Assign mandatory providers that have capacity
      const assigned: number[] = [];
      for (const pid of config.mandatory) {
        if (hasCapacity(pid)) {
          assigned.push(pid);
        }
      }

      // 2. Fill remaining slots from pool via round-robin
      const slotsNeeded = TOTAL_ASSIGNMENTS - assigned.length;
      if (slotsNeeded > 0) {
        // Get current pointer
        const state = await tx.allocationState.findUniqueOrThrow({
          where: { poolKey: config.poolKey },
        });

        const eligible = config.pool.filter(
          (pid) => !assigned.includes(pid) && hasCapacity(pid)
        );

        let pointer = state.nextIndex % Math.max(eligible.length, 1);
        let filled = 0;
        let attempts = 0;

        while (filled < slotsNeeded && attempts < eligible.length) {
          const pid = eligible[pointer % eligible.length];
          if (!assigned.includes(pid)) {
            assigned.push(pid);
            filled++;
          }
          pointer++;
          attempts++;
        }

        // Persist updated pointer
        await tx.allocationState.update({
          where: { poolKey: config.poolKey },
          data: { nextIndex: pointer },
        });
      }

      // 3. Create lead assignments & increment provider counters
      for (const pid of assigned) {
        await tx.leadAssignment.create({
          data: { leadId, providerId: pid },
        });
        await tx.provider.update({
          where: { id: pid },
          data: { leadsReceived: { increment: 1 } },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    }
  );

  // Notify SSE clients after transaction commits
  emitLeadUpdate({ leadId, serviceName });
}
