/**
 * The image files on a clipboard. A screenshot pasted from the OS arrives as a file item, not in `files`,
 * so items are read first; `files` is only for a clipboard that has no item list.
 * @param {DataTransfer | null | undefined} clipboardData
 * @returns {File[]}
 */
export function imagesFrom(clipboardData) {
  const files = clipboardData?.items
    ? [...clipboardData.items].filter((it) => it.kind === 'file').map((it) => it.getAsFile())
    : [...(clipboardData?.files ?? [])];
  return files.filter((f) => f?.type.startsWith('image/'));
}
