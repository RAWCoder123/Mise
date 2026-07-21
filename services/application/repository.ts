import { createMiseRepository, type MiseRepository } from "../repositories/miseRepository";

let activeRepository: MiseRepository = createMiseRepository();

/**
 * Application modules capture this once at import time, so it returns a
 * stable proxy that always delegates to the active repository. That keeps
 * screen-facing APIs unchanged while letting tests swap the backend.
 */
const repositoryProxy = new Proxy({} as MiseRepository, {
  get(_target, property) {
    return activeRepository[property as keyof MiseRepository];
  }
});

export function getMiseRepository(): MiseRepository {
  return repositoryProxy;
}

/** Test-only seam: swap the repository backend. Returns a restore function. */
export function setMiseRepositoryForTesting(replacement: MiseRepository): () => void {
  const previous = activeRepository;
  activeRepository = replacement;
  return () => {
    activeRepository = previous;
  };
}
