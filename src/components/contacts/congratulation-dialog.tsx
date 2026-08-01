"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONGRATULATIONS,
  CONGRATULATIONS_COUNT,
  pickCongratulationIndex,
} from "@/lib/congratulations";
import { Check, Copy, PartyPopper, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../../supabase/client";

interface CongratulationDialogProps {
  userId: string;
  contactName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CongratulationDialog({
  userId,
  contactName,
  open,
  onOpenChange,
}: CongratulationDialogProps) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickNext = useCallback(async () => {
    setLoading(true);
    setCopied(false);
    try {
      const { data, error } = await supabase
        .from("congratulations_usage")
        .select("used_indexes")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const used = data?.used_indexes ?? [];
      const index = pickCongratulationIndex(used);

      const nextUsed =
        used.length >= CONGRATULATIONS_COUNT - 1 ? [index] : [...used, index];

      const { error: upsertError } = await supabase
        .from("congratulations_usage")
        .upsert(
          {
            user_id: userId,
            used_indexes: nextUsed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (upsertError) {
        throw upsertError;
      }

      setText(CONGRATULATIONS[index]);
    } catch (err) {
      console.error("Error fetching congratulation:", err);
      setText(
        CONGRATULATIONS[Math.floor(Math.random() * CONGRATULATIONS_COUNT)],
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (open) {
      void pickNext();
    }
  }, [open, pickNext]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            Поздравление для {contactName}
          </DialogTitle>
          <DialogDescription>
            Случайное поздравление от коллектива. Нажмите «Копировать», чтобы
            вставить его в чат или email.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/30 bg-card/60 p-4 text-sm leading-relaxed">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Подбираем поздравление...
            </div>
          ) : (
            text
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => void pickNext()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Другое поздравление
          </Button>
          <Button
            type="button"
            onClick={() => void copyToClipboard()}
            disabled={loading || !text}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Копировать
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
