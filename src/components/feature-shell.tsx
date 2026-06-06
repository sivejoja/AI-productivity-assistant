import { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}

export function FeatureShell({ title, description, icon, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="sticky top-12 z-10 -mx-4 flex items-start gap-4 bg-background/95 px-4 py-3 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </div>
  );
}

