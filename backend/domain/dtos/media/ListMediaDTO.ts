import { MediaFilters } from "../../repositories";
import type { Category } from "../../types";

export class ListMediaDTO extends MediaFilters {
	category?: Category;
}
