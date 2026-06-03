import { supabase } from "@/integrations/supabase/client";

export type Feature = "email" | "meeting" | "tasks" | "research" | "chat" | "autoapply";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  feature: Feature;
  input?: string;
  messages?: ChatMessage[];
  options?: Record<string, string>;
}

export async function callAi(req: AiRequest): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-assist", { body: req });
  if (error) {
    // The edge function returns JSON error messages we want to surface.
    const msg =
      (error as { context?: { error?: string } }).context?.error ||
      error.message ||
      "Something went wrong";
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return (data?.content as string) ?? "";
}
