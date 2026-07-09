import { createClient } from "@/lib/supabase/server";
import { RoleToggle } from "./role-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ব্যবহারকারী</h1>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>নাম</TableHead>
              <TableHead>রোল</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.role === "admin" ? "default" : "secondary"}
                  >
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <RoleToggle
                    id={u.id}
                    role={u.role as "student" | "admin"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
