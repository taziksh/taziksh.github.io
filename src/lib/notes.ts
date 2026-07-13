export function isBookReview(id: string) {
  return id.split('/')[0]?.toLowerCase() === 'book-notes';
}
