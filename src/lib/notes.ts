export function isBookReview(id: string) {
  return id.split('/')[0]?.toLowerCase() === 'book-notes';
}

export function formatNoteTitle(title: string) {
  const lowercaseTitle = title.toLocaleLowerCase('en-US');
  return lowercaseTitle.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('en-US'));
}
