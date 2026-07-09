"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = Record<string, unknown>;

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          setRows(Array.isArray(parsed) ? parsed : []);
        } catch {
          toast.error("অবৈধ JSON");
        }
      } else {
        const parsed = Papa.parse<Row>(text, {
          header: true,
          skipEmptyLines: true,
        });
        setRows(parsed.data);
      }
    };
    reader.readAsText(file);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ইমপোর্ট ব্যর্থ");
      setResult(data);
      toast.success(`${data.inserted} টি প্রশ্ন যোগ হয়েছে`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ইমপোর্ট ব্যর্থ");
    } finally {
      setSubmitting(false);
    }
  }

  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">বাল্ক ইমপোর্ট</h1>
        <p className="text-muted-foreground">
          CSV বা JSON ফাইল আপলোড করুন। প্রয়োজনীয় কলাম: subject_slug, topic_slug,
          body, option_a…option_d, correct_key।
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,.json"
          id="importfile"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById("importfile")?.click()}
        >
          ফাইল বাছুন
        </Button>
        {fileName && (
          <span className="text-sm text-muted-foreground">{fileName}</span>
        )}
        {rows.length > 0 && (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "ইমপোর্ট হচ্ছে…" : `${rows.length} টি সারি ইমপোর্ট`}
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                {columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c} className="max-w-40 truncate">
                      {String(row[c] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 20 && (
            <p className="p-2 text-xs text-muted-foreground">
              … আরও {rows.length - 20} টি সারি
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="font-medium text-primary">
            ✓ {result.inserted} টি প্রশ্ন সফলভাবে যোগ হয়েছে
          </p>
          {result.errors.length > 0 && (
            <div className="text-sm text-destructive">
              <p className="font-medium">
                {result.errors.length} টি সারিতে সমস্যা:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e.row}>
                    সারি {e.row}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
