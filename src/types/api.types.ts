export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string | Record<string, string[]> };

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type SelectOption = {
  value: string;
  label: string;
};

export type SortDirection = "asc" | "desc";

export type SortConfig<T extends string = string> = {
  column: T;
  direction: SortDirection;
};
