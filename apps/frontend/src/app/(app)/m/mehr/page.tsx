'use client';

import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';

export default function MehrPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-newTextColor">Mehr</h1>
      <div className="rounded-lg border border-newBorder bg-newBgColor p-4">
        <LogoutComponent />
      </div>
      <p className="text-xs text-textItemBlur text-center pt-4">
        Weitere Einstellungen folgen.
      </p>
    </div>
  );
}
