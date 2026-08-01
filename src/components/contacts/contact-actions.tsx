"use client";

import { CongratulationDialog } from "@/components/contacts/congratulation-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/supabase";
import { Edit, Gift, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../supabase/client";

interface ContactActionsProps {
  userId: string;
  contact: Tables<"contacts">;
}

export function ContactActions({ userId, contact }: ContactActionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [congratulateOpen, setCongratulateOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contact.id)
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting contact:", error);
        return;
      }

      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="icon"
        title="Поздравить"
        onClick={() => setCongratulateOpen(true)}
      >
        <Gift className="h-4 w-4" />
      </Button>

      <Link href={`/dashboard/contacts/edit/${contact.id}`}>
        <Button variant="outline" size="icon" title="Редактировать">
          <Edit className="h-4 w-4" />
        </Button>
      </Link>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="icon" title="Удалить">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
            <AlertDialogDescription>
              Контакт «{contact.name}» будет удалён без возможности
              восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CongratulationDialog
        userId={userId}
        contactName={contact.name}
        open={congratulateOpen}
        onOpenChange={setCongratulateOpen}
      />
    </div>
  );
}
