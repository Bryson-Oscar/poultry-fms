"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { OvoCoreUpsell } from '@/components/ovocore/OvoCoreUpsell';
import { Suspense } from 'react';
import { PeckingChickenLoader } from '@/components/ovocore/PeckingChickenLoader';

function UpgradeContent() {
  const searchParams = useSearchParams();
  const farmId = searchParams.get('farmId');

  return <OvoCoreUpsell farmId={farmId || undefined} />;
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <PeckingChickenLoader size="lg" message="Loading OvoCore Tier Upgrade..." />
        </div>
      }
    >
      <UpgradeContent />
    </Suspense>
  );
}
