"use client";

import type { Tables } from "@/types/supabase";
import { daysUntilBirthday } from "@/lib/birthdays";
import { getDaysText, getBadgeVariant } from "@/lib/birthdays-ui";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Cake } from "lucide-react";
import { formatFullName } from "@/utils/name-formatter";

interface NextBirthdayProps {
  contacts?: Tables<"contacts">[];
  variant?: "full" | "compact";
}

interface ContactWithDays extends Tables<"contacts"> {
  daysUntil: number;
}

export function NextBirthday({
  contacts = [],
  variant = "full",
}: NextBirthdayProps) {
  const [nextBirthday, setNextBirthday] = useState<ContactWithDays | null>(
    null,
  );

  useEffect(() => {
    if (contacts.length === 0) {
      setNextBirthday(null);
      return;
    }

    // Добавляем информацию о днях до дня рождения и сортируем по ближайшей дате
    const contactsWithDays = contacts
      .map((contact) => ({
        ...contact,
        daysUntil: daysUntilBirthday(contact.birth_date),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // Берем ближайший день рождения
    if (contactsWithDays.length > 0) {
      setNextBirthday(contactsWithDays[0]);
    } else {
      setNextBirthday(null);
    }
  }, [contacts]);

  // Компактный вариант для отображения в заголовке
  if (variant === "compact") {
    if (!nextBirthday) {
      return (
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Cake className="h-4 w-4" />
          <span className="text-sm">Нет дней рождений</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <Avatar className="h-6 w-6 border border-border/50">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {formatFullName(nextBirthday.name)
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {formatFullName(nextBirthday.name)}
          </span>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-muted-foreground">
              {new Date(nextBirthday.birth_date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <Badge
              variant={getBadgeVariant(nextBirthday.daysUntil)}
              className="text-xs px-1 py-0"
            >
              {nextBirthday.daysUntil === 1
                ? "Завтра"
                : nextBirthday.daysUntil === 0
                  ? "Сегодня"
                  : `${nextBirthday.daysUntil} дн.`}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Полный вариант для отдельной карточки
  if (!nextBirthday) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/80">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Следующий день рождения
          </CardTitle>
          <Cake className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Cake className="h-5 w-5" />
            <span>Нет предстоящих дней рождения</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Следующий день рождения
        </CardTitle>
        <Cake className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border border-border/50">
            <AvatarFallback className="bg-primary/10 text-primary">
              {formatFullName(nextBirthday.name)
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {formatFullName(nextBirthday.name)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {new Date(nextBirthday.birth_date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <Badge variant={getBadgeVariant(nextBirthday.daysUntil)}>
            {getDaysText(nextBirthday.daysUntil)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
