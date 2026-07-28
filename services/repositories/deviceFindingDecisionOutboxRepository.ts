import AsyncStorage from "@react-native-async-storage/async-storage";

import { createFindingDecisionOutboxRepository } from "./findingDecisionOutboxRepository";

export const deviceFindingDecisionOutboxRepository =
  createFindingDecisionOutboxRepository(AsyncStorage);
