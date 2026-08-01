"use client";

import loadDynamic from "next/dynamic";

const UpgradeInner = loadDynamic(() => import("./_inner"), { ssr: false });

export default function UpgradePage() {
  return <UpgradeInner />;
}
