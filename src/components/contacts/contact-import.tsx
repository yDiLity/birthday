"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "../../../supabase/client";
import { useRouter } from "next/navigation";
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Workbook } from "exceljs";
import type { Tables } from "@/types/supabase";

interface ContactImportProps {
  userId: string;
  existingContacts: Tables<"contacts">[];
}

interface ParsedContact {
  name: string;
  birth_date: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  imported?: number;
  failed?: number;
  duplicates?: string[];
}

export default function ContactImport({
  userId,
  existingContacts,
}: ContactImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const findDuplicates = (parsed: ParsedContact[]): string[] => {
    const existingNames = new Set(
      existingContacts.map((c) => normalize(c.name)),
    );
    const seen = new Set<string>();
    const dupes: string[] = [];

    for (const contact of parsed) {
      const norm = normalize(contact.name);
      if (existingNames.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        dupes.push(contact.name);
      }
    }
    return dupes;
  };

  const parseExcel = async (file: File): Promise<ParsedContact[]> => {
    const result: ParsedContact[] = [];
    const workbook = new Workbook();

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error("No worksheet found");
      }

      const firstRow = worksheet.getRow(1);
      const hasHeader =
        firstRow.values &&
        Array.isArray(firstRow.values) &&
        firstRow.values.some(
          (cell) =>
            cell &&
            typeof cell === "string" &&
            (cell.toLowerCase().includes("surname") ||
              cell.toLowerCase().includes("name") ||
              cell.toLowerCase().includes("birth")),
        );

      const startRow = hasHeader ? 2 : 1;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < startRow) return;

        const values = row.values;
        if (!values || values.length < 3) return;

        const fullName = String(values[1] || "").trim();
        let surname = "";
        let firstName = "";

        if (fullName) {
          const nameParts = fullName.split(" ");
          if (nameParts.length >= 1) {
            surname = nameParts[0];
          }
          if (nameParts.length >= 2) {
            firstName = nameParts.slice(1).join(" ");
          }
        }

        let birthDate: Date | null = null;

        const birthDateValue = values[2];
        if (birthDateValue instanceof Date) {
          birthDate = birthDateValue;
        } else if (
          typeof birthDateValue === "string" &&
          birthDateValue.includes(".")
        ) {
          const [day, month, year] = birthDateValue.split(".").map(Number);
          if (
            !Number.isNaN(day) &&
            !Number.isNaN(month) &&
            !Number.isNaN(year)
          ) {
            birthDate = new Date(year, month - 1, day, 12);
          }
        }

        if (
          surname &&
          firstName &&
          birthDate &&
          !Number.isNaN(birthDate.getTime())
        ) {
          result.push({
            name: `${surname} ${firstName}`,
            birth_date: birthDate.toISOString().split("T")[0],
          });
        }
      });
    } else {
      const text = await file.text();
      const lines = text.split("\n");

      const hasHeader =
        lines[0].toLowerCase().includes("surname") ||
        lines[0].toLowerCase().includes("name") ||
        lines[0].toLowerCase().includes("birth");

      const startRow = hasHeader ? 1 : 0;

      for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split(",");
        if (columns.length < 3) continue;

        const fullName = columns[0].trim();
        let surname = "";
        let firstName = "";

        if (fullName) {
          const nameParts = fullName.split(" ");
          if (nameParts.length >= 1) {
            surname = nameParts[0];
          }
          if (nameParts.length >= 2) {
            firstName = nameParts.slice(1).join(" ");
          }
        }

        const birthDateStr = columns[1].trim();

        let birthDate: Date | null = null;
        if (birthDateStr.includes(".")) {
          const [day, month, year] = birthDateStr.split(".").map(Number);
          if (
            !Number.isNaN(day) &&
            !Number.isNaN(month) &&
            !Number.isNaN(year)
          ) {
            birthDate = new Date(year, month - 1, day, 12);
          }
        }

        if (
          surname &&
          firstName &&
          birthDate &&
          !Number.isNaN(birthDate.getTime())
        ) {
          result.push({
            name: `${surname} ${firstName}`,
            birth_date: birthDate.toISOString().split("T")[0],
          });
        }
      }
    }

    return result;
  };

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const contacts = await parseExcel(file);

      if (contacts.length === 0) {
        setResult({
          success: false,
          message: "Не удалось найти контакты в файле.",
        });
        return;
      }

      const duplicates = findDuplicates(contacts);

      const uniqueContacts = contacts.filter(
        (c) =>
          !duplicates.some((d) => normalize(d) === normalize(c.name)),
      );

      if (uniqueContacts.length === 0) {
        setResult({
          success: false,
          message:
            duplicates.length === 1
              ? "1 контакт уже есть на сайте."
              : `${duplicates.length} контактов уже есть на сайте.`,
          duplicates,
        });
        return;
      }

      const contactsWithUserId = uniqueContacts.map((contact) => ({
        ...contact,
        user_id: userId,
      }));

      const batchSize = 50;
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < contactsWithUserId.length; i += batchSize) {
        const batch = contactsWithUserId.slice(i, i + batchSize);
        const { error } = await supabase.from("contacts").insert(batch);

        if (error) {
          console.error("Error importing contacts:", error);
          failed += batch.length;
        } else {
          imported += batch.length;
        }
      }

      const parts: string[] = [];
      if (imported > 0) parts.push(`Импортировано: ${imported}`);
      if (failed > 0) parts.push(`Ошибки: ${failed}`);
      if (duplicates.length > 0)
        parts.push(`Дубликатов: ${duplicates.length}`);

      setResult({
        success: imported > 0,
        message: parts.join(". ") + ".",
        imported,
        failed,
        duplicates: duplicates.length > 0 ? duplicates : undefined,
      });

      if (imported > 0) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setResult({
        success: false,
        message:
          "Ошибка при обработке файла. Убедитесь, что это корректный Excel или CSV файл.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 border border-border/30 rounded-xl bg-card/80 backdrop-blur-sm shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Импорт контактов</h2>

      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-2">
          Загрузите файл Excel (.xlsx) или CSV с вашими контактами. Файл должен
          содержать столбцы для фамилии, имени и даты рождения (в формате
          дд.мм.гггг).
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Пример:{" "}
          <code className="bg-card px-1.5 py-0.5 rounded border border-border/30">
            Иванов Иван Иванович,01.05.1990
          </code>
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={handleFileChange}
          className="block w-full text-sm text-foreground
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-primary/10 file:text-primary
            hover:file:bg-primary/20"
        />

        <Button
          onClick={handleImport}
          disabled={!file || isUploading}
          variant="default"
          className="flex items-center gap-2"
        >
          {isUploading ? (
            "Импорт..."
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Импортировать
            </>
          )}
        </Button>
      </div>

      {result && (
        <Alert
          variant={result.success ? "default" : "destructive"}
          className={
            result.success
              ? result.duplicates && result.duplicates.length > 0
                ? "bg-[#FF9F0A]/10 border-[#FF9F0A]/30 text-[#FF9F0A]"
                : "bg-[#30D158]/10 border-[#30D158]/30 text-[#30D158]"
              : "bg-[#FF453A]/10 border-[#FF453A]/30 text-[#FF453A]"
          }
        >
          <div className="flex items-center gap-2">
              {result.success ? (
              result.duplicates && result.duplicates.length > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <AlertTitle>{result.success ? "Готово" : "Ошибка"}</AlertTitle>
          </div>
          <AlertDescription
            className={
              result.success
                ? "text-[#30D158]/90"
                : "text-[#FF453A]/90"
            }
          >
            {result.message}
          </AlertDescription>

          {result.duplicates && result.duplicates.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="flex items-center gap-1.5 text-sm font-medium hover:underline cursor-pointer"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showDuplicates ? "rotate-180" : ""}`}
                />
                {result.duplicates.length === 1
                  ? "1 контакт уже есть на сайте"
                  : `${result.duplicates.length} контактов уже есть на сайте`}
              </button>
              {showDuplicates && (
                <ul className="mt-2 ml-6 list-disc text-sm space-y-0.5">
                  {result.duplicates.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Alert>
      )}
    </div>
  );
}
