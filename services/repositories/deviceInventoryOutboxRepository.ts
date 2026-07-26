import AsyncStorage from "@react-native-async-storage/async-storage";

import { createInventoryOutboxRepository } from "./inventoryOutboxRepository";

export const deviceInventoryOutboxRepository =
  createInventoryOutboxRepository(AsyncStorage);
