/**
 * Sorts a drop into the pictures that get in and the reasons the rest do not, so a turned-away drop can be
 * answered. A file that is not a picture is that first, however big it is; a picture only counts toward
 * `room` if it is small enough to be let in.
 * @param {{type: string, size: number}[]} files
 * @param {{room: number, maxBytes: number}} limits how many more pictures fit, and the largest one allowed
 * @returns {{take: object[], refused: ('not-image' | 'too-big' | 'too-many')[]}} each reason once, in the order it was met
 */
export function triage(files, { room, maxBytes }) {
  const take = [], refused = [];
  const refuse = (reason) => { if (!refused.includes(reason)) refused.push(reason); };
  for (const file of files) {
    if (!file.type.startsWith('image/')) refuse('not-image');
    else if (file.size > maxBytes) refuse('too-big');
    else if (take.length >= room) refuse('too-many');
    else take.push(file);
  }
  return { take, refused };
}
