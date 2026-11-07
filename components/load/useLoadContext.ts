"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { DriverOption, TruckOption } from "@/lib/client-types";

export interface LoadContextData {
  trucks: TruckOption[];
  drivers: DriverOption[];
  costPerMile: number;
  targetRpm: number;
  attempt: { id: string; title: string; brief: string; scenarioKey: string; difficulty: string } | null;
}

const EMPTY: LoadContextData = { trucks: [], drivers: [], costPerMile: 1.85, targetRpm: 2.5, attempt: null };

export function useLoadContext() {
  const [ctx, setCtx] = useState<LoadContextData>(EMPTY);
  const reload = useCallback(() => {
    api<LoadContextData>("/api/context").then(setCtx, () => {});
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...ctx, reload };
}
