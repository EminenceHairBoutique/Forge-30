import type { BookPlanItem } from "@/lib/types";

/** 30-day book plan (Section 5.7). */
export const BOOK_PLAN: BookPlanItem[] = [
  { week: 1, title: "The Psychology of Money", author: "Morgan Housel" },
  { week: 2, title: "Atomic Habits", author: "James Clear" },
  { week: 3, title: "Set Boundaries, Find Peace", author: "Nedra Glover Tawwab" },
  { week: 4, title: "The War of Art", author: "Steven Pressfield" },
  { week: 5, title: "Becoming a Supple Leopard", author: "Kelly Starrett", optional: true },
];
