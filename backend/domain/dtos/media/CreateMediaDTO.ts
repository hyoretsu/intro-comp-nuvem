import type { Category, IntlField, LiteraryWorkType } from "../../types";

export class CreateChapterDTO {
	number!: number;
	pages?: number;
	readingTime?: number;
	releaseDate?: Date;
	sourceId!: string;
	title?: IntlField;
}

export class CreateLiteraryWorkDTO {
	currentChapters?: number;
	ongoing?: boolean;
	synopsis?: IntlField;
	tags?: string[];
	title!: IntlField;
	type!: LiteraryWorkType;
}

export class CreateMovieDTO {
	duration?: string;
	releaseDate?: Date;
	title!: IntlField;
}

export class CreateVideoDTO {
	duration?: string;
	link!: string;
	releaseDate?: Date;
	title?: IntlField;
}

export class CreateVideoGameDTO {
	title!: IntlField;
}

export type CreateMediaDTO = {
	image?: File | string;
	noCheck?: boolean;
} & (
	| (CreateChapterDTO & {
			category: Category.CHAPTER;
	  })
	| (CreateLiteraryWorkDTO & {
			category: Category.LITERARY_WORK;
	  })
	| (CreateMovieDTO & {
			category: Category.MOVIE;
	  })
	| (CreateVideoDTO & {
			category: Category.VIDEO;
	  })
	| (CreateVideoGameDTO & {
			category: Category.VIDEO_GAME;
	  })
);

export type CreateMediaDatabaseDTO =
	| (CreateChapterDTO & {
			category: Category.CHAPTER;
	  })
	| (Omit<CreateLiteraryWorkDTO, "currentChapters"> & {
			category: Category.LITERARY_WORK;
			tags: string[];
	  })
	| (Omit<CreateMovieDTO, "duration"> & {
			category: Category.MOVIE;
			duration: number;
	  })
	| (CreateVideoDTO & {
			category: Category.VIDEO;
			channelId: string;
			title: IntlField;
	  })
	| (CreateVideoGameDTO & {
			category: Category.VIDEO_GAME;
	  });
