import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import {
  downloadDocx,
  downloadHtml,
  downloadMarkdown,
  downloadPdf,
  downloadText,
} from "@/lib/cv-export";
import { toast } from "sonner";

export function CvDownload({ content }: { content: string }) {
  const disabled = !content.trim();

  const run = async (fn: () => void | Promise<void>, label: string) => {
    try {
      await fn();
      toast.success(`Downloaded as ${label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled} variant="default">
          <Download className="h-4 w-4" />
          Download CV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run(() => downloadPdf(content), "PDF")}>
          PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => downloadDocx(content), "Word")}>
          Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => downloadHtml(content), "HTML")}>
          HTML (.html)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => downloadMarkdown(content), "Markdown")}>
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => downloadText(content), "Text")}>
          Plain text (.txt)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
