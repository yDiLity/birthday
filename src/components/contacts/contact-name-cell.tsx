"use client";

import { CongratulationDialog } from "@/components/contacts/congratulation-dialog";
import { formatFullName } from "@/utils/name-formatter";
import type { Tables } from "@/types/supabase";
import { useState } from "react";

interface ContactNameCellProps {
  userId: string;
  contact: Tables<"contacts">;
}

export function ContactNameCell({ userId, contact }: ContactNameCellProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Показать поздравление"
        className="font-medium cursor-pointer text-left underline-offset-4 hover:underline"
      >
        {formatFullName(contact.name)}
      </button>
      <CongratulationDialog
        userId={userId}
        contactName={formatFullName(contact.name)}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
