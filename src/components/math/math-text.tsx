import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

/**
 * Renders text that may contain inline LaTeX between `$...$` delimiters.
 * Non-math segments render as plain text (whitespace preserved).
 */
export function MathText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const segments = splitMath(children);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {segments.map((seg, i) =>
        seg.math ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(seg.value) }}
          />
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </span>
  );
}

type Segment = { math: boolean; value: string };

function splitMath(input: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\$([^$]+)\$/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > last) {
      segments.push({ math: false, value: input.slice(last, match.index) });
    }
    segments.push({ math: true, value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    segments.push({ math: false, value: input.slice(last) });
  }
  return segments;
}

function renderMath(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return latex;
  }
}
