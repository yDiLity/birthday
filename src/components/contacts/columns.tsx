"use client";

import { ContactActions } from "@/components/contacts/contact-actions";
import { ContactNameCell } from "@/components/contacts/contact-name-cell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { daysUntilBirthday } from "@/lib/birthdays";
import type { Tables } from "@/types/supabase";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

// Функция для расчета возраста
const calculateAge = (birthDateStr: string): number => {
  const today = new Date();
  const birthDate = new Date(birthDateStr);

  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth();
  const todayDay = today.getUTCDate();

  let age = todayYear - birthDate.getUTCFullYear();
  const monthDiff = todayMonth - birthDate.getUTCMonth();

  // Если день рождения еще не наступил в этом году
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && todayDay < birthDate.getUTCDate())
  ) {
    age--;
  }

  return age;
};

export function createColumns(userId: string): ColumnDef<Tables<"contacts">>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Выбрать все"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Выбрать строку"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Имя
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <ContactNameCell userId={userId} contact={row.original} />
      ),
      sortingFn: (rowA, rowB, columnId) => {
        // Сортировка по фамилии
        const nameA = rowA.getValue(columnId) as string;
        const nameB = rowB.getValue(columnId) as string;

        // Определяем фамилию для обоих форматов
        const getLastName = (fullName: string) => {
          const parts = fullName.trim().split(" ");
          if (parts.length < 2) return fullName;

          // Если 2 части: Имя Фамилия -> фамилия вторая
          // Если 3+ части: Фамилия Имя Отчество -> фамилия первая
          if (parts.length === 2) {
            return parts[1]; // вторая часть - фамилия
          }
          return parts[0]; // первая часть - фамилия
        };

        const lastNameA = getLastName(nameA);
        const lastNameB = getLastName(nameB);

        return lastNameA.localeCompare(lastNameB, "ru");
      },
    },
    {
      accessorKey: "birth_date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            День рождения
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const birthDate = new Date(row.getValue("birth_date"));
        return (
          <div>
            {birthDate.toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>
        );
      },
      sortingFn: (rowA, rowB, columnId) => {
        // For birth_date, sort by full date including year
        const dateA = new Date(rowA.getValue(columnId));
        const dateB = new Date(rowB.getValue(columnId));

        return dateA.getTime() - dateB.getTime();
      },
    },
    {
      accessorKey: "age",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Возраст
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const age = calculateAge(row.original.birth_date);
        return <div>{age} лет</div>;
      },
      sortingFn: (rowA, rowB, _columnId) => {
        const ageA = calculateAge(rowA.original.birth_date);
        const ageB = calculateAge(rowB.original.birth_date);
        return ageA - ageB;
      },
    },
    {
      accessorKey: "days_until",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Дней до ДР
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const daysUntil = daysUntilBirthday(row.original.birth_date);
        if (daysUntil === 0) {
          return <span className="font-bold text-green-600">Сегодня!</span>;
        }
        if (daysUntil === 1) {
          return <span className="font-medium text-orange-500">Завтра</span>;
        }
        return <span>{daysUntil}</span>;
      },
      sortingFn: (rowA, rowB, _columnId) => {
        const daysUntilA = daysUntilBirthday(rowA.original.birth_date);
        const daysUntilB = daysUntilBirthday(rowB.original.birth_date);
        return daysUntilA - daysUntilB;
      },
    },
    {
      accessorKey: "notes",
      header: "Заметки",
      cell: ({ row }) => (
        <div className="max-w-xs truncate">{row.getValue("notes") || ""}</div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        return <ContactActions userId={userId} contact={row.original} />;
      },
    },
  ];
}
