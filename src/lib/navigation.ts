export function parseMenuLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [key, parentKey, label, href, sortOrder, visible] = line.split("|");
      if (!key || !label || !href)
        throw new Error(
          `Navigation line ${index + 1} needs key, label and href.`,
        );
      return {
        key,
        parentKey: parentKey || null,
        label,
        href,
        sortOrder: Number(sortOrder || index),
        isVisible: visible !== "false",
      };
    });
}
