import { createMiseRepository, type MiseRepository } from "../repositories/miseRepository";

const repository = createMiseRepository();

export function getMiseRepository(): MiseRepository {
  return repository;
}
