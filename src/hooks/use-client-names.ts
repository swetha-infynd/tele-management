import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildClientNameIndex, loadDialUploads, type ClientNameIndex } from "@/lib/dial-upload";

const EMPTY_INDEX: ClientNameIndex = buildClientNameIndex([]);

/**
 * Client names extracted from the uploaded dial data, keyed by campaign and by
 * agent. Shares the ["dial-uploads"] query so every page updates as soon as a
 * CSV is uploaded or removed.
 */
export function useClientNameIndex(): ClientNameIndex {
  const { data } = useQuery({
    queryKey: ["dial-uploads"],
    queryFn: loadDialUploads,
  });

  return useMemo(() => (data ? buildClientNameIndex(data) : EMPTY_INDEX), [data]);
}
