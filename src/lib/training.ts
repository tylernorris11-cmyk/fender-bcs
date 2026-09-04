import 'server-only';
import type { Company } from '@prisma/client';
import { db } from './db';

type TrainedUser = { id: string; companies: Company[] };

/** Every active module this user is required to complete — General/PPE
 * modules apply to everyone, Machine modules only to whoever they're
 * assigned to. Always a live query, never cached or snapshotted, so a newly
 * created or newly assigned module shows up immediately. */
export async function requiredModulesFor(user: TrainedUser) {
  const modules = await db.trainingModule.findMany({
    where: { active: true, OR: [{ company: null }, { company: { in: user.companies } }] },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });
  if (modules.length === 0) return [];

  const machineModuleIds = modules.filter((m) => m.category === 'MACHINE').map((m) => m.id);
  const assignments = machineModuleIds.length
    ? await db.userTrainingAssignment.findMany({
        where: { userId: user.id, moduleId: { in: machineModuleIds } },
        select: { moduleId: true },
      })
    : [];
  const assignedIds = new Set(assignments.map((a) => a.moduleId));

  return modules.filter((m) => m.category !== 'MACHINE' || assignedIds.has(m.id));
}

export async function incompleteRequiredModulesFor(user: TrainedUser) {
  const required = await requiredModulesFor(user);
  if (required.length === 0) return [];

  const completions = await db.trainingCompletion.findMany({
    where: { userId: user.id, moduleId: { in: required.map((m) => m.id) } },
    select: { moduleId: true },
  });
  const completedIds = new Set(completions.map((c) => c.moduleId));

  return required.filter((m) => !completedIds.has(m.id));
}

export async function hasIncompleteRequiredTraining(user: TrainedUser): Promise<boolean> {
  const incomplete = await incompleteRequiredModulesFor(user);
  return incomplete.length > 0;
}
