type GroupLike = { id: string; name: string; parentId: string | null };

/** Each group's full path, e.g. "Reinforcing bar › B500B", sorted so children follow their parent. */
export function groupPaths<T extends GroupLike>(groups: T[]): (T & { path: string; depth: number })[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const trail = (g: T): T[] => {
    const chain: T[] = [g];
    const seen = new Set([g.id]);
    let parent = g.parentId ? byId.get(g.parentId) : undefined;
    while (parent && !seen.has(parent.id)) {
      chain.unshift(parent);
      seen.add(parent.id);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return chain;
  };
  return groups
    .map((g) => {
      const chain = trail(g);
      return { ...g, path: chain.map((c) => c.name).join(' › '), depth: chain.length - 1 };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
