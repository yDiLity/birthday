// Отображение имени контакта в формате «Фамилия Имя» для разных форматов ввода.
export const displayLastNameFirst = (fullName: string) => {
  const parts = fullName.trim().split(" ");

  // Если только одно слово, возвращаем как есть
  if (parts.length < 2) {
    return fullName;
  }

  // 2 части: скорее всего «Имя Фамилия» -> меняем на «Фамилия Имя»
  // 3 и более частей: предполагаем, что это уже «Фамилия Имя Отчество»
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }

  return fullName;
};
