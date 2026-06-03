import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Eye, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  content: string;
  loading?: boolean;
  onChange?: (value: string) => void;
}

export function AiOutput({ content, loading, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);

  useEffect(() => setValue(content), [content]);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="min-h-[200px] animate-pulse rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Generating with AI…
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-[200px] rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Output will appear here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">AI Output</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing((e) => !e)}
            className="h-8"
          >
            {editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            <span className="ml-1.5 text-xs">{editing ? "Preview" : "Edit"}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={copy} className="h-8">
            <Copy className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Copy</span>
          </Button>
        </div>
      </div>
      <div className="p-4">
        {editing ? (
          <Textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onChange?.(e.target.value);
            }}
            className="min-h-[300px] font-mono text-sm"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80" />
                ),
              }}
            >{value}</ReactMarkdown>
          </div>
        )}
      </div>
      {editing && (
        <div className="flex justify-end border-t px-3 py-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-8">
            <Check className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Done</span>
          </Button>
        </div>
      )}
    </div>
  );
}
