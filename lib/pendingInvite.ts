import AsyncStorage from "@react-native-async-storage/async-storage";

import { isValidInviteToken, normalizeInviteToken } from "../services/domain/teamInvites";

const PENDING_INVITE_STORAGE_KEY = "mise:pending-invite-token:v1";

export async function savePendingInviteToken(token: string): Promise<string | null> {
  const normalized = normalizeInviteToken(token);
  if (!isValidInviteToken(normalized)) return null;
  await AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, normalized);
  return normalized;
}

export async function readPendingInviteToken(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY);
  if (!raw) return null;
  const normalized = normalizeInviteToken(raw);
  if (!isValidInviteToken(normalized)) {
    await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    return null;
  }
  return normalized;
}

export async function clearPendingInviteToken(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
}
