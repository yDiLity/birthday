"use client";

import { createColumns } from "@/components/contacts/columns";
import { DataTable } from "@/components/contacts/data-table";
import type { Tables } from "@/types/supabase";

interface ContactsDataTableProps {
  userId: string;
  contacts: Tables<"contacts">[];
}

export function ContactsDataTable({
  userId,
  contacts,
}: ContactsDataTableProps) {
  return (
    <DataTable
      columns={createColumns(userId)}
      data={contacts}
      userId={userId}
    />
  );
}
