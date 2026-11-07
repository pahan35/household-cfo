import type { ReactNode } from "react";

import { ExternalProviderSyncProvider, ExternalProviderSyncToolbar } from "./_components/external-provider-sync-toolbar";

export default function FamilyBudgetLayout({ children }: { children: ReactNode }) {
  return (
    <ExternalProviderSyncProvider>
      <div className="flex flex-col gap-4">
        <ExternalProviderSyncToolbar />
        {children}
      </div>
    </ExternalProviderSyncProvider>
  );
}
