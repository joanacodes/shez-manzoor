/** Search results show about 160 characters of a description: add the first closing line that still fits. */
export const describe = (text: string, ...tails: string[]) => {
  const tail = tails.find((t) => text.length + 1 + t.length <= 160);
  return tail ? `${text} ${tail}` : text;
};
