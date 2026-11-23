import { get } from "@/apps/sigma/lib/httpClient";

export interface BandejaUserOption {
  value: string;
  label: string;
}

interface RawUsersResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
}

const normalizeOption = (item: Record<string, unknown>): BandejaUserOption | null => {
  const rawValue =
    item.value ??
    item.Value ??
    item.samAccountName ??
    item.SamAccountName ??
    item.usuario ??
    item.Usuario ??
    item.id ??
    item.Id;

  const rawLabel =
    item.label ??
    item.Label ??
    item.displayName ??
    item.DisplayName ??
    item.nombre ??
    item.Nombre ??
    item.userName ??
    item.UserName ??
    rawValue;

  if (!rawValue || !rawLabel) {
    return null;
  }

  return {
    value: String(rawValue),
    label: String(rawLabel),
  };
};

export async function fetchBandejaUsers(): Promise<BandejaUserOption[]> {
  const result = await get<RawUsersResponse | Array<Record<string, unknown>>>(
    "/documentos/bandeja/usuarios"
  );

  let items: Array<Record<string, unknown>> = [];

  if (Array.isArray(result)) {
    items = result;
  } else if (result && Array.isArray(result.data)) {
    items = result.data;
  }

  return items
    .map((item) => normalizeOption(item))
    .filter((item): item is BandejaUserOption => Boolean(item));
}
