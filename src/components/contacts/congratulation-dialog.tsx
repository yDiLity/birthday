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
import { buildSeedRows } from "@/lib/congratulations";
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
  const [error, setError] = useState<string | null>(null);

  const pickNext = useCallback(async () => {
    setLoading(true);
    setCopied(false);
    setError(null);
    try {
      const pick = async () =>
        supabase
          .rpc("pick_random_congratulation", { p_user_id: userId })
          .maybeSingle();

      let { data, error } = await pick();
      if (error) {
        throw error;
      }

      if (!data) {
        const { error: seedError } = await supabase
          .from("congratulations")
          .upsert(buildSeedRows(userId), {
            onConflict: "user_id,text",
          });

        if (seedError) {
          throw seedError;
        }

        ({ data, error } = await pick());
        if (error) {
          throw error;
        }
      }

      if (!data) {
        throw new Error("No congratulations available");
      }

      setText((data as { id: string; text: string }).text);
    } catch (err) {
      console.error("Error fetching congratulation:", err);
      setText("");
      setError("Не удалось получить поздравление. Попробуйте ещё раз.");
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
          ) : error ? (
            <p className="text-destructive py-2">{error}</p>
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
