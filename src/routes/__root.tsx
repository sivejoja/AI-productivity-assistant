import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Workplace Productivity Assistant" },
      {
        name: "description",
        content:
          "AI Workplace Productivity Assistant — generate emails, summarize meetings, plan tasks, research topics, and chat with AI.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "AI Workplace Productivity Assistant" },
      {
        property: "og:description",
        content: "Automate workplace tasks with AI: emails, meeting notes, tasks, research, chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "AI Workplace Productivity Assistant" },
      { name: "description", content: "AI Productivity Hub automates professional tasks with AI tools for enhanced efficiency." },
      { property: "og:description", content: "AI Productivity Hub automates professional tasks with AI tools for enhanced efficiency." },
      { name: "twitter:description", content: "AI Productivity Hub automates professional tasks with AI tools for enhanced efficiency." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d69b3911-af58-4f12-bacd-44f2dbabaa91/id-preview-0b25aa30--14ec4708-0da9-4bf8-8a6f-74ffab7c88d5.lovable.app-1779868215269.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d69b3911-af58-4f12-bacd-44f2dbabaa91/id-preview-0b25aa30--14ec4708-0da9-4bf8-8a6f-74ffab7c88d5.lovable.app-1779868215269.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar />
        <main className="relative flex min-h-screen w-full flex-col bg-background bg-[radial-gradient(ellipse_at_top,_oklch(0.3_0.12_280/0.35),_transparent_60%),radial-gradient(ellipse_at_bottom_right,_oklch(0.35_0.18_300/0.25),_transparent_55%)]">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-white/10 bg-background/60 px-3 backdrop-blur md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-medium">AI Workplace</span>
          </header>
          <div className="flex-1">
            <Outlet />
          </div>
        </main>
        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
