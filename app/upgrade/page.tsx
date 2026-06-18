"use client";

export const dynamic = "force-dynamic";

import loadDynamic from "next/dynamic";

const UpgradeInner = loadDynamic(() => import("./_inner"), { ssr: false });

export default function UpgradePage() {
  return <UpgradeInner />;
}
