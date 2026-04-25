import { DEFAULT_LIMIT } from "@/lib/validations";

export interface PaginationParams {
	limit: number;
	offset: number;
}

export interface PaginatedResult<T> {
	data: T[];
	meta: {
		total: number;
		filtered: number;
		returned: number;
		limit: number;
		offset: number;
	};
}

export function parsePaginationParams(
	searchParams: URLSearchParams,
): PaginationParams {
	const limitParam = searchParams.get("limit");
	const offsetParam = searchParams.get("offset");
	const limit = limitParam
		? Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT)
		: DEFAULT_LIMIT;
	const offset = Math.max(0, parseInt(offsetParam ?? "0", 10));
	return { limit, offset };
}

export function paginateItems<T>(
	items: T[],
	{ limit, offset }: PaginationParams,
	total: number,
): PaginatedResult<T> {
	const filtered = items.length;
	const page = items.slice(offset, offset + limit);
	return {
		data: page,
		meta: { total, filtered, returned: page.length, limit, offset },
	};
}

export const CACHE_HEADERS = {
	"Cache-Control": "private, max-age=2, stale-while-revalidate=5",
} as const;
