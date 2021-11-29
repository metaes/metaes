const namesParts = <const>[
  "ImportEnvironment",
  "ExportEnvironment",
  "GetImportBindingValue",
  "ImportModule",
  "URLToScript",
  "ExportBinding"
];

export const toFullyQualifiedName = (namePart: string) => `[[${namePart}]]`;
type FullyQualifiedName<N extends string> = `[[${N}]]`;

type valuesOf<T extends readonly string[]> = T[number];

export const intrinsic = namesParts.reduce(
  (names, namePart: string) => ((names[namePart] = toFullyQualifiedName(namePart)), names),
  {} as { [key in valuesOf<typeof namesParts>]: FullyQualifiedName<key> }
);
